// middleware/validateContratoActivo.js
export function validateAsignacionContratoActivo(req, res, next) {
    const { id_activo, id_detalle_adenda, es_temporal } = req.body;
    if (!id_activo || !Number.isInteger(Number(id_activo)) || Number(id_activo) <= 0) {
        return res.status(400).json({ message: "id_activo es requerido y debe ser entero positivo." });
    }
    if (!id_detalle_adenda || !Number.isInteger(Number(id_detalle_adenda)) || Number(id_detalle_adenda) <= 0) {
        return res.status(400).json({ message: "id_detalle_adenda es requerido y debe ser entero positivo." });
    }
    if (es_temporal !== undefined && ![0, 1, true, false].includes(es_temporal)) {
        return res.status(400).json({ message: "es_temporal debe ser 0/1 o booleano." });
    }
    next();
}
