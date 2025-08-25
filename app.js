import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./src/routes/AutoLog/auth.routes.js";
import empleadosRoutes from "./src/routes/AutoLog/empleados.routes.js";
import vehiculosRoutes from "./src/routes/AutoLog/vehiculos.routes.js";
import registrosRoutes from "./src/routes/AutoLog/registros.routes.js";
import consultasRoutes from "./src/routes/AutoLog/consultas.routes.js";
import reservasRoutes from "./src/routes/AutoLog/reservas.route.js";
import countriesRoutes from "./src/routes/AutoLog/countries.routes.js";
import citiesRoutes from "./src/routes/AutoLog/cities.routes.js";
import parkingRoutes from "./src/routes/AutoLog/parking.routes.js";
import permisosRoutes from "./src/routes/AutoLog/permisos.routes.js";
import mailRoutes from "./src/routes/AutoLog/mail.routes.js";
import gruposRoutes from "./src/routes/AutoLog/grupos.routes.js";
import grupoUsuariosRoutes from "./src/routes/AutoLog/grupoUsuarios.routes.js";
import registerReportRoutes from "./src/routes/AutoLog/registerReport.routes.js";
import helpRoutes from "./src/routes/AutoLog/help.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import multer from "multer";
import {
  swaggerUi,
  swaggerSpec,
  swaggerCustomOptions,
} from "./src/config/swagger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Servir carpeta de imágenes

const app = express();

// Middlewares
app.use(
  cors({
    origin: "*", // o especifica tu dominio por seguridad
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(__dirname, "src", "uploads");

// Swagger UI (para documentación)
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerCustomOptions)
);

// Routes
app.use("/uploads", express.static(uploadsPath));
app.use("/api/auth", authRoutes);
app.use("/api/empleados", empleadosRoutes);
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/registros", registrosRoutes);
app.use("/api/dashboard", consultasRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/countries", countriesRoutes);
app.use("/api/cities", citiesRoutes);
app.use("/api/parkings", parkingRoutes);
app.use("/api/permisos", permisosRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/grupo-usuarios", grupoUsuariosRoutes);
app.use("/api/reports", registerReportRoutes);
app.use("/api/help", helpRoutes);

// Middleware de manejo de errores de multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Errores propios de multer (tamaño, etc)
    return res.status(400).json({ error: err.message });
  }

  if (err.message.includes("Tipo de archivo no permitido")) {
    // Nuestro custom error de tipo MIME no válido
    return res.status(400).json({ error: err.message });
  }

  // Otros errores no manejados
  console.error("❌ Error inesperado:", err);
  return res.status(500).json({ error: "Error interno del servidor." });
});

export default app;
