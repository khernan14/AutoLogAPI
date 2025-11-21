// src/routes/whatsapp.routes.js
import express from "express";
import {
  whatsappWebhookVerify,
  whatsappWebhookReceive,
} from "../../controllers/Mensajeria/whatsapp.controller.js";

const router = express.Router();

// Verificación de webhook (GET)
router.get("/webhook", whatsappWebhookVerify);

// Recepción de mensajes (POST)
router.post(
  "/webhook",
  express.json({ type: "*/*" }), // por si Meta manda tipo diferente
  whatsappWebhookReceive
);

export default router;
