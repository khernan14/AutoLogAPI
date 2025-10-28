// src/controllers/inventario/activos.controller.js
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
   Helpers de secuencia (tabla sequences)
============================== */
// Crea la tabla si no existe y garantiza la fila (sin mover valor si ya existe)
export async function ensureSequenceRow(conn, name, baseFromActivos = 1000) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sequences (
      name  VARCHAR(100) PRIMARY KEY,
      value BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Inserta fila si no existe; si existe, NO modifica value
  await conn.query(
    `
    INSERT INTO sequences (name, value)
    SELECT ?, GREATEST(
      COALESCE(MAX(CAST(REGEXP_REPLACE(codigo, '[^0-9]', '') AS UNSIGNED)), ?),
      ?
    )
    FROM activos
    ON DUPLICATE KEY UPDATE value = value
  `,
    [name, baseFromActivos, baseFromActivos]
  );

  const [[row]] = await conn.query(
    "SELECT value FROM sequences WHERE name = ?",
    [name]
  );
  return row; // { value: number }
}

// Reserva (consume) el siguiente número de forma atómica (dentro de la misma conexión/transacción)
export async function reserveNextCodigo(
  conn,
  name = "activos_codigo",
  base = 1000
) {
  await ensureSequenceRow(conn, name, base);

  await conn.query(
    `UPDATE sequences
     SET value = LAST_INSERT_ID(value + 1)
     WHERE name = ?`,
    [name]
  );

  const [[r]] = await conn.query(`SELECT LAST_INSERT_ID() AS next`);
  return String(r.next);
}

// Endpoint para mostrar el próximo código SIN consumirlo (peek)
export const getNextCodigo = async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureSequenceRow(conn, "activos_codigo", 1000);

    // GREATEST entre (sequences.value + 1) y (MAX código numérico en activos + 1)
    const [[row]] = await conn.query(`
      SELECT GREATEST(
        (SELECT value + 1 FROM sequences WHERE name = 'activos_codigo'),
        (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo, '[^0-9]', '') AS UNSIGNED)), 1000) + 1 FROM activos)
      ) AS next
    `);

    return res.json({ next: String(row.next) });
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
    const [rows] = await pool.query(`
      SELECT 
        a.*,
        (SELECT tipo_destino FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_tipo,
        (SELECT id_cliente_site FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_cliente_site,
        (SELECT id_bodega FROM (${LOC_ACTUAL_SQL}) AS loc) AS ubicacion_bodega
      FROM activos a
      ORDER BY CAST(REGEXP_REPLACE(a.codigo, '[^0-9]', '') AS UNSIGNED) DESC
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
   Crear activo (con generación de código + ubicación inicial en bodega)
============================== */
export const createActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      codigo,
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

    // Si no te mandan código, lo calculamos de forma segura (reserva/consume)
    let codigoStr = toStrOrNull(codigo);
    if (!codigoStr) {
      codigoStr = await reserveNextCodigo(connection, "activos_codigo", 1000);
    } else {
      // Si viene manual y es numérico mayor que la secuencia, la empujamos para no desincronizar
      await ensureSequenceRow(connection, "activos_codigo", 1000);
      const num = Number(codigoStr);
      if (Number.isFinite(num)) {
        await connection.query(
          `UPDATE sequences
           SET value = GREATEST(value, ?)
           WHERE name = 'activos_codigo'`,
          [num]
        );
      }
    }

    // INSERT con posible UNIQUE KEY violation (ER_DUP_ENTRY)
    const [ins] = await connection.query(
      `INSERT INTO activos (codigo, nombre, modelo, serial_number, tipo, estatus)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        codigoStr,
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
      // Con UNIQUE en DB
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

    // Mantén el valor actual si mandan vacío ("") o null
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

    // Si cambian el código, valida duplicado (DB tiene UNIQUE; esto es UX)
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
    const [rows] = await pool.query(
      `SELECT a.*, ua.fecha_inicio,
              b.nombre AS bodega_nombre
       FROM activos a
       JOIN ubicaciones_activos ua ON ua.id_activo = a.id
       JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.fecha_fin IS NULL
         AND ua.tipo_destino = 'Bodega'
         AND b.id = ?
       ORDER BY CAST(REGEXP_REPLACE(a.codigo, '[^0-9]', '') AS UNSIGNED) DESC, ua.fecha_inicio DESC`,
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
       ORDER BY b.nombre, CAST(REGEXP_REPLACE(a.codigo, '[^0-9]', '') AS UNSIGNED) DESC, ua.fecha_inicio DESC`
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
      ORDER BY CAST(REGEXP_REPLACE(a.codigo, '[^0-9]', '') AS UNSIGNED) DESC, a.fecha_registro DESC
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
   Historial de ubicaciones
============================== */
export const getHistorialUbicaciones = async (req, res) => {
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
       ORDER BY ua.fecha_inicio DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
