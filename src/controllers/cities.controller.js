import pool from "../config/connectionToSql.js";

export const getCities = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_ciudades('Mostrar', NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addCity = async (req, res) => {
  const { nombre, id_pais } = req.body;

  try {
    await pool.query("CALL gestion_ciudades('Insertar', NULL, ?, ?)", [
      nombre,
      id_pais,
    ]);
    res.status(201).json({ message: "Ciudad agregada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCity = async (req, res) => {
  const { id } = req.params;
  const { nombre, id_pais } = req.body;

  try {
    await pool.query("CALL gestion_ciudades('Actualizar', ?, ?, ?)", [
      id,
      nombre,
      id_pais,
    ]);
    res.json({ message: "Ciudad actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCity = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("CALL gestion_ciudades('Eliminar', ?, NULL, NULL)", [id]);
    res.json({ message: "Ciudad eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
