// controllers/AutoLog/registros.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// ---------------------------------------------
// GET /api/registros  (opcional: ?limit=&offset=)
// ---------------------------------------------
export const getRegistros = async (req, res) => {
  try {
    // Paginación opcional (no rompe si no la usas)
    const hasLimit = req.query.limit !== undefined;
    const hasOffset = req.query.offset !== undefined;
    const limit = hasLimit
      ? Math.min(Math.max(toInt(req.query.limit), 1), 500)
      : null;
    const offset = hasOffset ? Math.max(toInt(req.query.offset), 0) : null;

    if (
      (hasLimit && Number.isNaN(limit)) ||
      (hasOffset && Number.isNaN(offset))
    ) {
      return res
        .status(400)
        .json({ error: "Parámetros de paginación inválidos" });
    }

    let sql = `
      SELECT
        r.id,
        r.km_salida,
        r.km_regreso,
        r.combustible_salida,
        r.combustible_regreso,
        r.comentario_salida,
        r.comentario_regreso,
        r.fecha_salida,
        r.fecha_regreso,
        r.estado,
        v.placa,
        v.marca,
        v.modelo,
        e.id AS empleado_id,
        u.nombre AS empleado_nombre,
        u.rol AS empleado_rol,
        e.puesto AS empleado_puesto,
        es_salida.nombre_ubicacion AS ubicacion_salida,
        es_regreso.nombre_ubicacion AS ubicacion_regreso,
        IFNULL(
          CONCAT('[', GROUP_CONCAT(
            JSON_OBJECT(
              'id_image', IFNULL(i.id_image, 0),
              'url', IFNULL(i.url, '')
            ) ORDER BY i.id_image
          ), ']'),
          '[]'
        ) AS images_json
      FROM registros r
      LEFT JOIN vehiculos v ON r.id_vehiculo = v.id
      LEFT JOIN empleados e ON r.id_empleado = e.id
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN estacionamientos es_salida ON r.id_ubicacion_salida = es_salida.id
      LEFT JOIN estacionamientos es_regreso ON r.id_ubicacion_regreso = es_regreso.id
      LEFT JOIN registro_images ri ON r.id = ri.id_registro
      LEFT JOIN images i ON ri.id_image = i.id_image
      GROUP BY r.id
      ORDER BY r.fecha_salida DESC
    `;
    const params = [];

    if (limit != null) {
      sql += ` LIMIT ?`;
      params.push(limit);
      if (offset != null) {
        sql += ` OFFSET ?`;
        params.push(offset);
      }
    }

    const [rows] = await pool.execute(sql, params);

    const registros = rows.map((row) => ({
      id: row.id,
      km_salida: row.km_salida,
      km_regreso: row.km_regreso,
      combustible_salida: row.combustible_salida,
      combustible_regreso: row.combustible_regreso,
      comentario_salida: row.comentario_salida,
      comentario_regreso: row.comentario_regreso,
      fecha_salida: row.fecha_salida,
      fecha_regreso: row.fecha_regreso,
      estado: row.estado,
      vehiculo: {
        placa: row.placa,
        marca: row.marca,
        modelo: row.modelo,
      },
      empleado: {
        id: row.empleado_id,
        nombre: row.empleado_nombre,
        rol: row.empleado_rol,
        puesto: row.empleado_puesto,
      },
      ubicacion_salida: row.ubicacion_salida,
      ubicacion_regreso: row.ubicacion_regreso,
      images: (() => {
        try {
          return row.images_json ? JSON.parse(row.images_json) : [];
        } catch (err) {
          logger.warn({ err }, "Error al parsear images_json");
          return [];
        }
      })(),
    }));

    return res.json(registros);
  } catch (err) {
    logger.error({ err }, "getRegistros failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/empleados-mas-salidas
// --------------------------------------------------------------
export const getReporteEmpleadosMasSalidas = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.nombre AS nombre_empleado,
        e.puesto,
        COUNT(r.id) AS total_salidas
      FROM empleados e
      JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN registros r ON e.id = r.id_empleado
      WHERE u.rol != 'Admin'
      GROUP BY u.nombre, e.puesto
      ORDER BY total_salidas DESC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getReporteEmpleadosMasSalidas failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/kilometraje-por-empleado
// --------------------------------------------------------------
export const getReporteKilometrajePorEmpleado = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.nombre AS nombre_empleado,
        e.puesto,
        SUM(
          CASE
            WHEN r.km_regreso IS NOT NULL
             AND r.km_salida IS NOT NULL
             AND r.km_regreso >= r.km_salida
            THEN (r.km_regreso - r.km_salida)
            ELSE 0
          END
        ) AS kilometraje_total_recorrido
      FROM empleados e
      JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN registros r ON e.id = r.id_empleado
      WHERE u.rol != 'Admin'
      GROUP BY u.nombre, e.puesto
      ORDER BY kilometraje_total_recorrido DESC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getReporteKilometrajePorEmpleado failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/vehiculos-mas-utilizados
// --------------------------------------------------------------
export const getReporteVehiculosMasUtilizados = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        v.marca,
        v.modelo,
        v.placa,
        COUNT(r.id) AS total_usos
      FROM vehiculos v
      JOIN registros r ON v.id = r.id_vehiculo
      GROUP BY v.marca, v.modelo, v.placa
      ORDER BY total_usos DESC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getReporteVehiculosMasUtilizados failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/registros-por-ubicacion
// --------------------------------------------------------------
export const getReporteRegistrosPorUbicacion = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.nombre AS nombre_empleado,
        CONCAT(v.marca, ' ', v.modelo, ' (', v.placa, ')') AS vehiculo,
        es.nombre_ubicacion AS ubicacion_salida,
        er.nombre_ubicacion AS ubicacion_regreso,
        r.fecha_salida,
        r.fecha_regreso,
        r.km_salida,
        r.km_regreso
      FROM registros r
      JOIN empleados e ON r.id_empleado = e.id
      JOIN usuarios u ON e.id_usuario = u.id_usuario
      JOIN vehiculos v ON r.id_vehiculo = v.id
      LEFT JOIN estacionamientos es ON r.id_ubicacion_salida = es.id
      LEFT JOIN estacionamientos er ON r.id_ubicacion_regreso = er.id
      WHERE u.rol != 'Admin'
      ORDER BY r.fecha_salida DESC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getReporteRegistrosPorUbicacion failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/consumo-combustible-vehiculo
// --------------------------------------------------------------
export const getReporteConsumoCombustibleVehiculo = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        v.marca,
        v.modelo,
        v.placa,
        AVG(
          CASE
            WHEN r.combustible_salida IS NOT NULL
             AND r.combustible_regreso IS NOT NULL
             AND r.combustible_salida >= r.combustible_regreso
            THEN (r.combustible_salida - r.combustible_regreso)
            ELSE NULL
          END
        ) AS promedio_consumo_porcentaje
      FROM vehiculos v
      JOIN registros r ON v.id = r.id_vehiculo
      WHERE r.combustible_salida IS NOT NULL
        AND r.combustible_regreso IS NOT NULL
      GROUP BY v.marca, v.modelo, v.placa
      ORDER BY promedio_consumo_porcentaje DESC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "getReporteConsumoCombustibleVehiculo failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/total-empleados
// --------------------------------------------------------------
export const getTotalEmpleados = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(id_usuario) AS total
      FROM usuarios
      WHERE estatus = 'Activo' AND rol != 'Admin'
    `);
    return res.json(rows[0] || { total: 0 });
  } catch (err) {
    logger.error({ err }, "getTotalEmpleados failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/total-vehiculos
// --------------------------------------------------------------
export const getTotalVehiculos = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(id) AS total
      FROM vehiculos
    `);
    return res.json(rows[0] || { total: 0 });
  } catch (err) {
    logger.error({ err }, "getTotalVehiculos failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/vehiculos-en-uso
// --------------------------------------------------------------
export const getVehiculosEnUso = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(DISTINCT id_vehiculo) AS total
      FROM registros
      WHERE fecha_regreso IS NULL
    `);
    return res.json(rows[0] || { total: 0 });
  } catch (err) {
    logger.error({ err }, "getVehiculosEnUso failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// --------------------------------------------------------------
// GET /api/reportes/vehiculos-en-mantenimiento
// --------------------------------------------------------------
export const getVehiculosEnMantenimiento = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(id) AS total
      FROM vehiculos
      WHERE estado = 'En Mantenimiento'
    `);
    return res.json(rows[0] || { total: 0 });
  } catch (err) {
    logger.error({ err }, "getVehiculosEnMantenimiento failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
