import pool from "../config/connectionToSql.js";

// Obtener todos los empleados
export const getEmployees = async (req, res) => {
  try {
    // Llamar al procedimiento almacenado para obtener todos los empleados
    const [rows] = await pool.query(
      "CALL gestion_empleados('Obtener', NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener un empleado por su ID
export const getEmployeeById = async (req, res) => {
  const { id } = req.params;

  try {
    // Llamar al procedimiento almacenado para obtener un empleado por su ID
    const [rows] = await pool.query(
      "CALL gestion_empleados('Mostrar', ?, NULL, NULL, NULL)",
      [id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registro de un nuevo empleado
export const AddEmployees = async (req, res) => {
  const { id_usuario, puesto } = req.body;

  if (!id_usuario || !puesto) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const [result] = await pool.query(
      "CALL gestion_empleados('Registrar', NULL, ?, ?, NULL)",
      [id_usuario, puesto]
    );
    res.status(201).json({ message: "Empleado agregado", id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar un empleado
export const updateEmployee = async (req, res) => {
  const { id } = req.params; // ID del empleado a actualizar
  const { id_usuario, puesto } = req.body;

  try {
    await pool.query("CALL gestion_empleados('Actualizar', ?, ?, ?, ?)", [
      id,
      id_usuario,
      puesto,
    ]);
    res.json({ message: "Empleado actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar un empleado
export const deleteEmployee = async (req, res) => {
  const { id } = req.params; // ID del empleado a eliminar

  try {
    await pool.query(
      "CALL gestion_empleados('Eliminar', ?, NULL, NULL, NULL)",
      [id]
    );
    res.json({ message: "Empleado eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
