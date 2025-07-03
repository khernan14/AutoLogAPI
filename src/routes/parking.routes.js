import express from "express";
import {
  getParkings,
  addParking,
  updateParking,
  deleteParking,
} from "../controllers/parkings.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Rutas protegidas
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_estacionamientos"),
  getParkings
);
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_estacionamientos"),
  addParking
);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_estacionamientos"),
  updateParking
);
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_estacionamientos"),
  deleteParking
);

export default router;
