// src/api/controllers/preview.controller.js
import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

// Normaliza respuesta para el front
function normalize({
  kind,
  id,
  title,
  subtitle,
  fields = [],
  moduleUrl,
  canEdit = false,
}) {
  return { kind, id, title, subtitle, fields, moduleUrl, canEdit };
}

// Helper pequeño
const f = (label, value) =>
  value !== null && value !== undefined && value !== ""
    ? { label, value }
    : null;

/**
 * GET /api/preview?kind=asset&id=123
 * kinds: asset, company, site, warehouse, vehicle, city, country, parking, record, so, faq, tutorial
 */
export const getPreview = asyncHandler(async (req, res) => {
  const kind = String(req.query.kind || "")
    .toLowerCase()
    .trim();
  const id = Number(req.query.id);

  if (!kind || !id) {
    return res.status(400).json({ message: "Parámetros requeridos: kind, id" });
  }

  switch (kind) {
    case "asset": {
      const [[row]] = await pool.query(
        "SELECT id, codigo, nombre, modelo, serial_number, tipo, estatus, fecha_registro FROM activos WHERE id = ? LIMIT 1",
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Activo no encontrado" });

      const fields = [
        f("Código", row.codigo),
        f("Modelo", row.modelo),
        f("Serial", row.serial_number),
        f("Tipo", row.tipo),
        f("Estatus", row.estatus),
        f(
          "Fecha registro",
          row.fecha_registro?.toISOString?.() ?? row.fecha_registro
        ),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "asset",
          id: row.id,
          title: row.nombre || row.codigo || `Activo #${row.id}`,
          subtitle: row.codigo || "",
          fields,
          moduleUrl: `/admin/inventario/activos?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "company": {
      const [[row]] = await pool.query(
        "SELECT id, codigo, nombre, estatus, fecha_registro FROM clientes WHERE id = ? LIMIT 1",
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Compañía no encontrada" });

      const fields = [
        f("Código", row.codigo),
        f("Estatus", row.estatus),
        f(
          "Fecha registro",
          row.fecha_registro?.toISOString?.() ?? row.fecha_registro
        ),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "company",
          id: row.id,
          title: row.nombre,
          subtitle: row.codigo || "",
          fields,
          moduleUrl: `/admin/clientes/${row.id}/info`,
          canEdit: true,
        })
      );
    }

    case "site": {
      const [[row]] = await pool.query(
        `SELECT s.id, s.nombre, s.descripcion, s.id_cliente, c.nombre AS ciudad
         FROM clientes_sites s
         LEFT JOIN ciudades c ON c.id = s.id_ciudad
         WHERE s.id = ? LIMIT 1`,
        [id]
      );
      if (!row) return res.status(404).json({ message: "Site no encontrado" });

      const fields = [
        f("Ciudad", row.ciudad),
        f("Descripción", row.descripcion),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "site",
          id: row.id,
          title: row.nombre,
          subtitle: "Site de cliente",
          fields,
          // ⬇️ Ruta real que tienes: admin/clientes/:idCliente/sites, marcando focus del site
          moduleUrl: `/admin/clientes/${row.id_cliente}/sites?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "warehouse": {
      const [[row]] = await pool.query(
        `SELECT b.id, b.nombre, b.descripcion, c.nombre AS ciudad
         FROM bodegas b
         LEFT JOIN ciudades c ON c.id = b.id_ciudad
         WHERE b.id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Bodega no encontrada" });

      const fields = [
        f("Ciudad", row.ciudad),
        f("Descripción", row.descripcion),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "warehouse",
          id: row.id,
          title: row.nombre,
          subtitle: "Bodega",
          fields,
          moduleUrl: `/admin/inventario/bodegas/${row.id}`,
          canEdit: true,
        })
      );
    }

    case "vehicle": {
      const [[row]] = await pool.query(
        `SELECT v.id, v.placa, v.marca, v.modelo, v.estado
         FROM vehiculos v
         WHERE v.id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Vehículo no encontrado" });

      const fields = [
        f("Marca", row.marca),
        f("Modelo", row.modelo),
        f("Estado", row.estado),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "vehicle",
          id: row.id,
          title: row.placa,
          subtitle: [row.marca, row.modelo].filter(Boolean).join(" • "),
          fields,
          moduleUrl: `/admin/vehiculos?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "city": {
      const [[row]] = await pool.query(
        "SELECT id, nombre FROM ciudades WHERE id = ? LIMIT 1",
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Ciudad no encontrada" });

      return res.json(
        normalize({
          kind: "city",
          id: row.id,
          title: row.nombre,
          subtitle: "Ciudad",
          fields: [],
          moduleUrl: `/admin/cities?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "country": {
      const [[row]] = await pool.query(
        "SELECT id, nombre FROM paises WHERE id = ? LIMIT 1",
        [id]
      );
      if (!row) return res.status(404).json({ message: "País no encontrado" });

      return res.json(
        normalize({
          kind: "country",
          id: row.id,
          title: row.nombre,
          subtitle: "País",
          fields: [],
          moduleUrl: `/admin/countries?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "parking": {
      const [[row]] = await pool.query(
        `SELECT e.id, e.nombre_ubicacion, c.nombre AS ciudad
         FROM estacionamientos e
         LEFT JOIN ciudades c ON c.id = e.id_ciudad
         WHERE e.id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res
          .status(404)
          .json({ message: "Estacionamiento no encontrado" });

      const fields = [f("Ciudad", row.ciudad)].filter(Boolean);

      return res.json(
        normalize({
          kind: "parking",
          id: row.id,
          title: row.nombre_ubicacion,
          subtitle: "Estacionamiento",
          fields,
          moduleUrl: `/admin/parkings?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "record": {
      const [[row]] = await pool.query(
        `SELECT id, fecha_salida, fecha_regreso, comentario_salida, comentario_regreso
         FROM registros WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Registro no encontrado" });

      const fields = [
        f("Fecha salida", row.fecha_salida),
        f("Fecha regreso", row.fecha_regreso),
        f("Comentario salida", row.comentario_salida),
        f("Comentario regreso", row.comentario_regreso),
      ].filter(Boolean);

      return res.json(
        normalize({
          kind: "record",
          id: row.id,
          title: `Registro #${row.id}`,
          subtitle: "Registro de uso",
          fields,
          moduleUrl: `/admin/panel-vehiculos?focus=${row.id}`,
          canEdit: true,
        })
      );
    }

    case "so": {
      const [[row]] = await pool.query(
        `SELECT id, codigo, estatus, fecha
         FROM sales_orders WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Sales Order no encontrado" });

      const fields = [f("Estatus", row.estatus), f("Fecha", row.fecha)].filter(
        Boolean
      );

      return res.json(
        normalize({
          kind: "reporte",
          id: row.id,
          title: row.codigo,
          subtitle: "Sales Order",
          fields,
          moduleUrl: `/admin/reports?so=${row.id}`,
          canEdit: false,
        })
      );
    }

    case "faq": {
      const [[row]] = await pool.query(
        `SELECT id, slug, question AS title, category FROM faqs WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!row) return res.status(404).json({ message: "FAQ no encontrada" });

      const fields = [f("Categoría", row.category)].filter(Boolean);

      return res.json(
        normalize({
          kind: "soporte",
          id: row.id,
          title: row.title,
          subtitle: "FAQ",
          fields,
          // ⬇️ Vista pública (no gestión):
          moduleUrl: `/admin/help/faqs/${row.slug}`,
          canEdit: false,
        })
      );
    }

    case "tutorial": {
      const [[row]] = await pool.query(
        `SELECT id, slug, title, category FROM tutorials WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!row)
        return res.status(404).json({ message: "Tutorial no encontrado" });

      const fields = [f("Categoría", row.category)].filter(Boolean);

      return res.json(
        normalize({
          kind: "soporte",
          id: row.id,
          title: row.title,
          subtitle: "Tutorial",
          fields,
          // ⬇️ Vista pública:
          moduleUrl: `/admin/help/tutorials/${row.slug}`,
          canEdit: false,
        })
      );
    }

    default:
      return res.status(400).json({ message: `kind no soportado: ${kind}` });
  }
});
