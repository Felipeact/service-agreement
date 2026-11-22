"use client";

import { motion } from "motion/react";
import Link from "next/link";

/** `next/link` as a motion element, so a grid of link cards can stagger in like any other grid (variants come from `variants.ts`). */
export const MotionLink = motion.create(Link);
