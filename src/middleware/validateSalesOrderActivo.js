// middleware/validateSalesOrderActivo.js
export function validateLineaSO(req, res, next) {
    const { id_sales_order, id_activo, accion } = req.body;

    if (!id_sales_order || !Number.isInteger(Number(id_sales_order)) || Number(id_sales_order) <= 0) {
        return res.status(400).json({ message: "id_sales_order es requerido y debe ser entero positivo." });
    }
    if (!id_activo || !Number.isInteger(Number(id_activo)) || Number(id_activo) <= 0) {
        return res.status(400).json({ message: "id_activo es requerido y debe ser entero positivo." });
    }
    if (!["Instalacion", "Retiro", "Reemplazo"].includes(accion)) {
        return res.status(400).json({ message: "accion inválida (Instalacion|Retiro|Reemplazo)." });
    }

    // Movimiento opcional (para Instalacion/Reemplazo)
    const { movimiento } = req.body;
    if (movimiento) {
        const { tipo_destino, id_cliente_site, id_bodega } = movimiento;
        if (!["Cliente", "Bodega"].includes(tipo_destino)) {
            return res.status(400).json({ message: "tipo_destino inválido en movimiento (Cliente|Bodega)." });
        }
        if (tipo_destino === "Cliente" && !id_cliente_site) {
            return res.status(400).json({ message: "id_cliente_site es requerido cuando el destino es Cliente." });
        }
        if (tipo_destino === "Bodega" && !id_bodega) {
            return res.status(400).json({ message: "id_bodega es requerido cuando el destino es Bodega." });
        }
    }

    next();
}
