"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { DISPLAY_CANVAS_HEIGHT, DISPLAY_CANVAS_WIDTH, getDisplayScale } from "@/lib/public-display";

export function PublicDisplay({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const { scaleX, scaleY } = getDisplayScale(width, height);
      canvas.style.setProperty("--display-scale-x", String(scaleX));
      canvas.style.setProperty("--display-scale-y", String(scaleY));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="public-display" ref={hostRef}>
      <div className="public-display-canvas" ref={canvasRef} style={{
        "--display-canvas-width": `${DISPLAY_CANVAS_WIDTH}px`,
        "--display-canvas-height": `${DISPLAY_CANVAS_HEIGHT}px`,
      } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
