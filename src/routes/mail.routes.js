import express from "express";
import {
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendNotificationSalida,
  sendNotificationRegreso,
} from "../controllers/mail.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Correos
 *     description: Endpoints relacionados con correos electrónicos
 *   - name: Notificaciones de Vehículos
 *     description: Notificaciones por correo sobre salidas y regresos de vehículos
 */

/**
 * @swagger
 * /send-welcome:
 *   post:
 *     summary: Envia un correo electrónico de bienvenida a un nuevo usuario.
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Dirección de correo electrónico del usuario.
 *                 example: usuario@ejemplo.com
 *               name:
 *                 type: string
 *                 description: Nombre del usuario.
 *                 example: Juan Pérez
 *     responses:
 *       200:
 *         description: Correo de bienvenida enviado exitosamente.
 *       400:
 *         description: Datos inválidos proporcionados.
 *       500:
 *         description: Error al enviar el correo de bienvenida.
 */
router.post("/send-welcome", sendWelcomeEmail);

/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Envia un correo electrónico para restablecer la contraseña.
 *     tags: [Correos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Dirección de correo del usuario.
 *                 example: usuario@ejemplo.com
 *     responses:
 *       200:
 *         description: Instrucciones enviadas exitosamente.
 *       400:
 *         description: Correo no encontrado o inválido.
 *       500:
 *         description: Error al enviar el correo.
 */
router.post("/forgot-password", sendResetPasswordEmail);

/**
 * @swagger
 * /notification-salida:
 *   post:
 *     summary: Envia una notificación por correo electrónico de salida de vehículo.
 *     tags: [Notificaciones de Vehículos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - vehicleId
 *               - exitTime
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo del destinatario.
 *                 example: conductor@ejemplo.com
 *               vehicleId:
 *                 type: string
 *                 description: ID del vehículo.
 *                 example: ABC-123
 *               exitTime:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha y hora de salida (ISO 8601).
 *                 example: "2025-07-12T10:00:00Z"
 *     responses:
 *       200:
 *         description: Notificación enviada exitosamente.
 *       400:
 *         description: Datos inválidos.
 *       500:
 *         description: Error al enviar notificación.
 */
router.post("/notification-salida", sendNotificationSalida);

/**
 * @swagger
 * /notification-regreso:
 *   post:
 *     summary: Envia una notificación por correo electrónico de regreso de vehículo.
 *     tags: [Notificaciones de Vehículos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - vehicleId
 *               - returnTime
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo del destinatario.
 *                 example: conductor@ejemplo.com
 *               vehicleId:
 *                 type: string
 *                 description: ID del vehículo.
 *                 example: ABC-123
 *               returnTime:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha y hora de regreso (ISO 8601).
 *                 example: "2025-07-12T18:30:00Z"
 *     responses:
 *       200:
 *         description: Notificación enviada exitosamente.
 *       400:
 *         description: Datos inválidos.
 *       500:
 *         description: Error al enviar notificación.
 */
router.post("/notification-regreso", sendNotificationRegreso);

export default router;
