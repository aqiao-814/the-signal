"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Subtle page-enter transition for the authenticated app. `template.tsx`
 * re-mounts on navigation, so this animates each route change.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
