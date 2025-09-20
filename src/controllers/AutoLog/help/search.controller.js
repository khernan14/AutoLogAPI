// src/api/controllers/search.controller.js
import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

// ===== Helpers de auth/rol para filtrar visibilidad pública =====
function getRole(req) {
  // Ajusta a tu middleware real:
  const rol = req.user?.rol || "Empleado"; // Empleado | Supervisor | Admin
  const isAdmin = rol === "Admin";
  const isInternal = isAdmin || rol === "Empleado" || rol === "Supervisor";
  return { rol, isAdmin, isInternal };
}

// Normaliza q (y evita inyección simple)
function sanitize(q) {
  return String(q || "")
    .trim()
    .slice(0, 120);
}

function shapeItem({ id, title, subtitle, url, kind, perm, exact = false }) {
  return { id, title, subtitle, url, kind, perm, exact };
}

// URLs a tus rutas reales
const url = {
  activo: (id) => `/admin/inventario/activos?focus=${id}`,
  cliente: (id) => `/admin/clientes/${id}/info`,
  site: (idCliente, idSite) =>
    `/admin/clientes/${idCliente}/sites?focus=${idSite}`,
  bodega: (id) => `/admin/inventario/bodegas/${id}`,
  vehiculo: (id) => `/admin/vehiculos?focus=${id}`,
  ciudad: (id) => `/admin/cities?focus=${id}`,
  pais: (id) => `/admin/countries?focus=${id}`,
  estacionamiento: (id) => `/admin/parkings?focus=${id}`,
  registro: (id) => `/admin/panel-vehiculos?focus=${id}`,
  so: (id) => `/admin/reports?so=${id}`,
  faqPublic: (slug) => `/admin/help/faqs/${slug}`,
  tutorialPublic: (slug) => `/admin/help/tutorials/${slug}`,
  changelogPublic: (slug) => `/admin/help/changelog/${slug}`,
  statusPublic: (q) =>
    q ? `/admin/help/status?q=${encodeURIComponent(q)}` : `/admin/help/status`,
};

// ========== BÚSQUEDAS de módulos ==========

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
      // ⬇️ Ruta real por compañía:
      url: url.site(r.id_cliente, r.id),
      kind: "site",
      perm: "gestionar_companias",
    })
  );
}

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

// ========== BÚSQUEDAS de ayuda pública ==========

async function searchFaqsPublic(req, q, limit) {
  const { isInternal } = getRole(req);
  const like = `%${q}%`;

  // Public siempre; Internal si el usuario es interno
  const vis = isInternal ? ["public", "internal"] : ["public"];

  const [rows] = await pool.query(
    `SELECT id, slug, question AS title, category
     FROM faqs
     WHERE (question LIKE ?)
       AND visibility IN (${vis.map(() => "?").join(",")})
     LIMIT ?`,
    [like, ...vis, limit]
  );

  return rows.map((r) =>
    shapeItem({
      id: `faq-${r.id}`,
      title: r.title,
      subtitle: r.category ? `FAQ • ${r.category}` : "FAQ",
      url: url.faqPublic(r.slug),
      kind: "soporte",
      perm: null,
    })
  );
}

async function searchTutorialsPublic(req, q, limit) {
  const { isInternal } = getRole(req);
  const like = `%${q}%`;
  const vis = isInternal ? ["public", "internal"] : ["public"];

  const [rows] = await pool.query(
    `SELECT id, slug, title, category
     FROM tutorials
     WHERE (title LIKE ?)
       AND visibility IN (${vis.map(() => "?").join(",")})
     LIMIT ?`,
    [like, ...vis, limit]
  );

  return rows.map((r) =>
    shapeItem({
      id: `tutorial-${r.id}`,
      title: r.title,
      subtitle: r.category ? `Tutorial • ${r.category}` : "Tutorial",
      url: url.tutorialPublic(r.slug),
      kind: "soporte",
      perm: null,
    })
  );
}

async function searchChangelogsPublic(req, q, limit) {
  const { isInternal, isAdmin } = getRole(req);
  const like = `%${q}%`;

  // Audiencias visibles
  const audiences = ["all"];
  if (isInternal) audiences.push("internal", "customers");
  if (isAdmin) audiences.push("admins");

  const [rows] = await pool.query(
    `SELECT id, slug, title, DATE_FORMAT(date, '%Y-%m-%d') AS day, type
     FROM changelogs
     WHERE (title LIKE ? OR description LIKE ?)
       AND audience IN (${audiences.map(() => "?").join(",")})
     ORDER BY date DESC
     LIMIT ?`,
    [like, like, ...audiences, limit]
  );

  return rows.map((r) =>
    shapeItem({
      id: `ch-${r.id}`,
      title: r.title,
      subtitle: `${r.type} • ${r.day}`,
      url: url.changelogPublic(r.slug),
      kind: "soporte",
      perm: null,
    })
  );
}

async function searchStatusPublic(q, limit) {
  const like = `%${q}%`;

  // 1) servicios por nombre o mensaje
  const [svc] = await pool.query(
    `SELECT name, status, message
     FROM system_services
     WHERE (name LIKE ? OR message LIKE ?)
     ORDER BY group_name, display_order
     LIMIT ?`,
    [like, like, limit]
  );

  // 2) overall por descripción (opcional; muestra la página general igual)
  const [overall] = await pool.query(
    `SELECT overall_status, description, DATE_FORMAT(status_timestamp, '%Y-%m-%d %H:%i') AS ts
     FROM system_overall_status_log
     WHERE (description LIKE ?)
     ORDER BY status_timestamp DESC
     LIMIT ?`,
    [like, limit]
  );

  const items = [];

  svc.forEach((r, i) =>
    items.push(
      shapeItem({
        id: `svc-${i}`,
        title: r.name,
        subtitle: r.message ? `${r.status} • ${r.message}` : r.status,
        url: url.statusPublic(r.name),
        kind: "soporte",
        perm: null,
      })
    )
  );

  overall.forEach((r, i) =>
    items.push(
      shapeItem({
        id: `ovr-${i}`,
        title: `Estado general: ${r.overall_status}`,
        subtitle: r.description ? `${r.ts} • ${r.description}` : r.ts,
        url: url.statusPublic(q),
        kind: "soporte",
        perm: null,
      })
    )
  );

  return items.slice(0, limit);
}

// ========== CONTROLADOR PRINCIPAL ==========

export const globalSearch = asyncHandler(async (req, res) => {
  const q = sanitize(req.query.q);
  const n = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 20) : 10;

  if (!q || q.length < 2) return res.json([]);

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
    faqsPub,
    tutorialsPub,
    changelogsPub,
    statusPub,
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
    searchFaqsPublic(req, q, 3),
    searchTutorialsPublic(req, q, 3),
    searchChangelogsPublic(req, q, 3),
    searchStatusPublic(q, 3),
  ]);

  // Ranking base + boost a exactos
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
      : /* soporte & otros */ 40;

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
    ...faqsPub,
    ...tutorialsPub,
    ...changelogsPub,
    ...statusPub,
  ];

  const ranked = allRaw
    .map((r) => ({
      ...r,
      _score: scoreKind(r.kind || "") + (r.exact ? 1000 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...r }) => r);

  res.set("Cache-Control", "private, max-age=0, no-store");
  res.json(ranked);
});
