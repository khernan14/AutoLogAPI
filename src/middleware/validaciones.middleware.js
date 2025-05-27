export const validarRegistroSalida = (req, res, next) => {
    const { id_empleado, id_vehiculo, id_ubicacion_salida, km_salida, combustible_salida } = req.body;

    if (!id_empleado || !id_vehiculo || !id_ubicacion_salida || !km_salida || !combustible_salida) {
        return res.status(400).json({ error: "Faltan datos obligatorios para registrar salida." });
    }
    next();
};

export const validarRegistroRegreso = (req, res, next) => {
    const { id_registro, id_ubicacion_regreso, km_regreso, combustible_regreso } = req.body;

    if (!id_registro || !id_ubicacion_regreso || km_regreso == null || combustible_regreso == null) {
        return res.status(400).json({ error: "Faltan datos obligatorios para registrar regreso." });
    }
    next();
};
