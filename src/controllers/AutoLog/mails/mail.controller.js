import { sendMail } from "../../../services/mail.service.js";
import { renderHtmlTemplate } from "../../../helpers/templateRenderer.js";
import pool from "../../../config/connectionToSql.js";
import crypto from "crypto";
import { format } from "date-fns";

export const sendWelcomeEmail = async (req, res) => {
  try {
    const { to, nombre, usuario, password } = req.body;

    if (!to || !nombre || !usuario || !password) {
      return res
        .status(400)
        .json({ error: "Faltan campos requeridos: to, nombre o password" });
    }

    const html = renderHtmlTemplate("welcome.html", {
      nombre,
      usuario,
      password,
    });

    const result = await sendMail({
      to,
      subject: "Bienvenido a AutoLog 🚗",
      html,
    });

    if (result.success) {
      return res.status(200).json({ message: "Correo enviado correctamente" });
    } else {
      return res
        .status(500)
        .json({ error: "Error al enviar correo", detail: result.error });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const sendCommentsEmail = async (req, res) => {
  try {
    const { toList, nombreEmpleado, comentarios } = req.body;

    if (
      !Array.isArray(toList) ||
      toList.length === 0 ||
      !comentarios ||
      !nombreEmpleado
    ) {
      return res.status(400).json({
        error: "Faltan campos requeridos: toList, nombreEmpleado o comentarios",
      });
    }

    const html = renderHtmlTemplate("comments.html", {
      nombreEmpleado,
      comentarios,
    });

    const result = await sendMail({
      to: toList,
      subject: `📣 Reporte de comentarios de ${nombreEmpleado}`,
      html,
      fromType: "noReply",
    });

    if (result.success) {
      return res.status(200).json({ message: "Correo enviado correctamente" });
    } else {
      return res.status(500).json({
        error: "Error al enviar correo",
        detail: result.error,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const sendResetPasswordEmail = async (req, res) => {
  const { email } = req.body;
  console.log("📌 Email de reseteo de contraseña:", email);

  try {
    // 1. Buscar el usuario por email
    const [users] = await pool.query(
      "SELECT id_usuario, nombre FROM usuarios WHERE email = ?",
      [email]
    );
    const user = users[0];

    // Verificar cuántos tokens ha solicitado en la última hora
    const [recentRequests] = await pool.query(
      `SELECT COUNT(*) as count FROM password_reset_tokens
   WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [user.id_usuario]
    );

    if (recentRequests[0].count >= 5) {
      return res.status(429).json({
        message:
          "Has solicitado demasiados restablecimientos recientemente. Intenta más tarde.",
      });
    }

    if (!user) {
      // Importante: Por razones de seguridad, no revelar si el correo existe o no.
      // Siempre devuelve un mensaje genérico.
      return res.status(200).json({
        message:
          "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      });
    }

    // 2. Generar un token único y seguro
    const resetToken = crypto.randomBytes(32).toString("hex"); // Genera un token aleatorio
    // Calcular la fecha de expiración (ej: 1 hora a partir de ahora)
    const now = new Date(Date.now() + 3600000); // 1 hora después
    const expiresAt = now.toISOString().slice(0, 19).replace("T", " "); // 👈 así MySQL lo acepta

    // Eliminar tokens anteriores (opcional pero recomendado)
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      user.id_usuario,
    ]);

    // 3. Guardar el token en la tabla `password_reset_tokens`
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id_usuario, resetToken, expiresAt]
    );

    // 4. Construir la URL de restablecimiento para el frontend
    // Asegúrate de que process.env.FRONTEND_URL esté configurado en tu .env del backend
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    // 5. Renderizar el template HTML del correo
    const html = renderHtmlTemplate("resetPassword.html", {
      nombre: user.nombre, // Pasamos el nombre del usuario al template
      url: resetUrl, // Pasamos la URL de restablecimiento al template
    });

    // 6. Enviar el correo electrónico utilizando tu servicio sendMail
    const emailResult = await sendMail({
      to: email,
      subject: "Restablecimiento de Contraseña en AutoLog", // Asunto claro
      html,
      fromType: "recovery", // Usar el alias de correo 'recovery'
    });

    if (!emailResult.success) {
      console.error(
        "Fallo al enviar el correo de restablecimiento:",
        emailResult.error
      );
      return res.status(500).json({
        message: "No se pudo enviar el correo de restablecimiento.",
      });
    }

    res.status(200).json({
      message:
        "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
    });
  } catch (error) {
    console.error(
      "Error en la solicitud de restablecimiento de contraseña (mail.controller):",
      error
    );
    res.status(500).json({
      message: "Error interno del servidor al procesar la solicitud.",
    });
  }
};

export const sendNotificationSalida = async (req, res) => {
  try {
    const { to, employeeName, vehicleName, supervisorName } = req.body;
    const now = new Date();
    const fecha = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const hora = now.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!to || !employeeName || !vehicleName || !supervisorName) {
      return res
        .status(400)
        .json({ error: "Faltan campos requeridos: to, nombre o password" });
    }

    const html = renderHtmlTemplate("notificationSalida.html", {
      employeeName,
      vehicleName,
      supervisorName,
      fecha,
      hora,
    });

    const result = await sendMail({
      to,
      subject: "Notificación de salida de vehículo",
      html,
      fromType: "noReply",
    });

    if (result.success) {
      return res.status(200).json({ message: "Correo enviado correctamente" });
    } else {
      return res
        .status(500)
        .json({ error: "Error al enviar correo", detail: result.error });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const sendNotificationRegreso = async (req, res) => {
  try {
    const { to, employeeName, vehicleName, supervisorName, estacionamiento } =
      req.body;
    const now = new Date();
    const fecha = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const hora = now.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (
      (!to || !employeeName || !vehicleName || !supervisorName,
      !estacionamiento)
    ) {
      return res
        .status(400)
        .json({ error: "Faltan campos requeridos: to, nombre o password" });
    }

    const html = renderHtmlTemplate("notificationRegreso.html", {
      employeeName,
      vehicleName,
      supervisorName,
      estacionamiento,
      fecha,
      hora,
    });

    const result = await sendMail({
      to,
      subject: "Notificación de regreso de vehículo",
      html,
      fromType: "noReply",
    });

    if (result.success) {
      return res.status(200).json({ message: "Correo enviado correctamente" });
    } else {
      return res
        .status(500)
        .json({ error: "Error al enviar correo", detail: result.error });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
