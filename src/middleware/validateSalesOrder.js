// middleware/validateSalesOrder.js
export function validateCreateSO(req, res, next) {
    const { codigo, id_cliente, fecha, descripcion, estatus } = req.body;

    if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
        return res.status(400).json({ message: "El campo 'codigo' es requerido." });
    }
    if (!id_cliente || !Number.isInteger(Number(id_cliente)) || Number(id_cliente) <= 0) {
        return res.status(400).json({ message: "El campo 'id_cliente' es requerido y debe ser entero positivo." });
    }
    if (!fecha) {
        return res.status(400).json({ message: "El campo 'fecha' es requerido (YYYY-MM-DD)." });
    }
    if (estatus && !["Pendiente", "Completado", "Cancelado"].includes(estatus)) {
        return res.status(400).json({ message: "Estatus inválido." });
    }
    next();
}

export const validateUpdateSO = validateCreateSO;
