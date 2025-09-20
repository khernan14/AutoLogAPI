// src/api/controllers/search.controller.js
import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

// Normaliza q y evita inyecciones básicas
function sanitize(q) {
  return String(q || "")
    .trim()
    .slice(0, 120);
}

function shapeItem({ id, title, subtitle, url, kind, perm, exact = false }) {
  return { id, title, subtitle, url, kind, perm, exact };
}

// helpers de URL (ajusta si tus rutas reales difieren)
const url = {
  activo: (id) => `/admin/inventario/activos?focus=${id}`,
  cliente: (id) => `/admin/clientes?focus=${id}`,
  site: (id) => `/admin/clientes?tab=sites&focus=${id}`,
  bodega: (id) => `/admin/inventario/bodegas?focus=${id}`,
  vehiculo: (id) => `/admin/vehiculos?focus=${id}`,
  ciudad: (id) => `/admin/cities?focus=${id}`,
  pais: (id) => `/admin/countries?focus=${id}`,
  estacionamiento: (id) => `/admin/parkings?focus=${id}`,
  registro: (id) => `/admin/reports?focus=${id}`,
  so: (id) => `/admin/reports?so=${id}`,
  faq: (id) => `/admin/support/faqs/${id}`,
  tutorial: (id) => `/admin/support/tutorials/${id}`,
};

// ========== BÚSQUEDAS ==========

// ACTIVOS: nombre, modelo, serial_number, codigo
async function searchActivos(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, nombre, modelo, serial_number, codigo
     FROM activos
     WHERE (nombre LIKE ? OR modelo LIKE ? OR serial_number LIKE ? OR codigo LIKE ?)
     LIMIT ?`,
    [like, like, like, like, limit]
  );
  return rows.map((r) => {
    const exact =
      (r.codigo || "").toLowerCase() === q.toLowerCase() ||
      (r.serial_number || "").toLowerCase() === q.toLowerCase();
    return shapeItem({
      id: `asset-${r.id}`,
      title: r.nombre || r.codigo || `Activo #${r.id}`,
      subtitle: [r.codigo, r.modelo, r.serial_number]
        .filter(Boolean)
        .join(" • "),
      url: url.activo(r.id),
      kind: "asset",
      perm: "gestionar_activos",
      exact,
    });
  });
}

// CLIENTES: nombre / código
async function searchClientes(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, nombre, codigo
     FROM clientes
     WHERE (nombre LIKE ? OR codigo LIKE ?)
     LIMIT ?`,
    [like, like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `cliente-${r.id}`,
      title: r.nombre,
      subtitle: r.codigo || "Cliente",
      url: url.cliente(r.id),
      kind: "company",
      perm: "gestionar_companias",
      exact: (r.codigo || "").toLowerCase() === q.toLowerCase(),
    })
  );
}

// SITES: nombre
async function searchSites(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, nombre, id_cliente
     FROM clientes_sites
     WHERE nombre LIKE ?
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `site-${r.id}`,
      title: r.nombre,
      subtitle: "Site de cliente",
      url: url.site(r.id),
      kind: "site",
      perm: "gestionar_companias",
    })
  );
}

// BODEGAS: nombre (+ ciudad)
async function searchBodegas(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT b.id, b.nombre, c.nombre AS ciudad
     FROM bodegas b
     LEFT JOIN ciudades c ON c.id = b.id_ciudad
     WHERE b.nombre LIKE ?
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `bodega-${r.id}`,
      title: r.nombre,
      subtitle: r.ciudad ? `Ciudad: ${r.ciudad}` : "Bodega",
      url: url.bodega(r.id),
      kind: "warehouse",
      perm: "gestionar_bodegas",
    })
  );
}

// VEHÍCULOS: placa, marca, modelo
async function searchVehiculos(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, placa, marca, modelo
     FROM vehiculos
     WHERE (placa LIKE ? OR marca LIKE ? OR modelo LIKE ?)
     LIMIT ?`,
    [like, like, like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `veh-${r.id}`,
      title: r.placa,
      subtitle: [r.marca, r.modelo].filter(Boolean).join(" • ") || "Vehículo",
      url: url.vehiculo(r.id),
      kind: "vehicle",
      perm: "gestionar_vehiculos",
      exact: (r.placa || "").toLowerCase() === q.toLowerCase(),
    })
  );
}

// CIUDADES: nombre
async function searchCiudades(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, nombre FROM ciudades WHERE nombre LIKE ? LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `city-${r.id}`,
      title: r.nombre,
      subtitle: "Ciudad",
      url: url.ciudad(r.id),
      kind: "city",
      perm: "gestionar_ciudades",
    })
  );
}

// PAÍSES: nombre
async function searchPaises(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, nombre FROM paises WHERE nombre LIKE ? LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `country-${r.id}`,
      title: r.nombre,
      subtitle: "País",
      url: url.pais(r.id),
      kind: "country",
      perm: "gestionar_paises",
    })
  );
}

// ESTACIONAMIENTOS: nombre (+ ciudad)
async function searchEstacionamientos(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre_ubicacion, c.nombre AS ciudad
     FROM estacionamientos e
     LEFT JOIN ciudades c ON c.id = e.id_ciudad
     WHERE e.nombre_ubicacion LIKE ?
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `park-${r.id}`,
      title: r.nombre_ubicacion,
      subtitle: r.ciudad ? `Ciudad: ${r.ciudad}` : "Estacionamiento",
      url: url.estacionamiento(r.id),
      kind: "parking",
      perm: "gestionar_estacionamientos",
    })
  );
}

// REGISTROS: por id exacto (numérico) o por comentarios
async function searchRegistros(q, limit) {
  const like = `%${q}%`;
  const isNum = /^\d+$/.test(q);
  const [rows] = await pool.query(
    `SELECT id, comentario_salida, comentario_regreso
     FROM registros
     WHERE (? IS NOT NULL AND id = ?)
        OR (comentario_salida LIKE ? OR comentario_regreso LIKE ?)
     LIMIT ?`,
    [isNum ? Number(q) : null, isNum ? Number(q) : null, like, like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `reg-${r.id}`,
      title: `Registro #${r.id}`,
      subtitle:
        r.comentario_salida || r.comentario_regreso || "Registro de uso",
      url: url.registro(r.id),
      kind: "record",
      perm: "registrar_uso",
      exact: isNum && Number(q) === r.id,
    })
  );
}

// SALES ORDERS: por código
async function searchSalesOrders(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, codigo, estatus
     FROM sales_orders
     WHERE codigo LIKE ?
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `so-${r.id}`,
      title: r.codigo,
      subtitle: `Sales Order • ${r.estatus}`,
      url: url.so(r.id),
      kind: "reporte",
      perm: "ver_reportes",
      exact: (r.codigo || "").toLowerCase() === q.toLowerCase(),
    })
  );
}

// FAQs / Tutorials: título
async function searchFaqs(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, question AS title, category
     FROM faqs
     WHERE (question LIKE ?)
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `faq-${r.id}`,
      title: r.title,
      subtitle: r.category ? `FAQ • ${r.category}` : "FAQ",
      url: url.faq(r.id),
      kind: "soporte",
      perm: "help_manage",
    })
  );
}
async function searchTutorials(q, limit) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT id, title, category
     FROM tutorials
     WHERE (title LIKE ?)
     LIMIT ?`,
    [like, limit]
  );
  return rows.map((r) =>
    shapeItem({
      id: `tutorial-${r.id}`,
      title: r.title,
      subtitle: r.category ? `Tutorial • ${r.category}` : "Tutorial",
      url: url.tutorial(r.id),
      kind: "soporte",
      perm: "help_manage",
    })
  );
}

// ========== CONTROLADOR PRINCIPAL ==========

export const globalSearch = asyncHandler(async (req, res) => {
  const q = sanitize(req.query.q);
  // limit robusto
  const n = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 20) : 10;

  if (!q || q.length < 2) {
    return res.json([]);
  }

  // Ejecutamos en paralelo, cada uno con un pequeño tope (no estrictamente suma = limit)
  const per = Math.max(3, Math.ceil(limit / 3));

  const [
    activos,
    clientes,
    sites,
    bodegas,
    vehiculos,
    ciudades,
    paises,
    estacionamientos,
    registros,
    salesOrders,
    faqs,
    tutorials,
  ] = await Promise.all([
    searchActivos(q, per),
    searchClientes(q, per),
    searchSites(q, per),
    searchBodegas(q, per),
    searchVehiculos(q, per),
    searchCiudades(q, per),
    searchPaises(q, per),
    searchEstacionamientos(q, per),
    searchRegistros(q, per),
    searchSalesOrders(q, per),
    searchFaqs(q, 2),
    searchTutorials(q, 2),
  ]);

  // Ranking base por tipo + boost fuerte a exactos
  const scoreKind = (k) =>
    k === "asset"
      ? 100
      : k === "company"
      ? 95
      : k === "vehicle"
      ? 90
      : k === "record"
      ? 70
      : k === "warehouse"
      ? 65
      : k === "site"
      ? 60
      : k === "city" || k === "country"
      ? 55
      : k === "parking"
      ? 50
      : k === "reporte"
      ? 45
      : 30;

  const allRaw = [
    ...activos,
    ...clientes,
    ...vehiculos,
    ...sites,
    ...bodegas,
    ...ciudades,
    ...paises,
    ...estacionamientos,
    ...registros,
    ...salesOrders,
    ...faqs,
    ...tutorials,
  ];

  const ranked = allRaw
    .map((r) => ({
      ...r,
      _score: scoreKind(r.kind || "") + (r.exact ? 1000 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...r }) => r);

  // caché off (resultados dependen de permisos del front, etc.)
  res.set("Cache-Control", "private, max-age=0, no-store");
  res.json(ranked);
});
