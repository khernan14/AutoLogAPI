import pool from "../../config/connectionToSql.js";

/* ==============================
   Helper SQL para ubicación actual
============================== */
const LOC_ACTUAL_SQL = `
  SELECT ua.*
  FROM ubicaciones_activos ua
  WHERE ua.id_activo = a.id
    AND ua.fecha_fin IS NULL
  ORDER BY ua.fecha_inicio DESC
  LIMIT 1
`;

/* ==============================
   Helpers de secuencia
   NOTA: Ya no forzamos sincronización con regex compleja. 
   Confiamos en que la tabla 'sequences' en DB tiene la verdad absoluta.
============================== */

// Endpoint para obtener el próximo número de secuencia (Solo informativo)
export const getNextCodigo = async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    // Simplemente leemos el valor actual y sumamos 1 para mostrarlo en UI si fuera necesario
    // PERO NO LO RESERVAMOS NI LO CALCULAMOS BASADO EN LOS ACTIVOS EXISTENTES
    const [rows] = await conn.query(
      "SELECT value FROM sequences WHERE name = 'activos_codigo'"
    );

    let nextVal = 1;
    if (rows.length > 0) {
      nextVal = rows[0].value + 1;
    }

    // Devolvemos el formato esperado por defecto (01-XXXXX)
    const nextCodeFormatted = `01-${String(nextVal).padStart(5, "0")}`;

    return res.json({ next: nextCodeFormatted });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err?.message || "No se pudo obtener el próximo código" });
  } finally {
    conn.release();
  }
};

/* ==============================
   Utils
============================== */
const toStrOrNull = (v) =>
  v === undefined || v === null ? null : String(v).trim() || null;

/* ==============================
   Listar todos los activos (con ubicación actual resumida)
============================== */
export const getActivos = async (_req, res) => {
  try {
    // Ordenamos por consecutivo_interno si existe, o por ID para mantener orden cronológico real
    // Usar regex aquí también podría ser lento, mejor confiar en el orden natural o el ID
    const [rows] = await pool.query(`
      SELECT 
        a.*,
        (SELECT tipo_destino FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_tipo,
        (SELECT id_cliente_site FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_cliente_site,
        (SELECT id_bodega FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_bodega
      FROM activos a
      ORDER BY a.id DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Obtener 1 activo por ID (con ubicación actual y detalle)
============================== */
export const getActivoById = async (req, res) => {
  try {
    const { id } = req.params;

    const [activos] = await pool.query("SELECT * FROM activos WHERE id = ?", [
      id,
    ]);
    if (activos.length === 0)
      return res.status(404).json({ message: "Activo no encontrado" });

    const [loc] = await pool.query(
      `SELECT ua.*, 
             cs.nombre AS site_nombre, 
             c.nombre  AS cliente_nombre, 
             b.nombre  AS bodega_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.id_activo = ?
         AND ua.fecha_fin IS NULL
       ORDER BY ua.fecha_inicio ASC
       LIMIT 1`,
      [id]
    );

    res.json({
      ...activos[0],
      ubicacion_actual: loc[0] || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Listar activos por cliente
============================== */
export const getActivosByCliente = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const [rows] = await pool.query(
      `SELECT a.*,
              ua.tipo_destino,
              ua.id_cliente_site,
              ua.id_bodega,
              cs.nombre AS site_nombre,
              c.nombre  AS cliente_nombre,
              b.nombre  AS bodega_nombre
       FROM activos a
       JOIN ubicaciones_activos ua ON ua.id_activo = a.id
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.fecha_fin IS NULL
         AND c.id = ?
       ORDER BY a.fecha_registro ASC`,
      [idCliente]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Crear activo (DELEGADO A LA DB)
============================== */
export const createActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      codigo, // Si viene null/vacío, el Trigger lo generará
      nombre,
      modelo,
      serial_number,
      tipo,
      estatus,
      id_bodega,
      usuario_responsable,
    } = req.body || {};

    if (!id_bodega) {
      return res
        .status(400)
        .json({ message: "Debe especificar la bodega inicial" });
    }

    const nombreStr = toStrOrNull(nombre);
    if (!nombreStr) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    await connection.beginTransaction();

    /* CAMBIO CLAVE:
       Eliminamos toda la lógica de 'reserveNextCodigo'.
       Si 'codigo' no viene, mandamos NULL.
       El Trigger 'trg_activos_autocodigo' en MySQL se encargará del resto.
    */
    const codigoStr = toStrOrNull(codigo);

    // INSERT
    const [ins] = await connection.query(
      `INSERT INTO activos (codigo, nombre, modelo, serial_number, tipo, estatus)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        codigoStr, // Aquí pasamos NULL si no hay código manual
        nombreStr,
        toStrOrNull(modelo),
        toStrOrNull(serial_number),
        toStrOrNull(tipo) || "Otro",
        toStrOrNull(estatus) || "Activo",
      ]
    );

    const activoId = ins.insertId;

    await connection.query(
      `INSERT INTO ubicaciones_activos
        (id_activo, tipo_destino, id_bodega, fecha_inicio, motivo, usuario_responsable)
       VALUES (?, 'Bodega', ?, NOW(), 'Ingreso inicial', ?)`,
      [activoId, id_bodega, toStrOrNull(usuario_responsable)]
    );

    await connection.commit();

    // Devolvemos el activo recién creado (aquí ya vendrá con el código generado por el trigger)
    const [[row]] = await connection.query(
      `SELECT * FROM activos WHERE id = ?`,
      [activoId]
    );
    res.status(201).json(row);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Ya existe un activo con ese 'codigo'." });
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

/* ==============================
   Actualizar activo
============================== */
export const updateActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { codigo, nombre, modelo, serial_number, tipo, estatus } =
      req.body || {};

    const [exists] = await connection.query(
      `SELECT * FROM activos WHERE id=?`,
      [id]
    );
    if (!exists.length) {
      return res.status(404).json({ message: "Activo no encontrado" });
    }
    const current = exists[0];

    const rawCodigo = codigo === undefined ? undefined : toStrOrNull(codigo);
    const newCodigo = rawCodigo == null ? current.codigo : rawCodigo;

    const newNombre =
      nombre === undefined ? current.nombre : toStrOrNull(nombre);
    const newModelo =
      modelo === undefined ? current.modelo : toStrOrNull(modelo);
    const newSerie =
      serial_number === undefined
        ? current.serial_number
        : toStrOrNull(serial_number);
    const newTipo =
      tipo === undefined ? current.tipo : toStrOrNull(tipo) || "Otro";
    const newEstatus =
      estatus === undefined
        ? current.estatus
        : toStrOrNull(estatus) || "Activo";

    if (!newNombre) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    if (newCodigo !== current.codigo) {
      const [dup] = await connection.query(
        `SELECT id FROM activos WHERE codigo=? AND id<>? LIMIT 1`,
        [newCodigo, id]
      );
      if (dup.length) {
        return res
          .status(409)
          .json({ message: "Ya existe un activo con ese 'codigo'." });
      }
    }

    await connection.query(
      `UPDATE activos
          SET codigo=?, nombre=?, modelo=?, serial_number=?, tipo=?, estatus=?
        WHERE id=?`,
      [newCodigo, newNombre, newModelo, newSerie, newTipo, newEstatus, id]
    );

    const [[row]] = await connection.query(`SELECT * FROM activos WHERE id=?`, [
      id,
    ]);
    res.json(row);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Ya existe un activo con ese 'codigo'." });
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

/* ==============================
   Listar activos por bodega
============================== */
export const getActivosByBodega = async (req, res) => {
  try {
    const { idBodega } = req.params;
    // Ordenamos por ID para evitar lógica compleja de regex
    const [rows] = await pool.query(
      `SELECT a.*, ua.fecha_inicio,
              b.nombre AS bodega_nombre
       FROM activos a
       JOIN ubicaciones_activos ua ON ua.id_activo = a.id
       JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.fecha_fin IS NULL
         AND ua.tipo_destino = 'Bodega'
         AND b.id = ?
       ORDER BY a.id DESC, ua.fecha_inicio DESC`,
      [idBodega]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Listar activos en todas las bodegas
============================== */
export const getActivosEnBodegas = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, ua.fecha_inicio,
              b.id AS bodega_id, b.nombre AS bodega_nombre
       FROM activos a
       JOIN ubicaciones_activos ua ON ua.id_activo = a.id
       JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.fecha_fin IS NULL
         AND ua.tipo_destino = 'Bodega'
       ORDER BY b.nombre, a.id DESC, ua.fecha_inicio DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Listar todos los activos con su ubicación actual
============================== */
export const getActivosGlobal = async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.*,
        ua.tipo_destino,
        ua.id_cliente_site,
        ua.id_bodega,
        ua.id_empleado,
        cs.nombre AS site_nombre,
        c.nombre  AS cliente_nombre,
        b.nombre  AS bodega_nombre,
        u.nombre  AS empleado_nombre
      FROM activos a
      LEFT JOIN ubicaciones_activos ua
        ON ua.id_activo = a.id AND ua.fecha_fin IS NULL
      LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
      LEFT JOIN clientes      c  ON cs.id_cliente = c.id
      LEFT JOIN bodegas       b  ON ua.id_bodega  = b.id
      LEFT JOIN empleados     e  ON ua.id_empleado = e.id
      LEFT JOIN usuarios      u  ON e.id_usuario   = u.id_usuario
      ORDER BY a.id DESC, a.fecha_registro DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Ubicación actual de un activo
============================== */
export const getUbicacionActual = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT ua.*, 
              cs.nombre AS site_nombre, 
              c.nombre  AS cliente_nombre, 
              b.nombre  AS bodega_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.id_activo = ?
         AND ua.fecha_fin IS NULL
       ORDER BY ua.fecha_inicio DESC
       LIMIT 1`,
      [id]
    );
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ==============================
   Historial de ubicaciones (USANDO SNAPSHOTS)
============================== */
export const getHistorialUbicaciones = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT ua.*, 
              cs.nombre AS site_nombre, 
              cs.activo AS site_activo,
              c.nombre  AS cliente_nombre, 
              b.nombre  AS bodega_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.id_activo = ?
       ORDER BY ua.fecha_inicio DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
