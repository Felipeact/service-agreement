"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { shaderMode, shaderPixelRatio } from "./shader-mode";
import { FRAGMENT_SHADERS, VERTEX_SHADER, type ShaderVariant } from "./shader-sources";

/** The static ground behind the canvas: what a visitor sees before WebGL starts, without WebGL, or if it fails. */
const FALLBACK: Record<ShaderVariant, string> = {
  light: "bg-gradient-to-b from-ground via-action-tint/60 to-ground",
  night: "bg-gradient-to-br from-night via-night-raised to-night",
};

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

type ShaderCanvasProps = {
  /** `light` for the public pages' pale ground, `night` behind the dark panels. */
  variant?: ShaderVariant;
  /** Layout only: where the backdrop sits (it is `absolute inset-0` and `aria-hidden`). */
  className?: string;
};

/**
 * An animated WebGL backdrop (the owner's shader mockups) that never carries content. A CSS gradient is always there
 * first, so nothing waits on the script. The canvas starts only when WebGL exists; a visitor who prefers reduced motion
 * gets one still frame; it pauses while offscreen or while the tab is hidden; the pixel ratio is capped.
 */
export function ShaderCanvas({ variant = "light", className }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // `getContext` is missing or returns null where there is no WebGL (old devices, jsdom); `matchMedia` is missing in jsdom.
    const gl = typeof canvas.getContext === "function" ? canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) : null;
    const prefersReducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mode = shaderMode({ hasWebGL: Boolean(gl), prefersReducedMotion });
    if (!gl || mode === "none") return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADERS[variant]);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");

    let frame = 0;
    let isVisible = true;
    let isTabShown = !document.hidden;
    const startedAt = performance.now();

    function resize() {
      const ratio = shaderPixelRatio(window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round((canvas?.clientWidth ?? 1) * ratio));
      const height = Math.max(1, Math.round((canvas?.clientHeight ?? 1) * ratio));
      if (canvas && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    function draw(now: number) {
      if (!gl || !canvas) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      // A still frame is a fixed, pleasant moment (a few seconds in), not the first frame.
      gl.uniform1f(uTime, mode === "still" ? 6 : (now - startedAt) / 1000);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function tick(now: number) {
      frame = 0;
      if (!isVisible || !isTabShown) return;
      draw(now);
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (mode === "loop" && frame === 0 && isVisible && isTabShown) frame = requestAnimationFrame(tick);
    }

    resize();
    draw(performance.now());
    setIsLive(true);

    // Release what this run created. The context itself is left alone: React may run this effect twice in development
    // and would get the same canvas context back, which must still be usable.
    function release() {
      gl?.deleteBuffer(buffer);
      gl?.deleteProgram(program);
      gl?.deleteShader(vertex);
      gl?.deleteShader(fragment);
    }

    if (mode !== "loop") return release;

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      start();
    });
    visibilityObserver.observe(canvas);
    function onVisibilityChange() {
      isTabShown = !document.hidden;
      start();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [variant]);

  return (
    <div aria-hidden="true" data-shader={variant} className={cn("pointer-events-none absolute inset-0 overflow-hidden", FALLBACK[variant], className)}>
      <canvas ref={canvasRef} className={cn("size-full transition-opacity duration-700", isLive ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
