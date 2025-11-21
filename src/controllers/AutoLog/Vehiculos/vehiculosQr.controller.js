// src/controllers/AutoLog/Vehiculos/vehiculosQr.controller.js
import pool from "../../../config/connectionToSql.js";
import QRCode from "qrcode";
import { signPublicLink, verifyPublicLink } from "../../../utils/signedLink.js";
import logger from "../../../utils/logger.js";

const APP_BASE = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
  /\/$/,
  ""
);

// Por defecto 1 año (puedes ajustar)
const VEHICULO_QR_TTL_SEC = Number(
  process.env.VEHICULO_QR_TTL_SEC || 60 * 60 * 24 * 365
);

// 🔹 Genera link firmado para registrar uso de un vehículo
export const issueRegistroLinkForVehiculo = async (req, res) => {
  try {
    const idVehiculo = Number(req.params.id_vehiculo);
    if (!Number.isInteger(idVehiculo)) {
      return res.status(400).json({ message: "id_vehiculo inválido" });
    }

    const [[vehiculo]] = await pool.query(
      "SELECT id, placa FROM vehiculos WHERE id = ? LIMIT 1",
      [idVehiculo]
    );

    if (!vehiculo) {
      return res.status(404).json({ message: "Vehículo no encontrado" });
    }

    const token = signPublicLink(
      {
        kind: "vehiculo_registro",
        id_vehiculo: vehiculo.id,
        placa: vehiculo.placa,
      },
      VEHICULO_QR_TTL_SEC
    );

    // 👇 Esta es la ruta de tu front donde está RegisterForm
    const url = `${APP_BASE}/admin/panel-vehiculos/register?token=${encodeURIComponent(
      token
    )}`;

    return res.json({
      url,
      token,
      expiresIn: VEHICULO_QR_TTL_SEC,
      vehiculo: {
        id: vehiculo.id,
        placa: vehiculo.placa,
      },
    });
  } catch (error) {
    logger.error({ error }, "issueRegistroLinkForVehiculo failed");
    return res
      .status(500)
      .json({ error: "Error generando link de registro de vehículo" });
  }
};

// 🔹 Devuelve imagen PNG del QR (mismo URL que arriba)
export const getQRImageForVehiculo = async (req, res) => {
  try {
    const idVehiculo = Number(req.params.id_vehiculo);
    if (!Number.isInteger(idVehiculo)) {
      return res.status(400).json({ message: "id_vehiculo inválido" });
    }

    const [[vehiculo]] = await pool.query(
      "SELECT id, placa FROM vehiculos WHERE id = ? LIMIT 1",
      [idVehiculo]
    );

    if (!vehiculo) {
      return res.status(404).json({ message: "Vehículo no encontrado" });
    }

    const token = signPublicLink(
      {
        kind: "vehiculo_registro",
        id_vehiculo: vehiculo.id,
        placa: vehiculo.placa,
      },
      VEHICULO_QR_TTL_SEC
    );

    const frontUrl = `${APP_BASE}/admin/panel-vehiculos/register?token=${encodeURIComponent(
      token
    )}`;

    res.setHeader("Content-Type", "image/png");
    await QRCode.toFileStream(res, frontUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });
  } catch (error) {
    logger.error({ error }, "getQRImageForVehiculo failed");
    return res
      .status(500)
      .json({ error: "Error generando imagen de código QR" });
  }
};

// 🔹 Resolver token -> datos del vehículo (cuando entras desde QR en el front)
export const resolveVehiculoFromQrToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Token requerido" });
    }

    const v = verifyPublicLink(token);
    if (!v.ok) {
      return res
        .status(403)
        .json({ message: "Token inválido o expirado", reason: v.reason });
    }

    const { payload } = v;
    if (payload.kind !== "vehiculo_registro") {
      return res
        .status(403)
        .json({ message: "Token no corresponde a vehículo" });
    }

    const idVehiculo = payload.id_vehiculo;

    const [[vehiculo]] = await pool.query(
      "SELECT id, placa, marca, modelo FROM vehiculos WHERE id = ? LIMIT 1",
      [idVehiculo]
    );

    if (!vehiculo) {
      return res
        .status(404)
        .json({ message: "Vehículo no encontrado para este token" });
    }

    return res.json({
      id_vehiculo: vehiculo.id,
      placa: vehiculo.placa,
      marca: vehiculo.marca ?? null,
      modelo: vehiculo.modelo ?? null,
    });
  } catch (error) {
    logger.error({ error }, "resolveVehiculoFromQrToken failed");
    return res.status(500).json({
      error: "Error al resolver token de registro de vehículo",
    });
  }
};
