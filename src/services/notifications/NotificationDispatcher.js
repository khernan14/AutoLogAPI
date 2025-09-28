import pool from "../../config/connectionToSql.js";
import TemplateService from "./TemplateService.js";
import { sendMail } from "../mail.service.js"; // <-- tu servicio actual

export default {
  // Envía todos los pendientes (o los fallidos, si scope='retry') de una notificación
  async sendAll(notifId, { scope = "normal" } = {}) {
    const conn = await pool.getConnection();
    try {
      const [[n]] = await conn.query(
        `SELECT n.*, e.clave AS evento_clave
         FROM notificaciones n
         JOIN eventos_catalogo e ON e.id = n.evento_id
         WHERE n.id=?`,
        [notifId]
      );
      if (!n) return { processed: 0, sent: 0, failed: 0, suppressed: 0 };

      const estados =
        scope === "retry" ? ["failed", "bounced", "suppressed"] : ["pending"];
      const [dest] = await conn.query(
        `SELECT nd.*, u.email, u.nombre
         FROM notificacion_destinatarios nd
         JOIN usuarios u ON u.id_usuario = nd.id_usuario
         WHERE nd.notificacion_id=? AND nd.estado IN (?)`,
        [notifId, estados]
      );

      if (!dest.length) {
        await conn.query(
          "UPDATE notificaciones SET estado='delivered' WHERE id=? AND estado<>'delivered'",
          [notifId]
        );
        return { processed: 0, sent: 0, failed: 0, suppressed: 0 };
      }

      let sent = 0,
        failed = 0,
        suppressed = 0;

      for (const d of dest) {
        try {
          if (d.canal === "email") {
            const tpl = await TemplateService.render({
              evento_clave: n.evento_clave,
              canal: "email",
              payload: n.payload,
            });

            const resp = await sendMail({
              from: "noReply", // usa tu noReplyTransporter
              to: d.direccion_override || d.email,
              subject: tpl.subject || `Notificación ${n.evento_clave}`,
              html:
                tpl.html || `<pre>${JSON.stringify(n.payload, null, 2)}</pre>`,
            });

            if (resp?.success) {
              await conn.query(
                `UPDATE notificacion_destinatarios
                 SET estado='sent', sent_at=NOW(), ultimo_error=NULL
                 WHERE id=?`,
                [d.id]
              );
              await conn.query(
                `INSERT INTO notificacion_intentos
                 (destinatario_id, intento_num, provider_message_id, provider_response, estado)
                 VALUES (
                   ?, (SELECT COALESCE(MAX(i.intento_num),0)+1 FROM notificacion_intentos i WHERE i.destinatario_id=?),
                   ?, CAST(? AS JSON), 'sent'
                 )`,
                [d.id, d.id, resp.messageId || null, JSON.stringify(resp || {})]
              );
              sent++;
            } else {
              throw new Error(resp?.error?.message || "Fallo al enviar correo");
            }
          } else {
            await conn.query(
              `UPDATE notificacion_destinatarios
               SET estado='suppressed', ultimo_error='Canal no implementado'
               WHERE id=?`,
              [d.id]
            );
            suppressed++;
          }
        } catch (e) {
          await conn.query(
            `UPDATE notificacion_destinatarios
             SET estado='failed', ultimo_error=?
             WHERE id=?`,
            [String(e.message || e).slice(0, 500), d.id]
          );
          await conn.query(
            `INSERT INTO notificacion_intentos
             (destinatario_id, intento_num, estado, error_msg)
             VALUES (?, (SELECT COALESCE(MAX(i.intento_num),0)+1 FROM notificacion_intentos i WHERE i.destinatario_id=?), 'failed', ?)`,
            [d.id, d.id, String(e.message || e).slice(0, 1000)]
          );
          failed++;
        }
      }

      const [[agg]] = await conn.query(
        `SELECT SUM(estado IN ('pending','failed','bounced','suppressed')) AS remain
         FROM notificacion_destinatarios
         WHERE notificacion_id=?`,
        [notifId]
      );
      const nuevo = agg.remain > 0 ? "queued" : "delivered";
      await conn.query("UPDATE notificaciones SET estado=? WHERE id=?", [
        nuevo,
        notifId,
      ]);

      return { processed: dest.length, sent, failed, suppressed, state: nuevo };
    } finally {
      conn.release();
    }
  },
};
