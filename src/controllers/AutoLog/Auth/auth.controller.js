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
    const { username, password } = req.body ?? {};
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

    const [permisosRows] = await pool.execute(
      `SELECT p.nombre
       FROM usuario_permisos up
       INNER JOIN permisos p ON up.permiso_id = p.id
       WHERE up.id_usuario = ?`,
      [user.id_usuario]
    );
    const permisos = permisosRows.map((p) => p.nombre);

    const token = jwt.sign(
      { id: user.id_usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      message: "Inicio de sesión exitoso",
      token,
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
    const hashedPassword =
      password && String(password).length
        ? await bcrypt.hash(String(password), 10)
        : null;

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
