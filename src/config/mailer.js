// config/mailers.js
import nodemailer from "nodemailer";

export const supportTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.MAIL_USER, // support@herndevs.com
    pass: process.env.MAIL_PASS,
  },
});

// Ejemplo de transporter para no-reply
export const noReplyTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.NO_REPLY_USER, // no-reply@herndevs.com
    pass: process.env.NO_REPLY_PASS,
  },
});

// recovery opcional...
export const recoveryTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.RECOVERY_USER,
    pass: process.env.RECOVERY_PASS,
  },
});

export const sendNotificationSalidaTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.NO_REPLY_USER,
    pass: process.env.NO_REPLY_PASS,
  },
});

export const sendNotificationRegresoTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.NO_REPLY_USER,
    pass: process.env.NO_REPLY_PASS,
  },
});
