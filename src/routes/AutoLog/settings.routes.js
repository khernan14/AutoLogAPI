import { Router } from "express";
import {
  getAllSettings,
  getSection,
  patchSection,
  getSectionHistory,
} from "../../controllers/AutoLog/settings/settings.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

// Aplica autenticación a todo el router
router.use(authenticate);

// Middleware para validar el parámetro :section
const validateSectionParam = (req, res, next) => {
  const { section } = req.params;
  if (!section || typeof section !== "string") {
    return res.status(400).json({ message: "Sección inválida" });
  }
  next();
};

/**
 * GET /
 * Obtiene todas las configuraciones (merge de defaults + usuario)
 */
router.get("/", authorizeByPermisos("ver_configuraciones"), getAllSettings);

/**
 * GET /:section
 * Obtiene una sección específica
 */
router.get(
  "/:section",
  authorizeByPermisos("ver_configuraciones"),
  validateSectionParam,
  getSection
);

/**
 * PATCH /:section
 * Actualiza parcialmente una sección
 */
router.patch(
  "/:section",
  authorizeByPermisos("editar_configuraciones"),
  validateSectionParam,
  (req, res, next) => {
    // Validar que el body sea un objeto JSON válido
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Payload inválido: se requiere un objeto JSON parcial",
      });
    }
    next();
  },
  patchSection
);

/**
 * GET /:section/history
 * Historial de cambios
 */
router.get(
  "/:section/history",
  authorizeByPermisos("ver_configuraciones"),
  validateSectionParam,
  getSectionHistory
);

export default router;
