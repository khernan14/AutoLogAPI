// controllers/Inventario/ubicaciones.controller.js
import pool from "../../config/connectionToSql.js";

// ✅ Validar destino y FKs (ahora incluye Empleado)
async function validateDestino({
  tipo_destino,
  id_cliente_site,
  id_bodega,
  id_empleado,
}) {
  if (!["Cliente", "Bodega", "Empleado"].includes(tipo_destino)) {
    return {
      ok: false,
      msg: "tipo_destino inválido (Cliente|Bodega|Empleado)",
    };
  }

  if (tipo_destino === "Cliente") {
    if (!id_cliente_site)
      return {
        ok: false,
        msg: "id_cliente_site es requerido para destino Cliente",
      };
    const [r] = await pool.query(
      "SELECT id FROM clientes_sites WHERE id = ? LIMIT 1",
      [id_cliente_site]
    );
    if (r.length === 0) return { ok: false, msg: "id_cliente_site no existe" };
  }

  if (tipo_destino === "Bodega") {
    if (!id_bodega)
      return { ok: false, msg: "id_bodega es requerido para destino Bodega" };
    const [r] = await pool.query(
      "SELECT id FROM bodegas WHERE id = ? LIMIT 1",
      [id_bodega]
    );
    if (r.length === 0) return { ok: false, msg: "id_bodega no existe" };
  }

  if (tipo_destino === "Empleado") {
    if (!id_empleado)
      return {
        ok: false,
        msg: "id_empleado es requerido para destino Empleado",
      };
    const [r] = await pool.query(
      "SELECT e.id FROM empleados e WHERE e.id = ? LIMIT 1",
      [id_empleado]
    );
    if (r.length === 0) return { ok: false, msg: "id_empleado no existe" };
  }

  // (Opcional) Validación soft de exclusividad en el payload
  const filled = [
    id_cliente_site ? "id_cliente_site" : null,
    id_bodega ? "id_bodega" : null,
    id_empleado ? "id_empleado" : null,
  ].filter(Boolean);
  if (filled.length > 1) {
    return {
      ok: false,
      msg: "Solo debe venir el ID del destino correspondiente",
    };
  }

  return { ok: true };
}

// 🧩 Helper para armar columnas por destino y dejar null las otras
function destinoFields(
  tipo_destino,
  { id_cliente_site, id_bodega, id_empleado }
) {
  return {
    id_cliente_site: tipo_destino === "Cliente" ? id_cliente_site : null,
    id_bodega: tipo_destino === "Bodega" ? id_bodega : null,
    id_empleado: tipo_destino === "Empleado" ? id_empleado : null,
  };
}

// ✅ Mover activo: cierra ubicación anterior y abre una nueva (transacción)
export const moverActivo = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      id_activo,
      tipo_destino,
      id_cliente_site = null,
      id_bodega = null,
      id_empleado = null,
      motivo = null,
      usuario_responsable = null,
    } = req.body;

    // existe activo?
    const [act] = await connection.query(
      "SELECT id FROM activos WHERE id = ? LIMIT 1",
      [id_activo]
    );
    if (act.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Activo no encontrado" });
    }

    // validar destino
    const v = await validateDestino({
      tipo_destino,
      id_cliente_site,
      id_bodega,
      id_empleado,
    });
    if (!v.ok) {
      connection.release();
      return res.status(400).json({ message: v.msg });
    }

    await connection.beginTransaction();

    // cerrar ubicación actual (si hay)
    await connection.query(
      `UPDATE ubicaciones_activos 
       SET fecha_fin = NOW() 
       WHERE id_activo = ? AND fecha_fin IS NULL`,
      [id_activo]
    );

    // abrir nueva ubicación
    const f = destinoFields(tipo_destino, {
      id_cliente_site,
      id_bodega,
      id_empleado,
    });

    const [ins] = await connection.query(
      `INSERT INTO ubicaciones_activos
       (id_activo, tipo_destino, id_cliente_site, id_bodega, id_empleado, fecha_inicio, motivo, usuario_responsable)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [
        id_activo,
        tipo_destino,
        f.id_cliente_site,
        f.id_bodega,
        f.id_empleado,
        motivo,
        usuario_responsable,
      ]
    );

    await connection.commit();

    // devolver registro recién creado con nombres (incluye empleado/usuario)
    const [row] = await connection.query(
      `SELECT ua.*,
              cs.nombre   AS site_nombre,
              c.nombre    AS cliente_nombre,
              b.nombre    AS bodega_nombre,
              e.id        AS empleado_id,
              u.nombre    AS empleado_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c        ON cs.id_cliente = c.id
       LEFT JOIN bodegas b         ON ua.id_bodega = b.id
       LEFT JOIN empleados e       ON ua.id_empleado = e.id
       LEFT JOIN usuarios u        ON u.id_usuario = e.id_usuario
       WHERE ua.id = ?`,
      [ins.insertId]
    );

    res.status(201).json(row[0]);
  } catch (error) {
    // ❗ rollback correcto en el mismo connection
    try {
      await connection.rollback();
    } catch {}
    // Errores comunes de integridad: triggers y unique de "abierto"
    if (error && error.code === "ER_SIGNAL_EXCEPTION") {
      return res
        .status(400)
        .json({ message: error.sqlMessage || "Validación de destino falló" });
    }
    if (error && error.code === "ER_DUP_ENTRY") {
      // índice único (id_activo, abierto) impide dos ubicaciones abiertas
      return res
        .status(409)
        .json({ message: "El activo ya tiene una ubicación abierta" });
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// ✅ Movimientos por activo (historial) — ahora incluye datos del empleado
export const getMovimientosByActivo = async (req, res) => {
  try {
    const { id_activo } = req.params;
    const [rows] = await pool.query(
      `SELECT ua.*,
              cs.nombre   AS site_nombre,
              c.nombre    AS cliente_nombre,
              b.nombre    AS bodega_nombre,
              e.id        AS empleado_id,
              u.nombre    AS empleado_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c        ON cs.id_cliente = c.id
       LEFT JOIN bodegas b         ON ua.id_bodega = b.id
       LEFT JOIN empleados e       ON ua.id_empleado = e.id
       LEFT JOIN usuarios u        ON u.id_usuario = e.id_usuario
       WHERE ua.id_activo = ?
       ORDER BY ua.fecha_inicio DESC`,
      [id_activo]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
