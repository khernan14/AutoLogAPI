// controllers/AutoLog/empleados.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // ajusta la ruta si cambia

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// Helper para construir los 6 params del SP (ajusta al orden real de tu SP si difiere):
// CALL gestion_empleados(accion, id, id_usuario, puesto, estatus, id_ciudad)
const params = ({
  accion,
  id = null,
  id_usuario = null,
  puesto = null,
  estatus = null,
  id_ciudad = null,
}) => [accion, id, id_usuario, puesto, estatus, id_ciudad];

// GET /empleados
export const getEmployees = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({ accion: "Obtener" })
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "getEmployees failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// GET /empleados/jefes  (ejemplo: obtiene jefes del usuario autenticado)
// Si tu SP no necesita id_usuario aquí, ponlo en null.
export const getEmployeesBoss = async (req, res) => {
  try {
    const userId = toInt(req.user?.id);
    // si tu SP requiere el id del usuario autenticado para filtrar jefes:
    const [rows] = await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({
        accion: "ObtenerJefes",
        id_usuario: Number.isNaN(userId) ? null : userId,
      })
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "getEmployeesBoss failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// GET /empleados/:id
export const getEmployeeById = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [rows] = await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({ accion: "Mostrar", id })
    );
    // DV: algunos SP devuelven [ [fila], [meta] ]
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err, params: { id } }, "getEmployeeById failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// POST /empleados
export const AddEmployees = async (req, res) => {
  const { id_usuario, puesto } = req.body ?? {};
  const idUsuarioNum = toInt(id_usuario);
  if (Number.isNaN(idUsuarioNum) || !puesto || !String(puesto).trim()) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const [rows] = await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({
        accion: "Registrar",
        id_usuario: idUsuarioNum,
        puesto: String(puesto).trim(),
        estatus: "Activo",
      })
    );
    // Algunos drivers no exponen insertId al usar CALL; si lo necesitas, devuélvelo desde el SP.
    return res.status(201).json({ message: "Empleado agregado" });
  } catch (err) {
    logger.error(
      { err, body: { id_usuario: idUsuarioNum, puesto: "[REDACTED]" } },
      "AddEmployees failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// PUT /empleados/:id
export const updateEmployee = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { id_usuario, puesto, estatus, id_ciudad } = req.body ?? {};
  const idUsuarioNum = id_usuario != null ? toInt(id_usuario) : null;
  const idCiudadNum = id_ciudad != null ? toInt(id_ciudad) : null;

  if (id_usuario != null && Number.isNaN(idUsuarioNum)) {
    return res.status(400).json({ error: "id_usuario inválido" });
  }
  if (id_ciudad != null && Number.isNaN(idCiudadNum)) {
    return res.status(400).json({ error: "id_ciudad inválido" });
  }
  const puestoVal =
    typeof puesto === "string" && puesto.trim().length ? puesto.trim() : null;
  const estatusVal = estatus ?? null; // ej. 'Activo' | 'Inactivo' si tu SP lo soporta

  try {
    await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({
        accion: "Actualizar",
        id,
        id_usuario: idUsuarioNum,
        puesto: puestoVal,
        estatus: estatusVal,
        id_ciudad: idCiudadNum,
      })
    );
    return res.json({ message: "Empleado actualizado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "updateEmployee failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// DELETE /empleados/:id
export const deleteEmployee = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute(
      "CALL gestion_empleados(?, ?, ?, ?, ?, ?)",
      params({ accion: "Eliminar", id })
    );
    return res.json({ message: "Empleado eliminado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "deleteEmployee failed");
    return res.status(500).json({ error: "Error interno" });
  }
};
