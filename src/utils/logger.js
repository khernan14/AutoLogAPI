// src/utils/logger.js
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "password",
      "req.body.password",
      "req.headers.authorization",
      "authorization",
      "token",
      "jwt",
      "secret",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { singleLine: true } }
      : undefined,
});

export default logger;
