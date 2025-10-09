// controllers/AutoLog/vehiculos.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const isNonEmptyStr = (s) => typeof s === "string" && s.trim().length > 0;
const ALLOWED_ESTADOS = new Set([
  "Disponible",
  "En Uso",
  "En Mantenimiento",
  "Inactivo",
]);

// 🔧 Mapea argumentos nombrados → orden del SP
// Firma asumida: (id_empleado, accion, id, placa, marca, modelo, estado, id_ubicacion_actual)
const spParams = ({
  accion,
  id_empleado = null,
  id = null,
  placa = null,
  marca = null,
  modelo = null,
  estado = null,
  id_ubicacion_actual = null,
}) => [
  id_empleado,
  accion,
  id,
  placa,
  marca,
  modelo,
  estado,
  id_ubicacion_actual,
];

// Para CALL ... a veces mysql2 retorna [[rows], meta]; extrae primer set
const firstResultSet = (rows) =>
  Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;

// ------------------------------------
// GET /api/vehiculos
// ------------------------------------
export const getVehiculos = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({ accion: "Mostrar" })
    );
    return res.json(firstResultSet(rows));
  } catch (err) {
    logger.error({ err }, "getVehiculos failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// GET /api/vehiculos/empleado/:id
// ------------------------------------
export const listarVehiculosEmpleado = async (req, res) => {
  const idEmpleado = toInt(req.params.id);
  if (Number.isNaN(idEmpleado)) {
    return res.status(400).json({ error: "id_empleado inválido" });
  }

  try {
    const [rows] = await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({ accion: "Listar", id_empleado: idEmpleado })
    );
    return res.json(firstResultSet(rows));
  } catch (err) {
    logger.error(
      { err, params: { idEmpleado } },
      "listarVehiculosEmpleado failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// POST /api/vehiculos
// body: { placa, marca, modelo, estado, id_ubicacion_actual }
// ------------------------------------
export const addVehiculo = async (req, res) => {
  const { placa, marca, modelo, estado, id_ubicacion_actual } = req.body ?? {};

  // Validaciones
  if (
    !isNonEmptyStr(placa) ||
    !isNonEmptyStr(marca) ||
    !isNonEmptyStr(modelo)
  ) {
    return res
      .status(400)
      .json({ error: "placa, marca y modelo son requeridos" });
  }
  const placaVal = placa.trim();
  const marcaVal = marca.trim();
  const modeloVal = modelo.trim();
  if (placaVal.length > 20 || marcaVal.length > 100 || modeloVal.length > 100) {
    return res.status(400).json({ error: "Longitud de campos excedida" });
  }

  if (!isNonEmptyStr(estado) || !ALLOWED_ESTADOS.has(estado.trim())) {
    return res.status(400).json({ error: "estado inválido" });
  }
  const estadoVal = estado.trim();

  const idUbicNum = toInt(id_ubicacion_actual);
  if (Number.isNaN(idUbicNum)) {
    return res.status(400).json({ error: "id_ubicacion_actual inválido" });
  }

  try {
    await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({
        accion: "Insertar",
        placa: placaVal,
        marca: marcaVal,
        modelo: modeloVal,
        estado: estadoVal,
        id_ubicacion_actual: idUbicNum,
      })
    );
    return res.status(201).json({ message: "Vehículo agregado correctamente" });
  } catch (err) {
    logger.error(
      {
        err,
        body: {
          placa: placaVal,
          marca: marcaVal,
          modelo: modeloVal,
          estado: estadoVal,
          id_ubicacion_actual: idUbicNum,
        },
      },
      "addVehiculo failed"
    );
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// PUT /api/vehiculos/:id
// ------------------------------------
export const updateVehiculo = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { placa, marca, modelo, estado, id_ubicacion_actual } = req.body ?? {};

  // Campos opcionales; normaliza/valida si vienen
  const placaVal = isNonEmptyStr(placa) ? placa.trim() : null;
  const marcaVal = isNonEmptyStr(marca) ? marca.trim() : null;
  const modeloVal = isNonEmptyStr(modelo) ? modelo.trim() : null;

  if (placaVal && placaVal.length > 20) {
    return res.status(400).json({ error: "placa demasiado larga" });
  }
  if (marcaVal && marcaVal.length > 100) {
    return res.status(400).json({ error: "marca demasiado larga" });
  }
  if (modeloVal && modeloVal.length > 100) {
    return res.status(400).json({ error: "modelo demasiado largo" });
  }

  let estadoVal = null;
  if (estado !== undefined && estado !== null && estado !== "") {
    if (!isNonEmptyStr(estado) || !ALLOWED_ESTADOS.has(estado.trim())) {
      return res.status(400).json({ error: "estado inválido" });
    }
    estadoVal = estado.trim();
  }

  let idUbicNum = null;
  if (
    id_ubicacion_actual !== undefined &&
    id_ubicacion_actual !== null &&
    id_ubicacion_actual !== ""
  ) {
    idUbicNum = toInt(id_ubicacion_actual);
    if (Number.isNaN(idUbicNum)) {
      return res.status(400).json({ error: "id_ubicacion_actual inválido" });
    }
  }

  try {
    await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({
        accion: "Actualizar",
        id,
        placa: placaVal,
        marca: marcaVal,
        modelo: modeloVal,
        estado: estadoVal,
        id_ubicacion_actual: idUbicNum,
      })
    );
    return res.json({ message: "Vehículo actualizado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "updateVehiculo failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// DELETE /api/vehiculos/:id
// ------------------------------------
export const deleteVehiculo = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({ accion: "Eliminar", id })
    );
    return res.json({ message: "Vehículo eliminado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "deleteVehiculo failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// PATCH /api/vehiculos/:id/restaurar
// ------------------------------------
export const restoreVehiculo = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await pool.execute(
      "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)",
      spParams({ accion: "Restaurar", id })
    );
    return res.json({ message: "Vehículo restaurado correctamente" });
  } catch (err) {
    logger.error({ err, params: { id } }, "restoreVehiculo failed");
    return res.status(500).json({ error: "Error interno" });
  }
};

// ------------------------------------
// GET /api/vehiculos/ubicaciones
// ------------------------------------
export const getUbicaciones = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, nombre_ubicacion FROM estacionamientos ORDER BY nombre_ubicacion"
    );
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getUbicaciones failed");
    return res.status(500).json({ error: "Error interno" });
  }
};
