import pool from "../config/connectionToSql.js";

// Crear una nueva reserva
export const createReserva = async (req, res) => {
  const {
    id_vehiculo,
    id_empleado,
    id_empleado_reserva,
    fecha_inicio,
    fecha_fin,
    motivo,
  } = req.body;

  try {
    await pool.query(
      "CALL gestion_reservas('Registrar', NULL, ?, ?, ?, ?, ?, ?, NULL)",
      [
        id_vehiculo,
        id_empleado,
        id_empleado_reserva,
        fecha_inicio,
        fecha_fin,
        motivo,
      ]
    );

    res.status(201).json({ message: "Reserva creada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todas las reservas
export const getReservas = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_reservas('Mostrar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener una reserva por ID (filtrando del resultado de Mostrar)
export const getReservaById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "CALL gestion_reservas('Mostrar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    const reserva = rows[0].find((r) => r.id === parseInt(id));

    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }

    res.json(reserva);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// obtener reservas activas por empleado
export const getReservasEmpleado = async (req, res) => {
  const { id_empleado } = req.params;

  try {
    const [resultado] = await pool.query(
      `SELECT COUNT(*) AS total FROM reservas WHERE id_empleado = ? AND estatus = 'Activa'`,
      [id_empleado]
    );

    if (resultado.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay reservas pendientes para este empleado." });
    }

    res.json(resultado); // Aquí devolvemos todas las reservas activas
  } catch (error) {
    console.error("❌ Error al obtener registro pendiente:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor.", details: error.message });
  }
};

// Actualizar una reserva
export const updateReserva = async (req, res) => {
  const { id } = req.params;
  const {
    id_vehiculo,
    id_empleado,
    id_empleado_reserva,
    fecha_inicio,
    fecha_fin,
    motivo,
  } = req.body;

  try {
    await pool.query(
      "CALL gestion_reservas('Actualizar', ?, ?, ?, ?, ?, ?, ?, NULL)",
      [
        id,
        id_vehiculo,
        id_empleado,
        id_empleado_reserva,
        fecha_inicio,
        fecha_fin,
        motivo,
      ]
    );

    res.json({ message: "Reserva actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancelar una reserva
export const cancelarReserva = async (req, res) => {
  const { id } = req.params;

  try {
    // Primero verificas que exista y esté en estado válido
    const [rows] = await pool.query(
      "CALL gestion_reservas('Mostrar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    const reserva = rows[0].find((r) => r.id === parseInt(id));

    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }
    if (reserva.estatus === "Cancelada") {
      return res
        .status(400)
        .json({ message: "La reserva ya fue cancelada previamente." });
    }
    if (reserva.estatus === "Finalizada") {
      return res
        .status(400)
        .json({ message: "No se puede cancelar una reserva finalizada." });
    }

    // Ejecutar cancelación
    await pool.query(
      "CALL gestion_reservas('Cancelar', ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id, reserva.id_vehiculo] // 👈 aquí está la clave
    );

    // Obtener registro actualizado
    const [rowsUpdated] = await pool.query(
      "CALL gestion_reservas('Mostrar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    const reservaActualizada = rowsUpdated[0].find(
      (r) => r.id === parseInt(id)
    );

    res.json({
      message: "Reserva cancelada correctamente",
      reserva: reservaActualizada,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Finalizar una reserva
export const finalizarReserva = async (req, res) => {
  const { id } = req.params;
  const { id_vehiculo, id_ubicacion_regreso } = req.body;

  try {
    const [rows] = await pool.query(
      "CALL gestion_reservas('Mostrar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    const reserva = rows[0].find((r) => r.id === parseInt(id));

    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }

    if (reserva.estatus === "Finalizada") {
      return res
        .status(400)
        .json({ message: "La reserva ya fue finalizada previamente." });
    }

    if (reserva.estatus === "Cancelada") {
      return res
        .status(400)
        .json({ message: "No se puede finalizar una reserva cancelada." });
    }

    await pool.query(
      "CALL gestion_reservas('Finalizar', ?, ?, NULL, NULL, NULL, NULL, NULL, ?)",
      [id, id_vehiculo, id_ubicacion_regreso]
    );

    res.json({ message: "Reserva finalizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
