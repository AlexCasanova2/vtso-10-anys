import { randomUUID } from "node:crypto";

const trackingPattern = /^vtso:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newEmailTrackingId() {
  return `vtso:${randomUUID()}`;
}

export function emailTrackingHeader(trackingId: string) {
  if (!trackingPattern.test(trackingId)) throw new Error("Identificador de seguiment no vàlid");
  return `tracking_id:${trackingId}`;
}

export function deliveryReference(payload: { "X-Mailin-custom"?: unknown; "message-id"?: unknown }) {
  const customHeader = payload["X-Mailin-custom"];
  if (typeof customHeader === "string") {
    const trackingId = customHeader.split("|").find((part) => part.startsWith("tracking_id:"))?.slice("tracking_id:".length);
    if (trackingId && trackingPattern.test(trackingId)) return trackingId;
  }
  const messageId = payload["message-id"];
  return typeof messageId === "string" && messageId.length > 0 ? messageId : null;
}
