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
  console.log("📩 [/api/mail/forgot-password] email recibido:", email);

  try {
    // ---- 0) Sanity check envs en producción ----
    console.log("🔎 SMTP envs (prod):", {
      MAIL_HOST: process.env.MAIL_HOST,
      MAIL_PORT: process.env.MAIL_PORT,
      RECOVERY_USER: process.env.RECOVERY_USER,
    });

    if (!email) {
      console.warn("⚠️ No se envió email en el body");
      return res
        .status(400)
        .json({ message: "Debes indicar un correo electrónico." });
    }

    // 1) Buscar usuario por email
    const [users] = await pool.query(
      "SELECT id_usuario, nombre FROM usuarios WHERE email = ?",
      [email]
    );
    const user = users[0];

    console.log("👤 Usuario encontrado para reset?", !!user, user?.id_usuario);

    // Por seguridad, aunque no exista el usuario se devuelve 200
    if (!user) {
      console.log(
        "ℹ️ Email no registrado, respondiendo 200 genérico (no se enviará correo)."
      );
      return res.status(200).json({
        message:
          "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      });
    }

    // 2) Rate limit: cuántos tokens en la última hora
    const [recentRequests] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM password_reset_tokens
       WHERE user_id = ? 
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [user.id_usuario]
    );

    console.log(
      "⏱  Solicitudes recientes de reset:",
      recentRequests?.[0]?.count
    );

    if (recentRequests[0].count >= 5) {
      return res.status(429).json({
        message:
          "Has solicitado demasiados restablecimientos recientemente. Intenta más tarde.",
      });
    }

    // 3) Generar token y fecha de expiración
    const resetToken = crypto.randomBytes(32).toString("hex");
    const now = new Date(Date.now() + 3600000); // +1h
    const expiresAt = now.toISOString().slice(0, 19).replace("T", " ");

    console.log("🔑 Token generado:", resetToken.slice(0, 8) + "…");
    console.log("⏰ Expira en:", expiresAt);

    // 4) Borrar tokens anteriores y guardar el nuevo
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      user.id_usuario,
    ]);
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id_usuario, resetToken, expiresAt]
    );

    // 5) Construir URL de reset
    const frontendUrl = process.env.FRONTEND_URL;
    console.log("🌐 FRONTEND_URL =", frontendUrl);

    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;
    console.log("🔗 URL de reset generada:", resetUrl);

    // 6) Renderizar template
    const html = renderHtmlTemplate("resetPassword.html", {
      nombre: user.nombre,
      url: resetUrl,
    });

    // 7) Enviar correo (fromType: recovery)
    console.log("📨 Llamando a sendMail(recovery)…");
    const emailResult = await sendMail({
      to: email,
      subject: "Restablecimiento de Contraseña en AutoLog",
      html,
      fromType: "recovery",
    });

    console.log("📬 Resultado sendMail:", {
      success: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
        ? {
            message: emailResult.error.message,
            code: emailResult.error.code,
            command: emailResult.error.command,
          }
        : null,
    });

    if (!emailResult.success) {
      // 👇 deja esto así mientras debugueas, luego puedes hacerlo más genérico
      console.error("❌ Error al enviar correo de reset:", emailResult.error);
      return res.status(500).json({
        message: "No se pudo enviar el correo de restablecimiento.",
        // TEMPORAL: info extra para que la veas en el front (quítalo después)
        debug: {
          errorMessage: emailResult.error?.message,
          errorCode: emailResult.error?.code,
        },
      });
    }

    return res.status(200).json({
      message:
        "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
    });
  } catch (error) {
    console.error("💥 sendResetPasswordEmail error:", error);
    return res.status(500).json({
      message: "Error interno del servidor al procesar la solicitud.",
      // TEMPORAL para debug
      debug: error.message,
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
