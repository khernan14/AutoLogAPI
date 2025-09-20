// index.js
import app from "./app.js";
import pool from "./src/config/connectionToSql.js"; // para cerrar el pool en shutdown

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en ${HOST}:${PORT}`);
});

// Shutdown ordenado (Railway envía SIGTERM en despliegues/rollouts)
async function shutdown(signal) {
  console.log(`Recibido ${signal}, cerrando servidor...`);
  server.close(async () => {
    try {
      await pool.end?.(); // cierra pool MySQL si tu cliente lo soporta
    } catch {}
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
