import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/connectionToSql.js";

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
