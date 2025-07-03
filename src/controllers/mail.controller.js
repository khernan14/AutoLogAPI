import { sendMail } from "../services/mail.service.js";
import { renderHtmlTemplate } from "../helpers/templateRenderer.js";

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
