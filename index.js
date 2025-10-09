// index.js
import app from "./app.js";
import pool from "./src/config/connectionToSql.js";
import logger from "./src/utils/logger.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT }, "Servidor iniciado");
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info({ signal }, "Recibido signal, cerrando servidor...");
  server.close(async () => {
    try {
      await pool.end?.();
      logger.info("Pool MySQL cerrado");
    } catch (err) {
      logger.warn({ err }, "Error cerrando pool");
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Atrapa errores no manejados (para log, no para continuar)
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  process.exit(1);
});
