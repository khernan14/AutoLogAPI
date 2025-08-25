import pool from "../../../config/connectionToSql.js";

// Función auxiliar para llamar al procedimiento almacenado
const llamarSPVehiculos = async (accion, params) => {
  const query = "CALL gestion_vehiculos(?, ?, ?, ?, ?, ?, ?, ?)";
  const [result] = await pool.query(query, params);
  return result;
};

export const getVehiculos = async (req, res) => {
  try {
    const result = await llamarSPVehiculos("Mostrar", [
      null,
      "Mostrar",
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listarVehiculosEmpleado = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Falta id_empleado" });
  }

  try {
    const result = await llamarSPVehiculos("Listar", [
      id,
      "Listar",
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addVehiculo = async (req, res) => {
  const { placa, marca, modelo, estado, id_ubicacion_actual } = req.body;

  if (!placa || !marca || !modelo || !estado || !id_ubicacion_actual) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    await llamarSPVehiculos("Insertar", [
      null,
      "Insertar",
      null,
      placa,
      marca,
      modelo,
      estado,
      id_ubicacion_actual,
    ]);
    res.status(201).json({ message: "Vehículo agregado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateVehiculo = async (req, res) => {
  const { id } = req.params;
  const { placa, marca, modelo, estado, id_ubicacion_actual } = req.body;

  try {
    await llamarSPVehiculos("Actualizar", [
      null,
      "Actualizar",
      id,
      placa,
      marca,
      modelo,
      estado,
      id_ubicacion_actual,
    ]);
    res.json({ message: "Vehículo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteVehiculo = async (req, res) => {
  const { id } = req.params;

  try {
    await llamarSPVehiculos("Eliminar", [
      null,
      "Eliminar",
      id,
      null,
      null,
      null,
      null,
      null,
    ]);
    res.json({ message: "Vehículo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const restoreVehiculo = async (req, res) => {
  const { id } = req.params;

  try {
    await llamarSPVehiculos("Restaurar", [
      null,
      "Restaurar",
      id,
      null,
      null,
      null,
      null,
      null,
    ]);
    res.json({ message: "Vehículo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUbicaciones = async (req, res) => {
  try {
    const [result] = await pool.query("SELECT * FROM estacionamientos");
    res.json(result); // ← ✅ Devuelve todas las ubicaciones
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
