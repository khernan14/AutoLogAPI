// middleware/validateActivo.js
const TIPOS_PERMITIDOS = new Set(["Impresa", "Impresora", "UPS", "ATM", "Mueble", "Silla", "Otro"]); // ajusta a tu catálogo real
const ESTATUS_PERMITIDOS = new Set(["Activo", "Inactivo", "En Mantenimiento", "Arrendado"]);

export function validateCreateActivo(req, res, next) {
    const { codigo, nombre, modelo, serial_number, tipo, estatus } = req.body;

    if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
        return res.status(400).json({ message: "El campo 'codigo' es requerido." });
    }
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({ message: "El campo 'nombre' es requerido." });
    }

    if (tipo && !TIPOS_PERMITIDOS.has(tipo)) {
        return res.status(400).json({ message: `Tipo inválido. Permitidos: ${[...TIPOS_PERMITIDOS].join(", ")}` });
    }
    if (estatus && !ESTATUS_PERMITIDOS.has(estatus)) {
        return res.status(400).json({ message: `Estatus inválido. Permitidos: ${[...ESTATUS_PERMITIDOS].join(", ")}` });
    }

    // longitudes
    if (codigo.length > 50) return res.status(400).json({ message: "codigo no debe exceder 50 caracteres" });
    if (nombre.length > 100) return res.status(400).json({ message: "nombre no debe exceder 100 caracteres" });
    if (modelo && modelo.length > 100) return res.status(400).json({ message: "modelo no debe exceder 100 caracteres" });
    if (serial_number && serial_number.length > 100) return res.status(400).json({ message: "serial_number no debe exceder 100 caracteres" });
    if (tipo && tipo.length > 50) return res.status(400).json({ message: "tipo no debe exceder 50 caracteres" });

    next();
}

export function validateUpdateActivo(req, res, next) {
    // En tu flujo, PUT siempre envía todo
    return validateCreateActivo(req, res, next);
}
