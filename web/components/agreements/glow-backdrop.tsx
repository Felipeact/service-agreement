"use client";

import { useEffect, useRef } from "react";

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/** Rays, rings and a hexagon core in the action blue on the light ground (docs/DESIGN.md tokens). */
const FRAGMENT = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

float hexDist(vec2 p) {
  p = abs(p);
  float c = dot(p, normalize(vec2(1.0, 1.7320508)));
  return max(c, p.x);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Drawn on the app's light ground (docs/DESIGN.md tokens): the pattern is an amount of "ink" in the action blue, laid over
// --color-ground and fading to --color-surface at the edges, so the screen matches the rest of the staff app.
const vec3 GROUND = vec3(0.965, 0.973, 0.996); // --color-ground #f6f8fe
const vec3 SURFACE = vec3(1.0, 1.0, 1.0); // --color-surface #ffffff
const vec3 GLOW = vec3(0.561, 0.690, 1.0); // --color-action-glow #8fb0ff
const vec3 ACTION = vec3(0.145, 0.388, 0.922); // --color-action #2563eb

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.8;
  float r = length(uv);
  float theta = atan(uv.y, uv.x);
  float soft = 0.0; // light-blue wash: rays, grid, ring halos
  float line = 0.0; // action-blue strokes: rings, hexagons, nodes

  float rayAngle = theta * 18.0;
  float rayPattern = pow(max(0.0, sin(rayAngle + t * 0.6) * cos(rayAngle * 0.5 - t * 0.4)), 4.0);
  soft += (rayPattern / (r + 0.15)) * 0.05;

  for (int i = 1; i <= 6; i++) {
    float fi = float(i);
    float ringRadius = 0.12 * fi + 0.02 * sin(t * 1.2 + fi * 1.5);
    float ringThick = 0.0035 + 0.001 * sin(fi * 2.0 + t);
    float rotSpeed = (mod(fi, 2.0) == 0.0 ? 1.0 : -1.0) * (0.3 + 0.15 * fi);
    float arcMask = smoothstep(0.1, 0.6, sin((theta + t * rotSpeed) * 6.0 * fi));
    float ringGlow = (ringThick / (abs(r - ringRadius) + 0.0025)) * arcMask;
    line += ringGlow * 0.22;
    soft += ringGlow * 0.12;
  }

  float s = sin(-t * 0.35);
  float c = cos(-t * 0.35);
  float hDist = hexDist(mat2(c, -s, s, c) * uv);
  for (float h = 0.06; h <= 0.28; h += 0.055) {
    line += (0.0022 / (abs(hDist - h) + 0.002)) * 0.35;
  }
  soft += 0.018 / (hDist + 0.015) * 0.5;

  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float angle = t * (0.7 + fk * 0.3) + fk * 1.618;
    float dNode = length(uv - vec2(cos(angle), sin(angle)) * (0.18 + fk * 0.14));
    line += (0.0035 / (dNode + 0.003)) * 0.6;
  }

  vec2 gridUv = uv * 9.0;
  float n = noise(gridUv + vec2(t * 0.15, -t * 0.2));
  float lines = step(0.92, fract(gridUv.x)) + step(0.92, fract(gridUv.y));
  soft += lines * n * smoothstep(0.9, 0.1, r) * 0.12;

  float fade = 1.0 - smoothstep(0.55, 1.25, r);
  vec3 col = mix(SURFACE, GROUND, fade);
  col = mix(col, GLOW, clamp(soft * fade, 0.0, 0.55));
  col = mix(col, ACTION, clamp(line * fade, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

/**
 * The animated ground of the thinking screen: a WebGL shader filling its parent. It never calls `loseContext`: React runs an
 * effect twice in development, and a lost context cannot be used again, so the second run would draw nothing. Mount it only
 * while it is on screen, so it has a real size and stops drawing when it goes. With no WebGL it draws nothing, leaving the
 * light ground the parent already has; when the person asks for reduced motion it draws one still frame.
 */
export function GlowBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl");
    if (!canvas || !gl) return;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;

    function draw() {
      if (!canvas || !gl) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, still ? 4 : (performance.now() - start) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!still) frame = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(frame);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />;
}
