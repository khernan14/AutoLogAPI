import express from "express";
import upload from "../../middleware/upload.middleware.js";
import {
  validarRegistroSalida,
  validarRegistroRegreso,
} from "../../middleware/validaciones.middleware.js";
import {
  registrarSalida,
  registrarRegreso,
  asociarImagenes,
  obtenerRegistroConImagenes,
  obtenerRegistroPendienteEmpleado,
  obtenerKmActual,
  obtenerCombustibleActual,
  getCiudades,
} from "../../controllers/AutoLog/Registros/registros.controller.js";

import {
  obtenerRegistrosPorFecha,
  obtenerRegistrosPorEmpleado,
  obtenerVehiculosDisponibles,
} from "../../controllers/AutoLog/Reports/reportes.controller.js";

import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Registros
 *     description: Rutas para gestionar registros de uso de vehículos
 */

/**
 * @swagger
 * /registros/ciudades:
 *   get:
 *     summary: Obtener lista de ciudades
 *     tags: [Registros]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/ciudades",
  authenticate,
  authorizeByPermisos("ver_ciudades"),
  getCiudades
);

/**
 * @swagger
 * /registros/empleados/{id_empleado}/registro-pendiente:
 *   get:
 *     summary: Obtener el registro pendiente de un empleado
 *     tags: [Registros]
 */
router.get(
  "/empleados/:id_empleado/registro-pendiente",
  obtenerRegistroPendienteEmpleado
);

/**
 * @swagger
 * /registros/obtener-km-actual/{id_vehiculo}:
 *   get:
 *     summary: Obtener el kilometraje actual del vehículo
 *     tags: [Registros]
 */
router.get("/obtener-km-actual/:id_vehiculo", obtenerKmActual);

/**
 * @swagger
 * /registros/obtener-combustible-actual/{id_vehiculo}:
 *   get:
 *     summary: Obtener nivel de combustible actual del vehículo
 *     tags: [Registros]
 */
router.get(
  "/obtener-combustible-actual/:id_vehiculo",
  obtenerCombustibleActual
);

/**
 * @swagger
 * /registros/salida:
 *   post:
 *     summary: Registrar la salida de un vehículo
 *     tags: [Registros]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post(
  "/salida",
  authenticate,
  authorizeByPermisos("registrar_uso"),
  upload.array("files", 10),
  validarRegistroSalida,
  registrarSalida
);

/**
 * @swagger
 * /registros/regreso:
 *   post:
 *     summary: Registrar el regreso de un vehículo
 *     tags: [Registros]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post(
  "/regreso",
  authenticate,
  authorizeByPermisos("registrar_uso"),
  upload.array("files", 10),
  validarRegistroRegreso,
  registrarRegreso
);

/**
 * @swagger
 * /registros/{id}/upload:
 *   post:
 *     summary: Asociar imágenes a un registro
 *     tags: [Registros]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imagenes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post("/:id/upload", upload.array("imagenes", 10), asociarImagenes);

/**
 * @swagger
 * /registros/{id}:
 *   get:
 *     summary: Obtener un registro con sus imágenes
 *     tags: [Registros]
 */
router.get("/:id", obtenerRegistroConImagenes);

/**
 * @swagger
 * /registros/reportes/fecha:
 *   get:
 *     summary: Obtener registros por fecha
 *     tags: [Registros]
 */
router.get("/reportes/fecha", obtenerRegistrosPorFecha);

/**
 * @swagger
 * /registros/reportes/empleado/{id_empleado}:
 *   get:
 *     summary: Obtener registros por empleado
 *     tags: [Registros]
 */
router.get("/reportes/empleado/:id_empleado", obtenerRegistrosPorEmpleado);

/**
 * @swagger
 * /registros/vehiculos/disponibles:
 *   get:
 *     summary: Obtener vehículos disponibles
 *     tags: [Registros]
 */
router.get("/vehiculos/disponibles", obtenerVehiculosDisponibles);

export default router;
