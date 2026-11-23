/** What a shader backdrop should do for this visitor: animate, draw one still frame, or stay out and leave the CSS fallback. */
export type ShaderMode = "loop" | "still" | "none";

/**
 * A visitor who asks for less motion gets one still frame, never a loop. Without WebGL there is nothing to draw, so the
 * static gradient behind the canvas is all they see. Pure, so the rule is tested without a browser.
 */
export function shaderMode({ hasWebGL, prefersReducedMotion }: { hasWebGL: boolean; prefersReducedMotion: boolean }): ShaderMode {
  if (!hasWebGL) return "none";
  return prefersReducedMotion ? "still" : "loop";
}

/** The device pixel ratio the canvas renders at: sharp on a retina screen, never so large that a full-bleed shader burns the GPU. */
export const MAX_SHADER_PIXEL_RATIO = 1.5;
export const shaderPixelRatio = (devicePixelRatio: number): number => Math.min(Math.max(devicePixelRatio, 1), MAX_SHADER_PIXEL_RATIO);
