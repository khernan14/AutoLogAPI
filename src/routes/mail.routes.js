import express from "express";
import {
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendNotificationSalida,
  sendNotificationRegreso,
} from "../controllers/mail.controller.js";

const router = express.Router();

router.post("/send-welcome", sendWelcomeEmail);

router.post("/forgot-password", sendResetPasswordEmail);
router.post("/notification-salida", sendNotificationSalida);
router.post("/notification-regreso", sendNotificationRegreso);

export default router;
