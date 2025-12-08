import pool from "../../../config/connectionToSql.js";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const ALLOWED_SECTIONS = [
  "inicio",
  "seguridad",
  "apariencia",
  "idioma",
  "accesibilidad",
  "integraciones",
  "privacidad",
  "backups",
  "acerca",
];

// --- HELPERS ---

function validatePartial(section, partial) {
  if (!ALLOWED_SECTIONS.includes(section)) {
    return { ok: false, msg: `Sección inválida: ${section}` };
  }

  // Nunca permitir cambiar contraseña o secretos vía PATCH /settings/:section
  if (section === "seguridad") {
    if (
      "password" in partial ||
      "newPassword" in partial ||
      "currentPassword" in partial
    ) {
      return {
        ok: false,
        msg: "No está permitido cambiar contraseñas o credenciales desde este endpoint. Usa el endpoint dedicado.",
      };
    }
  }

  const forbidden = [
    "user_id",
    "id_usuario",
    "version",
    "created_at",
    "updated_at",
  ];
  for (const f of forbidden) {
    if (f in partial) {
      return { ok: false, msg: `Campo no permitido en payload: ${f}` };
    }
  }

  if (section === "apariencia" && partial.theme) {
    if (!["light", "dark"].includes(partial.theme)) {
      return { ok: false, msg: "Valor de theme inválido" };
    }
  }

  return { ok: true };
}

function deepMerge(target = {}, patch = {}) {
  // Aseguramos que target sea un objeto si viene null/undefined
  const t = target || {};
  const out = Array.isArray(t) ? [...t] : { ...t };

  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      t[key] &&
      typeof t[key] === "object" &&
      !Array.isArray(t[key])
    ) {
      out[key] = deepMerge(t[key], pv);
    } else {
      out[key] = pv;
    }
  }
  return out;
}

// --- CONTROLLERS ---

export const getAllSettings = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.rol;
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id, 10)
      : requesterId;

    if (req.query.user_id && requesterRole !== "Admin") {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    // ✨ MEJORA: Usamos LEFT JOIN para traer Defaults y Settings del usuario en una sola consulta.
    // Si el usuario no tiene settings (u.payload es NULL), usaremos d.payload.
    const query = `
      SELECT 
        d.section_key, 
        d.payload as default_payload, 
        u.payload as user_payload
      FROM settings_defaults d
      LEFT JOIN user_settings u 
        ON d.section_key = u.section_key 
        AND u.user_id = ?
      WHERE d.section_key IN (?)
    `;

    const [rows] = await pool.query(query, [targetUserId, ALLOWED_SECTIONS]);

    const out = {};
    for (const r of rows) {
      // ✨ MEJORA: Merge inteligente. Base = Default, Sobre = Usuario.
      const defaults = r.default_payload || {};
      const userConfig = r.user_payload || {};
      out[r.section_key] = deepMerge(defaults, userConfig);
    }

    return res.json({ ok: true, data: out });
  } catch (error) {
    console.error("getAllSettings error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
};

export const getSection = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.rol;
    const { section } = req.params;
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id, 10)
      : requesterId;

    if (req.query.user_id && requesterRole !== "Admin") {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    if (!ALLOWED_SECTIONS.includes(section)) {
      return res.status(400).json({ ok: false, message: "Sección inválida" });
    }

    // ✨ MEJORA: Traemos Default y User en una sola consulta
    const query = `
      SELECT 
        d.payload as default_payload, 
        u.payload as user_payload
      FROM settings_defaults d
      LEFT JOIN user_settings u 
        ON d.section_key = u.section_key 
        AND u.user_id = ?
      WHERE d.section_key = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(query, [targetUserId, section]);

    if (rows.length === 0) {
      // Si no existe ni en defaults, devolvemos vacío (o error 404 si prefieres)
      return res.json({ ok: true, data: {} });
    }

    const defaults = rows[0].default_payload || {};
    const userConfig = rows[0].user_payload || {};

    // Fusionamos
    const finalPayload = deepMerge(defaults, userConfig);

    return res.json({ ok: true, data: finalPayload });
  } catch (error) {
    console.error("getSection error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
};

export const patchSection = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.rol;
    const { section } = req.params;
    const partial = req.body || {};

    // Determinar ID del usuario objetivo (Admin puede editar otros, usuario normal solo a sí mismo)
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id, 10)
      : requesterId;

    if (req.query.user_id && requesterRole !== "Admin") {
      connection.release();
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    // Validación básica del payload
    const v = validatePartial(section, partial);
    if (!v.ok) {
      connection.release();
      return res.status(400).json({ ok: false, message: v.msg });
    }

    await connection.beginTransaction();

    // =================================================================
    // 🛡️ LÓGICA ESPECIAL DE SEGURIDAD (2FA)
    // =================================================================
    if (section === "seguridad") {
      // CASO A: INICIAR ENROLAMIENTO (Generar Secreto + QR)
      if (partial.tfa_enroll_init) {
        try {
          const secret = authenticator.generateSecret();

          // Obtenemos el email del usuario para la etiqueta del Authenticator
          // (Podrías sacarlo de req.user.email si tu JWT lo trae, o consultar DB)
          const [uRows] = await connection.query(
            "SELECT email FROM usuarios WHERE id_usuario = ?",
            [targetUserId]
          );
          const userEmail = uRows[0]?.email || "usuario@autolog";

          // Guardamos secreto temporalmente (pero tfa_enabled = 0 hasta verificar)
          await connection.query(
            "UPDATE usuarios SET tfa_secret = ?, tfa_enabled = 0 WHERE id_usuario = ?",
            [secret, targetUserId]
          );

          // Generar URL para QR (otpauth://...)
          const otpauth = authenticator.keyuri(userEmail, "AutoLog", secret);
          const qrImage = await QRCode.toDataURL(otpauth);

          await connection.commit();
          connection.release();

          // Retornamos de inmediato, no guardamos nada en user_settings JSON todavía
          return res.json({
            ok: true,
            action: "enroll",
            data: { qr_image: qrImage, secret: secret },
          });
        } catch (err) {
          throw new Error("Error generando 2FA: " + err.message);
        }
      }

      // CASO B: VERIFICAR CÓDIGO Y ACTIVAR DEFINITIVAMENTE
      if (partial.tfa_enroll_verify) {
        const { token } = partial;

        // Recuperar secreto de DB
        const [uRows] = await connection.query(
          "SELECT tfa_secret FROM usuarios WHERE id_usuario = ?",
          [targetUserId]
        );
        const dbSecret = uRows[0]?.tfa_secret;

        if (!dbSecret) {
          connection.release(); // No olvides liberar si retornas temprano sin rollback manual
          return res.status(400).json({
            ok: false,
            message:
              "No hay configuración de 2FA iniciada. Reinicia el proceso.",
          });
        }

        const isValid = authenticator.check(token, dbSecret);
        if (!isValid) {
          // Importante: No hacemos rollback porque queremos que el usuario pueda reintentar con el mismo secreto
          await connection.rollback(); // Rollback de la transacción iniciada arriba para limpiar estado SQL
          connection.release();
          return res
            .status(400)
            .json({ ok: false, message: "Código incorrecto o expirado." });
        }

        // ¡Código válido! Activamos en la tabla de usuarios
        await connection.query(
          "UPDATE usuarios SET tfa_enabled = 1 WHERE id_usuario = ?",
          [targetUserId]
        );

        // Limpiamos el payload para que en el JSON de settings solo quede el estado visual
        delete partial.tfa_enroll_verify;
        delete partial.token;
        delete partial.secret; // Por si acaso venía

        // Forzamos que el switch visual en el JSON quede encendido
        partial.tfa_enabled = true;
      }

      // CASO C: DESACTIVAR 2FA (Switch OFF)
      if (partial.tfa_enabled === false) {
        await connection.query(
          "UPDATE usuarios SET tfa_enabled = 0, tfa_secret = NULL WHERE id_usuario = ?",
          [targetUserId]
        );
        // Dejamos que el flujo continúe para guardar "tfa_enabled: false" en el JSON settings
      }
    }
    // =================================================================
    // FIN LÓGICA ESPECIAL
    // =================================================================

    // 1. Obtener defaults (para integridad del merge)
    const [defaultRows] = await connection.query(
      "SELECT payload FROM settings_defaults WHERE section_key = ?",
      [section]
    );
    const defaultPayload = defaultRows.length > 0 ? defaultRows[0].payload : {};

    // 2. Obtener configuración actual del usuario (Bloqueo Pesimista para evitar Race Conditions)
    const [existingRows] = await connection.query(
      "SELECT id, payload, version FROM user_settings WHERE user_id = ? AND section_key = ? LIMIT 1 FOR UPDATE",
      [targetUserId, section]
    );

    let newPayload;
    let settingsId = null;
    let newVersion = 1;

    if (existingRows.length === 0) {
      // Crear nueva configuración (Base Default + Parcial Usuario)
      newPayload = deepMerge(defaultPayload, partial);

      const [ins] = await connection.query(
        "INSERT INTO user_settings (user_id, section_key, payload, version, updated_by) VALUES (?, ?, ?, 1, ?)",
        [targetUserId, section, JSON.stringify(newPayload), requesterId]
      );
      settingsId = ins.insertId;
      newVersion = 1;
    } else {
      // Actualizar existente
      const row = existingRows[0];
      settingsId = row.id;
      const currentPayload = row.payload || {};
      const currentVersion = row.version || 1;

      // Merge: Lo que ya tenía + Lo nuevo
      newPayload = deepMerge(currentPayload, partial);
      newVersion = currentVersion + 1;

      await connection.query(
        "UPDATE user_settings SET payload = ?, version = ?, updated_by = ? WHERE id = ?",
        [JSON.stringify(newPayload), newVersion, requesterId, settingsId]
      );
    }

    // 3. Guardar en Historial (Auditoría)
    await connection.query(
      "INSERT INTO user_settings_history (user_settings_id, user_id, section_key, payload, changed_by, change_reason, change_meta) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        settingsId,
        targetUserId,
        section,
        JSON.stringify(newPayload),
        requesterId,
        "PATCH /api/settings",
        JSON.stringify({
          ip: req.ip,
          ua: req.headers["user-agent"] || null,
        }),
      ]
    );

    await connection.commit();
    connection.release();

    // Retornamos el payload actualizado
    return res.json({ ok: true, data: newPayload, version: newVersion });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {}
      connection.release();
    }

    console.error("patchSection error:", error);

    if (error && error.code === "ER_LOCK_DEADLOCK") {
      return res.status(503).json({
        ok: false,
        message: "Bloqueo temporal en base de datos, intenta de nuevo.",
      });
    }

    return res.status(500).json({ ok: false, message: error.message });
  }
};

export const getSectionHistory = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.rol;
    const { section } = req.params;
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id, 10)
      : requesterId;

    if (req.query.user_id && requesterRole !== "Admin") {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    if (!ALLOWED_SECTIONS.includes(section)) {
      return res.status(400).json({ ok: false, message: "Sección inválida" });
    }

    // Paginación básica
    const limit = parseInt(req.query.limit || "50", 10);
    const offset = parseInt(req.query.offset || "0", 10);

    const [rows] = await pool.query(
      `SELECT id, user_settings_id, payload, changed_by, change_reason, change_meta, created_at
       FROM user_settings_history
       WHERE user_id = ? AND section_key = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [targetUserId, section, limit, offset]
    );

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getSectionHistory error:", error);
    return res.status(500).json({ ok: false, message: error.message });
  }
};
