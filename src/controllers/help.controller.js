// src/controllers/helpController.js

import pool from "../config/connectionToSql.js"; // Asegúrate de que esta ruta sea correcta para tu pool de conexión

// --- Funciones para Preguntas Frecuentes (FAQs) ---

/**
 * @desc Obtiene todas las FAQs activas o una específica por ID.
 * @route GET /api/help/faqs
 * @route GET /api/help/faqs/:id
 * @access Public (o Private si solo admins pueden ver todas, pero generalmente es público)
 */
export const getFAQs = async (req, res) => {
  const { id } = req.params; // Si se pasa un ID, se busca una FAQ específica

  try {
    let queryResult;
    if (id) {
      // Llamar al SP para obtener una FAQ por ID
      [queryResult] = await pool.query(
        "CALL SP_GestionarAyuda('ObtenerFAQPorId', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
        [id]
      );
    } else {
      // Llamar al SP para obtener todas las FAQs activas
      [queryResult] = await pool.query(
        "CALL SP_GestionarAyuda('ObtenerFAQs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
      );
    }
    // El SP retorna un array de resultados, el primero [0] contiene las filas
    res.json(queryResult[0]);
  } catch (error) {
    console.error("Error al obtener FAQs:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Agrega una nueva FAQ.
 * @route POST /api/help/faqs
 * @access Private (solo para administradores/editores de contenido)
 */
export const addFAQ = async (req, res) => {
  const { question, answer, category, order, isActive } = req.body;

  try {
    // Llamar al SP para insertar una FAQ
    const [result] = await pool.query(
      "CALL SP_GestionarAyuda('InsertarFAQ', NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [question, answer, category, order, isActive]
    );
    // El SP retorna el ID de la nueva FAQ en el primer array de resultados
    res
      .status(201)
      .json({ message: "FAQ agregada correctamente", id: result[0][0].new_id });
  } catch (error) {
    console.error("Error al agregar FAQ:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Actualiza una FAQ existente.
 * @route PUT /api/help/faqs/:id
 * @access Private (solo para administradores/editores de contenido)
 */
export const updateFAQ = async (req, res) => {
  const { id } = req.params;
  const { question, answer, category, order, isActive } = req.body;

  try {
    // Llamar al SP para actualizar una FAQ
    await pool.query(
      "CALL SP_GestionarAyuda('ActualizarFAQ', ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id, question, answer, category, order, isActive]
    );
    res.json({ message: "FAQ actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar FAQ:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Elimina (inactiva) una FAQ.
 * @route DELETE /api/help/faqs/:id
 * @access Private (solo para administradores/editores de contenido)
 */
export const deleteFAQ = async (req, res) => {
  const { id } = req.params;

  try {
    // Llamar al SP para eliminar (inactivar) una FAQ
    await pool.query(
      "CALL SP_GestionarAyuda('EliminarFAQ', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    res.json({ message: "FAQ inactivada correctamente" });
  } catch (error) {
    console.error("Error al inactivar FAQ:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- Funciones para Tutoriales ---

/**
 * @desc Obtiene todos los tutoriales.
 * @route GET /api/help/tutorials
 * @access Public
 */
export const getTutorials = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL SP_GestionarAyuda('ObtenerTutoriales', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener tutoriales:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Agrega un nuevo tutorial.
 * @route POST /api/help/tutorials
 * @access Private
 */
export const addTutorial = async (req, res) => {
  const { title, description, videoUrl, imageUrl, category, publishedDate } =
    req.body;
  try {
    const [result] = await pool.query(
      "CALL SP_GestionarAyuda('InsertarTutorial', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [title, description, videoUrl, imageUrl, category, publishedDate]
    );
    res.status(201).json({
      message: "Tutorial agregado correctamente",
      id: result[0][0].new_id,
    });
  } catch (error) {
    console.error("Error al agregar tutorial:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Actualiza un tutorial existente.
 * @route PUT /api/help/tutorials/:id
 * @access Private
 */
export const updateTutorial = async (req, res) => {
  const { id } = req.params;
  const { title, description, videoUrl, imageUrl, category, publishedDate } =
    req.body;
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('ActualizarTutorial', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id, title, description, videoUrl, imageUrl, category, publishedDate]
    );
    res.json({ message: "Tutorial actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar tutorial:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Elimina un tutorial.
 * @route DELETE /api/help/tutorials/:id
 * @access Private
 */
export const deleteTutorial = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('EliminarTutorial', NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    res.json({ message: "Tutorial eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar tutorial:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- Funciones para Changelogs (Novedades y Anuncios) ---

/**
 * @desc Obtiene todos los changelogs.
 * @route GET /api/help/changelogs
 * @access Public
 */
export const getChangelogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL SP_GestionarAyuda('ObtenerChangelogs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener changelogs:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Agrega un nuevo changelog.
 * @route POST /api/help/changelogs
 * @access Private
 */
export const addChangelog = async (req, res) => {
  const { date, type, title, description } = req.body;
  try {
    const [result] = await pool.query(
      "CALL SP_GestionarAyuda('InsertarChangelog', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [date, type, title, description]
    );
    res.status(201).json({
      message: "Changelog agregado correctamente",
      id: result[0][0].new_id,
    });
  } catch (error) {
    console.error("Error al agregar changelog:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Actualiza un changelog existente.
 * @route PUT /api/help/changelogs/:id
 * @access Private
 */
export const updateChangelog = async (req, res) => {
  const { id } = req.params;
  const { date, type, title, description } = req.body;
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('ActualizarChangelog', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id, date, type, title, description]
    );
    res.json({ message: "Changelog actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar changelog:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Elimina un changelog.
 * @route DELETE /api/help/changelogs/:id
 * @access Private
 */
export const deleteChangelog = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('EliminarChangelog', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    res.json({ message: "Changelog eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar changelog:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- Funciones para System Services (Estado de Servicios) ---

/**
 * @desc Obtiene todos los servicios del sistema.
 * @route GET /api/help/services
 * @access Public
 */
export const getSystemServices = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL SP_GestionarAyuda('ObtenerServiciosSistema', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener servicios del sistema:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Agrega un nuevo servicio del sistema.
 * @route POST /api/help/services
 * @access Private
 */
export const addSystemService = async (req, res) => {
  const { name, status, message } = req.body;
  try {
    const [result] = await pool.query(
      "CALL SP_GestionarAyuda('InsertarServicioSistema', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)",
      [name, status, message]
    );
    res.status(201).json({
      message: "Servicio de sistema agregado correctamente",
      id: result[0][0].new_id,
    });
  } catch (error) {
    console.error("Error al agregar servicio de sistema:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Actualiza el estado de un servicio del sistema.
 * @route PUT /api/help/services/:id
 * @access Private
 */
export const updateSystemServiceStatus = async (req, res) => {
  const { id } = req.params;
  const { status, message } = req.body; // Solo se espera status y message para actualización de estado
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('ActualizarEstadoServicio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id, status, message]
    );
    res.json({ message: "Estado del servicio actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar estado del servicio:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Elimina un servicio del sistema.
 * @route DELETE /api/help/services/:id
 * @access Private
 */
export const deleteSystemService = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "CALL SP_GestionarAyuda('EliminarServicioSistema', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
      [id]
    );
    res.json({ message: "Servicio de sistema eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar servicio de sistema:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- Funciones para System Overall Status Log (Historial de Estado General) ---

/**
 * @desc Registra un nuevo estado general del sistema.
 * @route POST /api/help/status/log
 * @access Private (solo para herramientas de monitoreo o administradores)
 */
export const addOverallStatusLog = async (req, res) => {
  const { overall_status, description } = req.body;
  try {
    const [result] = await pool.query(
      "CALL SP_GestionarAyuda('RegistrarEstadoGeneral', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, NULL)",
      [overall_status, description]
    );
    res.status(201).json({
      message: "Registro de estado general agregado correctamente",
      id: result[0][0].new_id,
    });
  } catch (error) {
    console.error("Error al registrar estado general:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc Obtiene el historial del estado general del sistema.
 * @route GET /api/help/status/history
 * @access Public
 */
export const getOverallStatusHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL SP_GestionarAyuda('ObtenerHistorialEstadoGeneral', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener historial de estado general:", error);
    res.status(500).json({ error: error.message });
  }
};
