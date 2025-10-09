// controllers/AutoLog/reportes.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // 👈 ruta pedida

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const isYYYYMMDD = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 📅 Reporte de registros por fecha
// GET /api/reportes/registros-por-fecha?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
export const obtenerRegistrosPorFecha = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query ?? {};

  if (!isYYYYMMDD(fecha_inicio) || !isYYYYMMDD(fecha_fin)) {
    return res
      .status(400)
      .json({
        error:
          "Debes proporcionar fecha_inicio y fecha_fin en formato YYYY-MM-DD.",
      });
  }
  if (new Date(fecha_inicio) > new Date(fecha_fin)) {
    return res
      .status(400)
      .json({ error: "fecha_inicio no puede ser mayor que fecha_fin." });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        r.id, r.id_empleado, r.id_vehiculo,
        r.km_salida, r.km_regreso,
        r.combustible_salida, r.combustible_regreso,
        r.comentario_salida, r.comentario_regreso,
        r.fecha_salida, r.fecha_regreso, r.estado,
        v.placa,
        u.nombre AS empleado
      FROM registros r
      JOIN vehiculos v ON r.id_vehiculo = v.id
      JOIN empleados e ON r.id_empleado = e.id
      JOIN usuarios  u ON u.id_usuario = e.id_usuario
      WHERE DATE(r.fecha_salida) BETWEEN ? AND ?
      ORDER BY r.fecha_salida DESC
      `,
      [fecha_inicio, fecha_fin]
    );

    return res.json(rows);
  } catch (err) {
    logger.error(
      { err, query: { fecha_inicio, fecha_fin } },
      "obtenerRegistrosPorFecha failed"
    );
    return res.status(500).json({ error: "Error al obtener reportes." });
  }
};

// 👨‍💼 Reporte de registros por empleado
// GET /api/reportes/registros-por-empleado/:id_empleado
export const obtenerRegistrosPorEmpleado = async (req, res) => {
  const idEmpleado = toInt(req.params.id_empleado);
  if (Number.isNaN(idEmpleado)) {
    return res.status(400).json({ error: "id_empleado inválido" });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        r.id, r.id_empleado, r.id_vehiculo,
        r.km_salida, r.km_regreso,
        r.combustible_salida, r.combustible_regreso,
        r.comentario_salida, r.comentario_regreso,
        r.fecha_salida, r.fecha_regreso, r.estado,
        v.placa
      FROM registros r
      JOIN vehiculos v ON r.id_vehiculo = v.id
      WHERE r.id_empleado = ?
      ORDER BY r.fecha_salida DESC
      `,
      [idEmpleado]
    );

    return res.json(rows);
  } catch (err) {
    logger.error(
      { err, params: { id_empleado: idEmpleado } },
      "obtenerRegistrosPorEmpleado failed"
    );
    return res.status(500).json({ error: "Error al obtener reportes." });
  }
};

// 🚗 Reporte de vehículos disponibles
// GET /api/reportes/vehiculos-disponibles
export const obtenerVehiculosDisponibles = async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, placa, marca, modelo, estado FROM vehiculos WHERE estado = 'Disponible' ORDER BY marca, modelo, placa`
    );
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "obtenerVehiculosDisponibles failed");
    return res
      .status(500)
      .json({ error: "Error al obtener vehículos disponibles." });
  }
};
