// src/middleware/auth.middleware.js (o el nombre que uses)
import jwt from "jsonwebtoken";
import pool from "../config/connectionToSql.js";
import logger from "../utils/logger.js";
// --- Helpers ---
const normRole = (r) =>
  String(r || "")
    .trim()
    .toLowerCase();
const normPerms = (arr) =>
  (arr || []).map((p) => String(p || "").trim()).filter((p) => p.length > 0);

/**
 * Autenticación por JWT.
 * - Espera header: Authorization: Bearer <token>
 * - Adjunta req.user con lo que firmaste en el login (id, rol, permisos?).
 */
export const authenticate = (req, res, next) => {
  try {
    const hdr = req.headers.authorization || req.header("Authorization") || "";
    const [scheme, token] = hdr.split(" ");

    if (!token || String(scheme).toLowerCase() !== "bearer") {
      return res
        .status(401)
        .json({ error: "Acceso denegado. Token no proporcionado." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id || !decoded.rol) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = decoded; // { id, rol, permisos? }
    return next();
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    logger.warn({ err }, "JWT inválido");
    return res.status(401).json({ error: "Token inválido" });
  }
};

/**
 * Autorización por rol.
 * - Admin siempre pasa.
 * - Roles enviados se comparan case-insensitivamente.
 * Uso: router.post(..., authenticate, authorize("Supervisor","Admin"), handler)
 */
export const authorize = (...roles) => {
  const required = roles.map(normRole).filter(Boolean);
  return (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });

      const userRole = normRole(req.user.rol);
      if (userRole === "admin") return next();
      if (required.length === 0) return next(); // si no pides roles, pasa

      if (!required.includes(userRole)) {
        return res
          .status(403)
          .json({ error: "No tienes permiso para realizar esta acción" });
      }
      return next();
    } catch (err) {
      logger.error({ err }, "authorize error");
      return res.status(500).json({ error: "Error interno" });
    }
  };
};

/**
 * Autorización por permisos.
 * - Admin siempre pasa.
 * - Si el JWT trae permisos[], se valida en memoria.
 * - Si no, consulta a DB por los permisos necesarios del usuario.
 * Uso: router.put(..., authenticate, authorizeByPermisos("editar_ciudad"), handler)
 */
export const authorizeByPermisos = (...permisos) => {
  const required = normPerms(permisos);

  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });

      const userRole = normRole(req.user.rol);
      if (userRole === "admin") return next();
      if (required.length === 0) return next(); // si no pides permisos, pasa

      // 1) Si el token ya trae permisos, valida sin tocar DB
      const tokenPerms = normPerms(req.user.permisos);
      if (tokenPerms.length > 0) {
        const ok = required.every((p) => tokenPerms.includes(p));
        if (!ok)
          return res
            .status(403)
            .json({ error: "No tienes los permisos requeridos" });
        return next();
      }

      // 2) Si no vienen en el token, consulta DB de manera segura (IN con placeholders)
      const placeholders = required.map(() => "?").join(",");
      const sql = `
        SELECT p.nombre
          FROM usuario_permisos up
          JOIN permisos p ON p.id = up.permiso_id
         WHERE up.id_usuario = ?
           AND p.nombre IN (${placeholders})
      `;
      const params = [req.user.id, ...required];

      const [rows] = await pool.execute(sql, params);
      const userPerms = new Set(rows.map((r) => r.nombre));

      const ok = required.every((p) => userPerms.has(p));
      if (!ok)
        return res
          .status(403)
          .json({ error: "No tienes los permisos requeridos" });

      return next();
    } catch (err) {
      logger.error({ err }, "Error en authorizeByPermisos");
      return res.status(500).json({ error: "Error al verificar permisos" });
    }
  };
};
