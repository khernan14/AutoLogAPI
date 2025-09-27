import express from "express";
import cors from "cors";
import "dotenv/config";
import pool from "./src/config/connectionToSql.js"; // ajusta la ruta si difiere
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
// import helpRoutes from "./src/routes/AutoLog/help.routes.js";
import helpPublicRoutes from "./src/routes/AutoLog/help.public.routes.js";
import helpAdminRoutes from "./src/routes/AutoLog/help.admin.routes.js";
import searchRoutes from "./src/routes/AutoLog/search.routes.js";

//rutas de Inventario
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
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "idempotency-key",
    ],
    exposedHeaders: ["Idempotency-Key", "idempotency-key"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.options("*", cors());

const uploadsPath = path.join(__dirname, "src", "uploads");

// Swagger UI (para documentación)
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerCustomOptions)
);

app.get("/health", async (req, res) => {
  try {
    // Ping super rápido a la DB (opcional)
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: "up" });
  } catch (e) {
    // Si tu DB tarda en levantar, puedes devolver 200 igualmente para no matar el contenedor
    res.status(500).json({ ok: false, db: "down" });
  }
});

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
// app.use("/api/help", helpRoutes);
app.use("/api", helpPublicRoutes);
app.use("/api", helpAdminRoutes);
app.use("/api", searchRoutes);

//rutas de Inventario
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
