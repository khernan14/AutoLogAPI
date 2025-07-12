import express from "express";
import {
  getCountries,
  addCountry,
  updateCountry,
  deleteCountry,
} from "../controllers/countries.controller.js";
import {
  authenticate,
  authorize,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Países
 *   description: Endpoints para la gestión de países
 */

/**
 * @swagger
 * /countries:
 *   get:
 *     summary: Obtener todos los países
 *     tags: [Países]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de países
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/", authenticate, authorizeByPermisos("ver_paises"), getCountries);

/**
 * @swagger
 * /countries:
 *   post:
 *     summary: Crear un nuevo país
 *     tags: [Países]
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
 *                 example: Honduras
 *     responses:
 *       201:
 *         description: País creado exitosamente
 */
router.post("/", authenticate, authorizeByPermisos("crear_paises"), addCountry);

/**
 * @swagger
 * /countries/{id}:
 *   put:
 *     summary: Actualizar un país
 *     tags: [Países]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del país
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
 *                 example: Nicaragua
 *     responses:
 *       200:
 *         description: País actualizado
 */
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_paises"),
  updateCountry
);

/**
 * @swagger
 * /countries/{id}:
 *   delete:
 *     summary: Eliminar un país
 *     tags: [Países]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del país a eliminar
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: País eliminado
 */
router.delete("/:id", authenticate, authorize("Admin"), deleteCountry);

export default router;
