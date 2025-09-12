// middleware/validateBodega.js
export function validateCreateBodega(req, res, next) {
    const { nombre, descripcion, id_ciudad } = req.body;

    // nombre requerido
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({ message: "El campo 'nombre' es requerido." });
    }
    if (nombre.length > 150) {
        return res.status(400).json({ message: "El campo 'nombre' no puede exceder 150 caracteres." });
    }

    // descripcion opcional
    if (descripcion !== undefined && typeof descripcion !== "string") {
        return res.status(400).json({ message: "El campo 'descripcion' debe ser texto." });
    }

    // id_ciudad opcional pero si viene debe ser número entero positivo
    if (id_ciudad !== undefined && id_ciudad !== null) {
        const n = Number(id_ciudad);
        if (!Number.isInteger(n) || n <= 0) {
            return res.status(400).json({ message: "El campo 'id_ciudad' debe ser un entero positivo." });
        }
    }

    next();
}

export function validateUpdateBodega(req, res, next) {
    const { nombre, descripcion, id_ciudad } = req.body;

    // Para PUT vamos a exigir nombre (tu frontend manda todos los campos)
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({ message: "El campo 'nombre' es requerido." });
    }
    if (nombre.length > 150) {
        return res.status(400).json({ message: "El campo 'nombre' no puede exceder 150 caracteres." });
    }

    if (descripcion !== undefined && descripcion !== null && typeof descripcion !== "string") {
        return res.status(400).json({ message: "El campo 'descripcion' debe ser texto." });
    }

    if (id_ciudad !== undefined && id_ciudad !== null) {
        const n = Number(id_ciudad);
        if (!Number.isInteger(n) || n <= 0) {
            return res.status(400).json({ message: "El campo 'id_ciudad' debe ser un entero positivo." });
        }
    }

    next();
}
