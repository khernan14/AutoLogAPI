// controllers/Inventario/ubicaciones.controller.js
import pool from "../../config/connectionToSql.js";

// Validar destino y FKs
async function validateDestino({ tipo_destino, id_cliente_site, id_bodega }) {
    if (!["Cliente", "Bodega"].includes(tipo_destino)) {
        return { ok: false, msg: "tipo_destino inválido (Cliente|Bodega)" };
    }
    if (tipo_destino === "Cliente") {
        if (!id_cliente_site) return { ok: false, msg: "id_cliente_site es requerido para destino Cliente" };
        const [r] = await pool.query("SELECT id FROM clientes_sites WHERE id = ? LIMIT 1", [id_cliente_site]);
        if (r.length === 0) return { ok: false, msg: "id_cliente_site no existe" };
    }
    if (tipo_destino === "Bodega") {
        if (!id_bodega) return { ok: false, msg: "id_bodega es requerido para destino Bodega" };
        const [r] = await pool.query("SELECT id FROM bodegas WHERE id = ? LIMIT 1", [id_bodega]);
        if (r.length === 0) return { ok: false, msg: "id_bodega no existe" };
    }
    return { ok: true };
}

// Mover activo: cierra ubicación anterior y abre una nueva (transacción)
export const moverActivo = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id_activo, tipo_destino, id_cliente_site = null, id_bodega = null, motivo = null, usuario_responsable = null } = req.body;

        // existe activo?
        const [act] = await connection.query("SELECT id FROM activos WHERE id = ? LIMIT 1", [id_activo]);
        if (act.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Activo no encontrado" });
        }

        // validar destino
        const v = await validateDestino({ tipo_destino, id_cliente_site, id_bodega });
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
        const [ins] = await connection.query(
            `INSERT INTO ubicaciones_activos
       (id_activo, tipo_destino, id_cliente_site, id_bodega, fecha_inicio, motivo, usuario_responsable)
       VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
            [id_activo, tipo_destino, tipo_destino === "Cliente" ? id_cliente_site : null, tipo_destino === "Bodega" ? id_bodega : null, motivo, usuario_responsable]
        );

        await connection.commit();

        // devolver registro recién creado con nombres
        const [row] = await connection.query(
            `SELECT ua.*, cs.nombre AS site_nombre, c.nombre AS cliente_nombre, b.nombre AS bodega_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.id = ?`,
            [ins.insertId]
        );

        res.status(201).json(row[0]);

    } catch (error) {
        try { await pool.query("ROLLBACK"); } catch (_) { }
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Movimientos por activo (alias de historial, por si quieres ruta específica aquí)
export const getMovimientosByActivo = async (req, res) => {
    try {
        const { id_activo } = req.params;
        const [rows] = await pool.query(
            `SELECT ua.*, cs.nombre AS site_nombre, c.nombre AS cliente_nombre, b.nombre AS bodega_nombre
       FROM ubicaciones_activos ua
       LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
       LEFT JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN bodegas b ON ua.id_bodega = b.id
       WHERE ua.id_activo = ?
       ORDER BY ua.fecha_inicio DESC`,
            [id_activo]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
