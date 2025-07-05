import pool from "../../config/connectionToSql.js";

/**
 * @desc Obtiene todos los registros de uso de vehículos con detalles de empleado, vehículo, ubicaciones e imágenes.
 * @route GET /api/registros
 * @access Public
 */
export const getRegistros = async (req, res) => {
  try {
    const [rows] = await pool.query(`
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
      ORDER BY r.fecha_salida DESC;
    `);

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
          console.error("❌ Error al parsear images_json:", err);
          return [];
        }
      })(),
    }));

    res.json(registros);
  } catch (error) {
    console.error("Error al obtener los registros:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el reporte de empleados con más salidas de vehículos.
 * @route GET /api/reportes/empleados-mas-salidas
 * @access Public
 */
export const getReporteEmpleadosMasSalidas = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          u.nombre AS nombre_empleado,
          e.puesto,
          COUNT(r.id) AS total_salidas
      FROM
          empleados e
      JOIN
          usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN
          registros r ON e.id = r.id_empleado
      GROUP BY
          u.nombre, e.puesto
      ORDER BY
          total_salidas DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error(
      "Error al obtener el reporte de empleados con más salidas:",
      error
    );
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el reporte de kilometraje total recorrido por cada empleado.
 * @route GET /api/reportes/kilometraje-por-empleado
 * @access Public
 */
export const getReporteKilometrajePorEmpleado = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          u.nombre AS nombre_empleado,
          e.puesto,
          SUM(CASE WHEN r.km_regreso IS NOT NULL AND r.km_salida IS NOT NULL AND r.km_regreso >= r.km_salida THEN (r.km_regreso - r.km_salida) ELSE 0 END) AS kilometraje_total_recorrido
      FROM
          empleados e
      JOIN
          usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN
          registros r ON e.id = r.id_empleado
      GROUP BY
          u.nombre, e.puesto
      ORDER BY
          kilometraje_total_recorrido DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error(
      "Error al obtener el reporte de kilometraje por empleado:",
      error
    );
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el reporte de los vehículos más utilizados.
 * @route GET /api/reportes/vehiculos-mas-utilizados
 * @access Public
 */
export const getReporteVehiculosMasUtilizados = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          v.marca,
          v.modelo,
          v.placa,
          COUNT(r.id) AS total_usos
      FROM
          vehiculos v
      JOIN
          registros r ON v.id = r.id_vehiculo
      GROUP BY
          v.marca, v.modelo, v.placa
      ORDER BY
          total_usos DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error(
      "Error al obtener el reporte de vehículos más utilizados:",
      error
    );
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el reporte de registros de uso de vehículos por ubicación.
 * @route GET /api/reportes/registros-por-ubicacion
 * @access Public
 */
export const getReporteRegistrosPorUbicacion = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          u.nombre AS nombre_empleado,
          CONCAT(v.marca, ' ', v.modelo, ' (', v.placa, ')') AS vehiculo,
          es.nombre_ubicacion AS ubicacion_salida,
          er.nombre_ubicacion AS ubicacion_regreso,
          r.fecha_salida,
          r.fecha_regreso,
          r.km_salida,
          r.km_regreso
      FROM
          registros r
      JOIN
          empleados e ON r.id_empleado = e.id
      JOIN
          usuarios u ON e.id_usuario = u.id_usuario
      JOIN
          vehiculos v ON r.id_vehiculo = v.id
      LEFT JOIN
          estacionamientos es ON r.id_ubicacion_salida = es.id
      LEFT JOIN
          estacionamientos er ON r.id_ubicacion_regreso = er.id
      ORDER BY
          r.fecha_salida DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error(
      "Error al obtener el reporte de registros por ubicación:",
      error
    );
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el reporte de consumo promedio de combustible por vehículo.
 * @route GET /api/reportes/consumo-combustible-vehiculo
 * @access Public
 */
export const getReporteConsumoCombustibleVehiculo = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          v.marca,
          v.modelo,
          v.placa,
          AVG(CASE
              WHEN r.combustible_salida IS NOT NULL AND r.combustible_regreso IS NOT NULL AND r.combustible_salida >= r.combustible_regreso
              THEN (r.combustible_salida - r.combustible_regreso)
              ELSE NULL
          END) AS promedio_consumo_porcentaje
      FROM
          vehiculos v
      JOIN
          registros r ON v.id = r.id_vehiculo
      WHERE
          r.combustible_salida IS NOT NULL AND r.combustible_regreso IS NOT NULL
      GROUP BY
          v.marca, v.modelo, v.placa
      ORDER BY
          promedio_consumo_porcentaje DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error(
      "Error al obtener el reporte de consumo de combustible por vehículo:",
      error
    );
    res.status(500).json({ error: error.message });
  }
};

// --- Nuevos Controladores para Métricas del Dashboard Home ---

/**
 * @desc Obtiene el total de empleados (activos).
 * @route GET /api/reportes/total-empleados
 * @access Public
 */
export const getTotalEmpleados = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(id) AS total FROM empleados WHERE estatus = 'Activo';
    `);
    res.json(rows[0] || { total: 0 }); // Retorna el primer resultado o un objeto con total 0
  } catch (error) {
    console.error("Error al obtener el total de empleados:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el total de vehículos.
 * @route GET /api/reportes/total-vehiculos
 * @access Public
 */
export const getTotalVehiculos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(id) AS total FROM vehiculos;
    `);
    res.json(rows[0] || { total: 0 });
  } catch (error) {
    console.error("Error al obtener el total de vehículos:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el total de vehículos actualmente en uso.
 * Un vehículo está en uso si tiene un registro de salida sin fecha de regreso.
 * @route GET /api/reportes/vehiculos-en-uso
 * @access Public
 */
export const getVehiculosEnUso = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(DISTINCT id_vehiculo) AS total
      FROM registros
      WHERE fecha_regreso IS NULL;
    `);
    res.json(rows[0] || { total: 0 });
  } catch (error) {
    console.error("Error al obtener vehículos en uso:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el total de vehículos en mantenimiento.
 * @route GET /api/reportes/vehiculos-en-mantenimiento
 * @access Public
 */
export const getVehiculosEnMantenimiento = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(id) AS total FROM vehiculos WHERE estado = 'En Mantenimiento';
    `);
    res.json(rows[0] || { total: 0 });
  } catch (error) {
    console.error("Error al obtener vehículos en mantenimiento:", error);
    res.status(500).json({ error: error.message });
  }
};
