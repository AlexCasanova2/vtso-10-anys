export const DISPLAY_CANVAS_WIDTH = 640;
export const DISPLAY_CANVAS_HEIGHT = 960;

export function getDisplayScale(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Las dimensiones de la pantalla deben ser positivas y finitas.");
  }
  return {
    scaleX: width / DISPLAY_CANVAS_WIDTH,
    scaleY: height / DISPLAY_CANVAS_HEIGHT,
  };
}
