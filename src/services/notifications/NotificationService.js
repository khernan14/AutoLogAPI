import pool from "../../config/connectionToSql.js";
import NotificationRouter from "./NotificationRouter.js";
import NotificationDispatcher from "./NotificationDispatcher.js";
import crypto from "crypto";

function hashDedupe(clave, payload) {
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify({ clave, payload }));
  return h.digest("hex").slice(0, 64);
}

export default {
  // Crea la notificación, inserta destinatarios y envía de inmediato (sin cola)
  async createAndSend({
    clave,
    severidad,
    payload,
    dedupe_key,
    forzar_grupos = [],
    omit_grupos = [],
    creado_por = null,
  }) {
    const conn = await pool.getConnection();
    let notifId = null;
    try {
      await conn.beginTransaction();

      // 1) Evento activo
      const [ev] = await conn.query(
        "SELECT id, severidad_def, activo FROM eventos_catalogo WHERE clave=? LIMIT 1",
        [clave]
      );
      if (ev.length === 0) throw new Error("Evento no registrado");
      if (ev[0].activo !== 1) {
        // Si está apagado, salimos como suprimida
        return { suppressed: true, reason: "Evento inactivo" };
      }

      const evento = ev[0];

      // 2) Dedupe
      const finalDedupe = dedupe_key || hashDedupe(clave, payload || {});

      // 3) Insert maestro
      const sev = severidad || evento.severidad_def || "medium";
      const [ins] = await conn.query(
        "INSERT INTO notificaciones (evento_id, severidad, payload, dedupe_key, creado_por, estado) VALUES (?, ?, CAST(? AS JSON), ?, ?, 'pending')",
        [evento.id, sev, JSON.stringify(payload || {}), finalDedupe, creado_por]
      );
      notifId = ins.insertId;

      // 4) Resolver destinatarios
      const route = await NotificationRouter.resolveRecipients(conn, {
        evento_id: evento.id,
        severidad: sev,
        forzar_grupos,
        omit_grupos,
      });

      if (!route.recipients.length) {
        await conn.query(
          "UPDATE notificaciones SET estado='suppressed' WHERE id=?",
          [notifId]
        );
        await conn.commit();
        return {
          id: notifId,
          estado: "suppressed",
          queued: false,
          summary: { processed: 0, sent: 0, failed: 0, suppressed: 0 },
        };
      }

      // 5) Insert destinatarios
      const values = route.recipients.map((r) => [
        notifId,
        r.id_usuario,
        r.canal,
        r.direccion_override || null,
        "pending",
        null,
        r.send_after || null,
        null,
        null,
        null,
      ]);
      await conn.query(
        `INSERT INTO notificacion_destinatarios
         (notificacion_id, id_usuario, canal, direccion_override, estado, ultimo_error, send_after, sent_at, delivered_at, read_at)
         VALUES ?`,
        [values]
      );

      await conn.commit();

      // 6) Enviar inmediatamente
      const summary = await NotificationDispatcher.sendAll(notifId);

      return {
        id: notifId,
        estado: summary.state || "queued",
        queued: false,
        summary,
      };
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  },

  async list({ evento, estado, desde, hasta, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const params = [];
    let where = "1=1";
    if (evento) {
      where += " AND e.clave=?";
      params.push(evento);
    }
    if (estado) {
      where += " AND n.estado=?";
      params.push(estado);
    }
    if (desde) {
      where += " AND n.created_at >= ?";
      params.push(desde);
    }
    if (hasta) {
      where += " AND n.created_at < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT n.id, e.clave AS evento, n.severidad, n.estado, n.created_at, n.updated_at
       FROM notificaciones n
       JOIN eventos_catalogo e ON e.id = n.evento_id
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, +limit, +offset]
    );

    const [[{ total } = { total: 0 }]] = await pool.query(
      `SELECT COUNT(*) total
       FROM notificaciones n
       JOIN eventos_catalogo e ON e.id = n.evento_id
       WHERE ${where}`,
      params
    );

    return { page, limit, total, rows };
  },

  async getById(id) {
    const [[head]] = await pool.query(
      `SELECT n.*, e.clave AS evento
       FROM notificaciones n
       JOIN eventos_catalogo e ON e.id = n.evento_id
       WHERE n.id = ?`,
      [id]
    );
    if (!head) return null;

    const [[agg]] = await pool.query(
      `SELECT
         SUM(estado='pending')   AS pending,
         SUM(estado='sent')      AS sent,
         SUM(estado='delivered') AS delivered,
         SUM(estado='failed')    AS failed,
         SUM(estado='suppressed')AS suppressed,
         SUM(estado='bounced')   AS bounced,
         SUM(estado='read')      AS read_count
       FROM notificacion_destinatarios WHERE notificacion_id=?`,
      [id]
    );

    return { ...head, agregados: agg };
  },

  async listRecipients(id, { page = 1, limit = 50, estado }) {
    const offset = (page - 1) * limit;
    const params = [id];
    let where = "nd.notificacion_id = ?";
    if (estado) {
      where += " AND nd.estado = ?";
      params.push(estado);
    }

    const [rows] = await pool.query(
      `SELECT nd.*, u.nombre AS usuario_nombre, u.email
       FROM notificacion_destinatarios nd
       JOIN usuarios u ON u.id_usuario = nd.id_usuario
       WHERE ${where}
       ORDER BY nd.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, +limit, +offset]
    );
    const [[{ total } = { total: 0 }]] = await pool.query(
      `SELECT COUNT(*) total FROM notificacion_destinatarios nd WHERE ${where}`,
      params
    );
    return { page, limit, total, rows };
  },

  async retryFailed(id) {
    const summary = await NotificationDispatcher.sendAll(id, {
      scope: "retry",
    });
    return summary;
  },
};
