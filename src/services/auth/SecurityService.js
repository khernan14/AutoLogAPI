// src/services/auth/SecurityService.js
import { sendMail } from "../../services/mail.service.js"; // Asegúrate que la ruta a mail.service.js sea correcta
import { UAParser } from "ua-parser-js"; // 👈 CAMBIO AQUÍ: Agregamos llaves { }
import requestIp from "request-ip";

export const sendLoginAlert = async (user, req) => {
  try {
    // 1. Detectar si el usuario tiene alertas activadas
    // (Por ahora asumimos que sí o que el controller ya lo validó)

    // Parsear User Agent
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    // Obtener IP
    const ip = requestIp.getClientIp(req) || "IP desconocida";

    // Formatear datos
    const navegador = `${ua.browser.name || "Navegador"} ${
      ua.browser.version || ""
    }`;
    const sistema = `${ua.os.name || "OS"} ${ua.os.version || ""}`;
    const dispositivo = ua.device.model
      ? `${ua.device.vendor || ""} ${ua.device.model}`
      : "PC/Mac";

    const fecha = new Date().toLocaleString("es-HN", {
      timeZone: "America/Tegucigalpa",
    });

    // HTML simple para la alerta
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #d9534f; border-bottom: 2px solid #d9534f; padding-bottom: 10px;">⚠️ Nuevo inicio de sesión detectado</h2>
        <p>Hola <strong>${user.nombre}</strong>,</p>
        <p>Se ha detectado un nuevo inicio de sesión en tu cuenta de <strong>AutoLog</strong>.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 8px;">🖥️ <strong>Dispositivo:</strong> ${dispositivo} (${sistema})</li>
            <li style="margin-bottom: 8px;">🌐 <strong>Navegador:</strong> ${navegador}</li>
            <li style="margin-bottom: 8px;">📍 <strong>IP:</strong> ${ip}</li>
            <li style="margin-bottom: 0;">📅 <strong>Fecha:</strong> ${fecha}</li>
          </ul>
        </div>

        <p style="font-size: 0.9em; color: #666;">
          Si fuiste tú, puedes ignorar este mensaje tranquilamente. <br>
          <strong>Si NO fuiste tú, por favor cambia tu contraseña inmediatamente y contacta a soporte.</strong>
        </p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; font-size: 0.8em; color: #999;">
          AutoLog - Seguridad
        </p>
      </div>
    `;

    // Enviar correo
    await sendMail({
      to: user.email,
      subject: "🚨 Alerta de seguridad: Nuevo inicio de sesión",
      html,
      fromType: "noReply",
    });

    console.log(`[Security] Alerta de login enviada a ${user.email}`);
  } catch (error) {
    console.error("[Security] Error enviando alerta de login:", error);
    // No lanzamos el error para no bloquear el login del usuario si el correo falla
  }
};
