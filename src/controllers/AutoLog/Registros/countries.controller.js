import pool from "../../../config/connectionToSql.js";

export const getCountries = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_paises('Mostrar', NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addCountry = async (req, res) => {
  const { nombre } = req.body;

  try {
    await pool.query("CALL gestion_paises('Insertar', ?)", [nombre]);
    res.status(201).json({ message: "Pais agregado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCountry = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  try {
    await pool.query("CALL gestion_paises('Actualizar', ?, ?)", [id, nombre]);
    res.json({ message: "Pais actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCountry = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("CALL gestion_paises('Eliminar', ?, NULL)", [id]);
    res.json({ message: "Pais eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
