// controllers/AutoLog/register.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js";
import NotificationConfigService from "../../../services/notifications/NotificationConfigService.js";
import NotificationService from "../../../services/notifications/NotificationService.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const isNonEmptyStr = (s) => typeof s === "string" && s.trim().length > 0;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

// 📌 Obtener registro activo del empleado
export const obtenerRegistroPendienteEmpleado = async (req, res) => {
  const idEmpleado = toInt(req.params.id_empleado);
  if (Number.isNaN(idEmpleado))
    return res.status(400).json({ message: "id_empleado inválido" });

  try {
    const [resultado] = await pool.execute(
      `SELECT r.id AS id_registro, r.id_vehiculo, v.placa, 'En Uso' AS estado
         FROM registros r
         INNER JOIN vehiculos v ON r.id_vehiculo = v.id
        WHERE r.id_empleado = ? AND r.fecha_regreso IS NULL
        LIMIT 1`,
      [idEmpleado]
    );

    if (resultado.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay registros pendientes para este empleado." });
    }

    return res.json(resultado[0]);
  } catch (err) {
    logger.error({ err }, "obtenerRegistroPendienteEmpleado failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

export const obtenerKmActual = async (req, res) => {
  const idVehiculo = toInt(req.params.id_vehiculo);
  if (Number.isNaN(idVehiculo))
    return res.status(400).json({ message: "id_vehiculo inválido" });

  try {
    const [resultado] = await pool.execute(
      `SELECT r.km_regreso, r.km_salida
         FROM registros r
        WHERE r.id_vehiculo = ?
        ORDER BY r.km_regreso DESC
        LIMIT 1`,
      [idVehiculo]
    );

    if (resultado.length === 0) {
      return res.status(404).json({ message: "No hay KM Registrado" });
    }

    return res.json(resultado[0]);
  } catch (err) {
    logger.error({ err }, "obtenerKmActual failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

export const obtenerCombustibleActual = async (req, res) => {
  const idVehiculo = toInt(req.params.id_vehiculo);
  if (Number.isNaN(idVehiculo))
    return res.status(400).json({ message: "id_vehiculo inválido" });

  try {
    const [resultado] = await pool.execute(
      `SELECT r.combustible_salida, r.combustible_regreso
         FROM registros r
        WHERE r.id_vehiculo = ?
        ORDER BY r.km_regreso DESC
        LIMIT 1`,
      [idVehiculo]
    );

    if (resultado.length === 0) {
      return res.status(404).json({ message: "No hay combustible Registrado" });
    }

    return res.json(resultado[0]);
  } catch (err) {
    logger.error({ err }, "obtenerCombustibleActual failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

// 🚙 Registrar salida (con imágenes)
export const registrarSalida = async (req, res) => {
  const {
    id_empleado,
    id_vehiculo,
    id_ubicacion_salida,
    km_salida,
    combustible_salida,
    comentario_salida,
  } = req.body ?? {};

  const idEmpleado = toInt(id_empleado);
  const idVehiculo = toInt(id_vehiculo);
  const idUbicacionSalida = toInt(id_ubicacion_salida);
  const kmSalidaNum = toInt(km_salida);

  if ([idEmpleado, idVehiculo, idUbicacionSalida].some(Number.isNaN)) {
    return res.status(400).json({ error: "IDs inválidos" });
  }
  if (Number.isNaN(kmSalidaNum)) {
    return res.status(400).json({ error: "km_salida inválido" });
  }

  const archivos = req.files;
  if (!archivos || archivos.length === 0) {
    return res.status(400).json({ error: "Debes subir al menos una imagen." });
  }
  for (const f of archivos) {
    if (!ALLOWED_MIME.has(f.mimetype)) {
      return res
        .status(400)
        .json({ error: `Tipo de archivo no permitido: ${f.mimetype}` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fecha_salida = new Date();

    // ⚠️ Mantengo tu firma de SP y @insertId
    await conn.execute(
      `CALL GestionarRegistros(
        'InsertarSalida',
        NULL, ?, ?, ?, NULL,
        ?, NULL, ?, NULL,
        ?, NULL, ?, NULL,
        @insertId
      )`,
      [
        idEmpleado,
        idVehiculo,
        idUbicacionSalida,
        kmSalidaNum,
        toInt(combustible_salida) ?? null,
        isNonEmptyStr(comentario_salida) ? comentario_salida.trim() : null,
        fecha_salida,
      ]
    );

    const [[{ insertId }]] = await conn.execute("SELECT @insertId AS insertId");

    for (const file of archivos) {
      const baseUrl = (process.env.HOST || process.env.APP_URL || "").replace(
        /\/$/,
        ""
      );
      const url = `${baseUrl}/uploads/registros/${file.filename}`;

      const [imageResult] = await conn.execute(
        "INSERT INTO images (type, url) VALUES (?, ?)",
        [file.mimetype, url]
      );

      const id_image = imageResult.insertId;
      await conn.execute("CALL GestionarImagenes('Insertar', ?, ?)", [
        insertId,
        id_image,
      ]);
    }

    await conn.commit();

    // === Notificación post-commit (no bloquea la respuesta si falla) ===
    (async () => {
      try {
        const enabled = await NotificationConfigService.isEnabled(
          "VEHICULO_SALIDA"
        );
        if (!enabled) return;

        const [[info]] = await pool.execute(
          `SELECT 
             u.nombre  AS employeeName,
             v.placa   AS vehicleName,
             su.nombre AS supervisorName
           FROM empleados e
           JOIN usuarios u       ON u.id_usuario = e.id_usuario
           LEFT JOIN empleados s ON s.id = e.supervisor_id
           LEFT JOIN usuarios su ON su.id_usuario = s.id_usuario
           JOIN vehiculos v      ON v.id = ?
           WHERE e.id = ?
           LIMIT 1`,
          [idVehiculo, idEmpleado]
        );

        const tz = "America/Tegucigalpa";
        const fecha = new Date().toLocaleDateString("es-HN", { timeZone: tz });
        const hora = new Date().toLocaleTimeString("es-HN", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        await NotificationService.createAndSend({
          clave: "VEHICULO_SALIDA",
          payload: {
            employeeName: info?.employeeName || "",
            vehicleName: info?.vehicleName || "",
            supervisorName: info?.supervisorName || "",
            fecha,
            hora,
            registroId: insertId,
            vehiculo_id: idVehiculo,
            empleado_id: idEmpleado,
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/vehiculos/registros/${insertId}`,
          },
          creado_por: req.user?.id || null, // <- consistente con tu JWT
        });
      } catch (notifErr) {
        logger.warn({ err: notifErr }, "Notificación SALIDA falló");
      }
    })().catch(() => {
      /* noop */
    });

    return res.status(201).json({
      message: "Registro de salida y subida de imágenes exitosos.",
      id_registro: insertId,
    });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "registrarSalida failed");
    return res.status(500).json({
      error: "Error al registrar salida con imágenes.",
    });
  } finally {
    conn.release();
  }
};

// 🚙 Registrar regreso (con imágenes)
export const registrarRegreso = async (req, res) => {
  const {
    id_registro,
    id_empleado,
    id_ubicacion_regreso,
    km_regreso,
    combustible_regreso,
    comentario_regreso,
  } = req.body ?? {};

  const idRegistro = toInt(id_registro);
  const idEmpleado = toInt(id_empleado);
  const idUbicacionReg = toInt(id_ubicacion_regreso);
  const kmRegresoNum = toInt(km_regreso);

  if ([idRegistro, idEmpleado, idUbicacionReg].some(Number.isNaN)) {
    return res.status(400).json({ error: "IDs inválidos" });
  }
  if (Number.isNaN(kmRegresoNum)) {
    return res.status(400).json({ error: "km_regreso inválido" });
  }

  const archivos = req.files;
  if (!archivos || archivos.length === 0) {
    return res.status(400).json({ error: "Debes subir al menos una imagen." });
  }
  for (const f of archivos) {
    if (!ALLOWED_MIME.has(f.mimetype)) {
      return res
        .status(400)
        .json({ error: `Tipo de archivo no permitido: ${f.mimetype}` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fecha_regreso = new Date();

    await conn.execute(
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
      )`,
      [
        idRegistro,
        idEmpleado,
        idUbicacionReg,
        kmRegresoNum,
        toInt(combustible_regreso) ?? null,
        isNonEmptyStr(comentario_regreso) ? comentario_regreso.trim() : null,
        fecha_regreso,
      ]
    );

    // Asociar imágenes al registro existente
    for (const file of archivos) {
      const baseUrl = (process.env.HOST || process.env.APP_URL || "").replace(
        /\/$/,
        ""
      );
      const url = `${baseUrl}/uploads/registros/${file.filename}`;

      const [imageResult] = await conn.execute(
        "INSERT INTO images (type, url) VALUES (?, ?)",
        [file.mimetype, url]
      );

      const id_image = imageResult.insertId;
      await conn.execute("CALL GestionarImagenes('Insertar', ?, ?)", [
        idRegistro,
        id_image,
      ]);
    }

    await conn.commit();

    // === Notificación post-commit ===
    (async () => {
      try {
        const enabled = await NotificationConfigService.isEnabled(
          "VEHICULO_REGRESO"
        );
        if (!enabled) return;

        const [[veh]] = await pool.execute(
          `SELECT v.id AS vehiculo_id, v.placa AS vehicleName
             FROM registros r 
             JOIN vehiculos v ON v.id = r.id_vehiculo
            WHERE r.id = ?
            LIMIT 1`,
          [idRegistro]
        );

        const [[info]] = await pool.execute(
          `SELECT 
             u.nombre  AS employeeName,
             su.nombre AS supervisorName
           FROM empleados e
           JOIN usuarios u       ON u.id_usuario = e.id_usuario
           LEFT JOIN empleados s ON s.id = e.supervisor_id
           LEFT JOIN usuarios su ON su.id_usuario = s.id_usuario
          WHERE e.id = ?
          LIMIT 1`,
          [idEmpleado]
        );

        const tz = "America/Tegucigalpa";
        const fecha = new Date().toLocaleDateString("es-HN", { timeZone: tz });
        const hora = new Date().toLocaleTimeString("es-HN", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        await NotificationService.createAndSend({
          clave: "VEHICULO_REGRESO",
          payload: {
            employeeName: info?.employeeName || "",
            vehicleName: veh?.vehicleName || "",
            supervisorName: info?.supervisorName || "",
            fecha,
            hora,
            registroId: idRegistro,
            vehiculo_id: veh?.vehiculo_id ?? null,
            empleado_id: idEmpleado,
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/vehiculos/registros/${idRegistro}`,
          },
          creado_por: req.user?.id || null,
        });
      } catch (notifErr) {
        logger.warn({ err: notifErr }, "Notificación REGRESO falló");
      }
    })().catch(() => {
      /* noop */
    });

    return res.status(200).json({
      message: "Registro de regreso y subida de imágenes exitosos.",
    });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "registrarRegreso failed");
    return res.status(500).json({
      error: "Error al registrar regreso con imágenes.",
    });
  } finally {
    conn.release();
  }
};

// 📸 Asociar imágenes a un registro (transaccional)
export const asociarImagenes = async (req, res) => {
  const idRegistro = toInt(req.params.id);
  if (Number.isNaN(idRegistro)) {
    return res.status(400).json({
      error: "El ID del registro es obligatorio y debe ser numérico.",
    });
  }

  const archivos = req.files;
  if (!archivos || archivos.length === 0) {
    return res.status(400).json({ error: "No se enviaron archivos." });
  }
  for (const f of archivos) {
    if (!ALLOWED_MIME.has(f.mimetype)) {
      return res
        .status(400)
        .json({ error: `Tipo de archivo no permitido: ${f.mimetype}` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const file of archivos) {
      const baseUrl = (
        process.env.HOST ||
        process.env.APP_URL ||
        "http://localhost:3000"
      ).replace(/\/$/, "");
      const url = `${baseUrl}/uploads/registros/${file.filename}`;

      const [imageResult] = await conn.execute(
        "INSERT INTO images (type, url) VALUES (?, ?)",
        [file.mimetype, url]
      );

      const id_image = imageResult.insertId;
      if (!id_image)
        throw new Error("No se pudo obtener el ID de la imagen insertada.");

      await conn.execute("CALL GestionarImagenes('Insertar', ?, ?)", [
        idRegistro,
        id_image,
      ]);
    }

    await conn.commit();
    return res.json({ message: "Imágenes asociadas correctamente." });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "asociarImagenes failed");
    return res.status(500).json({ error: "Error al subir imágenes." });
  } finally {
    conn.release();
  }
};

// 📸 Obtener un registro con sus imágenes
export const obtenerRegistroConImagenes = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [[registro]] = await pool.execute(
      `SELECT r.*, v.placa, u.nombre AS empleado
         FROM registros r
         JOIN vehiculos v ON r.id_vehiculo = v.id
         JOIN empleados e ON r.id_empleado = e.id
         JOIN usuarios  u ON u.id_usuario = e.id_usuario
        WHERE r.id = ?
        LIMIT 1`,
      [id]
    );

    if (!registro)
      return res.status(404).json({ error: "Registro no encontrado." });

    const [imagenes] = await pool.execute(
      `SELECT i.url
         FROM registro_images ri
         JOIN images i ON ri.id_image = i.id_image
        WHERE ri.id_registro = ?`,
      [id]
    );

    return res.json({ registro, imagenes });
  } catch (err) {
    logger.error({ err }, "obtenerRegistroConImagenes failed");
    return res.status(500).json({ error: "Error obteniendo el registro." });
  }
};

export const getCiudades = async (_req, res) => {
  try {
    const [result] = await pool.execute("SELECT * FROM ciudades");
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "getCiudades failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
