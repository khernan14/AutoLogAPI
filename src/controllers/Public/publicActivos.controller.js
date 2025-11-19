// src/controllers/Public/publicActivos.controller.js
import pool from "../../config/connectionToSql.js";
import QRCode from "qrcode";
import { signPublicLink, verifyPublicLink } from "../../utils/signedLink.js";

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:5173";
const REQUIRE_TOKEN = (process.env.PUBLIC_REQUIRE_TOKEN || "true") === "true";
// por ejemplo 90 días: 60*60*24*90
const PUBLIC_LINK_TTL_SEC = Number(
  process.env.PUBLIC_LINK_TTL_SEC || 60 * 60 * 24 * 90
);

// ---- helper para construir payload público (tu función existente) ----
function mapPublicActivo({ activo, ubicacion, asignacion }) {
  const isEnCliente = !!ubicacion && ubicacion.tipo_destino === "Cliente";
  const cliente_logo_url = isEnCliente
    ? ubicacion.cliente_logo_url || null
    : null;

  return {
    codigo: activo.codigo,
    nombre: activo.nombre,
    modelo: activo.modelo,
    serial_number: activo.serial_number,
    tipo: activo.tipo,
    estatus: activo.estatus,
    fecha_registro: activo.fecha_registro,
    ubicacion_actual: ubicacion
      ? {
          tipo_destino: ubicacion.tipo_destino,
          cliente: ubicacion.cliente_nombre || null,
          site: ubicacion.site_nombre || null,
          bodega: ubicacion.bodega_nombre || null,
          desde: ubicacion.fecha_inicio,
          motivo: ubicacion.motivo || null,
        }
      : null,
    asignacion_vigente: asignacion
      ? {
          es_temporal: Boolean(asignacion.es_temporal),
          modelo_contrato: asignacion.modelo,
          precio_arrendamiento: asignacion.precio_arrendamiento,
          costo_impresion_bn: asignacion.costo_impresion_bn,
          costo_impresion_color: asignacion.costo_impresion_color,
          contrato_codigo: asignacion.contrato_codigo,
          adenda_codigo: asignacion.adenda_codigo,
          cliente: asignacion.cliente_nombre,
        }
      : null,
    cliente_logo_url,
    tecnasa_logo_url: process.env.PUBLIC_TECNASA_LOGO_URL || null,
    meta: {
      isEnCliente,
      isEnBodega: !!ubicacion && ubicacion.tipo_destino === "Bodega",
      queryVersion: "v2-ultima-ubicacion", // 👈 DEBUG
    },
  };
}

// ========== NUEVO: emitir link público firmado para un activo ==========
export const issuePublicLinkForActivo = async (req, res) => {
  try {
    const { id } = req.params;
    // valida que el activo exista
    const [[activo]] = await pool.query(
      "SELECT id, codigo FROM activos WHERE id = ? LIMIT 1",
      [id]
    );
    if (!activo)
      return res.status(404).json({ message: "Activo no encontrado" });

    const token = signPublicLink(
      { kind: "activo", id: activo.id, codigo: activo.codigo },
      PUBLIC_LINK_TTL_SEC
    );

    const url = `${PUBLIC_BASE}/public/activos/${encodeURIComponent(
      activo.codigo
    )}?token=${token}`;
    return res.json({ url, token, expiresIn: PUBLIC_LINK_TTL_SEC });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ========== Público: JSON del activo (requiere token si así lo configuras) ==========
export const getPublicActivoByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const token = req.query.token;

    if (REQUIRE_TOKEN) {
      const v = verifyPublicLink(token);
      if (!v.ok) {
        return res
          .status(403)
          .json({ message: "Link inválido o expirado", reason: v.reason });
      }
      const { payload } = v;
      if (payload.kind !== "activo" || payload.codigo !== codigo) {
        return res
          .status(403)
          .json({ message: "Token no corresponde a este activo" });
      }
    }

    // 1) Buscar activo
    const [[activo]] = await pool.query(
      "SELECT * FROM activos WHERE codigo = ? LIMIT 1",
      [codigo]
    );
    if (!activo)
      return res.status(404).json({ message: "Activo no encontrado" });

    // 2) Ubicación actual
    const [ubicRows] = await pool.query(
      `SELECT
      ua.*,
      COALESCE(ua.site_nombre_snapshot, cs.nombre)      AS site_nombre,
      COALESCE(ua.cliente_nombre_snapshot, c.nombre)    AS cliente_nombre,
      b.nombre                                          AS bodega_nombre,
      img.url                                           AS cliente_logo_url
      FROM ubicaciones_activos ua
      LEFT JOIN clientes_sites cs ON ua.id_cliente_site = cs.id
      LEFT JOIN clientes c        ON cs.id_cliente      = c.id
      LEFT JOIN images  img       ON c.logo_image_id    = img.id_image
      LEFT JOIN bodegas b         ON ua.id_bodega       = b.id
      WHERE ua.id = (
        SELECT u2.id
        FROM ubicaciones_activos u2
        WHERE u2.id_activo = ?
        ORDER BY u2.fecha_inicio DESC, u2.id DESC
        LIMIT 1
      )`,
      [activo.id]
    );

    const ubicacion = ubicRows[0] || null;

    // 3) Asignación vigente
    const [asigRows] = await pool.query(
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
    const asignacion = asigRows[0] || null;

    // 4) Respuesta pública
    const payload = mapPublicActivo({ activo, ubicacion, asignacion });

    // 5) Cache corto
    res.set("Cache-Control", "public, max-age=60");
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ========== (opcional) PNG del QR que ya incluya token firmado ==========
export const getQRImageByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;

    const [[row]] = await pool.query(
      "SELECT id FROM activos WHERE codigo = ? LIMIT 1",
      [codigo]
    );
    if (!row) return res.status(404).json({ message: "Activo no encontrado" });

    const token = signPublicLink(
      { kind: "activo", id: row.id, codigo },
      PUBLIC_LINK_TTL_SEC
    );
    const publicUrl = `${PUBLIC_BASE}/public/activos/${encodeURIComponent(
      codigo
    )}?token=${token}`;

    res.setHeader("Content-Type", "image/png");
    await QRCode.toFileStream(res, publicUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
