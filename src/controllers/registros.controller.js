import pool from "../config/connectionToSql.js";

// 📌 Obtener registro activo del empleado
export const obtenerRegistroPendienteEmpleado = async (req, res) => {
  const { id_empleado } = req.params;

  try {
    const [resultado] = await pool.query(
      `
            SELECT r.id AS id_registro, r.id_vehiculo, v.placa , 'En Uso' AS estado
            FROM registros r INNER JOIN vehiculos v
            ON r.id_vehiculo = v.id
            WHERE id_empleado = ? AND fecha_regreso IS NULL
            LIMIT 1;
        `,
      [id_empleado]
    );

    if (resultado.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay registros pendientes para este empleado." });
    }

    res.json(resultado[0]);
  } catch (error) {
    console.error("❌ Error al obtener registro pendiente:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor.", details: error.message });
  }
};

export const obtenerKmActual = async (req, res) => {
  const { id_vehiculo } = req.params;

  try {
    const [resultado] = await pool.query(
      `
          SELECT km_regreso, km_salida
          FROM registros r INNER JOIN vehiculos v
          ON r.id_vehiculo = v.id
          WHERE r.id_vehiculo = ?
          ORDER BY km_regreso desc
          LIMIT 1;
        `,
      [id_vehiculo]
    );

    if (resultado.length === 0) {
      return res.status(404).json({ message: "No hay KM Registrado" });
    }

    res.json(resultado[0]);
  } catch (error) {
    console.error("❌ Error al obtener registro pendiente:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor.", details: error.message });
  }
};

export const obtenerCombustibleActual = async (req, res) => {
  const { id_vehiculo } = req.params;

  try {
    const [resultado] = await pool.query(
      `
          SELECT combustible_salida, combustible_regreso
          FROM registros r INNER JOIN vehiculos v
          ON r.id_vehiculo = v.id
          WHERE r.id_vehiculo = ?
          ORDER BY km_regreso DESC
          LIMIT 1;
        `,
      [id_vehiculo]
    );

    if (resultado.length === 0) {
      return res.status(404).json({ message: "No hay combustible Registrado" });
    }

    res.json(resultado[0]);
  } catch (error) {
    console.error("❌ Error al obtener registro pendiente:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor.", details: error.message });
  }
};

// 🚗 Registrar la salida de un vehículo
export const registrarSalida = async (req, res) => {
  const {
    id_empleado,
    id_vehiculo,
    id_ubicacion_salida,
    km_salida,
    combustible_salida,
    comentario_salida,
  } = req.body;

  try {
    const fecha_salida = new Date(); // Ahora
    const fecha_regreso = null;

    await pool.query(
      `CALL GestionarRegistros(
        'InsertarSalida',
        NULL,     -- _id
        ?,        -- _id_empleado
        ?,        -- _id_vehiculo
        ?,        -- _id_ubicacion_salida
        NULL,     -- _id_ubicacion_regreso
        ?,        -- _km_salida
        NULL,     -- _km_regreso
        ?,        -- _combustible_salida
        NULL,     -- _combustible_regreso
        ?,        -- _comentario_salida
        NULL,     -- _comentario_regreso
        ?,        -- _fecha_salida
        NULL,     -- _fecha_regreso
        @insertId
      );`,
      [
        id_empleado,
        id_vehiculo,
        id_ubicacion_salida,
        km_salida,
        combustible_salida,
        comentario_salida,
        fecha_salida,
      ]
    );

    const [result] = await pool.query("SELECT @insertId AS insertId");

    res.status(201).json({
      message: "Registro de salida creado.",
      id_registro: result[0].insertId,
    });
  } catch (error) {
    console.error("❌ Error al registrar salida:", error);
    res
      .status(500)
      .json({ error: "Error al registrar salida.", details: error.message });
  }
};

// 🚗 Registrar el regreso de un vehículo
export const registrarRegreso = async (req, res) => {
  const {
    id_registro,
    id_empleado,
    id_ubicacion_regreso,
    km_regreso,
    combustible_regreso,
    comentario_regreso,
  } = req.body;

  try {
    const fecha_regreso = new Date();

    await pool.query(
      `CALL GestionarRegistros(
        'RegistrarRegreso',
        ?,     -- _id
        ?,     -- _id_empleado
        NULL,  -- _id_vehiculo
        NULL,  -- _id_ubicacion_salida
        ?,     -- _id_ubicacion_regreso
        NULL,  -- _km_salida
        ?,     -- _km_regreso
        NULL,  -- _combustible_salida
        ?,     -- _combustible_regreso
        NULL,  -- _comentario_salida
        ?,     -- _comentario_regreso
        NULL,  -- _fecha_salida
        ?,     -- _fecha_regreso
        @insertId
      );`,
      [
        id_registro,
        id_empleado,
        id_ubicacion_regreso,
        km_regreso,
        combustible_regreso,
        comentario_regreso,
        fecha_regreso,
      ]
    );

    res.json({ message: "Registro de regreso actualizado." });
  } catch (error) {
    console.error("❌ Error al registrar regreso:", error);
    res
      .status(500)
      .json({ error: "Error al registrar regreso.", details: error.message });
  }
};

// 📸 Asociar imágenes a un registro
// 📸 Asociar imágenes a un registro
export const asociarImagenes = async (req, res) => {
  const id_registro = req.params.id;
  const archivos = req.files;

  console.log("📌 Recibiendo petición para subir imágenes...");
  console.log("📌 ID Registro recibido:", id_registro);
  console.log("📌 Archivos recibidos:", archivos);

  if (!id_registro) {
    console.error("❌ ERROR: id_registro no se recibió.");
    return res
      .status(400)
      .json({ error: "El ID del registro es obligatorio." });
  }

  if (!archivos || archivos.length === 0) {
    console.error("❌ ERROR: No se enviaron archivos.");
    return res.status(400).json({ error: "No se enviaron archivos." });
  }

  try {
    for (const file of archivos) {
      console.log("📂 Guardando archivo:", file.filename);

      // ✅ Usar HOST dinámico desde variables de entorno
      const baseUrl = process.env.HOST || "http://localhost:3000";
      const url = `${baseUrl}/uploads/registros/${file.filename}`;

      // ✅ Insertar imagen en `images`
      const [imageResult] = await pool.query(
        "INSERT INTO images (type, url) VALUES (?, ?)",
        [file.mimetype, url]
      );

      console.log("✅ Imagen insertada, ID:", imageResult.insertId);

      const id_image = imageResult.insertId;

      if (!id_image) {
        console.error(
          "❌ ERROR: No se pudo obtener el ID de la imagen insertada."
        );
        throw new Error("No se pudo obtener el ID de la imagen insertada.");
      }

      // ✅ Asociar la imagen al registro
      console.log(
        "🔗 Asociando imagen ID",
        id_image,
        "con registro ID",
        id_registro
      );
      const [relationResult] = await pool.query(
        "CALL GestionarImagenes('Insertar', ?, ?);",
        [id_registro, id_image]
      );

      console.log("✅ Imagen asociada correctamente:", relationResult);
    }

    res.json({ message: "Imágenes asociadas correctamente." });
  } catch (error) {
    console.error("❌ ERROR al subir imágenes:", error);
    res
      .status(500)
      .json({ error: "Error al subir imágenes.", details: error.message });
  }
};

// 📸 Obtener un registro con sus imágenes
export const obtenerRegistroConImagenes = async (req, res) => {
  const { id } = req.params;

  try {
    const [[registro]] = await pool.query(
      `
      SELECT r.*, v.placa, e.nombre AS empleado
      FROM registros r
      JOIN vehiculos v ON r.id_vehiculo = v.id
      JOIN empleados e ON r.id_empleado = e.id
      WHERE r.id = ?
    `,
      [id]
    );

    if (!registro)
      return res.status(404).json({ error: "Registro no encontrado." });

    const [imagenes] = await pool.query(
      `
      SELECT i.url FROM registro_images ri
      JOIN images i ON ri.id_image = i.id_image
      WHERE ri.id_registro = ?
    `,
      [id]
    );

    res.json({ registro, imagenes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo el registro." });
  }
};

export const getCiudades = async (req, res) => {
  try {
    const [result] = await pool.query("SELECT * FROM ciudades");
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
