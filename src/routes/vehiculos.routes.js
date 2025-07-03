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
router.get(
  "/ubicaciones",
  authenticate,
  authorizeByPermisos("ver_ubicaciones"),
  getUbicaciones
);
router.get("/:id", authenticate, listarVehiculosEmpleado);
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_vehiculos"),
  addVehiculo
);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_vehiculos"),
  updateVehiculo
);
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_vehiculos"),
  deleteVehiculo
);
router.put("/restaurar/:id", authenticate, restoreVehiculo);

export default router;
