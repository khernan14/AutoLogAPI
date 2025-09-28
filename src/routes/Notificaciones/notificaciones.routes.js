import { Router } from "express";
import {
  dispararEvento,
  listarNotificaciones,
  getNotificacion,
  getDestinatarios,
  retryNotificacion,
} from "../../controllers/Notificaciones/notificaciones.controller.js";

import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Disparar evento (crea y envía inmediatamente, sin cola)
router.post(
  "/eventos/:clave",
  authorizeByPermisos("notif_disparar_evento"),
  dispararEvento
);

// Listar notificaciones
router.get("/", authorizeByPermisos("notif_ver"), listarNotificaciones);

// Detalle
router.get("/:id", authorizeByPermisos("notif_ver"), getNotificacion);

// Destinatarios
router.get(
  "/:id/destinatarios",
  authorizeByPermisos("notif_ver"),
  getDestinatarios
);

// Reintentar fallidos/suprimidos
router.post(
  "/:id/retry",
  authorizeByPermisos("notif_retry"),
  retryNotificacion
);

export default router;
