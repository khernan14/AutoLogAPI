import express from "express";
import { obtenerDatosDashboard } from "../controllers/consultasDashboard.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Ruta dinámica para cada acción del dashboard
router.get("/:accion", obtenerDatosDashboard);

export default router;
