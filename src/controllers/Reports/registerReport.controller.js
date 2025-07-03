import pool from "../../config/connectionToSql.js";

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

    console.log("Fila de la DB:", rows[0]); // Solo muestra 1 para no saturar

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
        console.log("images_json string:", row.images_json);
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
