"use client";

import { motion } from "motion/react";
import { springs } from "@/lib/motion/presets";

interface AnimatedLabelProps {
  show: boolean;
  children: React.ReactNode;
}

/**
 * Animated label that slides in/out with spring animation.
 * Used for responsive nav labels that hide when space is limited.
 *
 * Keeps element in DOM to prevent gap-snap when hiding.
 * Animates width while maintaining consistent height/alignment.
 */
export function AnimatedLabel({ show, children }: AnimatedLabelProps) {
  return (
    <motion.span
      className="overflow-hidden whitespace-nowrap inline-flex items-center"
      style={{ verticalAlign: "middle" }}
      initial={false}
      animate={{
        width: show ? "auto" : 0,
        opacity: show ? 1 : 0,
        marginLeft: show ? 0 : -6, // Compensate for parent gap when hidden
      }}
      transition={springs.smooth}
    >
      {children}
    </motion.span>
  );
}
