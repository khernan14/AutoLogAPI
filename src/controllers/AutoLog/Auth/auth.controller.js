import { authenticator } from "otplib";
import { sendLoginAlert } from "../../../services/auth/SecurityService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../../config/connectionToSql.js";

// Helpers
const sendError = (res, status, msg) => res.status(status).json({ error: msg });
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// Obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_usuarios('ListarUsuariosActivos', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error("getUsers error:", error);
    return sendError(res, 500, "Error interno");
  }
};

export const getUsersById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (Number.isNaN(id)) return sendError(res, 400, "ID inválido");

    const [rows] = await pool.execute(
      "CALL gestion_usuarios('Perfil', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error("getUsersById error:", error);
    return sendError(res, 500, "Error interno");
  }
};

export const getEmailSupervisor = async (req, res) => {
  const id = toInt(req.query.id_empleado); // o req.body si lo prefieres
  if (Number.isNaN(id))
    return sendError(res, 400, "Falta o es inválido id_empleado");

  try {
    const [rows] = await pool.execute(
      `SELECT 
        e.id AS empleado_id,
        ue.nombre AS empleado_nombre,
        ue.email AS empleado_email,
        e.supervisor_id,
        us.nombre AS supervisor_nombre,
        us.email AS supervisor_email
      FROM empleados e
      LEFT JOIN usuarios ue ON e.id_usuario = ue.id_usuario
      LEFT JOIN empleados s ON e.supervisor_id = s.id
      LEFT JOIN usuarios us ON s.id_usuario = us.id_usuario
      WHERE e.id = ?`,
      [id]
    );

    if (!rows.length) return sendError(res, 404, "Empleado no encontrado");
    return res.json(rows[0]);
  } catch (error) {
    console.error("getEmailSupervisor error:", error);
    return sendError(res, 500, "Error interno");
  }
};

// Registro de un nuevo usuario
export const register = async (req, res) => {
  const {
    nombre,
    email,
    username,
    password,
    rol,
    puesto,
    id_ciudad,
    supervisor_id,
  } = req.body;

  try {
    if (!nombre || !email || !username || !password || !rol) {
      return sendError(res, 400, "Datos incompletos");
    }
    const idCiudadNum = id_ciudad != null ? toInt(id_ciudad) : null;
    const supervisorNum = supervisor_id != null ? toInt(supervisor_id) : null;
    if (id_ciudad != null && Number.isNaN(idCiudadNum)) {
      return sendError(res, 400, "id_ciudad inválido");
    }
    if (supervisor_id != null && Number.isNaN(supervisorNum)) {
      return sendError(res, 400, "supervisor_id inválido");
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    await pool.execute(
      "CALL gestion_usuarios('Registrar', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        nombre,
        email,
        username,
        hashedPassword,
        rol,
        "Activo",
        puesto ?? null,
        idCiudadNum,
        supervisorNum,
      ]
    );

    return res
      .status(201)
      .json({ message: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("register error:", error);
    // Si el SP lanza SIGNAL (email duplicado), cae aquí; responde genérico
    return sendError(res, 500, "Error interno");
  }
};

// Inicio de sesión
export const login = async (req, res) => {
  try {
    const { username, password, code } = req.body ?? {};
    if (!username || !password) {
      return sendError(res, 400, "Credenciales inválidas");
    }

    const [rows] = await pool.execute(
      "CALL gestion_usuarios('Login', NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL)",
      [username]
    );

    const user = rows?.[0]?.[0] || null;
    if (!user) return sendError(res, 401, "Credenciales inválidas");

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return sendError(res, 401, "Credenciales inválidas");

    // === LÓGICA 2FA ===
    // 1. Verificar si tiene 2FA habilitado en DB (columna nueva)
    if (user.tfa_enabled === 1) {
      if (!code) {
        return res.json({
          require_2fa: true,
          message: "Se requiere código de verificación",
          temp_token: jwt.sign(
            { id: user.id_usuario, partial: true },
            process.env.JWT_SECRET,
            { expiresIn: "5m" }
          ),
        });
      }

      // Si mandó código, verificarlo
      const isValid = authenticator.check(code, user.tfa_secret);
      if (!isValid) {
        return sendError(res, 401, "Código 2FA incorrecto");
      }
    }

    // === FIN LÓGICA 2FA (Si pasa, generamos token real) ===

    // Obtener permisos
    const [permisosRows] = await pool.execute(
      `SELECT p.nombre FROM usuario_permisos up INNER JOIN permisos p ON up.permiso_id = p.id WHERE up.id_usuario = ?`,
      [user.id_usuario]
    );
    const permisos = permisosRows.map((p) => p.nombre);
    const tokenVersion =
      typeof user.token_version !== "undefined"
        ? Number(user.token_version)
        : 0;

    const token = jwt.sign(
      { id: user.id_usuario, rol: user.rol, tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      partitioned: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    });

    try {
      const ip =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
      const userAgent = req.headers["user-agent"] || "Dispositivo Desconocido";

      let deviceName = "Escritorio";
      if (/mobile/i.test(userAgent)) deviceName = "Móvil";
      else if (/windows/i.test(userAgent)) deviceName = "Windows PC";
      else if (/mac/i.test(userAgent)) deviceName = "Mac";

      const tokenSignature = token.split(".")[2];
      await pool.execute(
        `INSERT INTO user_sessions (user_id, token_signature, ip_address, device_info) 
         VALUES (?, ?, ?, ?)`,
        [user.id_usuario, tokenSignature, ip, userAgent]
      );
      await pool.execute(
        `INSERT INTO activity_logs (user_id, action, ip_address, device_info) 
         VALUES (?, ?, ?, ?)`,
        [user.id_usuario, "Inicio de sesión exitoso", ip, userAgent]
      );
    } catch (dbError) {
      console.error("Error guardando sesión/log:", dbError);
    }

    try {
      const [settingRows] = await pool.query(
        "SELECT payload FROM user_settings WHERE user_id = ? AND section_key = 'seguridad'",
        [user.id_usuario]
      );
      const loginAlertsEnabled =
        settingRows.length > 0
          ? settingRows[0].payload.login_alerts ?? true
          : true;

      if (loginAlertsEnabled) {
        sendLoginAlert(user, req);
      }
    } catch (e) {
      console.error("Error verificando settings para alerta:", e);
    }

    return res.json({
      message: "Inicio de sesión exitoso",
      rol: user.rol,
      nombre: user.nombre,
      id: user.id_usuario,
      id_empleado: user.id,
      email: user.email,
      permisos,
    });
  } catch (error) {
    console.error("login error:", error);
    return sendError(res, 500, "Error interno");
  }
};

// Endpoint /me: obtiene datos actualizados del usuario desde BD (lee cookie o header via middleware)
export const me = async (req, res) => {
  try {
    // Si authenticate middleware ya adjunta req.user con id, úsalo.
    // Pero soportamos también caso donde no se ejecuta el middleware: leer token de cookie aquí.
    let userId = req.user?.id;

    if (!userId) {
      // intentar leer token de cookie/manual (fallback)
      const token = req.cookies?.token || null;
      if (!token) return sendError(res, 401, "No autenticado");
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return sendError(res, 401, "Token inválido o expirado");
      }
      userId = payload.id;
    }

    // Obtener usuario fresco desde BD usando tu SP 'Perfil' (como ya tenías)
    const [rows] = await pool.execute(
      "CALL gestion_usuarios('Perfil', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [userId]
    );
    const user = rows?.[0]?.[0] || null;
    if (!user) return sendError(res, 401, "No autenticado");

    const [permisosRows] = await pool.execute(
      `SELECT p.nombre
       FROM usuario_permisos up
       INNER JOIN permisos p ON up.permiso_id = p.id
       WHERE up.id_usuario = ?`,
      [user.id_usuario]
    );
    const permisos = permisosRows.map((p) => p.nombre);

    return res.json({
      rol: user.rol,
      nombre: user.nombre,
      id: user.id_usuario,
      id_empleado: user.id,
      email: user.email,
      permisos,
      tokenVersion: user.token_version ?? 0, // opcional exponer para debugging
    });
  } catch (err) {
    console.error("me error:", err);
    return sendError(res, 500, "Error interno");
  }
};

// Logout: borrar cookie httpOnly
export const logout = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.json({ message: "Sesión cerrada" });
  } catch (err) {
    console.error("logout error:", err);
    return sendError(res, 500, "Error interno");
  }
};

// Actualizar un usuario (admin/similar)
export const updateUser = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return sendError(res, 400, "ID inválido");

  const {
    nombre,
    email,
    username,
    password,
    rol,
    puesto,
    estatus,
    id_ciudad,
    supervisor_id,
  } = req.body;

  try {
    const hashedPassword =
      password && String(password).length
        ? await bcrypt.hash(String(password), 10)
        : null;

    const idCiudadNum = id_ciudad != null ? toInt(id_ciudad) : null;
    const supervisorNum = supervisor_id != null ? toInt(supervisor_id) : null;
    if (id_ciudad != null && Number.isNaN(idCiudadNum)) {
      return sendError(res, 400, "id_ciudad inválido");
    }
    if (supervisor_id != null && Number.isNaN(supervisorNum)) {
      return sendError(res, 400, "supervisor_id inválido");
    }

    await pool.execute(
      "CALL gestion_usuarios('Actualizar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        nombre ?? null,
        email ?? null,
        username ?? null,
        hashedPassword, // null si no se envía -> SP preserva
        rol ?? null,
        estatus ?? null,
        puesto ?? null,
        idCiudadNum,
        supervisorNum,
      ]
    );

    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "Navegador Web";

    await pool.execute(
      `INSERT INTO activity_logs (user_id, action, ip_address, device_info) 
         VALUES (?, ?, ?, ?)`,
      [id, "Restablecimiento de Contraseña", ip, userAgent]
    );

    return res.json({ message: "Usuario actualizado correctamente" });
  } catch (error) {
    console.error("updateUser error:", error);
    return sendError(res, 500, "Error interno");
  }
};

// Actualizar perfil del usuario autenticado
export const updateOwnProfile = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, "No autenticado");

  const { nombre, email, username, password } = req.body ?? {};

  try {
    // 1. Hashear contraseña si existe
    const hashedPassword =
      password && String(password).length
        ? await bcrypt.hash(String(password), 10)
        : null;

    // 2. Ejecutar el SP de actualización (TU CÓDIGO ACTUAL)
    await pool.execute(
      "CALL gestion_usuarios('Actualizar', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)",
      [
        toInt(userId),
        nombre ?? null,
        email ?? null,
        username ?? null,
        hashedPassword,
      ]
    );

    // === NUEVO: LOG DE CAMBIO DE CONTRASEÑA ===
    // Solo guardamos el log si efectivamente envió una nueva contraseña
    if (hashedPassword) {
      const ip =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
      const userAgent = req.headers["user-agent"] || "Dispositivo Desconocido";

      await pool.execute(
        `INSERT INTO activity_logs (user_id, action, ip_address, device_info) 
             VALUES (?, ?, ?, ?)`,
        [userId, "Restablecimiento de contraseña", ip, userAgent]
      );
    }
    // ==========================================

    return res.json({ message: "Perfil actualizado correctamente" });
  } catch (error) {
    console.error("updateOwnProfile error:", error);
    return sendError(res, 500, "Error interno");
  }
};

// Eliminar lógicamente un usuario
export const deleteUser = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return sendError(res, 400, "ID inválido");

  try {
    await pool.execute(
      "CALL gestion_usuarios('Eliminar', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );

    return res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("deleteUser error:", error);
    return sendError(res, 500, "Error interno");
  }
};

export const restoreUser = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return sendError(res, 400, "ID inválido");

  try {
    await pool.execute(
      "CALL gestion_usuarios('Restaurar', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );

    return res.json({ message: "Usuario restaurado correctamente" });
  } catch (error) {
    console.error("restoreUser error:", error);
    return sendError(res, 500, "Error interno");
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword) return sendError(res, 400, "Datos incompletos");

  try {
    // 1) Buscar token válido
    const [tokens] = await pool.execute(
      "SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()",
      [token]
    );
    const resetTokenEntry = tokens?.[0];

    if (!resetTokenEntry) {
      return res.status(400).json({ message: "Token inválido o expirado." });
    }

    // 2) Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    // 3) Actualizar contraseña del usuario
    await pool.execute(
      "UPDATE usuarios SET password = ? WHERE id_usuario = ?",
      [hashedPassword, resetTokenEntry.user_id]
    );

    // 4) Marcar token como usado
    await pool.execute(
      "UPDATE password_reset_tokens SET used = TRUE WHERE id = ?",
      [resetTokenEntry.id]
    );

    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "Navegador Web";

    await pool.execute(
      `INSERT INTO activity_logs (user_id, action, ip_address, device_info) 
         VALUES (?, ?, ?, ?)`,
      [resetTokenEntry.user_id, "Restablecimiento de contraseña", ip, userAgent]
    );

    return res
      .status(200)
      .json({ message: "Contraseña restablecida exitosamente." });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({
      message: "Error interno del servidor al restablecer la contraseña.",
    });
  }
};

// --- NUEVAS FUNCIONES PARA SEGURIDAD ---

// Obtener sesiones activas
export const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    // El token actual viene en la cookie
    const currentToken = req.cookies.token;
    // Usamos la firma (última parte del JWT) para identificar la sesión actual
    const currentSignature = currentToken ? currentToken.split(".")[2] : "";

    const [rows] = await pool.execute(
      "SELECT * FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC LIMIT 3;",
      [userId]
    );

    // Formateamos para el frontend
    const sessions = rows.map((s) => ({
      id: s.id,
      device: s.device_info || "Desconocido",
      ip: s.ip_address,
      last_active: s.last_active,
      // Si la firma en la DB coincide con la de la cookie, es la sesión actual
      current: s.token_signature === currentSignature,
      type: (s.device_info || "").toLowerCase().includes("mobile")
        ? "mobile"
        : "desktop",
    }));

    return res.json(sessions);
  } catch (error) {
    console.error("getActiveSessions error:", error);
    return sendError(res, 500, "Error al obtener sesiones");
  }
};

// Obtener historial de actividad
export const getActivityLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      "SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 6",
      [userId]
    );
    return res.json(rows);
  } catch (error) {
    console.error("getActivityLogs error:", error);
    return sendError(res, 500, "Error al obtener logs");
  }
};

// Revocar todas las sesiones MENOS la actual
export const revokeOtherSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentToken = req.cookies.token;
    const currentSignature = currentToken ? currentToken.split(".")[2] : "";

    // Borramos todas las que NO tengan la firma actual
    await pool.execute(
      "DELETE FROM user_sessions WHERE user_id = ? AND token_signature != ?",
      [userId, currentSignature]
    );

    // Opcional: Registrar esto en el log
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "Unknown";
    await pool.execute(
      "INSERT INTO activity_logs (user_id, action, ip_address, device_info) VALUES (?, ?, ?, ?)",
      [userId, "Cierre de otras sesiones", ip, userAgent]
    );

    return res.json({ message: "Otras sesiones cerradas correctamente" });
  } catch (error) {
    console.error("revokeSessions error:", error);
    return sendError(res, 500, "Error al cerrar sesiones");
  }
};
