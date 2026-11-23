"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#2563eb", "#00d9f2", "#60a5fa", "#7c3aed"] as const;
const COUNT = 38;
const LINK_DISTANCE = 110;
const MOUSE_REACH = 140;

type Particle = { x: number; y: number; radius: number; colour: string; vx: number; vy: number; alpha: number };

/**
 * The sign-in panel's drifting particles and faint circuit lines (the owner's mockup, `ambient-canvas`): 38 dots that
 * wander, link to near neighbours and lean toward the pointer. A visitor who asks for less motion gets nothing drawn;
 * the loop stops when the canvas leaves the screen or the tab is hidden. `panelId` names the element whose pointer
 * movement the dots follow.
 */
export function AmbientCanvas({ className, panelId }: { className?: string; panelId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const ctx = context;
    const parent = canvas.parentElement;
    if (!parent) return;
    const host = parent;

    let width = 0;
    let height = 0;
    function size() {
      width = canvas!.width = host.offsetWidth;
      height = canvas!.height = host.offsetHeight;
    }
    size();

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      alpha: Math.random() * 0.5 + 0.25,
    }));

    const pointer = { x: -1000, y: -1000 };
    const panel = (panelId ? document.getElementById(panelId) : null) ?? host;
    function onMove(event: MouseEvent) {
      const rect = panel.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    }
    function onLeave() {
      pointer.x = -1000;
      pointer.y = -1000;
    }

    let frame = 0;
    let isVisible = true;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < LINK_DISTANCE) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(37, 99, 235, ${0.18 * (1 - distance / LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        const mdx = pointer.x - p.x;
        const mdy = pointer.y - p.y;
        const mouseDistance = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mouseDistance < MOUSE_REACH) {
          p.x += (mdx / mouseDistance) * 0.4;
          p.y += (mdy / mouseDistance) * 0.4;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.colour;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame = isVisible && !document.hidden ? requestAnimationFrame(draw) : 0;
    }
    function start() {
      if (frame === 0 && isVisible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    const resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      start();
    });
    visibilityObserver.observe(canvas);
    panel.addEventListener("mousemove", onMove);
    panel.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", start);
    start();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      panel.removeEventListener("mousemove", onMove);
      panel.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", start);
    };
  }, [panelId]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
