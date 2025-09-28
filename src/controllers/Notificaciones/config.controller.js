import NotificationConfigService from "../../services/notifications/NotificationConfigService.js";

export const getConfigByEvent = async (req, res) => {
  try {
    const { clave } = req.params;
    const cfg = await NotificationConfigService.get(clave);
    if (!cfg) return res.status(404).json({ message: "Evento no encontrado" });
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const upsertConfigByEvent = async (req, res) => {
  try {
    const { clave } = req.params;
    const { enabled, grupos = [], severidad_def } = req.body || {};
    const result = await NotificationConfigService.save({
      clave,
      enabled: !!enabled,
      grupos: Array.isArray(grupos) ? grupos : [],
      severidad_def: severidad_def || null,
      updated_by: req.user?.id_usuario || null,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};
