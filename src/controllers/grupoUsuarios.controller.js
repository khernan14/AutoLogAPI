// controllers/grupoUsuariosController.js
import pool from "../config/connectionToSql.js";

// Mostrar todos los registros
export const getGrupoUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_grupo_notificacion_usuarios('Mostrar', NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener uno por ID
export const getGrupoUsuarioById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "CALL gestion_grupo_notificacion_usuarios('Obtener', ?, NULL, NULL)",
      [id]
    );
    res.json(rows[0][0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Agregar múltiples usuarios a un grupo
export const addGrupoUsuario = async (req, res) => {
  const { grupo_id, id_usuarios } = req.body;

  if (!grupo_id || !Array.isArray(id_usuarios)) {
    return res.status(400).json({ error: "Datos incompletos o incorrectos" });
  }

  try {
    for (let id_usuario of id_usuarios) {
      await pool.query(
        "CALL gestion_grupo_notificacion_usuarios('Registrar', NULL, ?, ?)",
        [grupo_id, id_usuario]
      );
    }

    res.status(201).json({ message: "Usuarios agregados al grupo" });
  } catch (error) {
    console.error("Error al agregar usuarios:", error);
    res.status(500).json({ error: error.message });
  }
};

// Actualizar relación
export const updateGrupoUsuario = async (req, res) => {
  const { id } = req.params;
  const { grupo_id, id_usuario } = req.body;

  try {
    await pool.query(
      "CALL gestion_grupo_notificacion_usuarios('Actualizar', ?, ?, ?)",
      [id, grupo_id, id_usuario]
    );
    res.json({ message: "Relación actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar relación
export const deleteGrupoUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "CALL gestion_grupo_notificacion_usuarios('Eliminar', ?, NULL, NULL)",
      [id]
    );
    res.json({ message: "Relación eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
