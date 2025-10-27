import pool from "../../config/connectionToSql.js";

// ==============================
// Helper SQL para ubicación actual
// ==============================
const LOC_ACTUAL_SQL = `
  SELECT ua.*
  FROM ubicaciones_activos ua
  WHERE ua.id_activo = a.id
    AND ua.fecha_fin IS NULL
  ORDER BY ua.fecha_inicio DESC
  LIMIT 1
`;

// Helper para asegurar la tabla sequences y devulve la fila (creada sino existe)
async function ensureSequenceRow(conn, name, baseFromActivos = 1000) {
  // 1) Crear tabla si no existe
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sequences (
      name  VARCHAR(100) PRIMARY KEY,
      value BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 2) Intentar leer fila
  const [[row]] = await conn.query(
    "SELECT value FROM sequences WHERE name = ?",
    [name]
  );

  if (row) return row;

  // 3) Si no existe, alinear con activos (máximo código numérico o base)
  const [[mx]] = await conn.query(
    `
    SELECT GREATEST(
      COALESCE(MAX(CAST(REGEXP_REPLACE(codigo, '[^0-9]', '') AS UNSIGNED)), ?),
      ?
    ) AS maxv
    FROM activos
  `,
    [baseFromActivos, baseFromActivos]
  );

  const base = mx?.maxv ?? baseFromActivos;

  await conn.query("INSERT INTO sequences (name, value) VALUES (?, ?)", [
    name,
    base,
  ]);

  return { value: base };
}

export const getNextCodigo = async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    const seq = await ensureSequenceRow(conn, "activos_codigo", 1000);
    return res.json({ next: String(Number(seq.value) + 1) });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err?.message || "No se pudo obtener el próximo código" });
  } finally {
    conn.release();
  }
};

// ==============================
// Listar todos los activos (con ubicación actual resumida)
// ==============================
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

// ==============================
// Obtener 1 activo por ID (con ubicación actual y detalle)
// ==============================
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
            ORDER BY a.fecha_registro ASC;
            `,
      [idCliente]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// Crear activo (ahora con ubicación inicial en bodega)
// ==============================
export const createActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      codigo: bodyCodigo,
      nombre,
      modelo = null,
      serial_number = null,
      tipo = "Otro",
      estatus = "Activo",
      id_bodega,
      usuario_responsable = null,
    } = req.body;

    if (!id_bodega) {
      connection.release();
      return res
        .status(400)
        .json({ message: "Debe especificar la bodega inicial" });
    }
    if (!nombre || !String(nombre).trim()) {
      connection.release();
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    await connection.beginTransaction();

    // ¿Trae código manual?
    const customCodigo = (bodyCodigo ?? "").trim();
    let codigoFinal = null;

    if (customCodigo) {
      // Validar duplicado
      const [dup] = await connection.query(
        "SELECT id FROM activos WHERE codigo = ? LIMIT 1",
        [customCodigo]
      );
      if (dup.length > 0) {
        await connection.rollback();
        connection.release();
        return res
          .status(409)
          .json({ message: "Ya existe un activo con ese 'codigo'." });
      }
      codigoFinal = customCodigo;
    } else {
      // Generar consecutivo de forma segura (sin reservar si se cae luego,
      // pero como estamos dentro de la misma transacción está ok)
      await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");

      // Asegurar fila en sequences y bloquearla
      await ensureSequenceRow(connection, "activos_codigo", 1000);

      const [[seq]] = await connection.query(
        "SELECT value FROM sequences WHERE name = 'activos_codigo' FOR UPDATE"
      );

      const nextVal = Number(seq.value) + 1;

      // Actualizar secuencia
      await connection.query(
        "UPDATE sequences SET value = ? WHERE name = 'activos_codigo'",
        [nextVal]
      );

      codigoFinal = String(nextVal);
    }

    // insertar activo
    const [result] = await connection.query(
      "INSERT INTO activos (codigo, nombre, modelo, serial_number, tipo, estatus) VALUES (?, ?, ?, ?, ?, ?)",
      [codigoFinal, nombre.trim(), modelo, serial_number, tipo, estatus]
    );
    const activoId = result.insertId;

    // insertar ubicación inicial en bodega
    await connection.query(
      `INSERT INTO ubicaciones_activos
        (id_activo, tipo_destino, id_bodega, fecha_inicio, motivo, usuario_responsable)
       VALUES (?, 'Bodega', ?, NOW(), 'Ingreso inicial', ?)`,
      [activoId, id_bodega, usuario_responsable]
    );

    await connection.commit();

    const [[row]] = await connection.query(
      "SELECT * FROM activos WHERE id = ?",
      [activoId]
    );
    res.status(201).json(row);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Entrada duplicada." });
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// ==============================
// Actualizar activo
// ==============================
export const updateActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      codigo,
      nombre,
      modelo = null,
      serial_number = null,
      tipo = "Otro",
      estatus = "Activo",
    } = req.body;

    const [exists] = await connection.query(
      "SELECT id FROM activos WHERE id = ?",
      [id]
    );
    if (exists.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Activo no encontrado" });
    }

    const [dup] = await connection.query(
      "SELECT id FROM activos WHERE codigo = ? AND id <> ? LIMIT 1",
      [codigo, id]
    );
    if (dup.length > 0) {
      connection.release();
      return res
        .status(409)
        .json({ message: "Ya existe un activo con ese 'codigo'." });
    }

    const [result] = await connection.query(
      `UPDATE activos 
       SET codigo=?, nombre=?, modelo=?, serial_number=?, tipo=?, estatus=? 
       WHERE id=?`,
      [codigo.trim(), nombre.trim(), modelo, serial_number, tipo, estatus, id]
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ message: "Activo no encontrado" });
    }

    const [rows] = await connection.query(
      "SELECT * FROM activos WHERE id = ?",
      [id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// ==============================
// Listar activos por bodega
// ==============================
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
       ORDER BY ua.fecha_inicio DESC`,
      [idBodega]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// Listar activos en todas las bodegas
// ==============================
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
       ORDER BY b.nombre, ua.fecha_inicio DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Listar todos los activos con su ubicación actual (cliente o bodega)
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
        WHERE
        (e.id IS NULL OR ua.id_empleado = e.id)
        AND (u.nombre IS NULL OR u.nombre LIKE CONCAT('%', u.nombre, '%'))
        ORDER BY a.fecha_registro DESC;

    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==============================
// Ubicación actual de un activo
// ==============================
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

// ==============================
// Historial de ubicaciones
// ==============================
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
