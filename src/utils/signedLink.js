// src/utils/signedLink.js
import crypto from "crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (str) => Buffer.from(str, "base64url");

export function signPublicLink(
  payload,
  ttlSec,
  secret = process.env.PUBLIC_LINK_SECRET
) {
  if (!secret) throw new Error("PUBLIC_LINK_SECRET no está configurado");
  const exp = Math.floor(Date.now() / 1000) + Number(ttlSec || 0);
  const body = { ...payload, exp };
  const data = b64u(JSON.stringify(body));
  const sig = b64u(crypto.createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyPublicLink(
  token,
  secret = process.env.PUBLIC_LINK_SECRET
) {
  try {
    if (!secret) throw new Error("PUBLIC_LINK_SECRET no está configurado");
    if (!token || typeof token !== "string")
      return { ok: false, reason: "missing" };
    const [data, sig] = token.split(".");
    if (!data || !sig) return { ok: false, reason: "format" };

    const expected = b64u(
      crypto.createHmac("sha256", secret).update(data).digest()
    );
    const a = fromB64u(sig);
    const b = fromB64u(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "sig" };
    }

    const payload = JSON.parse(fromB64u(data).toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: "error", error: e.message };
  }
}
