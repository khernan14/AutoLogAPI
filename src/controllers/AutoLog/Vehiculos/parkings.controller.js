// controllers/AutoLog/parkings.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // ajusta si es necesario

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// GET /api/parkings
export const getParkings = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_estacionamientos('Mostrar', NULL, NULL, NULL)"
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "getParkings failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// POST /api/parkings
export const addParking = async (req, res) => {
  const { nombre_ubicacion, id_ciudad } = req.body ?? {};

  if (
    !nombre_ubicacion ||
    typeof nombre_ubicacion !== "string" ||
    !nombre_ubicacion.trim()
  ) {
    return res.status(400).json({ error: "nombre_ubicacion es requerido" });
  }
  const nombre = nombre_ubicacion.trim();
  if (nombre.length > 100) {
    return res.status(400).json({ error: "nombre_ubicacion demasiado largo" });
  }

  const idCiudadNum = toInt(id_ciudad);
  if (Number.isNaN(idCiudadNum)) {
    return res.status(400).json({ error: "id_ciudad inválido" });
  }

  try {
    await pool.execute(
      "CALL gestion_estacionamientos('Insertar', NULL, ?, ?)",
      [nombre, idCiudadNum]
    );
    return res
      .status(201)
      .json({ message: "Estacionamiento agregado correctamente" });
  } catch (err) {
    logger.error(
      { err, body: { nombre_ubicacion: "[REDACTED]", id_ciudad } },
      "addParking failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// PUT /api/parkings/:id
export const updateParking = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre_ubicacion, id_ciudad } = req.body ?? {};
  const nombre =
    typeof nombre_ubicacion === "string" && nombre_ubicacion.trim().length
      ? nombre_ubicacion.trim()
      : null;

  if (nombre && nombre.length > 100) {
    return res.status(400).json({ error: "nombre_ubicacion demasiado largo" });
  }

  let idCiudadNum = null;
  if (id_ciudad !== undefined && id_ciudad !== null && id_ciudad !== "") {
    idCiudadNum = toInt(id_ciudad);
    if (Number.isNaN(idCiudadNum)) {
      return res.status(400).json({ error: "id_ciudad inválido" });
    }
  }

  try {
    await pool.execute("CALL gestion_estacionamientos('Actualizar', ?, ?, ?)", [
      id,
      nombre,
      idCiudadNum,
    ]);
    return res.json({ message: "Estacionamiento actualizado correctamente" });
  } catch (err) {
    logger.error(
      {
        err,
        params: { id },
        body: { id_ciudad, nombre_ubicacion: "[REDACTED]" },
      },
      "updateParking failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// DELETE /api/parkings/:id
export const deleteParking = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute(
      "CALL gestion_estacionamientos('Eliminar', ?, NULL, NULL)",
      [id]
    );
    return res.json({ message: "Estacionamiento eliminado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "deleteParking failed");
    return res.status(500).json({ error: "Error interno" });
  }
};
