import { EventScreen } from "@/components/event-screen";
import { headers } from "next/headers";

export default async function DisplayPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <EventScreen displayMode baseUrl={`${protocol}://${host}`} />;
}
