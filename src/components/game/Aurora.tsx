"use client";

import { useEffect } from "react";

/**
 * The ambient layer: slow color fields drifting behind the page (CSS only, see globals.css).
 * Pauses every ambient loop while the tab is hidden; reduced motion stops it entirely in CSS.
 */
export default function Aurora({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => root.toggleAttribute("data-tab-hidden", document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <div className={`aurora grain ${dark ? "aurora-dark" : ""} ${className}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
