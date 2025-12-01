// app.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import pool from "./src/config/connectionToSql.js";

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
import grupoUsuariosRoutes from "./src/routes/AutoLog/grupoUsuarios.routes.js";
import registerReportRoutes from "./src/routes/AutoLog/registerReport.routes.js";
import helpPublicRoutes from "./src/routes/AutoLog/help.public.routes.js";
import helpAdminRoutes from "./src/routes/AutoLog/help.admin.routes.js";
import searchRoutes from "./src/routes/AutoLog/search.routes.js";

// Inventario
import clientesRoutes from "./src/routes/Inventario/clientes.routes.js";
import siteRoutes from "./src/routes/Inventario/sites.routes.js";
import bodegasRoutes from "./src/routes/Inventario/bodega.routes.js";
import activosRoutes from "./src/routes/Inventario/activos.routes.js";
import ubicacionesRoutes from "./src/routes/Inventario/ubicaciones.routes.js";
import contratosRoutes from "./src/routes/Inventario/contratos.routes.js";
import adendasRoutes from "./src/routes/Inventario/adendas.routes.js";
import detalleAdendaRoutes from "./src/routes/Inventario/detalleAdenda.routes.js";
import contratosActivosRoutes from "./src/routes/Inventario/contratosActivos.routes.js";
import salesOrdersRoutes from "./src/routes/Inventario/salesOrders.routes.js";
import salesOrdersActivosRoutes from "./src/routes/Inventario/salesOrdersActivos.routes.js";
import publicActivosRoutes from "./src/routes/Public/publicActivos.routes.js";

// Notificaciones
import notificacionesRoutes from "./src/routes/Notificaciones/notificaciones.routes.js";
import configRoutes from "./src/routes/Notificaciones/config.routes.js";
import plantillasRoutes from "./src/routes/Notificaciones/plantillas.routes.js";
import gruposRoutes from "./src/routes/Notificaciones/grupos.routes.js";
import eventosRoutes from "./src/routes/Notificaciones/eventos.routes.js";

// Mensajeria
import whatsappRoutes from "./src/routes/Mensajeria/whatsapp.routes.js";

// Viaticos
// import viaticosRoutes from "./src/routes/Finanzas/viaticos.routes.js";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import multer from "multer";
import {
  swaggerUi,
  swaggerSpec,
  swaggerCustomOptions,
} from "./src/config/swagger.js";

// 🔹 Logger y middleware de request
import logger from "./src/utils/logger.js";
import { requestLogger } from "./src/middleware/request-logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://herndevs.com",
  "https://www.herndevs.com",
];

// CORS
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/Postman sin Origin
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Idempotency-Key",
    "idempotency-key",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Body parsers (con límite)
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(cookieParser());

// 🔹 Log de cada request/respuesta
app.use(requestLogger);

// (Opcional) Log de origen CORS para depurar
app.use((req, _res, next) => {
  if (req.headers.origin) {
    logger.debug(
      { method: req.method, path: req.path, origin: req.headers.origin },
      "[CORS]"
    );
  }
  next();
});

// Manejo de JSON malformado (syntax error del body parser)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn({ err }, "JSON inválido en request");
    return res.status(400).json({ error: "Solicitud inválida (JSON)" });
  }
  return next(err);
});

// Archivos estáticos
const defaultUploads = path.join(process.cwd(), "src", "uploads");
const uploadsRoot = process.env.UPLOADS_PATH || defaultUploads;

// Crea carpetas necesarias al arrancar
fs.mkdirSync(uploadsRoot, { recursive: true });
// (opcional) si deseas mantener ambas subcarpetas disponibles
for (const sub of ["registros", "clientes"]) {
  fs.mkdirSync(path.join(uploadsRoot, sub), { recursive: true });
}

app.set("trust proxy", 1);

app.use("/uploads", express.static(uploadsRoot));

// Swagger
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerCustomOptions)
);

// Healthcheck
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ ok: true, db: "up" });
  } catch {
    return res.status(500).json({ ok: false, db: "down" });
  }
});

// Rutas
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
app.use("/api/grupo-usuarios", grupoUsuariosRoutes);
app.use("/api/reports", registerReportRoutes);
app.use("/api", helpPublicRoutes);
app.use("/api", helpAdminRoutes);
app.use("/api", searchRoutes);

// Inventario
app.use("/api/clientes", clientesRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/inventario/bodegas", bodegasRoutes);
app.use("/api/inventario/activos", activosRoutes);
app.use("/api/inventario/ubicaciones", ubicacionesRoutes);
app.use("/api/inventario/contratos", contratosRoutes);
app.use("/api/inventario/adendas", adendasRoutes);
app.use("/api/inventario/detalle-adenda", detalleAdendaRoutes);
app.use("/api/inventario/contratos-activos", contratosActivosRoutes);
app.use("/api/inventario/sales-orders", salesOrdersRoutes);
app.use("/api/inventario/sales-orders/lineas", salesOrdersActivosRoutes);
app.use("/public", publicActivosRoutes);

// Notificaciones
app.use("/api/notifications", notificacionesRoutes);
app.use("/api/notifications/config", configRoutes);
app.use("/api/notificaciones/grupos", gruposRoutes);
app.use("/api/notificaciones/plantillas", plantillasRoutes);
app.use("/api/notificaciones/eventos", eventosRoutes);

// Mensajeria
app.use("/api/whatsapp", whatsappRoutes);

// Viaticos
// app.use("/api/viaticos", viaticosRoutes);

// Errores de multer
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (
    typeof err?.message === "string" &&
    err.message.includes("Tipo de archivo no permitido")
  ) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

// 404
app.use((req, res) => {
  return res.status(404).json({ error: "No encontrado" });
});

// Error handler global (último)
app.use((err, req, res, _next) => {
  logger.error(
    { err, url: req.originalUrl, method: req.method },
    "Unhandled error"
  );
  return res.status(500).json({ error: "Error interno del servidor." });
});

export default app;
