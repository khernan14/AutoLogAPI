import { Router } from "express";
import {
  getBodegas,
  getBodegaById,
  createBodega,
  updateBodega,
} from "../../controllers/Inventario/bodega.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, authorizeByPermisos("ver_bodegas"), getBodegas); // todas las bodegas
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_bodegas"),
  getBodegaById
); // un bodega
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_bodegas"),
  createBodega
); // crear una bodega
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_bodegas"),
  updateBodega
); // editar una bodega

export default router;
