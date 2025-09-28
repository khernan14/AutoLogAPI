// src/lib/templateRenderer.js

// --- helpers de render ---
function resolveVar(obj, path) {
  return String(
    path
      .split(".")
      .reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : ""), obj) ??
      ""
  );
}

function renderString(tpl = "", ctx = {}) {
  return String(tpl).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) =>
    resolveVar(ctx, key)
  );
}

function mergePayload(userPayload = {}, metadata = {}) {
  const base = (metadata && metadata.default_payload) || {};
  return { ...base, ...userPayload };
}

// --- Layouts ---
function renderBaseV1({ subject, html, metadata = {}, payload = {} }) {
  const appName = metadata.app_name || process.env.APP_NAME || "Tecnasa";
  const brandUrl = metadata.brand_url || process.env.APP_URL || "#";
  const logoUrl =
    metadata.logo_url ||
    process.env.NOTIF_LOGO_URL ||
    "https://dummyimage.com/120x40/4f46e5/ffffff&text=LOGO";

  const primary = metadata.primary_color || "#4f46e5";
  const textColor = "#111827";
  const muted = "#6b7280";
  const bg = "#f6f7fb";

  const footerLeft =
    metadata.footer_left || `${appName} · ${new Date().getFullYear()}`;
  const footerRight =
    metadata.footer_right ||
    (metadata.support_url
      ? `<a href="${metadata.support_url}" target="_blank" style="color:${primary};text-decoration:none;">Soporte</a>`
      : "");

  // Nota: emails suelen requerir <table> + CSS inline por compatibilidad
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject || "")}</title>
</head>
<body style="margin:0;padding:0;background:${bg};color:${textColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Apple Color Emoji','Segoe UI Emoji';">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${bg};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06);">
          <!-- header -->
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #eef2f7;">
              <a href="${brandUrl}" target="_blank" style="display:inline-block">
                <img src="${logoUrl}" alt="${escapeHtml(
    appName
  )}" height="32" style="display:block;height:32px;" />
              </a>
            </td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:20px;">
              ${html}
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:16px 20px;border-top:1px solid #eef2f7;color:${muted};font-size:12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="color:${muted};">${footerLeft}</td>
                  <td align="right" style="color:${muted};">${footerRight}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <div style="padding-top:12px;color:${muted};font-size:11px;">
          ${
            metadata.unsubscribe_url
              ? `<a href="${metadata.unsubscribe_url}" style="color:${muted};text-decoration:underline;" target="_blank">Darse de baja</a>`
              : ""
          }
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyLayout(layoutId, { subject, html, metadata, payload }) {
  if (!layoutId || layoutId === "none") return html;
  // futuros layouts -> switch(layoutId) ...
  return renderBaseV1({ subject, html, metadata, payload });
}

// --- API principal: render de email ---
export function renderEmailTemplate({
  subjectTpl,
  bodyTpl,
  payload = {},
  metadata = {},
}) {
  const ctx = mergePayload(payload, metadata);
  const subjectPrefix = metadata.subject_prefix || "";
  const subject = subjectPrefix + renderString(subjectTpl || "", ctx);
  const innerHtml = renderString(bodyTpl || "", ctx);
  const layoutId = metadata.layout_id || "base_v1";
  const html = applyLayout(layoutId, {
    subject,
    html: innerHtml,
    metadata,
    payload: ctx,
  });
  return { subject, html };
}
