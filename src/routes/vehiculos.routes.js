import express from "express";
import {
  getVehiculos,
  addVehiculo,
  updateVehiculo,
  deleteVehiculo,
  listarVehiculosEmpleado,
  getUbicaciones,
  restoreVehiculo,
} from "../controllers/vehiculos.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_vehiculos"),
  getVehiculos
);
router.get("/ubicaciones", authenticate, getUbicaciones);
router.get("/:id", authenticate, listarVehiculosEmpleado);
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_vehiculo"),
  addVehiculo
);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_vehiculo"),
  updateVehiculo
);
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_vehiculo"),
  deleteVehiculo
);
router.put("/restaurar/:id", authenticate, restoreVehiculo);

export default router;
