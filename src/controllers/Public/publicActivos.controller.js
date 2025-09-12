import pool from "../../config/connectionToSql.js";
// Si quieres QR PNG: npm i qrcode
import QRCode from "qrcode";

// Construye el objeto público (sin datos sensibles)
function mapPublicActivo({ activo, ubicacion, asignacion }) {
    const isEnCliente = !!ubicacion && ubicacion.tipo_destino === "Cliente";

    // Solo mostrar logo si físicamente está en Cliente.
    const cliente_logo_url = isEnCliente ? (ubicacion.cliente_logo_url || null) : null;

    return {
        codigo: activo.codigo,
        nombre: activo.nombre,
        modelo: activo.modelo,
        serial_number: activo.serial_number, // quítalo si no quieres exponerlo
        tipo: activo.tipo,
        estatus: activo.estatus,
        fecha_registro: activo.fecha_registro,

        ubicacion_actual: ubicacion
            ? {
                tipo_destino: ubicacion.tipo_destino,  // Cliente | Bodega
                cliente: ubicacion.cliente_nombre || null,
                site: ubicacion.site_nombre || null,
                bodega: ubicacion.bodega_nombre || null,
                desde: ubicacion.fecha_inicio,
                motivo: ubicacion.motivo || null
            }
            : null,

        // Asignación vigente (para cobros/info), pero NO gobierna el logo
        asignacion_vigente: asignacion
            ? {
                es_temporal: Boolean(asignacion.es_temporal),
                modelo_contrato: asignacion.modelo,
                precio_arrendamiento: asignacion.precio_arrendamiento,
                costo_impresion_bn: asignacion.costo_impresion_bn,
                costo_impresion_color: asignacion.costo_impresion_color,
                contrato_codigo: asignacion.contrato_codigo,
                adenda_codigo: asignacion.adenda_codigo,
                cliente: asignacion.cliente_nombre
            }
            : null,

        cliente_logo_url, // << solo si está en cliente
        tecnasa_logo_url: process.env.PUBLIC_TECNASA_LOGO_URL || null,

        // flags útiles para el frontend
        meta: {
            isEnCliente,
            isEnBodega: !!ubicacion && ubicacion.tipo_destino === "Bodega"
        }
    };
}

// GET /public/activos/:codigo
export const getPublicActivoByCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;

        // 1) Buscar activo
        const [activos] = await pool.query("SELECT * FROM activos WHERE codigo = ?", [codigo]);
        if (activos.length === 0) return res.status(404).json({ message: "Activo no encontrado" });
        const activo = activos[0];

        // 2) Ubicación actual
        const [ubic] = await pool.query(
            `SELECT ua.*, cs.nombre AS site_nombre, c.id AS cliente_id, c.nombre AS cliente_nombre,
                b.nombre AS bodega_nombre, img.url AS cliente_logo_url
            FROM ubicaciones_activos ua
            LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
            LEFT JOIN clientes c        ON cs.id_cliente = c.id
            LEFT JOIN images  img       ON c.logo_image_id = img.id_image
            LEFT JOIN bodegas b         ON ua.id_bodega = b.id
            WHERE ua.id_activo = ?
            AND ua.fecha_fin IS NULL
            ORDER BY ua.fecha_inicio DESC
            LIMIT 1`,
            [activo.id]
        );
        const ubicacion = ubic[0] || null;

        // 3) Asignación vigente (prioriza temporal)
        const [asig] = await pool.query(
            `SELECT ca.*, da.modelo, da.precio_arrendamiento, da.costo_impresion_bn, da.costo_impresion_color,
            ad.codigo AS adenda_codigo, co.codigo AS contrato_codigo,
            cli.id AS cliente_id, cli.nombre AS cliente_nombre, img.url AS cliente_logo_url
     FROM contratos_activos ca
     JOIN detalle_adenda da ON ca.id_detalle_adenda = da.id
     JOIN adendas ad        ON da.id_adenda = ad.id
     JOIN contratos co      ON ad.id_contrato = co.id
     JOIN clientes cli      ON co.id_cliente = cli.id
     LEFT JOIN images img   ON cli.logo_image_id = img.id_image
     WHERE ca.id_activo = ? AND ca.fecha_fin IS NULL
     ORDER BY ca.es_temporal DESC, ca.fecha_asignacion DESC
     LIMIT 1`,
            [activo.id]
        );
        const asignacion = asig[0] || null;

        // 4) Construir respuesta pública
        const payload = mapPublicActivo({ activo, ubicacion, asignacion });

        // 5) Cache básico para mejorar tiempos en lector QR
        res.set("Cache-Control", "public, max-age=60"); // 60s
        return res.json(payload);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// (Opcional) GET /public/activos/:codigo/qr  -> devuelve PNG del QR
export const getQRImageByCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        // valida existencia básica (opcional para no filtrar códigos inexistentes)
        const [rows] = await pool.query("SELECT id FROM activos WHERE codigo = ? LIMIT 1", [codigo]);
        if (rows.length === 0) return res.status(404).json({ message: "Activo no encontrado" });

        // URL pública que escaneará el cliente
        const publicUrl = `${process.env.PUBLIC_BASE_URL || "http://localhost:5173"}/public/activos/${encodeURIComponent(codigo)}`;

        // Generar PNG en memoria
        res.setHeader("Content-Type", "image/png");
        // opciones: errorCorrectionLevel: 'M'/'Q'/'H', margin, width
        await QRCode.toFileStream(res, publicUrl, { errorCorrectionLevel: "M", margin: 1, width: 300 });
        // no llames res.end(); el stream se cierra al terminar
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
