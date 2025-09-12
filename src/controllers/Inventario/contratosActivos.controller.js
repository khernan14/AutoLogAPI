import pool from "../../config/connectionToSql.js";

// Asignar activo a detalle_adenda (temporal o permanente)
export const asignarActivoAContrato = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id_activo, id_detalle_adenda, es_temporal = 0 } = req.body;

        // FKs
        const [act] = await conn.query("SELECT id FROM activos WHERE id = ? LIMIT 1", [id_activo]);
        if (!act.length) { conn.release(); return res.status(404).json({ message: "Activo no encontrado" }); }

        const [det] = await conn.query(
            `SELECT da.id, ad.id_contrato FROM detalle_adenda da JOIN adendas ad ON da.id_adenda = ad.id WHERE da.id = ?`,
            [id_detalle_adenda]
        );
        if (!det.length) { conn.release(); return res.status(404).json({ message: "Detalle de adenda no encontrado" }); }

        await conn.beginTransaction();

        // Si es permanente, cerramos asignaciones permanentes previas de ese activo
        if (!es_temporal) {
            await conn.query(
                `UPDATE contratos_activos SET fecha_fin = NOW()
         WHERE id_activo = ? AND es_temporal = 0 AND fecha_fin IS NULL`,
                [id_activo]
            );
        }

        const [ins] = await conn.query(
            `INSERT INTO contratos_activos (id_activo, id_detalle_adenda, es_temporal, fecha_asignacion)
       VALUES (?, ?, ?, NOW())`,
            [id_activo, id_detalle_adenda, es_temporal ? 1 : 0]
        );

        await conn.commit();

        const [row] = await conn.query(
            `SELECT ca.*, da.modelo, ad.codigo AS adenda_codigo, co.codigo AS contrato_codigo, c.nombre AS cliente_nombre
       FROM contratos_activos ca
       JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
       JOIN adendas ad        ON da.id_adenda = ad.id
       JOIN contratos co      ON ad.id_contrato = co.id
       JOIN clientes c        ON co.id_cliente = c.id
       WHERE ca.id = ?`,
            [ins.insertId]
        );

        res.status(201).json(row[0]);
    } catch (e) {
        try { await conn.query("ROLLBACK"); } catch (_) { }
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

// Cerrar una asignación (fin de temporal o fin de contrato para ese activo)
export const cerrarAsignacion = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params; // id de contratos_activos
        const [exists] = await conn.query("SELECT * FROM contratos_activos WHERE id = ? AND fecha_fin IS NULL", [id]);
        if (!exists.length) { conn.release(); return res.status(404).json({ message: "Asignación no encontrada o ya cerrada" }); }

        await conn.query("UPDATE contratos_activos SET fecha_fin = NOW() WHERE id = ?", [id]);

        const [row] = await conn.query(
            `SELECT ca.*, da.modelo, ad.codigo AS adenda_codigo, co.codigo AS contrato_codigo
       FROM contratos_activos ca
       JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
       JOIN adendas ad        ON da.id_adenda = ad.id
       JOIN contratos co      ON ad.id_contrato = co.id
       WHERE ca.id = ?`,
            [id]
        );
        res.json(row[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

// Asignación vigente (la que aplica para facturar hoy)
export const getAsignacionVigenteByActivo = async (req, res) => {
    try {
        const { id_activo } = req.params;

        // Regla: si hay temporal abierta, priorizar esa; si no, la permanente abierta.
        const [rows] = await pool.query(
            `SELECT ca.*, da.modelo, da.precio_arrendamiento, da.costo_impresion_bn, da.costo_impresion_color,
              ad.codigo AS adenda_codigo, co.codigo AS contrato_codigo, c.nombre AS cliente_nombre
       FROM contratos_activos ca
       JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
       JOIN adendas ad        ON da.id_adenda = ad.id
       JOIN contratos co      ON ad.id_contrato = co.id
       JOIN clientes c        ON co.id_cliente = c.id
       WHERE ca.id_activo = ? AND ca.fecha_fin IS NULL
       ORDER BY ca.es_temporal DESC, ca.fecha_asignacion DESC
       LIMIT 1`,
            [id_activo]
        );

        res.json(rows[0] || null);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Listar activos asignados por contrato o por adenda
export const getActivosPorContrato = async (req, res) => {
    try {
        const { id_contrato } = req.params;
        const [rows] = await pool.query(
            `SELECT ca.*, a.codigo AS activo_codigo, a.nombre AS activo_nombre, da.modelo, ad.codigo AS adenda_codigo
       FROM contratos_activos ca
       JOIN activos a        ON ca.id_activo = a.id
       JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
       JOIN adendas ad        ON da.id_adenda = ad.id
       WHERE ad.id_contrato = ?
       ORDER BY ca.fecha_asignacion DESC`,
            [id_contrato]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getActivosPorAdenda = async (req, res) => {
    try {
        const { id_adenda } = req.params;
        const [rows] = await pool.query(
            `SELECT ca.*, a.codigo AS activo_codigo, a.nombre AS activo_nombre, da.modelo
       FROM contratos_activos ca
       JOIN activos a         ON ca.id_activo = a.id
       JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
       WHERE da.id_adenda = ?
       ORDER BY ca.fecha_asignacion DESC`,
            [id_adenda]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
