// routes/Finanzas/Viaticos/viaticos.routes.js
import { Router } from "express";
import {
  // Catálogos / utilidades
  getCiudades,

  // Solicitudes
  listarSolicitudes,
  obtenerSolicitud,
  crearSolicitud,
  actualizarSolicitud, // PATCH encabezado (Borrador)
  enviarSolicitud,
  aprobarSolicitud,

  // Ítems de solicitud (Borrador)
  actualizarItem, // PATCH item
  eliminarItem, // DELETE item

  // Liquidaciones
  crearLiquidacion,
  listarLiquidaciones,
  obtenerLiquidacion, // GET detalle + comprobantes
  cerrarLiquidacion,

  // Comprobantes (JSON, sin archivos)
  agregarComprobante,
} from "../../controllers/Finanzas/Viaticos/viaticos.controller.js";

import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

/* =========================
   Catálogos / utilidades
========================= */
router.get(
  "/ciudades",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  getCiudades
);

router.get(
  "/liquidaciones",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  listarLiquidaciones
);

router.get(
  "/liquidaciones/:id",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  obtenerLiquidacion
);

/* =========================
   Viáticos: Solicitudes
========================= */
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  listarSolicitudes
);

router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_viaticos"),
  crearSolicitud
);

// 🔧 Editar encabezado (solo en Borrador)
router.patch(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_viaticos"),
  actualizarSolicitud
);

// ⚠️ Específicas primero (submit/approve) para no chocar con "/:id"
router.post(
  "/:id/submit",
  authenticate,
  authorizeByPermisos("enviar_viaticos"),
  enviarSolicitud
);

router.post(
  "/:id/approve",
  authenticate,
  authorizeByPermisos("aprobar_viaticos"),
  aprobarSolicitud
);

// Detalle de solicitud
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  obtenerSolicitud
);

/* =========================
   Ítems de Solicitud (Borrador)
========================= */
router.patch(
  "/items/:itemId",
  authenticate,
  authorizeByPermisos("editar_viaticos"),
  actualizarItem
);

router.delete(
  "/items/:itemId",
  authenticate,
  authorizeByPermisos("editar_viaticos"),
  eliminarItem
);

/* =========================
   Liquidaciones
========================= */
router.post(
  "/liquidaciones",
  authenticate,
  authorizeByPermisos("liquidar_viaticos"),
  crearLiquidacion
);

router.get(
  "/liquidaciones/:id",
  authenticate,
  authorizeByPermisos("ver_viaticos"),
  obtenerLiquidacion
);

router.post(
  "/liquidaciones/:id/cerrar",
  authenticate,
  authorizeByPermisos("cerrar_liquidacion_viaticos"),
  cerrarLiquidacion
);

/* =========================
   Comprobantes (JSON, sin archivos)
   Body puede ser:
   - { liquidacion_id, tipo, fecha, monto, ... }
   - { liquidacion_id, comprobantes: [ { ... }, { ... } ] }
========================= */
router.post(
  "/comprobantes",
  authenticate,
  authorizeByPermisos("agregar_comprobante_viaticos"),
  agregarComprobante
);

export default router;
