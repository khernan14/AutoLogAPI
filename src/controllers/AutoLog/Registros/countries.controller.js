// controllers/AutoLog/countries.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // ← ajusta esta ruta si es necesario

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// GET /countries
export const getCountries = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_paises('Mostrar', NULL, NULL)"
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "getCountries failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// POST /countries
export const addCountry = async (req, res) => {
  const { nombre } = req.body ?? {};

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "Nombre es requerido" });
  }
  const nombreTrim = nombre.trim();
  if (nombreTrim.length > 100) {
    return res.status(400).json({ error: "Nombre demasiado largo" });
  }

  try {
    // ⚠️ Si tu SP espera ('Insertar', NULL, ?), usa la línea de abajo.
    await pool.execute("CALL gestion_paises('Insertar', NULL, ?)", [
      nombreTrim,
    ]);

    // ⚠️ Si tu SP realmente espera solo ('Insertar', ?), cambia por:
    // await pool.execute("CALL gestion_paises('Insertar', ?)", [nombreTrim]);

    return res.status(201).json({ message: "País agregado correctamente" });
  } catch (err) {
    logger.error({ err, body: { nombre: "[REDACTED]" } }, "addCountry failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// PUT /countries/:id
export const updateCountry = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre } = req.body ?? {};
  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "Nombre es requerido" });
  }
  const nombreTrim = nombre.trim();
  if (nombreTrim.length > 100) {
    return res.status(400).json({ error: "Nombre demasiado largo" });
  }

  try {
    await pool.execute("CALL gestion_paises('Actualizar', ?, ?)", [
      id,
      nombreTrim,
    ]);
    return res.json({ message: "País actualizado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "updateCountry failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// DELETE /countries/:id
export const deleteCountry = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute("CALL gestion_paises('Eliminar', ?, NULL)", [id]);
    return res.json({ message: "País eliminado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "deleteCountry failed");
    return res.status(500).json({ error: "Error interno" });
  }
};
