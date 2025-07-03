import jwt from "jsonwebtoken";
import pool from "../config/connectionToSql.js"; // Asegúrate de tener tu conexión a MySQL aquí

export const authenticate = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Acceso denegado. Token no proporcionado." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(400).json({ error: "Token inválido" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para realizar esta acción" });
    }
    next();
  };
};

export const authorizeByPermisos = (...permisos) => {
  return async (req, res, next) => {
    try {
      if (req.user.rol?.toLowerCase() === "admin") return next();

      const [rows] = await pool.query(
        `SELECT p.nombre, p.descripcion FROM usuario_permisos up
         JOIN permisos p ON p.id = up.permiso_id
         WHERE up.id_usuario = ? AND p.nombre IN (?)`,
        [req.user.id, permisos]
      );

      const permisosDelUsuario = rows.map((r) => r.nombre);
      const tienePermiso = permisos.some((p) => permisosDelUsuario.includes(p));

      if (!tienePermiso) {
        return res
          .status(403)
          .json({ error: "No tienes los permisos requeridos" });
      }

      next();
    } catch (error) {
      console.error("Error en authorizeByPermisos:", error);
      res.status(500).json({ error: "Error al verificar permisos" });
    }
  };
};
