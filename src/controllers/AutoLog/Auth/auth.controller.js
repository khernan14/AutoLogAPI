import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../../config/connectionToSql.js";

// Obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_usuarios('ListarUsuariosActivos', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsersById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "CALL gestion_usuarios('Perfil', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmailSupervisor = async (req, res) => {
  const { id_empleado } = req.query; // O usa req.body si es POST

  if (!id_empleado) {
    return res.status(400).json({ error: "Falta id_empleado" });
  }

  try {
    const [rows] = await pool.query(
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
      [id_empleado]
    );

    if (!rows.length)
      return res.status(404).json({ error: "Empleado no encontrado" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener supervisor:", error);
    res.status(500).json({ error: error.message });
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
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "CALL gestion_usuarios('Registrar', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        nombre,
        email,
        username,
        hashedPassword,
        rol,
        "Activo",
        puesto,
        id_ciudad,
        supervisor_id,
      ]
    );

    res.status(201).json({ message: "Usuario registrado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Inicio de sesión
export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      "CALL gestion_usuarios('Login', NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL)",
      [username]
    );

    const user = rows[0][0];
    if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Contraseña incorrecta" });

    // ⬇️ Obtener permisos del usuario
    const [permisosRows] = await pool.query(
      `
      SELECT p.nombre
      FROM usuario_permisos up
      INNER JOIN permisos p ON up.permiso_id = p.id
      WHERE up.id_usuario = ?
      `,
      [user.id_usuario]
    );

    const permisos = permisosRows.map((p) => p.nombre); // ["ver_reportes", "editar_usuario", ...]

    const token = jwt.sign(
      { id: user.id_usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Inicio de sesión exitoso",
      token,
      rol: user.rol,
      nombre: user.nombre,
      id: user.id_usuario,
      id_empleado: user.id,
      email: user.email,
      permisos, // ⬅️ devolvemos los permisos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar un usuario
export const updateUser = async (req, res) => {
  const { id } = req.params;
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
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    await pool.query(
      "CALL gestion_usuarios('Actualizar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        nombre,
        email,
        username,
        hashedPassword || null,
        rol,
        estatus,
        puesto,
        id_ciudad,
        supervisor_id, // <-- Nuevo
      ]
    );

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar perfil del usuario autenticado
export const updateOwnProfile = async (req, res) => {
  const userId = req.user.id;
  const { nombre, email, username, password } = req.body;

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    await pool.query(
      "CALL gestion_usuarios('Actualizar', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)",
      [userId, nombre, email, username, hashedPassword || null]
    );

    res.json({ message: "Perfil actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar lógicamente un usuario
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "CALL gestion_usuarios('Eliminar', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const restoreUser = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "CALL gestion_usuarios('Restaurar', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );

    res.json({ message: "Usuario restaurado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // 1. Buscar el token en la base de datos
    // Verifica que el token exista, no esté usado y no haya expirado
    const [tokens] = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()",
      [token]
    );
    const resetTokenEntry = tokens[0];

    if (!resetTokenEntry) {
      return res.status(400).json({ message: "Token inválido o expirado." });
    }

    // 2. Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 8); // 10 es el costo del salt, un buen valor estándar

    // 3. Actualizar la contraseña del usuario
    await pool.query("UPDATE usuarios SET password = ? WHERE id_usuario = ?", [
      hashedPassword,
      resetTokenEntry.user_id, // Usar el user_id asociado al token
    ]);

    // 4. Marcar el token como usado
    await pool.query(
      "UPDATE password_reset_tokens SET used = TRUE WHERE id = ?",
      [resetTokenEntry.id]
    );

    res.status(200).json({ message: "Contraseña restablecida exitosamente." });
  } catch (error) {
    console.error("Error al restablecer la contraseña:", error);
    res.status(500).json({
      message: "Error interno del servidor al restablecer la contraseña.",
    });
  }
};
