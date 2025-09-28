import { Router } from "express";
import {
  getConfigByEvent,
  upsertConfigByEvent,
} from "../../controllers/Notificaciones/config.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Ver configuración de un evento (toggle + grupos asignados)
router.get(
  "/:clave",
  authorizeByPermisos("notif_settings_ver"),
  getConfigByEvent
);

// Guardar configuración (toggle + grupos)
router.put(
  "/:clave",
  authorizeByPermisos("notif_settings_editar"),
  upsertConfigByEvent
);

export default router;
