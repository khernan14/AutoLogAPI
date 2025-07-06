import express from "express";
import {
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from "../controllers/mail.controller.js";

const router = express.Router();

router.post("/send-welcome", sendWelcomeEmail);

router.post("/forgot-password", sendResetPasswordEmail);

export default router;
