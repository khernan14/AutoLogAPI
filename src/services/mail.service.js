// services/emailService.js
import {
  supportTransporter,
  noReplyTransporter,
  recoveryTransporter,
} from "../config/mailer.js";

const fromMap = {
  support: {
    name: "HernDev Systems",
    email: process.env.MAIL_USER,
    transporter: supportTransporter,
  },
  noReply: {
    name: "HernDev Notificaciones",
    email: process.env.NO_REPLY_USER,
    transporter: noReplyTransporter,
  },
  recovery: {
    name: "HernDev Notificaciones",
    email: process.env.RECOVERY_USER,
    transporter: recoveryTransporter,
  },
};

export const sendMail = async ({ to, subject, html, fromType = "support" }) => {
  const fromInfo = fromMap[fromType] || fromMap["support"];

  const mailOptions = {
    from: `"${fromInfo.name}" <${fromInfo.email}>`,
    to: Array.isArray(to) ? to.join(",") : to,
    subject,
    html,
  };

  try {
    const info = await fromInfo.transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo:", error);
    return { success: false, error };
  }
};
