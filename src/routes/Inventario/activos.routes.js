import { Router } from "express";
import {
  getActivos,
  getActivoById,
  createActivo,
  updateActivo,
  getUbicacionActual,
  getHistorialUbicaciones,
  getActivosByBodega,
  getActivosEnBodegas,
  getActivosByCliente,
  getActivosGlobal,
  getNextCodigo,
} from "../../controllers/Inventario/activos.controller.js";

import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

// Activos generales
router.get("/", authenticate, authorizeByPermisos("ver_activos"), getActivos);

router.get(
  "/next-code",
  authenticate,
  authorizeByPermisos("crear_activos"),
  getNextCodigo
);

// rutas específicas primero
router.get(
  "/all",
  authenticate,
  authorizeByPermisos("ver_activos"),
  getActivosGlobal
);
router.get(
  "/cliente/:idCliente",
  authenticate,
  authorizeByPermisos("ver_activos"),
  getActivosByCliente
);
router.get(
  "/bodega/:idBodega",
  authenticate,
  authorizeByPermisos("ver_activos"),
  getActivosByBodega
);

// dinámicas al final
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_activos"),
  getActivoById
);
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_activos"),
  createActivo
);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_activos"),
  updateActivo
);

// Ubicación y movimientos
router.get(
  "/:id/ubicacion",
  authenticate,
  authorizeByPermisos("ver_activos"),
  getUbicacionActual
);
router.get(
  "/:id/historial",
  authenticate,
  authorizeByPermisos("ver_historial_activos"),
  getHistorialUbicaciones
);

export default router;
