// src/routes/helpRoutes.js

import express from "express";
import {
  getFAQs,
  addFAQ,
  updateFAQ,
  deleteFAQ,
  getTutorials,
  addTutorial,
  updateTutorial,
  deleteTutorial,
  getChangelogs,
  addChangelog,
  updateChangelog,
  deleteChangelog,
  getSystemServices,
  addSystemService,
  updateSystemServiceStatus,
  deleteSystemService,
  addOverallStatusLog,
  getOverallStatusHistory,
} from "../controllers/help.controller.js"; // Asegúrate de que esta ruta sea correcta

// Importa tus middlewares de autenticación y autorización
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js"; // Asegúrate de que esta ruta sea correcta

const router = express.Router();

// --- Rutas para FAQs ---
// Acceso público para obtener FAQs
router.get("/faqs", getFAQs);
router.get("/faqs/:id", getFAQs);

// Acceso restringido para modificar FAQs
router.post("/faqs", authenticate, authorizeByPermisos("crear_faqs"), addFAQ);
router.put(
  "/faqs/:id",
  authenticate,
  authorizeByPermisos("editar_faqs"),
  updateFAQ
);
router.delete(
  "/faqs/:id",
  authenticate,
  authorizeByPermisos("eliminar_faqs"),
  deleteFAQ
);

// --- Rutas para Tutoriales ---
// Acceso público para obtener tutoriales
router.get("/tutorials", getTutorials);

// Acceso restringido para modificar tutoriales
router.post(
  "/tutorials",
  authenticate,
  authorizeByPermisos("crear_tutoriales"),
  addTutorial
);
router.put(
  "/tutorials/:id",
  authenticate,
  authorizeByPermisos("editar_tutoriales"),
  updateTutorial
);
router.delete(
  "/tutorials/:id",
  authenticate,
  authorizeByPermisos("eliminar_tutoriales"),
  deleteTutorial
);

// --- Rutas para Changelogs (Novedades y Anuncios) ---
// Acceso público para obtener changelogs
router.get("/changelogs", getChangelogs);

// Acceso restringido para modificar changelogs
router.post(
  "/changelogs",
  authenticate,
  authorizeByPermisos("crear_novedades"),
  addChangelog
);
router.put(
  "/changelogs/:id",
  authenticate,
  authorizeByPermisos("editar_novedades"),
  updateChangelog
);
router.delete(
  "/changelogs/:id",
  authenticate,
  authorizeByPermisos("eliminar_novedades"),
  deleteChangelog
);

// --- Rutas para System Services (Estado de Servicios) ---
// Acceso público para obtener el estado de los servicios
router.get("/services", getSystemServices);

// Acceso restringido para modificar servicios del sistema
router.post(
  "/services",
  authenticate,
  authorizeByPermisos("crear_servicios_sistema"),
  addSystemService
);
router.put(
  "/services/:id",
  authenticate,
  authorizeByPermisos("editar_servicios_sistema"),
  updateSystemServiceStatus
);
router.delete(
  "/services/:id",
  authenticate,
  authorizeByPermisos("eliminar_servicios_sistema"),
  deleteSystemService
);

// --- Rutas para System Overall Status Log (Historial de Estado General) ---
// Acceso público para obtener el historial de estado general
router.get("/status/history", getOverallStatusHistory);

// Acceso restringido para registrar un nuevo estado general (probablemente para un sistema automatizado o admin)
router.post(
  "/status/log",
  authenticate,
  authorizeByPermisos("registrar_estado_general"),
  addOverallStatusLog
);

export default router;
