// routes/Inventario/ubicaciones.routes.js
import { Router } from "express";
import {
  moverActivo,
  getMovimientosByActivo,
} from "../../controllers/Inventario/ubicaciones.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

// Aplica auth a todo
router.use(authenticate);

// --- POST /mover: mover activo (cierra actual y abre nueva)
router.post(
  "/mover",
  authorizeByPermisos("mover_activos"),
  // Validación ligera del payload (sin librerías externas)
  (req, res, next) => {
    const { id_activo, tipo_destino } = req.body || {};
    if (!Number.isInteger(id_activo)) {
      return res.status(400).json({ message: "id_activo debe ser entero" });
    }
    if (!["Cliente", "Bodega", "Empleado"].includes(tipo_destino)) {
      return res
        .status(400)
        .json({ message: "tipo_destino inválido (Cliente|Bodega|Empleado)" });
    }
    next();
  },
  moverActivo
);

// --- GET /activo/:id_activo: historial del activo (con paginación opcional)
router.get(
  "/activo/:id_activo",
  authorizeByPermisos("ver_historial_activos"),
  (req, res, next) => {
    const id = Number(req.params.id_activo);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "id_activo inválido" });
    }
    // Normaliza paginación (opcional, el controller puede ignorarla si no la usa)
    req.query.limit = Math.min(
      Math.max(parseInt(req.query.limit || "50"), 1),
      200
    );
    req.query.offset = Math.max(parseInt(req.query.offset || "0"), 0);
    next();
  },
  getMovimientosByActivo
);

export default router;
