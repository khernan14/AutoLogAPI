import pool from "../../config/connectionToSql.js";
// Reutiliza tu renderer de archivos .html
import { renderHtmlTemplate } from "../../helpers/templateRenderer.js";

// Mapeo a archivos .html como fallback (ajusta nombres si cambian)
const FILE_TEMPLATES = {
  VEHICULO_SALIDA: {
    file: "notificationSalida.html",
    subject: "Salida de vehículo {{vehiculo_placa}}",
  },
  VEHICULO_REGRESO: {
    file: "notificationRegreso.html",
    subject: "Regreso de vehículo {{vehiculo_placa}}",
  },
};

function renderVars(s = "", payload = {}) {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => payload?.[k] ?? "");
}

async function getEventoIdByClave(conn, clave) {
  const [[ev]] = await conn.query(
    "SELECT id FROM eventos_catalogo WHERE clave=? LIMIT 1",
    [clave]
  );
  return ev?.id || null;
}

export default {
  /**
   * Render DB-first: busca plantilla default (evento+canal+locale) en tabla `plantillas`.
   * Si no hay, fallback a archivo .html usando tu renderer.
   */
  async render({
    evento_clave,
    evento_id,
    canal = "email",
    locale = "es",
    payload = {},
  }) {
    const conn = await pool.getConnection();
    try {
      let evId = evento_id || null;
      if (!evId && evento_clave)
        evId = await getEventoIdByClave(conn, evento_clave);

      if (evId) {
        const [[tpl]] = await conn.query(
          `SELECT asunto, cuerpo, metadata
           FROM plantillas
           WHERE evento_id=? AND canal=? AND locale=? AND activo=1 AND es_default=1
           ORDER BY version DESC
           LIMIT 1`,
          [evId, canal, locale]
        );
        if (tpl) {
          return {
            subject: renderVars(tpl.asunto || `Notificación`, payload),
            html: renderVars(
              tpl.cuerpo || `<pre>${JSON.stringify(payload, null, 2)}</pre>`,
              payload
            ),
            metadata: tpl.metadata || null,
          };
        }
      }

      // Fallback a archivo
      const key = evento_clave || "DEFAULT";
      const cfg = FILE_TEMPLATES[key];
      if (cfg && canal === "email") {
        try {
          const html = renderHtmlTemplate(cfg.file, payload);
          const subject = renderVars(cfg.subject, payload);
          return { subject, html, metadata: null };
        } catch (_) {
          // si no existe el archivo, seguimos al genérico
        }
      }

      // Fallback genérico
      return {
        subject: `Notificación ${evento_clave || ""}`.trim(),
        html: `<pre>${payload ? JSON.stringify(payload, null, 2) : ""}</pre>`,
        metadata: null,
      };
    } finally {
      conn.release();
    }
  },
};
