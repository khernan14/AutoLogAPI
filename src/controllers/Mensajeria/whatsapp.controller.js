// src/controllers/whatsapp.controller.js
import "dotenv/config";

// Si usas Node 18+ ya tienes fetch global; si no, instala node-fetch y haz:
// import fetch from "node-fetch";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// GET /api/whatsapp/webhook  -> verificación inicial de Meta
export const whatsappWebhookVerify = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook de WhatsApp verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.warn("❌ Intento de verificación de webhook fallido");
  return res.sendStatus(403);
};

// Helper para enviar texto por WhatsApp Cloud API
async function sendWhatsAppText(to, text) {
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("Error enviando mensaje WhatsApp:", resp.status, errorText);
  }
}

// POST /api/whatsapp/webhook  -> mensajes entrantes
export const whatsappWebhookReceive = async (req, res) => {
  // Siempre responde 200 rápido para que Meta no se queje
  res.sendStatus(200);

  const body = req.body;

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      // Puede ser solo evento de estado; lo ignoramos
      return;
    }

    const msg = messages[0];

    const from = msg.from; // número del cliente (ej: "5049XXXXXXXX")
    const type = msg.type;

    let text = "";
    if (type === "text") {
      text = msg.text?.body || "";
    } else {
      // por ahora solo manejamos texto
      await sendWhatsAppText(
        from,
        "Por ahora solo puedo responder mensajes de texto 😊"
      );
      return;
    }

    console.log("📩 Mensaje entrante:", { from, text });

    // === LÓGICA MUY SIMPLE DE BOT (aquí luego metemos menús / LLM) ===
    const clean = text.trim().toLowerCase();

    if (clean === "hola" || clean === "buenas" || clean === "hi") {
      await sendWhatsAppText(
        from,
        "Hola 👋, soy el asistente virtual de Tecmasa.\n" +
          "Puedes responder con:\n" +
          "1 - Preguntas sobre uso de vehículos\n" +
          "2 - Estados y registros\n" +
          "3 - Crear un ticket de soporte"
      );
      return;
    }

    if (clean === "1") {
      await sendWhatsAppText(
        from,
        "Para dudas sobre uso de vehículos, por favor indícame tu consulta de forma breve."
      );
      return;
    }

    if (clean === "2") {
      await sendWhatsAppText(
        from,
        "Para estados y registros, por ahora consulta el panel web. Próximamente te podré enviar detalles por aquí 😉"
      );
      return;
    }

    if (clean === "3") {
      // Aquí luego integrarás creación de ticket por correo / API
      await sendWhatsAppText(
        from,
        "Perfecto, crearé un ticket de soporte.\n" +
          "Por favor escribe un resumen del problema."
      );
      return;
    }

    // Caso genérico: todavía no tenemos IA, respuesta básica
    await sendWhatsAppText(
      from,
      "Recibí tu mensaje, gracias.\n" +
        "Pronto te podré ayudar automáticamente, por ahora responde:\n" +
        '• "hola" para ver el menú\n' +
        '• "3" si quieres crear un ticket de soporte'
    );
  } catch (err) {
    console.error("Error procesando webhook de WhatsApp:", err);
  }
};
