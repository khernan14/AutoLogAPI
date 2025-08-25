import pool from "../../../config/connectionToSql.js";

export const getParkings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_estacionamientos('Mostrar', NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addParking = async (req, res) => {
  const { nombre_ubicacion, id_ciudad } = req.body;

  try {
    await pool.query("CALL gestion_estacionamientos('Insertar', NULL, ?, ?)", [
      nombre_ubicacion,
      id_ciudad,
    ]);
    res.status(201).json({ message: "Estacionamiento agregado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateParking = async (req, res) => {
  const { id } = req.params;
  const { nombre_ubicacion, id_ciudad } = req.body;

  try {
    await pool.query("CALL gestion_estacionamientos('Actualizar', ?, ?, ?)", [
      id,
      nombre_ubicacion,
      id_ciudad,
    ]);
    res.json({ message: "Estacionamiento actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteParking = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "CALL gestion_estacionamientos('Eliminar', ?, NULL, NULL)",
      [id]
    );
    res.json({ message: "Estacionamiento eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
