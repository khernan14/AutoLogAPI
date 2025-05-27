import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./src/routes/auth.routes.js";
import empleadosRoutes from "./src/routes/empleados.routes.js";
import vehiculosRoutes from "./src/routes/vehiculos.routes.js";
import registrosRoutes from "./src/routes/registros.routes.js";
import consultasRoutes from "./src/routes/consultas.routes.js";
import reservasRoutes from "./src/routes/reservas.route.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// app.use("/uploads", express.static("uploads"));
app.use("/api/auth", authRoutes);
app.use("/api/empleados", empleadosRoutes);
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/registros", registrosRoutes);
app.use("/api/dashboard", consultasRoutes);
app.use("/api/reservas", reservasRoutes);

export default app;
