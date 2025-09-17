// import express from "express";
// import {
//   getFAQs,
//   addFAQ,
//   updateFAQ,
//   deleteFAQ,
//   getTutorials,
//   addTutorial,
//   updateTutorial,
//   deleteTutorial,
//   getChangelogs,
//   addChangelog,
//   updateChangelog,
//   deleteChangelog,
//   getSystemServices,
//   addSystemService,
//   updateSystemServiceStatus,
//   deleteSystemService,
//   addOverallStatusLog,
//   getOverallStatusHistory,
// } from "../../controllers/AutoLog/mails/help.controller.js";

// import {
//   authenticate,
//   authorizeByPermisos,
// } from "../../middleware/auth.middleware.js";

// const router = express.Router();

// /**
//  * @swagger
//  * tags:
//  *   - name: FAQs
//  *     description: Preguntas frecuentes
//  *   - name: Tutoriales
//  *     description: Tutoriales del sistema
//  *   - name: Novedades
//  *     description: Anuncios y cambios recientes
//  *   - name: Servicios
//  *     description: Estado de servicios del sistema
//  *   - name: Estado General
//  *     description: Registro del estado general del sistema
//  */

// // FAQs
// /**
//  * @swagger
//  * /help/faqs:
//  *   get:
//  *     summary: Obtener todas las FAQs
//  *     tags: [FAQs]
//  *     responses:
//  *       200:
//  *         description: Lista de FAQs
//  */
// router.get("/faqs", getFAQs);

// /**
//  * @swagger
//  * /help/faqs/{id}:
//  *   get:
//  *     summary: Obtener una FAQ por ID
//  *     tags: [FAQs]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: FAQ encontrada
//  */
// router.get("/faqs/:id", getFAQs);

// /**
//  * @swagger
//  * /help/faqs:
//  *   post:
//  *     summary: Crear una nueva FAQ
//  *     tags: [FAQs]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               pregunta:
//  *                 type: string
//  *               respuesta:
//  *                 type: string
//  *     responses:
//  *       201:
//  *         description: FAQ creada
//  */
// router.post("/faqs", authenticate, authorizeByPermisos("crear_faqs"), addFAQ);

// /**
//  * @swagger
//  * /help/faqs/{id}:
//  *   put:
//  *     summary: Actualizar una FAQ
//  *     tags: [FAQs]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: FAQ actualizada
//  */
// router.put(
//   "/faqs/:id",
//   authenticate,
//   authorizeByPermisos("editar_faqs"),
//   updateFAQ
// );

// /**
//  * @swagger
//  * /help/faqs/{id}:
//  *   delete:
//  *     summary: Eliminar una FAQ
//  *     tags: [FAQs]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: FAQ eliminada
//  */
// router.delete(
//   "/faqs/:id",
//   authenticate,
//   authorizeByPermisos("eliminar_faqs"),
//   deleteFAQ
// );

// // Tutoriales
// /**
//  * @swagger
//  * /help/tutorials:
//  *   get:
//  *     summary: Obtener todos los tutoriales
//  *     tags: [Tutoriales]
//  *     responses:
//  *       200:
//  *         description: Lista de tutoriales
//  */
// router.get("/tutorials", getTutorials);

// router.post(
//   "/tutorials",
//   authenticate,
//   authorizeByPermisos("crear_tutoriales"),
//   addTutorial
// );
// router.put(
//   "/tutorials/:id",
//   authenticate,
//   authorizeByPermisos("editar_tutoriales"),
//   updateTutorial
// );
// router.delete(
//   "/tutorials/:id",
//   authenticate,
//   authorizeByPermisos("eliminar_tutoriales"),
//   deleteTutorial
// );

// // Changelogs
// /**
//  * @swagger
//  * /help/changelogs:
//  *   get:
//  *     summary: Obtener lista de novedades
//  *     tags: [Novedades]
//  *     responses:
//  *       200:
//  *         description: Lista de changelogs
//  */
// router.get("/changelogs", getChangelogs);

// router.post(
//   "/changelogs",
//   authenticate,
//   authorizeByPermisos("crear_novedades"),
//   addChangelog
// );
// router.put(
//   "/changelogs/:id",
//   authenticate,
//   authorizeByPermisos("editar_novedades"),
//   updateChangelog
// );
// router.delete(
//   "/changelogs/:id",
//   authenticate,
//   authorizeByPermisos("eliminar_novedades"),
//   deleteChangelog
// );

// // Servicios del sistema
// /**
//  * @swagger
//  * /help/services:
//  *   get:
//  *     summary: Obtener estado de los servicios del sistema
//  *     tags: [Servicios]
//  *     responses:
//  *       200:
//  *         description: Estado actual
//  */
// router.get("/services", getSystemServices);

// router.post(
//   "/services",
//   authenticate,
//   authorizeByPermisos("crear_servicios_sistema"),
//   addSystemService
// );
// router.put(
//   "/services/:id",
//   authenticate,
//   authorizeByPermisos("editar_servicios_sistema"),
//   updateSystemServiceStatus
// );
// router.delete(
//   "/services/:id",
//   authenticate,
//   authorizeByPermisos("eliminar_servicios_sistema"),
//   deleteSystemService
// );

// // Estado General del sistema
// /**
//  * @swagger
//  * /help/status/history:
//  *   get:
//  *     summary: Obtener historial de estado general
//  *     tags: [Estado General]
//  *     responses:
//  *       200:
//  *         description: Lista de estados históricos
//  */
// router.get("/status/history", getOverallStatusHistory);

// /**
//  * @swagger
//  * /help/status/log:
//  *   post:
//  *     summary: Registrar nuevo estado general
//  *     tags: [Estado General]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       201:
//  *         description: Estado registrado
//  */
// router.post(
//   "/status/log",
//   authenticate,
//   authorizeByPermisos("registrar_estado_general"),
//   addOverallStatusLog
// );

// export default router;
