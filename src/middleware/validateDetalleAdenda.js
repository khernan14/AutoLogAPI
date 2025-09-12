// middleware/validateDetalleAdenda.js
export function validateCreateDetalle(req, res, next) {
    const { id_adenda, modelo, precio_arrendamiento, costo_impresion_bn, costo_impresion_color, cantidad } = req.body;

    if (!id_adenda || !Number.isInteger(Number(id_adenda)) || Number(id_adenda) <= 0) {
        return res.status(400).json({ message: "id_adenda es requerido y debe ser entero positivo." });
    }
    if (!modelo || typeof modelo !== "string" || !modelo.trim()) {
        return res.status(400).json({ message: "modelo es requerido." });
    }
    if (precio_arrendamiento === undefined || isNaN(Number(precio_arrendamiento))) {
        return res.status(400).json({ message: "precio_arrendamiento es requerido y debe ser numérico." });
    }
    if (costo_impresion_bn !== undefined && isNaN(Number(costo_impresion_bn))) {
        return res.status(400).json({ message: "costo_impresion_bn debe ser numérico." });
    }
    if (costo_impresion_color !== undefined && isNaN(Number(costo_impresion_color))) {
        return res.status(400).json({ message: "costo_impresion_color debe ser numérico." });
    }
    if (!cantidad || !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
        return res.status(400).json({ message: "cantidad es requerida y debe ser un entero positivo." });
    }
    next();
}

export const validateUpdateDetalle = validateCreateDetalle;
