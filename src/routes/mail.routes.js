import express from "express";
import { sendWelcomeEmail } from "../controllers/mail.controller.js";

const router = express.Router();

router.post("/send-welcome", sendWelcomeEmail);

export default router;
