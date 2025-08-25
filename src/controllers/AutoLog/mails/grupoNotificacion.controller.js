// controllers/grupoNotificacionController.js
import pool from "../../../config/connectionToSql.js";

// Mostrar todos los grupos
export const getGrupos = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_grupo_notificacion('Mostrar', NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener grupo por ID
export const getGrupoById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "CALL gestion_grupo_notificacion('Obtener', ?, NULL, NULL)",
      [id]
    );
    res.json(rows[0][0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registrar nuevo grupo
export const addGrupo = async (req, res) => {
  const { nombre, descripcion } = req.body;

  try {
    await pool.query(
      "CALL gestion_grupo_notificacion('Registrar', NULL, ?, ?)",
      [nombre, descripcion]
    );
    res.status(201).json({ message: "Grupo creado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar grupo
export const updateGrupo = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

  try {
    await pool.query("CALL gestion_grupo_notificacion('Actualizar', ?, ?, ?)", [
      id,
      nombre,
      descripcion,
    ]);
    res.json({ message: "Grupo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar grupo
export const deleteGrupo = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "CALL gestion_grupo_notificacion('Eliminar', ?, NULL, NULL)",
      [id]
    );
    res.json({ message: "Grupo eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
