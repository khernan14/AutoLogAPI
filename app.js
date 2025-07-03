import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./src/routes/auth.routes.js";
import empleadosRoutes from "./src/routes/empleados.routes.js";
import vehiculosRoutes from "./src/routes/vehiculos.routes.js";
import registrosRoutes from "./src/routes/registros.routes.js";
import consultasRoutes from "./src/routes/consultas.routes.js";
import reservasRoutes from "./src/routes/reservas.route.js";
import countriesRoutes from "./src/routes/countries.routes.js";
import citiesRoutes from "./src/routes/cities.routes.js";
import parkingRoutes from "./src/routes/parking.routes.js";
import permisosRoutes from "./src/routes/permisos.routes.js";
import mailRoutes from "./src/routes/mail.routes.js";
import gruposRoutes from "./src/routes/grupos.routes.js";
import grupoUsuariosRoutes from "./src/routes/grupoUsuarios.routes.js";
import registerReportRoutes from "./src/routes/registerReport.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

const uploadsPath = "/app/uploads";

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

export default app;
