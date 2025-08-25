import express from "express";
import { obtenerDatosDashboard } from "../../controllers/AutoLog/Reports/consultasDashboard.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

// Ruta dinámica para cada acción del dashboard
router.get(
  "/:accion",
  authenticate, // <- primero autenticamos
  authorizeByPermisos("ver_dashboard"), // <- luego autorizamos
  obtenerDatosDashboard
);

export default router;
