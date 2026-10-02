import { createHash, randomBytes } from "node:crypto";

export const invitationTokenPattern = /^[0-9a-f]{64}$/;

export function newInvitationToken() {
  return randomBytes(32).toString("hex");
}

export function hashInvitationToken(token: string) {
  if (!invitationTokenPattern.test(token)) throw new Error("Enllaç de participació no vàlid");
  return createHash("sha256").update(token).digest("hex");
}

export function invitationUrl(token: string, baseUrl: string | undefined) {
  if (!baseUrl) throw new Error("Falta configurar REGISTRATION_BASE_URL");
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "localhost")) {
    throw new Error("REGISTRATION_BASE_URL ha de ser HTTPS");
  }
  return new URL(`/registro/${token}`, base).toString();
}
