import pool from "../../config/connectionToSql.js";
import TemplateService from "../../services/notifications/TemplateService.js";
import { renderEmailTemplate } from "../../lib/templateRenderer.js";
import { sendMail } from "../../services/mail.service.js";

function toInt(v, d = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

async function getEventoIdByClave(conn, clave) {
  const [[ev]] = await conn.query(
    "SELECT id FROM eventos_catalogo WHERE clave=? LIMIT 1",
    [clave]
  );
  return ev?.id || null;
}

// ===== Listar
export const listPlantillas = async (req, res) => {
  try {
    const {
      evento,
      canal = "email",
      locale = "es",
      activo,
      page = 1,
      limit = 50,
    } = req.query;

    const p = [];
    let where = "1=1";

    if (evento) {
      where += " AND (e.clave LIKE ?)";
      p.push(`%${evento}%`);
    }
    if (canal) {
      where += " AND p.canal = ?";
      p.push(canal);
    }
    if (locale) {
      where += " AND p.locale = ?";
      p.push(locale);
    }
    // <-- NUEVO: filtrar por activo si viene especificado
    if (typeof activo !== "undefined" && activo !== "") {
      where += " AND p.activo = ?";
      p.push(activo === "true" || activo === "1" ? 1 : 0);
    } else {
      // por default solo activas
      where += " AND p.activo = 1";
    }

    const offset = (Number(page || 1) - 1) * Number(limit || 50);

    const [rows] = await pool.query(
      `SELECT
         p.id, p.evento_id, e.clave AS evento, p.canal, p.locale, p.version,
         p.asunto, p.cuerpo, p.metadata, p.es_default, p.activo, p.created_at
       FROM plantillas p
       JOIN eventos_catalogo e ON e.id = p.evento_id
       WHERE ${where}
       ORDER BY e.clave ASC, p.locale ASC, p.version DESC
       LIMIT ? OFFSET ?`,
      [...p, Number(limit || 50), offset]
    );

    const [[{ total } = { total: 0 }]] = await pool.query(
      `SELECT COUNT(*) total
       FROM plantillas p
       JOIN eventos_catalogo e ON e.id = p.evento_id
       WHERE ${where}`,
      p
    );

    res.json({
      page: Number(page || 1),
      limit: Number(limit || 50),
      total,
      rows,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ===== Crear (nueva versión implícita)
export const createPlantilla = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      evento_clave,
      evento_id,
      canal = "email",
      locale = "es",
      asunto,
      cuerpo,
      metadata,
    } = req.body || {};
    if (!asunto?.trim() || !cuerpo?.trim())
      return res
        .status(400)
        .json({ message: "asunto y cuerpo son requeridos" });

    let evId = evento_id || null;
    if (!evId && evento_clave)
      evId = await getEventoIdByClave(conn, evento_clave);
    if (!evId)
      return res
        .status(400)
        .json({ message: "evento_id o evento_clave inválido" });

    const [[{ maxv }]] = await conn.query(
      "SELECT COALESCE(MAX(version),0) AS maxv FROM plantillas WHERE evento_id=? AND canal=? AND locale=?",
      [evId, canal, locale]
    );

    const nextVersion = (maxv || 0) + 1;
    const [ins] = await conn.query(
      `INSERT INTO plantillas (evento_id, canal, locale, version, asunto, cuerpo, es_default, activo, metadata)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`,
      [
        evId,
        canal,
        locale,
        nextVersion,
        asunto,
        cuerpo,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    const [[row]] = await conn.query("SELECT * FROM plantillas WHERE id=?", [
      ins.insertId,
    ]);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
};

// ===== Actualizar (en sitio; si quieres versionado estricto, crea nueva en lugar de PUT)
export const updatePlantilla = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { asunto, cuerpo, metadata } = req.body || {};
    const [[exists]] = await pool.query(
      "SELECT id FROM plantillas WHERE id=? AND activo=1",
      [id]
    );
    if (!exists)
      return res.status(404).json({ message: "Plantilla no encontrada" });

    await pool.query(
      "UPDATE plantillas SET asunto=COALESCE(?, asunto), cuerpo=COALESCE(?, cuerpo), metadata=COALESCE(?, metadata) WHERE id=?",
      [
        asunto ?? null,
        cuerpo ?? null,
        typeof metadata === "undefined" ? null : JSON.stringify(metadata),
        id,
      ]
    );
    const [[row]] = await pool.query("SELECT * FROM plantillas WHERE id=?", [
      id,
    ]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ===== Eliminar (soft)
export const deletePlantilla = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    await pool.query("UPDATE plantillas SET activo=0 WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ===== Publicar como default
export const publishPlantilla = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = toInt(req.params.id);
    const [[tpl]] = await conn.query(
      "SELECT id, evento_id, canal, locale FROM plantillas WHERE id=? AND activo=1",
      [id]
    );
    if (!tpl)
      return res.status(404).json({ message: "Plantilla no encontrada" });

    await conn.beginTransaction();
    await conn.query(
      "UPDATE plantillas SET es_default=0 WHERE evento_id=? AND canal=? AND locale=?",
      [tpl.evento_id, tpl.canal, tpl.locale]
    );
    await conn.query("UPDATE plantillas SET es_default=1 WHERE id=?", [id]);
    await conn.commit();

    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
};

// ===== Preview (render con payload)
export const previewPlantilla = async (req, res) => {
  try {
    const { evento_clave, canal = "email", locale = "es" } = req.body || {};
    const payload = req.body?.payload || {};

    // Buscar default publicada
    const [rows] = await pool.query(
      `SELECT p.*, e.clave AS evento
       FROM plantillas p
       JOIN eventos_catalogo e ON e.id = p.evento_id
       WHERE e.clave = ? AND p.canal = ? AND p.locale = ? AND p.es_default = 1 AND p.activo = 1
       ORDER BY p.version DESC
       LIMIT 1`,
      [evento_clave, canal, locale]
    );

    if (!rows.length) {
      // fallback (sin plantilla)
      return res.json({
        subject: `Notificación ${evento_clave}`,
        html: `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${escapeHtml(
          JSON.stringify(payload, null, 2)
        )}</pre>`,
      });
    }

    const p = rows[0];
    let metadata = {};
    try {
      metadata = p.metadata
        ? typeof p.metadata === "string"
          ? JSON.parse(p.metadata)
          : p.metadata
        : {};
    } catch (_) {
      metadata = {};
    }

    const { subject, html } = renderEmailTemplate({
      subjectTpl: p.asunto,
      bodyTpl: p.cuerpo,
      payload,
      metadata,
    });

    res.json({ subject, html });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== Test (envía una plantilla específica por id)
export const testPlantilla = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { to_email, payload = {} } = req.body || {};

    const [[p]] = await pool.query(
      `SELECT p.*, e.clave AS evento
       FROM plantillas p
       JOIN eventos_catalogo e ON e.id = p.evento_id
       WHERE p.id = ?`,
      [id]
    );
    if (!p) return res.status(404).json({ message: "Plantilla no encontrada" });

    let metadata = {};
    try {
      metadata = p.metadata
        ? typeof p.metadata === "string"
          ? JSON.parse(p.metadata)
          : p.metadata
        : {};
    } catch (_) {
      metadata = {};
    }

    const { subject, html } = renderEmailTemplate({
      subjectTpl: p.asunto,
      bodyTpl: p.cuerpo,
      payload,
      metadata,
    });

    // usa tu mailer/service existente
    await mailService.sendEmail({
      to: to_email,
      subject,
      html,
      // opcional: from, replyTo desde metadata
      from: metadata.from || process.env.MAIL_FROM,
      replyTo: metadata.reply_to || undefined,
      cc: metadata.cc || undefined,
      bcc: metadata.bcc || undefined,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const setPlantillaEstado = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { activo } = req.body || {};
    const val =
      activo === true || activo === 1 || activo === "1" || activo === "true"
        ? 1
        : 0;

    await pool.query("UPDATE plantillas SET activo=? WHERE id=?", [val, id]);
    const [[row]] = await pool.query(
      `SELECT p.*, e.clave AS evento
       FROM plantillas p JOIN eventos_catalogo e ON e.id = p.evento_id
       WHERE p.id=?`,
      [id]
    );
    if (!row)
      return res.status(404).json({ message: "Plantilla no encontrada" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
