import express from "express";
import upload from "../middleware/upload.middleware.js";
import {
  validarRegistroSalida,
  validarRegistroRegreso,
} from "../middleware/validaciones.middleware.js";
import {
  registrarSalida,
  registrarRegreso,
  asociarImagenes,
  obtenerRegistroConImagenes,
  obtenerRegistroPendienteEmpleado,
  obtenerKmActual,
  obtenerCombustibleActual,
  getCiudades,
} from "../controllers/registros.controller.js";

import {
  obtenerRegistrosPorFecha,
  obtenerRegistrosPorEmpleado,
  obtenerVehiculosDisponibles,
} from "../controllers/reportes.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/ciudades",
  authenticate,
  authorizeByPermisos("ver_ciudades"),
  getCiudades
);

router.get(
  "/empleados/:id_empleado/registro-pendiente",
  obtenerRegistroPendienteEmpleado
);
router.get("/obtener-km-actual/:id_vehiculo", obtenerKmActual);
router.get(
  "/obtener-combustible-actual/:id_vehiculo",
  obtenerCombustibleActual
);
router.post(
  "/salida",
  authenticate,
  authorizeByPermisos("registrar_uso"),
  upload.array("files", 10),
  validarRegistroSalida,
  registrarSalida
);
router.post(
  "/regreso",
  authenticate,
  authorizeByPermisos("registrar_uso"),
  validarRegistroRegreso,
  registrarRegreso
);
router.post("/:id/upload", upload.array("imagenes", 10), asociarImagenes);
router.get("/:id", obtenerRegistroConImagenes);

router.get("/reportes/fecha", obtenerRegistrosPorFecha);
router.get("/reportes/empleado/:id_empleado", obtenerRegistrosPorEmpleado);
router.get("/vehiculos/disponibles", obtenerVehiculosDisponibles);

export default router;
