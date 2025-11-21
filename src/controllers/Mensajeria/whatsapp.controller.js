// src/controllers/whatsapp.controller.js
import "dotenv/config";
import { sendMail } from "../../services/mail.service.js";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const SUPPORT_EMAIL = "micros.teh@tecnasadesk.com";

// ===== Sesiones en memoria (por número) =====
const sessions = new Map();

/**
 * Estructura de session:
 * {
 *   step: string | null,
 *   origin: 'web' | 'whatsapp',
 *   equipo: {
 *     codigo?: string,
 *     modelo?: string,
 *     serie?: string,
 *     site?: string,
 *     area?: string,
 *     resumen: string,   // texto legible
 *   },
 *   falla?: { code: string, label: string },
 *   contacto?: string,   // nombre + tel que escribe el usuario
 * }
 */

// ===== Opciones de falla =====
const ISSUE_OPTIONS = {
  1: { code: "papel_atascado", label: "Papel atascado" },
  2: { code: "toner_bajo", label: "Tóner vacío o bajo" },
  3: { code: "copias_manchadas", label: "Copias / impresiones manchadas" },
  4: { code: "no_enciende", label: "La impresora no enciende" },
  5: {
    code: "no_imprime_pc",
    label: "No imprime desde la PC / Error de conexión",
  },
  6: { code: "otra_falla", label: "Otra falla" },
};

function getIssueMenuText() {
  return (
    "Seleccione el tipo de falla (responda con el número):\n" +
    "1️⃣ Papel atascado\n" +
    "2️⃣ Tóner vacío o bajo\n" +
    "3️⃣ Copias / impresiones manchadas\n" +
    "4️⃣ La impresora no enciende\n" +
    "5️⃣ No imprime desde la PC / error de conexión\n" +
    "6️⃣ Otra falla"
  );
}

function getTipsForIssue(issueCode) {
  switch (issueCode) {
    case "papel_atascado":
      return (
        "🔧 *Revisión rápida para papel atascado:*\n" +
        "• Apague el equipo si es posible.\n" +
        "• Abra las tapas indicadas para atascos (bandeja, puerta lateral, fusor).\n" +
        "• Retire el papel con cuidado, sin halar con fuerza.\n" +
        "• Verifique que no haya pedazos pequeños de papel.\n" +
        "• Vuelva a colocar las bandejas y encienda el equipo."
      );
    case "toner_bajo":
      return (
        "🔧 *Revisión rápida para tóner bajo/vacío:*\n" +
        "• Revise en la pantalla del equipo qué color indica bajo.\n" +
        "• Si tiene tóner de repuesto, instálelo siguiendo las instrucciones del equipo.\n" +
        "• Si no cuenta con tóner, por favor indique en el ticket que requiere suministro."
      );
    case "copias_manchadas":
      return (
        "🔧 *Revisión rápida para copias/impresiones manchadas:*\n" +
        "• Verifique si las manchas aparecen al hacer copia desde el cristal.\n" +
        "• Limpie el vidrio y el alimentador de originales con un paño suave.\n" +
        "• Si el problema es solo al imprimir desde la PC, adjunte un ejemplo en el ticket."
      );
    case "no_enciende":
      return (
        "🔧 *Revisión rápida cuando la impresora no enciende:*\n" +
        "• Verifique que el cable de corriente esté bien conectado al equipo y al tomacorriente.\n" +
        "• Compruebe si hay algún regulador o UPS apagado.\n" +
        "• Si sigue sin encender, NO intente abrir el equipo; requerirá visita técnica."
      );
    case "no_imprime_pc":
      return (
        "🔧 *Revisión rápida para problemas de impresión desde PC:*\n" +
        "• Verifique que el equipo esté encendido y sin errores.\n" +
        "• Compruebe que la PC tenga red/internet.\n" +
        "• Intente imprimir una página de prueba.\n" +
        "• Si ve algún mensaje de error, por favor indíquelo en el ticket."
      );
    case "otra_falla":
    default:
      return (
        "🔧 Entendido, se trata de una falla distinta.\n" +
        "Por favor detalla el problema en el ticket para que el técnico pueda revisarlo."
      );
  }
}

// ===== Helper: parsear datos de equipo desde un texto libre =====
function parseEquipoFromTexto(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const equipo = {};
  let found = false;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rest.length) continue;

    const key = rawKey.toLowerCase();
    const value = rest.join(":").trim();
    if (!value) continue;

    if (key.includes("cod")) {
      equipo.codigo = value;
      found = true;
    } else if (key.includes("serie")) {
      equipo.serie = value;
      found = true;
    } else if (key.includes("modelo")) {
      equipo.modelo = value;
      found = true;
    } else if (
      key.includes("site") ||
      key.includes("ubic") ||
      key.includes("sede")
    ) {
      equipo.site = value;
      found = true;
    } else if (key.includes("area") || key.includes("área")) {
      equipo.area = value;
      found = true;
    }
  }

  if (!found) return null;

  const partes = [];
  if (equipo.codigo) partes.push(`• Código: ${equipo.codigo}`);
  if (equipo.modelo) partes.push(`• Modelo: ${equipo.modelo}`);
  if (equipo.serie) partes.push(`• Serie: ${equipo.serie}`);
  if (equipo.site) partes.push(`• Site: ${equipo.site}`);
  if (equipo.area) partes.push(`• Área: ${equipo.area}`);

  equipo.resumen = partes.join("\n");
  return equipo;
}

// ===== Envío de mensajes por WhatsApp Cloud API =====
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
    const errText = await resp.text();
    console.error("Error enviando mensaje WhatsApp:", resp.status, errText);
  }
}

/**
 * Crea ticket enviando correo a micros.teh@tecnasadesk.com
 * usando tu helper sendMail()
 */
async function crearTicketSoporte({ from, contacto, equipo, falla }) {
  const asunto = `Nuevo ticket desde WhatsApp - ${
    equipo?.codigo || "Equipo"
  } - ${falla?.label || "Falla"}`;

  const partesEquipo = [];
  if (equipo?.codigo)
    partesEquipo.push(`<li><strong>Código:</strong> ${equipo.codigo}</li>`);
  if (equipo?.modelo)
    partesEquipo.push(`<li><strong>Modelo:</strong> ${equipo.modelo}</li>`);
  if (equipo?.serie)
    partesEquipo.push(`<li><strong>Serie:</strong> ${equipo.serie}</li>`);
  if (equipo?.site)
    partesEquipo.push(`<li><strong>Site:</strong> ${equipo.site}</li>`);
  if (equipo?.area)
    partesEquipo.push(`<li><strong>Área:</strong> ${equipo.area}</li>`);

  const htmlEquipo =
    partesEquipo.length > 0
      ? `<ul>${partesEquipo.join("")}</ul>`
      : `<p>${
          equipo?.resumen || "No se recibieron datos estructurados del equipo."
        }</p>`;

  const html = `
    <p>Se ha recibido una solicitud de soporte desde <strong>WhatsApp</strong>.</p>
    <p><strong>Número de teléfono del usuario:</strong> ${from}</p>
    <p><strong>Contacto (nombre/teléfono proporcionado):</strong> ${
      contacto || "No indicado"
    }</p>
    <hr />
    <p><strong>Datos del equipo reportado:</strong></p>
    ${htmlEquipo}
    <p><strong>Falla seleccionada:</strong> ${falla?.label || "No indicada"}</p>
    <hr />
    <p>Por favor crear y gestionar el ticket correspondiente en la plataforma de servicio.</p>
  `;

  try {
    const result = await sendMail({
      to: SUPPORT_EMAIL,
      subject: asunto,
      html,
      fromType: "noReply", // opcional, puedes quitarlo si no lo usas
    });

    if (!result?.success) {
      console.error("Error al enviar correo de ticket:", result?.error);
    } else {
      console.log("📧 Ticket de soporte enviado por correo correctamente.");
    }
  } catch (err) {
    console.error("Error enviando correo de ticket:", err);
  }
}

// ====== GET: verificación de webhook ======
export const whatsappWebhookVerify = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook de WhatsApp verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.warn("❌ Verificación de webhook fallida:", { mode, token });
  return res.sendStatus(403);
};

// ====== POST: mensajes entrantes ======
export const whatsappWebhookReceive = async (req, res) => {
  // responder rápido a Meta
  res.sendStatus(200);

  const body = req.body;

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    const from = msg.from; // ej: "5049XXXXXXX"
    const type = msg.type;

    if (type !== "text") {
      await sendWhatsAppText(
        from,
        "Por ahora solo puedo responder mensajes de texto 😊"
      );
      return;
    }

    const text = msg.text?.body || "";
    const clean = text.trim().toLowerCase();

    console.log("📩 Mensaje entrante:", { from, text });

    // Obtener/crear sesión
    let session = sessions.get(from);
    if (!session) {
      session = { step: null, origin: "whatsapp", equipo: null, falla: null };
      sessions.set(from, session);
    }

    // ====== 1) Flujo principal por pasos ======

    // Si estamos esperando datos de equipo
    if (session.step === "esperando_equipo") {
      const equipoParsed = parseEquipoFromTexto(text);
      if (equipoParsed) {
        session.equipo = equipoParsed;
      } else {
        // no pudo parsear, guardar como texto libre
        session.equipo = { resumen: text };
      }

      session.step = "seleccionar_falla";

      await sendWhatsAppText(
        from,
        "✅ Gracias. Estos son los datos que tengo del equipo:\n" +
          (session.equipo?.resumen || "Datos libres del equipo recibidos.") +
          "\n\n" +
          getIssueMenuText()
      );
      return;
    }

    // Esperando selección de falla
    if (session.step === "seleccionar_falla") {
      const num = parseInt(clean[0], 10);
      const falla = ISSUE_OPTIONS[num];
      if (!falla) {
        await sendWhatsAppText(
          from,
          "Por favor responde con un número del 1 al 6 para indicar el tipo de falla."
        );
        return;
      }

      session.falla = falla;
      session.step = "confirmar_resuelto";

      const tips = getTipsForIssue(falla.code);
      await sendWhatsAppText(
        from,
        `Has indicado: *${falla.label}*\n\n${tips}\n\n` +
          "¿Se solucionó el problema?\n" +
          "1️⃣ Sí, ya quedó\n" +
          "2️⃣ No, sigue igual"
      );
      return;
    }

    // Confirmar si se resolvió
    if (session.step === "confirmar_resuelto") {
      if (clean.startsWith("1")) {
        await sendWhatsAppText(
          from,
          "👍 Excelente, nos alegra que el equipo esté funcionando nuevamente.\n" +
            "Si necesitas algo más, puedes escribir *soporte* en cualquier momento."
        );
        sessions.delete(from);
        return;
      }
      if (clean.startsWith("2")) {
        session.step = "confirmar_ticket";
        await sendWhatsAppText(
          from,
          "Entendido, la falla continúa.\n" +
            "¿Desea que abramos un *ticket de soporte* para que un oficial de servicio se comunique con usted?\n" +
            "1️⃣ Sí, abrir ticket\n" +
            "2️⃣ No, por ahora no"
        );
        return;
      }

      await sendWhatsAppText(from, "Por favor responde 1️⃣ (Sí) o 2️⃣ (No).");
      return;
    }

    // Confirmar apertura de ticket
    if (session.step === "confirmar_ticket") {
      if (clean.startsWith("1")) {
        session.step = "esperar_contacto";
        await sendWhatsAppText(
          from,
          "Perfecto. Para el ticket necesito su *nombre* y, si es diferente, un *teléfono de contacto*.\n" +
            'Por ejemplo: "Juan Pérez, 50490000000, extensión 123".'
        );
        return;
      }
      if (clean.startsWith("2")) {
        await sendWhatsAppText(
          from,
          "De acuerdo, no se abrirá ticket en este momento.\n" +
            "Si más adelante lo necesita, puede escribir *soporte* o *ticket*."
        );
        sessions.delete(from);
        return;
      }

      await sendWhatsAppText(from, "Por favor responde 1️⃣ (Sí) o 2️⃣ (No).");
      return;
    }

    // Esperando datos de contacto para el ticket
    if (session.step === "esperar_contacto") {
      session.contacto = text;
      session.step = null;

      await crearTicketSoporte({
        from,
        contacto: text,
        equipo: session.equipo,
        falla: session.falla,
      });

      await sendWhatsAppText(
        from,
        "🎫 Hemos enviado tu solicitud a nuestro sistema de tickets.\n" +
          "Un oficial de servicio se estará comunicando contigo en el menor tiempo posible.\n\n" +
          "Gracias por contactar a *Tecnasa*."
      );

      sessions.delete(from);
      return;
    }

    // ====== 2) Inicio de flujo (sin step previo) ======

    // Atajos de comando
    if (
      ["soporte", "ticket", "hola", "buenas", "menu", "menú"].includes(clean)
    ) {
      session.step = "esperando_equipo";
      await sendWhatsAppText(
        from,
        "👋 Buen día, bienvenido al *chat de soporte de Tecnasa*.\n\n" +
          "Para ayudarte con tu impresora necesito algunos datos del equipo:\n" +
          "• Código o serie del equipo\n" +
          "• Modelo (si lo conoces)\n" +
          "• Ubicación (site / área)\n\n" +
          "Si estás escribiendo desde la web ya veré los datos del equipo.\n" +
          "Si no, por favor envíame esa información en un solo mensaje.\n\n" +
          "Ejemplo:\n" +
          "Código: IMP-00123\nModelo: MX-4070N\nSite: Banco Centro\nÁrea: Caja 1"
      );
      return;
    }

    // Primer mensaje de un flujo nuevo: intentar detectar datos de equipo venidos desde la web
    if (!session.step) {
      const equipoParsed = parseEquipoFromTexto(text);
      if (equipoParsed) {
        // Asumimos que vino desde la web con datos ya precargados
        session.origin = "web";
        session.equipo = equipoParsed;
        session.step = "seleccionar_falla";

        await sendWhatsAppText(
          from,
          "👋 Buen día, bienvenido al *chat de Tecnasa*.\n" +
            "Hemos recibido los siguientes datos del equipo reportado:\n" +
            `${session.equipo.resumen}\n\n` +
            getIssueMenuText()
        );
        return;
      }

      // Si no logro detectar equipo, pido datos
      session.step = "esperando_equipo";
      await sendWhatsAppText(
        from,
        "👋 Buen día, bienvenido al *chat de soporte de Tecnasa*.\n\n" +
          "Para ayudarte con tu impresora necesito algunos datos del equipo:\n" +
          "• Código o serie del equipo\n" +
          "• Modelo (si lo conoces)\n" +
          "• Ubicación (site / área)\n\n" +
          "Envíame esa información en un solo mensaje.\n\n" +
          "Ejemplo:\n" +
          "Código: IMP-00123\nModelo: MX-4070N\nSite: Banco Centro\nÁrea: Caja 1"
      );
      return;
    }
  } catch (err) {
    console.error("Error procesando webhook de WhatsApp:", err);
  }
};
