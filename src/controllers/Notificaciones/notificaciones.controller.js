import NotificationService from "../../services/notifications/NotificationService.js";

export const dispararEvento = async (req, res) => {
  try {
    const { clave } = req.params;
    const {
      severidad,
      payload,
      dedupe_key,
      forzar_grupos,
      omit_grupos,
      creado_por,
    } = req.body || {};

    const result = await NotificationService.createAndSend({
      clave,
      severidad,
      payload,
      dedupe_key,
      forzar_grupos: Array.isArray(forzar_grupos) ? forzar_grupos : [],
      omit_grupos: Array.isArray(omit_grupos) ? omit_grupos : [],
      creado_por: creado_por ?? req.user?.id_usuario ?? null,
    });

    res.status(201).json(result);
  } catch (err) {
    const code = err.code === "ER_DUP_ENTRY" ? 409 : 400;
    res
      .status(code)
      .json({ message: err.message || "No se pudo crear la notificación" });
  }
};

export const listarNotificaciones = async (req, res) => {
  try {
    const { evento, estado, desde, hasta, page = 1, limit = 50 } = req.query;
    const data = await NotificationService.list({
      evento,
      estado,
      desde,
      hasta,
      page: +page,
      limit: +limit,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await NotificationService.getById(+id);
    if (!data) return res.status(404).json({ message: "No encontrada" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDestinatarios = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, estado } = req.query;
    const data = await NotificationService.listRecipients(+id, {
      page: +page,
      limit: +limit,
      estado,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const retryNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await NotificationService.retryFailed(+id); // reenvía sin cola
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
