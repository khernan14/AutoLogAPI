// src/middleware/auth.middleware.js
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
 * Extrae token: cookie 'token' preferida, si no header Bearer
 */
const getTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  const hdr = req.headers.authorization || req.header("Authorization") || "";
  const [scheme, token] = hdr.split(" ");
  if (String(scheme || "").toLowerCase() === "bearer" && token) return token;

  return null;
};

export const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res
        .status(401)
        .json({ error: "Acceso denegado. Token no proporcionado." });
    }

    // --- PASO A: Verificación Matemática (JWT) ---
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err?.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expirado" });
      }
      logger.warn({ err }, "JWT inválido");
      return res.status(401).json({ error: "Token inválido" });
    }

    if (!decoded || !decoded.id || !decoded.rol) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // --- PASO B: Verificación de Sesión Activa (DB) ---
    // Esto es lo que permite el "Cerrar sesión en otros dispositivos"
    try {
      // Extraemos la firma (última parte del token)
      const tokenSignature = token.split(".")[2];

      // Buscamos si esta firma existe en la tabla de sesiones activas
      const [rows] = await pool.execute(
        "SELECT id FROM user_sessions WHERE token_signature = ?",
        [tokenSignature]
      );

      // Si no hay resultados, significa que la sesión fue borrada/revocada
      if (rows.length === 0) {
        // Opcional: Limpiamos la cookie para que no siga enviando el token revocado
        res.clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });

        logger.warn(
          `Intento de uso de token revocado para usuario ${decoded.id}`
        );
        return res
          .status(401)
          .json({ error: "Sesión revocada o cerrada remotamente" });
      }
    } catch (dbError) {
      // Si falla la DB, por seguridad es mejor denegar o loguear el error crítico
      logger.error(
        { dbError },
        "Error verificando user_sessions en authenticate"
      );
      return res.status(500).json({ error: "Error interno de validación" });
    }

    // --- PASO C: Construcción del Usuario ---
    req.user = {
      id: decoded.id,
      rol: decoded.rol,
      permisos: decoded.permisos || [],
      iat: decoded.iat,
      exp: decoded.exp,
    };

    return next();
  } catch (err) {
    logger.error({ err }, "authenticate error");
    return res.status(401).json({ error: "Error de autenticación" });
  }
};

/**
 * Autorización por rol.
 */
export const authorize = (...roles) => {
  const required = roles.map(normRole).filter(Boolean);
  return (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });

      const userRole = normRole(req.user.rol);
      if (userRole === "admin") return next();
      if (required.length === 0) return next();

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
 */
export const authorizeByPermisos = (...permisos) => {
  const required = normPerms(permisos);

  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });

      const userRole = normRole(req.user.rol);
      if (userRole === "admin") return next();
      if (required.length === 0) return next();

      // Si el token trae permisos, compáralos sin tocar DB
      const tokenPerms = normPerms(req.user.permisos);
      if (tokenPerms.length > 0) {
        const ok = required.every((p) => tokenPerms.includes(p));
        if (!ok)
          return res
            .status(403)
            .json({ error: "No tienes los permisos requeridos" });
        return next();
      }

      // Sino, consulta BD
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
