// middleware/validateAdenda.js
export function validateCreateAdenda(req, res, next) {
    const { id_contrato, codigo, fecha_inicio, fecha_fin, estatus } = req.body;

    if (!id_contrato || !Number.isInteger(Number(id_contrato)) || Number(id_contrato) <= 0) {
        return res.status(400).json({ message: "id_contrato es requerido y debe ser entero positivo." });
    }
    if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
        return res.status(400).json({ message: "codigo es requerido." });
    }
    if (!fecha_inicio) {
        return res.status(400).json({ message: "fecha_inicio es requerida." });
    }
    if (fecha_fin && new Date(fecha_fin) < new Date(fecha_inicio)) {
        return res.status(400).json({ message: "fecha_fin no puede ser menor a fecha_inicio." });
    }
    if (estatus && !["Activo", "Finalizado", "Cancelado"].includes(estatus)) {
        return res.status(400).json({ message: "estatus inválido." });
    }
    next();
}

export const validateUpdateAdenda = validateCreateAdenda;
