/**
 * The two WebGL backdrops from the owner's mockups (docs/shader_1 and docs/shader_2), as GLSL strings.
 * `light` is a pale gradient with slow blue, cyan and violet glows; `night` is a dark grid with a glowing pipeline beam
 * and six pulsing nodes (the six steps). Both read only `u_time` and `u_resolution`.
 */

export const VERTEX_SHADER = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const NOISE = `float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}`;

const LIGHT_FRAGMENT = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

${NOISE}

void main() {
  vec2 uv = v_texCoord;
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.25;

  vec2 orb1 = vec2(sin(t * 0.8) * 0.55 + 0.1, cos(t * 0.6) * 0.35 + 0.2);
  vec2 orb2 = vec2(cos(t * 0.7) * 0.6 - 0.2, sin(t * 0.5) * 0.4 - 0.1);
  vec2 orb3 = vec2(sin(t * 0.5 + 2.0) * 0.45, cos(t * 0.75 + 1.5) * 0.35);

  float glow1 = 0.45 / (1.0 + dot(p - orb1, p - orb1) * 3.8);
  float glow2 = 0.38 / (1.0 + dot(p - orb2, p - orb2) * 4.2);
  float glow3 = 0.32 / (1.0 + dot(p - orb3, p - orb3) * 4.5);

  float n = noise(uv * 4.0 + vec2(t * 0.2, -t * 0.15));
  float grid = sin((uv.x + uv.y * 0.5 + n * 0.15) * 45.0 + t) * 0.5 + 0.5;
  grid = pow(grid, 4.0) * 0.035;

  vec3 bg = mix(vec3(0.97, 0.985, 1.0), vec3(0.93, 0.96, 1.0), uv.y);
  vec3 blueGlow = vec3(0.145, 0.388, 0.921);
  vec3 cyanGlow = vec3(0.02, 0.71, 0.89);
  vec3 violetAccent = vec3(0.48, 0.38, 0.96);

  vec3 col = bg;
  col += blueGlow * glow1 * 0.22;
  col += cyanGlow * glow2 * 0.20;
  col += violetAccent * glow3 * 0.16;
  col += vec3(grid * 0.8);

  float vig = smoothstep(1.8, 0.4, length(p));
  col = mix(bg, col, vig);

  gl_FragColor = vec4(col, 1.0);
}`;

const NIGHT_FRAGMENT = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

${NOISE}

void main() {
  vec2 uv = v_texCoord;
  float t = u_time * 0.4;

  vec2 gridUV = fract(uv * vec2(24.0, 12.0)) - 0.5;
  float gridLines = smoothstep(0.46, 0.49, max(abs(gridUV.x), abs(gridUV.y)));

  float wave1 = sin(uv.x * 6.283 - t * 2.0 + uv.y * 3.0) * 0.5 + 0.5;
  float wave2 = cos(uv.x * 12.566 + t * 1.5 - uv.y * 4.0) * 0.5 + 0.5;

  float beam = exp(-pow(abs(uv.y - 0.5 + sin(uv.x * 4.0 + t) * 0.12), 1.8) * 45.0);
  float beamParticles = noise(vec2(uv.x * 18.0 - t * 4.0, uv.y * 8.0));
  beam *= (0.6 + 0.4 * beamParticles);

  float nodes = 0.0;
  for (int i = 0; i < 6; i++) {
    float nodeX = (float(i) + 0.5) / 6.0;
    float dist = length(vec2(uv.x - nodeX, (uv.y - 0.5) * 1.5));
    float pulse = sin(t * 3.0 - float(i) * 1.047) * 0.5 + 0.5;
    nodes += exp(-dist * 18.0) * pulse;
  }

  vec3 bgCol = vec3(0.02, 0.04, 0.08);
  vec3 circuitCol = vec3(0.08, 0.15, 0.30) * gridLines * 0.25;

  vec3 neonBlue = vec3(0.145, 0.388, 0.921);
  vec3 cyanGlow = vec3(0.0, 0.85, 0.95);
  vec3 purpleHaze = vec3(0.45, 0.2, 0.9);

  vec3 finalColor = bgCol + circuitCol;
  finalColor += mix(neonBlue, cyanGlow, wave1) * beam * 1.2;
  finalColor += cyanGlow * nodes * 0.7;
  finalColor += purpleHaze * (wave2 * 0.12);

  float vignette = smoothstep(1.2, 0.2, length(uv - 0.5));
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}`;

export type ShaderVariant = "light" | "night";

export const FRAGMENT_SHADERS: Record<ShaderVariant, string> = { light: LIGHT_FRAGMENT, night: NIGHT_FRAGMENT };
