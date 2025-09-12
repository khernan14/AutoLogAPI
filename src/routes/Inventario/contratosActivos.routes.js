import { Router } from "express";
import { asignarActivoAContrato, cerrarAsignacion, getAsignacionVigenteByActivo, getActivosPorContrato, getActivosPorAdenda } from "../../controllers/Inventario/contratosActivos.controller.js";
import { validateAsignacionContratoActivo } from "../../middleware/validateContratoActivo.js";

const router = Router();

// asignar activo a detalle_adenda (temporal o permanente)
router.post("/asignar", validateAsignacionContratoActivo, asignarActivoAContrato);

// cerrar asignación (ej. fin de temporal)
router.post("/cerrar/:id", cerrarAsignacion);

// consultar asignación vigente (para facturar)
router.get("/vigente/activo/:id_activo", getAsignacionVigenteByActivo);

// listados
router.get("/contrato/:id_contrato", getActivosPorContrato);
router.get("/adenda/:id_adenda", getActivosPorAdenda);

export default router;
