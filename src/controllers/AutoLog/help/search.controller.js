// src/api/controllers/search.controller.js
import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

// ===== Helpers de rol =====
function getRole(req) {
  const rol = req.user?.rol || "Empleado"; // Empleado | Supervisor | Admin
  const isAdmin = rol === "Admin";
  const isInternal = isAdmin || rol === "Empleado" || rol === "Supervisor";
  return { rol, isAdmin, isInternal };
}

// Normaliza la query: recorta, quita tildes, pasa a minúsculas y limita longitud
function sanitize(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .trim()
    .slice(0, 120);
}

// Normalización simple para búsquedas en memoria (módulos estáticos)
function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function shapeItem({
  id,
  title,
  subtitle,
  url,
  kind,
  perm,
  exact = false,
  estatus = null,
}) {
  return { id, title, subtitle, url, kind, perm, exact, estatus };
}

// URLs a tus rutas reales
const url = {
  activo: (id) => `/admin/inventario/activos?focus=${id}`,
  activoEnCliente: (idCliente, idActivo) =>
    `/admin/clientes/${idCliente}/activos?focus=${idActivo}`,
  activoEnBodega: (idBodega, idActivo) =>
    `/admin/inventario/bodegas/${idBodega}?focus=${idActivo}`,
  cliente: (id) => `/admin/clientes/${id}`,
  site: (idCliente, idSite) =>
    `/admin/clientes/${idCliente}/sites?focus=${idSite}`,
  bodega: (id) => `/admin/inventario/bodegas?focus=${id}`,
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

// =========================
// 2.4 – Módulos estáticos
// =========================

const staticModules = [
  {
    id: "mod-home",
    title: "Inicio",
    subtitle: "Módulo • General",
    url: "/admin/home",
    kind: "module-general",
    perm: null,
    keywords: ["inicio", "home", "principal", "dashboard", "inicio autolog"],
  },
  {
    id: "mod-dashboard",
    title: "Dashboard",
    subtitle: "Módulo • General",
    url: "/admin/dashboard",
    kind: "module-dashboard",
    perm: "ver_dashboard",
    keywords: ["dashboard", "graficas", "estadisticas", "resumen"],
  },
  {
    id: "mod-vehiculos",
    title: "Vehículos",
    subtitle: "Módulo • Flota",
    url: "/admin/vehiculos",
    kind: "module-vehicle",
    perm: "gestionar_vehiculos",
    keywords: [
      "vehiculo",
      "vehiculos",
      "vehículos",
      "flota",
      "carro",
      "carros",
      "auto",
      "autos",
      "camioneta",
    ],
  },
  {
    id: "mod-registros",
    title: "Registros de uso",
    subtitle: "Módulo • Vehículos",
    url: "/admin/panel-vehiculos",
    kind: "module-record",
    perm: "registrar_uso",
    keywords: ["registros", "salida", "regreso", "movimientos", "uso"],
  },
  {
    id: "mod-activos",
    title: "Activos",
    subtitle: "Módulo • Inventario",
    url: "/admin/inventario/activos",
    kind: "module-asset",
    perm: "gestionar_activos",
    keywords: ["activos", "activo", "assets", "inventario"],
  },
  {
    id: "mod-bodegas",
    title: "Bodegas",
    subtitle: "Módulo • Inventario",
    url: "/admin/inventario/bodegas",
    kind: "module-warehouse",
    perm: "gestionar_bodegas",
    keywords: ["bodega", "bodegas", "almacen", "almacén"],
  },
  {
    id: "mod-clientes",
    title: "Compañías",
    subtitle: "Módulo • Gestión",
    url: "/admin/clientes",
    kind: "module-company",
    perm: "gestionar_companias",
    keywords: ["cliente", "clientes", "companias", "compañias", "company"],
  },
  {
    id: "mod-paises",
    title: "Países",
    subtitle: "Módulo • Gestión",
    url: "/admin/countries",
    kind: "module-country",
    perm: "gestionar_paises",
    keywords: ["pais", "paises", "país", "países", "country"],
  },
  {
    id: "mod-ciudades",
    title: "Ciudades",
    subtitle: "Módulo • Gestión",
    url: "/admin/cities",
    kind: "module-city",
    perm: "gestionar_ciudades",
    keywords: ["ciudad", "ciudades", "city"],
  },
  {
    id: "mod-parkings",
    title: "Estacionamientos",
    subtitle: "Módulo • Gestión",
    url: "/admin/parkings",
    kind: "module-parking",
    perm: "gestionar_estacionamientos",
    keywords: ["parqueo", "parking", "estacionamiento", "parqueos"],
  },
  {
    id: "mod-usuarios",
    title: "Usuarios",
    subtitle: "Módulo • Sistema",
    url: "/admin/usuarios",
    kind: "module-user",
    perm: "gestionar_usuarios",
    keywords: ["usuario", "usuarios", "empleado", "empleados", "user"],
  },
  {
    id: "mod-permisos",
    title: "Roles y permisos",
    subtitle: "Módulo • Sistema",
    url: "/admin/permissions",
    kind: "module-permissions",
    perm: "asignar_permisos",
    keywords: ["rol", "roles", "permisos", "seguridad", "accesos"],
  },
  {
    id: "mod-reportes",
    title: "Reportes",
    subtitle: "Módulo • Análisis",
    url: "/admin/reports",
    kind: "module-reports",
    perm: "ver_reportes",
    keywords: ["reportes", "report", "reporte", "informes"],
  },
  {
    id: "mod-help",
    title: "Centro de ayuda",
    subtitle: "Módulo • Soporte",
    url: "/admin/help",
    kind: "module-help",
    perm: null,
    keywords: [
      "ayuda",
      "faq",
      "faqs",
      "tutoriales",
      "manual",
      "que es autolog",
      "que es autolog?",
      "qué es autolog",
    ],
  },
];

function searchStaticModules(qRaw, limit) {
  const qNorm = normalizeText(qRaw);
  if (!qNorm || qNorm.length < 2) return [];

  const words = qNorm.split(/\s+/).filter(Boolean);

  const scored = staticModules
    .map((m) => {
      const kw =
        m._normKeywords ||
        (m._normKeywords = m.keywords.map((k) => normalizeText(k)));
      let score = 0;

      // match fuerte por coincidencia exacta de frase
      kw.forEach((k) => {
        if (!k) return;
        if (qNorm === k) score += 60;
        else if (qNorm.includes(k)) score += 40;
      });

      // matches por palabra individual
      words.forEach((w) => {
        if (kw.includes(w)) score += 20;
      });

      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ m }) =>
    shapeItem({
      id: m.id,
      title: m.title,
      subtitle: m.subtitle,
      url: m.url,
      kind: m.kind,
      perm: m.perm || null,
      exact: false,
    })
  );
}

// ========== BÚSQUEDAS de módulos / datos ==========

// Activos – exact code/serial + FULLTEXT + fallback LIKE
async function searchActivos(q, limit) {
  const qNorm = sanitize(q); // ya tienes sanitize arriba
  const like = `%${qNorm}%`;
  const isNum = /^\d+$/.test(qNorm);

  const [rows] = await pool.query(
    `
    SELECT
      a.id,
      a.nombre,
      a.modelo,
      a.serial_number,
      a.codigo,
      a.estatus,

      -- ubicación actual (si existe)
      ua.tipo_destino,
      ua.id_cliente_site,
      ua.id_bodega,
      ua.id_empleado,

      cs.id_cliente       AS cliente_id,
      c.nombre            AS cliente_nombre,
      cs.nombre           AS site_nombre,
      b.nombre            AS bodega_nombre,
      u.nombre            AS empleado_nombre

    FROM activos a
    LEFT JOIN ubicaciones_activos ua
      ON ua.id_activo = a.id AND ua.abierto = 1
    LEFT JOIN clientes_sites cs
      ON cs.id = ua.id_cliente_site
    LEFT JOIN clientes c
      ON c.id = cs.id_cliente
    LEFT JOIN bodegas b
      ON b.id = ua.id_bodega
    LEFT JOIN empleados e
      ON e.id = ua.id_empleado
    LEFT JOIN usuarios u
      ON u.id_usuario = e.id_usuario

    WHERE
      a.codigo        LIKE ?
      OR a.serial_number LIKE ?
      OR a.nombre     LIKE ?
      OR a.modelo     LIKE ?
      ${isNum ? "OR a.id = ?" : ""}
    LIMIT ?
    `,
    isNum
      ? [like, like, like, like, Number(qNorm), limit]
      : [like, like, like, like, limit]
  );

  return rows.map((r) => {
    const exact =
      (r.codigo || "").toLowerCase() === qNorm.toLowerCase() ||
      (r.serial_number || "").toLowerCase() === qNorm.toLowerCase() ||
      (isNum && r.id === Number(qNorm));

    // 💡 Decidir la URL según dónde está el activo
    let targetUrl = url.activo(r.id); // fallback: lista global

    if (r.tipo_destino === "Cliente" && r.cliente_id) {
      // al cliente, tab de activos
      targetUrl = url.activoEnCliente(r.cliente_id, r.id);
    } else if (r.tipo_destino === "Bodega" && r.id_bodega) {
      // a la bodega específica
      targetUrl = url.activoEnBodega(r.id_bodega, r.id);
    }
    // si está en Empleado o sin ubicación → se queda en global (url.activo)

    // Subtítulo con info útil
    const parts = [];

    if (r.codigo) parts.push(`Código: ${r.codigo}`);
    if (r.modelo) parts.push(r.modelo);
    if (r.serial_number) parts.push(`Serie: ${r.serial_number}`);

    if (r.tipo_destino === "Cliente" && r.cliente_nombre) {
      parts.push(
        `En cliente: ${r.cliente_nombre}${
          r.site_nombre ? " / " + r.site_nombre : ""
        }`
      );
    } else if (r.tipo_destino === "Bodega" && r.bodega_nombre) {
      parts.push(`En bodega: ${r.bodega_nombre}`);
    } else if (r.tipo_destino === "Empleado" && r.empleado_nombre) {
      parts.push(`Asignado a: ${r.empleado_nombre}`);
    }

    return shapeItem({
      id: `asset-${r.id}`,
      title: r.nombre || r.codigo || `Activo #${r.id}`,
      subtitle: parts.join(" • "),
      url: targetUrl,
      kind: "asset",
      perm: "gestionar_activos",
      exact,
    });
  });
}

// Clientes – FULLTEXT + fallback LIKE
async function searchClientes(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;
  const qLower = q.toLowerCase();

  let rows = [];

  if (q.length >= 3) {
    const boolean = q
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}*`)
      .join(" ");

    try {
      const [ftRows] = await pool.query(
        `SELECT id, nombre, codigo, estatus,
                MATCH(nombre, descripcion, codigo)
                  AGAINST (? IN BOOLEAN MODE) AS score_ft
         FROM clientes
         WHERE MATCH(nombre, descripcion, codigo)
               AGAINST (? IN BOOLEAN MODE)
         ORDER BY score_ft DESC
         LIMIT ?`,
        [boolean || q, boolean || q, limit]
      );
      rows = ftRows;
    } catch (_err) {
      rows = [];
    }
  }

  if (!rows.length) {
    const words = q.split(/\s+/).filter(Boolean);
    let whereParts = [];
    let params = [];

    if (words.length) {
      words.forEach((w) => {
        const wLike = `%${w}%`;
        whereParts.push(
          "(nombre LIKE ? OR codigo LIKE ? OR descripcion LIKE ?)"
        );
        params.push(wLike, wLike, wLike);
      });
    } else {
      whereParts.push("(nombre LIKE ? OR codigo LIKE ? OR descripcion LIKE ?)");
      params.push(like, like, like);
    }

    const sql = `
      SELECT id, nombre, codigo, estatus
      FROM clientes
      WHERE ${whereParts.join(" AND ")}
      LIMIT ?
    `;
    params.push(limit);

    const [likeRows] = await pool.query(sql, params);
    rows = likeRows;
  }

  return rows.map((r) =>
    shapeItem({
      id: `cliente-${r.id}`,
      title: r.nombre,
      subtitle: r.codigo || "Cliente",
      url: url.cliente(r.id),
      kind: "company",
      perm: "gestionar_companias",
      exact: (r.codigo || "").toLowerCase() === qLower,
      estatus: r.estatus || null,
    })
  );
}

// Sites (solo LIKE por ahora)
async function searchSites(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
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
      url: url.site(r.id_cliente, r.id),
      kind: "site",
      perm: "gestionar_companias",
    })
  );
}

// Bodegas – buscar por nombre + ciudad, soporta "bodega tegucigalpa"
async function searchBodegas(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const like = `%${q}%`;

  let whereParts = [];
  let params = [];

  if (words.length) {
    words.forEach((w) => {
      const wLike = `%${w}%`;
      whereParts.push("(b.nombre LIKE ? OR c.nombre LIKE ?)");
      params.push(wLike, wLike);
    });
  } else {
    whereParts.push("(b.nombre LIKE ? OR c.nombre LIKE ?)");
    params.push(like, like);
  }

  const sql = `
    SELECT b.id, b.nombre, c.nombre AS ciudad
    FROM bodegas b
    LEFT JOIN ciudades c ON c.id = b.id_ciudad
    WHERE ${whereParts.join(" AND ")}
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await pool.query(sql, params);

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

// Vehículos
async function searchVehiculos(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const like = `%${q}%`;
  const qLower = q.toLowerCase();

  let whereParts = [];
  let params = [];

  if (words.length) {
    words.forEach((w) => {
      const wLike = `%${w}%`;
      whereParts.push("(placa LIKE ? OR marca LIKE ? OR modelo LIKE ?)");
      params.push(wLike, wLike, wLike);
    });
  } else {
    whereParts.push("(placa LIKE ? OR marca LIKE ? OR modelo LIKE ?)");
    params.push(like, like, like);
  }

  const sql = `
    SELECT id, placa, marca, modelo, estado
    FROM vehiculos
    WHERE ${whereParts.join(" AND ")}
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await pool.query(sql, params);

  return rows.map((r) =>
    shapeItem({
      id: `veh-${r.id}`,
      title: r.placa,
      subtitle: [r.marca, r.modelo].filter(Boolean).join(" • ") || "Vehículo",
      url: url.vehiculo(r.id),
      kind: "vehicle",
      perm: "gestionar_vehiculos",
      exact: (r.placa || "").toLowerCase() === qLower,
      estatus: r.estado || null,
    })
  );
}

// Ciudades
async function searchCiudades(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
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

// Países
async function searchPaises(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
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

// Estacionamientos – nombre + ciudad, soporta "estacionamiento tegucigalpa"
async function searchEstacionamientos(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const like = `%${q}%`;

  let whereParts = [];
  let params = [];

  if (words.length) {
    words.forEach((w) => {
      const wLike = `%${w}%`;
      whereParts.push("(e.nombre_ubicacion LIKE ? OR c.nombre LIKE ?)");
      params.push(wLike, wLike);
    });
  } else {
    whereParts.push("(e.nombre_ubicacion LIKE ? OR c.nombre LIKE ?)");
    params.push(like, like);
  }

  const sql = `
    SELECT e.id, e.nombre_ubicacion, c.nombre AS ciudad
    FROM estacionamientos e
    LEFT JOIN ciudades c ON c.id = e.id_ciudad
    WHERE ${whereParts.join(" AND ")}
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await pool.query(sql, params);

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

// Registros – ID directo + FULLTEXT + fallback LIKE
async function searchRegistros(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;
  const isNum = /^\d+$/.test(q);

  const results = [];

  // 1) si es numérico, priorizar búsqueda por ID
  if (isNum) {
    const idNum = Number(q);
    const [byId] = await pool.query(
      `SELECT id, comentario_salida, comentario_regreso
       FROM registros
       WHERE id = ?
       LIMIT 1`,
      [idNum]
    );
    if (byId.length) {
      const r = byId[0];
      results.push(
        shapeItem({
          id: `reg-${r.id}`,
          title: `Registro #${r.id}`,
          subtitle:
            r.comentario_salida || r.comentario_regreso || "Registro de uso",
          url: url.registro(r.id),
          kind: "record",
          perm: "registrar_uso",
          exact: true,
        })
      );
    }
  }

  let ftRows = [];
  if (q.length >= 3) {
    const boolean = q
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}*`)
      .join(" ");

    try {
      const [rows] = await pool.query(
        `SELECT id, comentario_salida, comentario_regreso,
                MATCH(comentario_salida, comentario_regreso)
                  AGAINST (? IN BOOLEAN MODE) AS score_ft
         FROM registros
         WHERE MATCH(comentario_salida, comentario_regreso)
               AGAINST (? IN BOOLEAN MODE)
         ORDER BY score_ft DESC
         LIMIT ?`,
        [boolean || q, boolean || q, limit]
      );
      ftRows = rows;
    } catch (_err) {
      ftRows = [];
    }
  }

  if (!ftRows.length && results.length < limit) {
    const [rowsLike] = await pool.query(
      `SELECT id, comentario_salida, comentario_regreso
       FROM registros
       WHERE (comentario_salida LIKE ? OR comentario_regreso LIKE ?)
       LIMIT ?`,
      [like, like, limit]
    );
    ftRows = rowsLike;
  }

  ftRows.forEach((r) => {
    const idKey = `reg-${r.id}`;
    if (results.find((x) => x.id === idKey)) return;
    results.push(
      shapeItem({
        id: idKey,
        title: `Registro #${r.id}`,
        subtitle:
          r.comentario_salida || r.comentario_regreso || "Registro de uso",
        url: url.registro(r.id),
        kind: "record",
        perm: "registrar_uso",
        exact: isNum && Number(q) === r.id,
      })
    );
  });

  return results.slice(0, limit);
}

// Sales Orders
async function searchSalesOrders(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;
  const qLower = q.toLowerCase();

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
      exact: (r.codigo || "").toLowerCase() === qLower,
    })
  );
}

// Usuarios / Empleados
async function searchUsuariosEmpleados(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;

  const [rows] = await pool.query(
    `SELECT 
       u.id_usuario,
       u.nombre,
       u.email,
       u.username,
       u.rol,
       e.id AS empleado_id,
       e.puesto,
       e.estatus AS empleado_estatus
     FROM usuarios u
     LEFT JOIN empleados e ON e.id_usuario = u.id_usuario
     WHERE (u.nombre LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR e.puesto LIKE ?)
     LIMIT ?`,
    [like, like, like, like, limit]
  );

  return rows.map((r) =>
    shapeItem({
      id: `usr-${r.id_usuario}`,
      title: r.nombre,
      subtitle: [
        r.username,
        r.email,
        r.rol,
        r.puesto ? `Puesto: ${r.puesto}` : null,
      ]
        .filter(Boolean)
        .join(" • "),
      url: `/admin/usuarios?focus=${r.id_usuario}`,
      kind: "user",
      perm: "gestionar_usuarios",
      estatus: r.empleado_estatus || null,
    })
  );
}

// ========== BÚSQUEDAS de ayuda pública (FAQ, tutoriales, changelog, status) ==========

// FAQs – FULLTEXT + fallback palabras con LIKE
async function searchFaqsPublic(req, qRaw, limit) {
  const { isInternal } = getRole(req);
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;
  const vis = isInternal ? ["public", "internal"] : ["public"];

  let rows = [];

  if (q.length >= 3) {
    const boolean = q
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}*`)
      .join(" ");

    try {
      const [ftRows] = await pool.query(
        `SELECT id, slug, question AS title, category,
                MATCH(question, answer) AGAINST (? IN BOOLEAN MODE) AS score_ft
         FROM faqs
         WHERE MATCH(question, answer) AGAINST (? IN BOOLEAN MODE)
           AND visibility IN (${vis.map(() => "?").join(",")})
           AND isActive = 1
         ORDER BY score_ft DESC
         LIMIT ?`,
        [boolean || q, boolean || q, ...vis, limit]
      );
      rows = ftRows;
    } catch (_err) {
      rows = [];
    }
  }

  if (!rows.length) {
    const words = q.split(/\s+/).filter((w) => w.length > 1);
    const conditions = [];
    const params = [];

    if (words.length) {
      words.forEach((w) => {
        const wLike = `%${w}%`;
        conditions.push("(question LIKE ? OR answer LIKE ?)");
        params.push(wLike, wLike);
      });
    } else {
      conditions.push("(question LIKE ? OR answer LIKE ?)");
      params.push(like, like);
    }

    const whereText = conditions.length ? conditions.join(" AND ") : "1=1";

    const [likeRows] = await pool.query(
      `SELECT id, slug, question AS title, category
       FROM faqs
       WHERE ${whereText}
         AND visibility IN (${vis.map(() => "?").join(",")})
         AND isActive = 1
       LIMIT ?`,
      [...params, ...vis, limit]
    );
    rows = likeRows;
  }

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

// Tutorials – FULLTEXT + fallback LIKE
async function searchTutorialsPublic(req, qRaw, limit) {
  const { isInternal } = getRole(req);
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;
  const vis = isInternal ? ["public", "internal"] : ["public"];

  let rows = [];

  if (q.length >= 3) {
    const boolean = q
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}*`)
      .join(" ");

    try {
      const [ftRows] = await pool.query(
        `SELECT id, slug, title, category,
                MATCH(title, description) AGAINST (? IN BOOLEAN MODE) AS score_ft
         FROM tutorials
         WHERE MATCH(title, description) AGAINST (? IN BOOLEAN MODE)
           AND visibility IN (${vis.map(() => "?").join(",")})
         ORDER BY score_ft DESC
         LIMIT ?`,
        [boolean || q, boolean || q, ...vis, limit]
      );
      rows = ftRows;
    } catch (_err) {
      rows = [];
    }
  }

  if (!rows.length) {
    const [likeRows] = await pool.query(
      `SELECT id, slug, title, category
       FROM tutorials
       WHERE (title LIKE ? OR description LIKE ?)
         AND visibility IN (${vis.map(() => "?").join(",")})
       LIMIT ?`,
      [like, like, ...vis, limit]
    );
    rows = likeRows;
  }

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

// Changelogs – FULLTEXT + fallback LIKE
async function searchChangelogsPublic(req, qRaw, limit) {
  const { isInternal, isAdmin } = getRole(req);
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;

  const audiences = ["all"];
  if (isInternal) audiences.push("internal", "customers");
  if (isAdmin) audiences.push("admins");

  let rows = [];

  if (q.length >= 3) {
    const boolean = q
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}*`)
      .join(" ");

    try {
      const [ftRows] = await pool.query(
        `SELECT id, slug, title,
                DATE_FORMAT(date, '%Y-%m-%d') AS day,
                type,
                MATCH(title, description) AGAINST (? IN BOOLEAN MODE) AS score_ft
         FROM changelogs
         WHERE MATCH(title, description) AGAINST (? IN BOOLEAN MODE)
           AND audience IN (${audiences.map(() => "?").join(",")})
         ORDER BY date DESC
         LIMIT ?`,
        [boolean || q, boolean || q, ...audiences, limit]
      );
      rows = ftRows;
    } catch (_err) {
      rows = [];
    }
  }

  if (!rows.length) {
    const [likeRows] = await pool.query(
      `SELECT id, slug, title,
              DATE_FORMAT(date, '%Y-%m-%d') AS day,
              type
       FROM changelogs
       WHERE (title LIKE ? OR description LIKE ?)
         AND audience IN (${audiences.map(() => "?").join(",")})
       ORDER BY date DESC
       LIMIT ?`,
      [like, like, ...audiences, limit]
    );
    rows = likeRows;
  }

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

// Status página pública
async function searchStatusPublic(qRaw, limit) {
  const q = sanitize(qRaw);
  if (!q) return [];
  const like = `%${q}%`;

  const [svc] = await pool.query(
    `SELECT name, status, message
     FROM system_services
     WHERE (name LIKE ? OR message LIKE ?)
     ORDER BY group_name, display_order
     LIMIT ?`,
    [like, like, limit]
  );

  const [overall] = await pool.query(
    `SELECT overall_status, description,
            DATE_FORMAT(status_timestamp, '%Y-%m-%d %H:%i') AS ts
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

  if (!q || q.length < 2) {
    return res.json([]);
  }

  const per = Math.max(3, Math.ceil(limit / 3));

  const [
    activos,
    clientes,
    sites,
    bodegas,
    vehiculos,
    usuariosEmp,
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
    searchUsuariosEmpleados(q, 5),
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

  // Módulos estáticos (no depende de DB)
  const staticMods = searchStaticModules(q, 6);

  // Ranking base + penalización por inactivo + boost por match exacto
  const scoreKind = (k) => {
    const kk = String(k || "").toLowerCase();

    if (kk === "asset") return 100;
    if (kk === "company") return 95;
    if (kk === "vehicle") return 90;
    if (kk === "user") return 88;
    if (kk === "record") return 80;
    if (kk === "warehouse") return 75;
    if (kk === "site") return 70;
    if (kk === "city" || kk === "country") return 65;
    if (kk === "parking") return 60;
    if (kk === "reporte") return 55;
    if (kk.startsWith("module-")) return 58; // módulos de navegación
    // soporte, status, etc.
    return 50;
  };

  const allRaw = [
    ...staticMods,
    ...activos,
    ...clientes,
    ...vehiculos,
    ...usuariosEmp,
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
    .map((r) => {
      const base = scoreKind(r.kind || "");
      const exactBoost = r.exact ? 1000 : 0;
      const statusPenalty =
        typeof r.estatus === "string" && r.estatus !== "Activo" ? -30 : 0;

      return {
        ...r,
        _score: base + exactBoost + statusPenalty,
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...r }) => r);

  res.set("Cache-Control", "private, max-age=0, no-store");
  res.json(ranked);
});
