// controllers/cities.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // ← ajusta esta ruta a tu proyecto

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// GET /cities
export const getCities = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_ciudades('Mostrar', NULL, NULL, NULL)"
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "getCities failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// POST /cities
export const addCity = async (req, res) => {
  const { nombre, id_pais } = req.body ?? {};

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "Nombre es requerido" });
  }
  const idPaisNum = toInt(id_pais);
  if (Number.isNaN(idPaisNum)) {
    return res.status(400).json({ error: "id_pais inválido" });
  }

  try {
    await pool.execute("CALL gestion_ciudades('Insertar', NULL, ?, ?)", [
      nombre.trim(),
      idPaisNum,
    ]);
    return res.status(201).json({ message: "Ciudad agregada correctamente" });
  } catch (err) {
    logger.error(
      { err, body: { nombre: "[REDACTED]", id_pais } },
      "addCity failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// PUT /cities/:id
export const updateCity = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre, id_pais } = req.body ?? {};
  const nombreVal =
    typeof nombre === "string" && nombre.trim().length ? nombre.trim() : null;

  let idPaisNum = null;
  if (id_pais !== undefined && id_pais !== null && id_pais !== "") {
    idPaisNum = toInt(id_pais);
    if (Number.isNaN(idPaisNum)) {
      return res.status(400).json({ error: "id_pais inválido" });
    }
  }

  try {
    await pool.execute("CALL gestion_ciudades('Actualizar', ?, ?, ?)", [
      id,
      nombreVal,
      idPaisNum,
    ]);
    return res.json({ message: "Ciudad actualizada correctamente" });
  } catch (err) {
    logger.error(
      { err, params: { id }, body: { nombre: "[REDACTED]", id_pais } },
      "updateCity failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// DELETE /cities/:id
export const deleteCity = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute("CALL gestion_ciudades('Eliminar', ?, NULL, NULL)", [
      id,
    ]);
    return res.json({ message: "Ciudad eliminada correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "deleteCity failed");
    return res.status(500).json({ error: "Error interno" });
  }
};
