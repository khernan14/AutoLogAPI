import pool from "../../config/connectionToSql.js";

// Helpers de validación de FKs
async function fkSO(id) {
    const [r] = await pool.query("SELECT id FROM sales_orders WHERE id = ? LIMIT 1", [id]);
    return r.length > 0;
}
async function fkActivo(id) {
    const [r] = await pool.query("SELECT id FROM activos WHERE id = ? LIMIT 1", [id]);
    return r.length > 0;
}
async function fkClienteSite(id) {
    const [r] = await pool.query("SELECT id FROM clientes_sites WHERE id = ? LIMIT 1", [id]);
    return r.length > 0;
}
async function fkBodega(id) {
    const [r] = await pool.query("SELECT id FROM bodegas WHERE id = ? LIMIT 1", [id]);
    return r.length > 0;
}

// Crear línea de SO (con movimiento opcional del activo en la misma transacción)
export const createLineaSO = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id_sales_order, id_activo, accion, observacion = null, movimiento } = req.body;

        // FKs
        if (!(await fkSO(id_sales_order))) { conn.release(); return res.status(400).json({ message: "id_sales_order no existe." }); }
        if (!(await fkActivo(id_activo))) { conn.release(); return res.status(400).json({ message: "id_activo no existe." }); }

        // Reglas de movimiento
        let tipo_destino = null, id_cliente_site = null, id_bodega = null;
        if (movimiento) {
            tipo_destino = movimiento.tipo_destino || null;
            id_cliente_site = movimiento.id_cliente_site || null;
            id_bodega = movimiento.id_bodega || null;

            if (tipo_destino === "Cliente") {
                if (!(await fkClienteSite(id_cliente_site))) { conn.release(); return res.status(400).json({ message: "id_cliente_site no existe." }); }
            }
            if (tipo_destino === "Bodega") {
                if (!(await fkBodega(id_bodega))) { conn.release(); return res.status(400).json({ message: "id_bodega no existe." }); }
            }
        }

        await conn.beginTransaction();

        // 1) Insertar línea SO
        const [insLinea] = await conn.query(
            `INSERT INTO sales_orders_activos (id_sales_order, id_activo, accion)
       VALUES (?, ?, ?)`,
            [id_sales_order, id_activo, accion]
        );

        // 2) Si corresponde, mover activo (cierra ubicación anterior y abre nueva)
        if (accion === "Instalacion" || accion === "Reemplazo") {
            if (!tipo_destino) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ message: "Se requiere 'movimiento' con tipo_destino para Instalacion/Reemplazo." });
            }

            // cerrar ubicación actual
            await conn.query(
                `UPDATE ubicaciones_activos
         SET fecha_fin = NOW()
         WHERE id_activo = ? AND fecha_fin IS NULL`,
                [id_activo]
            );

            // abrir nueva
            await conn.query(
                `INSERT INTO ubicaciones_activos
         (id_activo, tipo_destino, id_cliente_site, id_bodega, fecha_inicio, motivo, usuario_responsable)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
                [
                    id_activo,
                    tipo_destino,
                    tipo_destino === "Cliente" ? id_cliente_site : null,
                    tipo_destino === "Bodega" ? id_bodega : null,
                    observacion || `SO ${id_sales_order} - ${accion}`,
                    null // usuario_responsable opcional
                ]
            );
        }

        await conn.commit();

        // Responder con línea + snapshot simple
        const [row] = await conn.query(
            `SELECT soa.*, a.codigo AS activo_codigo, a.nombre AS activo_nombre
       FROM sales_orders_activos soa
       JOIN activos a ON soa.id_activo = a.id
       WHERE soa.id = ?`,
            [insLinea.insertId]
        );

        res.status(201).json(row[0]);
    } catch (e) {
        try { await conn.rollback(); } catch (_) { }
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
};

// Listar líneas por SO
export const getLineasBySO = async (req, res) => {
    try {
        const { id_sales_order } = req.params;
        const [rows] = await pool.query(
            `SELECT soa.*, a.codigo AS activo_codigo, a.nombre AS activo_nombre
       FROM sales_orders_activos soa
       JOIN activos a ON soa.id_activo = a.id
       WHERE soa.id_sales_order = ?
       ORDER BY soa.id DESC`,
            [id_sales_order]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
