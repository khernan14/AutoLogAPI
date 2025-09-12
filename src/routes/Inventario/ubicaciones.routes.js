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

// mover activo (cierra ubicación anterior y abre nueva)
router.post(
  "/mover",
  authenticate,
  authorizeByPermisos("mover_activos"),
  moverActivo
);

// listar movimientos por activo
router.get(
  "/activo/:id_activo",
  authenticate,
  authorizeByPermisos("ver_historial_activos"),
  getMovimientosByActivo
);

export default router;
