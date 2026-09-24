"use client";

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/lib/types";

export function usePublicEvent(eventId?: string) {
  const [event, setEvent] = useState<PublicEvent | null>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/public/event${eventId ? `?id=${encodeURIComponent(eventId)}` : ""}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Event unavailable");
        const body = await response.json();
        if (active) setEvent(body.event);
      } catch { /* Keep the last good frame during a temporary connection failure. */ }
      finally { if (active) timer = setTimeout(load, 1500); }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [eventId]);
  return event;
}
