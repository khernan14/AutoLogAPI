/**
 * @swagger
 * tags:
 *   name: Ciudades
 *   description: Endpoints para la gestión de ciudades
 */

import express from "express";
import {
  getCities,
  addCity,
  updateCity,
  deleteCity,
} from "../controllers/cities.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes

/**
 * @swagger
 * /cities:
 *   get:
 *     summary: Obtener todas las ciudades
 *     tags: [Ciudades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ciudades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/", authenticate, authorizeByPermisos("ver_ciudades"), getCities);

/**
 * @swagger
 * /cities:
 *   post:
 *     summary: Crear una nueva ciudad
 *     tags: [Ciudades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Tegucigalpa
 *     responses:
 *       201:
 *         description: Ciudad creada exitosamente
 */
router.post("/", authenticate, authorizeByPermisos("crear_ciudades"), addCity);

/**
 * @swagger
 * /cities/{id}:
 *   put:
 *     summary: Actualizar una ciudad
 *     tags: [Ciudades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID de la ciudad
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: San Pedro Sula
 *     responses:
 *       200:
 *         description: Ciudad actualizada
 */
router.put("/:id", authorizeByPermisos("editar_ciudades"), updateCity);

/**
 * @swagger
 * /cities/{id}:
 *   delete:
 *     summary: Eliminar una ciudad
 *     tags: [Ciudades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID de la ciudad a eliminar
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ciudad eliminada
 */
router.delete("/:id", authorizeByPermisos("eliminar_ciudades"), deleteCity);

export default router;
