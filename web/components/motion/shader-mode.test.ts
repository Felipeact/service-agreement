import { describe, expect, test } from "vitest";
import { MAX_SHADER_PIXEL_RATIO, shaderMode, shaderPixelRatio } from "./shader-mode";
import { FRAGMENT_SHADERS, VERTEX_SHADER } from "./shader-sources";

describe("shaderMode", () => {
  test("animates for a visitor with WebGL who has not asked for less motion", () => {
    expect(shaderMode({ hasWebGL: true, prefersReducedMotion: false })).toBe("loop");
  });

  test("draws one still frame, never a loop, for reduced motion", () => {
    expect(shaderMode({ hasWebGL: true, prefersReducedMotion: true })).toBe("still");
  });

  test.each([true, false])("leaves the static fallback alone without WebGL (reduced motion: %s)", (prefersReducedMotion) => {
    expect(shaderMode({ hasWebGL: false, prefersReducedMotion })).toBe("none");
  });
});

describe("shaderPixelRatio", () => {
  test.each([
    [1, 1],
    [1.25, 1.25],
    [2, MAX_SHADER_PIXEL_RATIO],
    [3, MAX_SHADER_PIXEL_RATIO],
    [0.5, 1],
  ])("a device ratio of %s renders at %s", (device, expected) => {
    expect(shaderPixelRatio(device)).toBe(expected);
  });
});

describe("shader sources", () => {
  test.each(Object.entries(FRAGMENT_SHADERS))("the %s fragment shader declares the uniforms the canvas sets and writes a colour", (_name, source) => {
    expect(source).toContain("precision highp float;");
    expect(source).toContain("uniform float u_time;");
    expect(source).toContain("uniform vec2 u_resolution;");
    expect(source).toContain("gl_FragColor");
  });

  test("the vertex shader feeds the texture coordinate the fragment shaders read", () => {
    expect(VERTEX_SHADER).toContain("varying vec2 v_texCoord;");
    for (const source of Object.values(FRAGMENT_SHADERS)) expect(source).toContain("varying vec2 v_texCoord;");
  });
});
