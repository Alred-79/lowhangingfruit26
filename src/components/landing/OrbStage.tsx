"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion";
import OrbPoster from "./OrbPoster";
import { ORB_TIERS } from "./orbData";

// three.js is only ever fetched here, after the page is interactive, and never on the server.
const OrbCanvas = dynamic(() => import("./OrbCanvas"), { ssr: false });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The disclosure orb with its legend. Poster first; WebGL replaces it when allowed. */
export default function OrbStage({ className = "" }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // Mount the canvas once the browser is idle, so the form is interactive first.
  useEffect(() => {
    if (reduced) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    // Phones and narrow windows keep the poster: no three.js download, no battery cost.
    const go = () => setReady(window.matchMedia("(min-width: 1024px)").matches && webglAvailable());
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(go, 400);
    return () => clearTimeout(t);
  }, [reduced]);

  // Stop rendering when the orb is off screen or the tab is hidden.
  useEffect(() => {
    if (!ready || !box.current) return;
    let visible = true;
    let onScreen = true;
    const update = () => setActive(visible && onScreen);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    io.observe(box.current);
    const vis = () => {
      visible = document.visibilityState === "visible";
      update();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ready]);

  const live = ready && !failed && !reduced;
  return (
    <figure className={className}>
      <div ref={box} className="relative aspect-square w-full">
        <OrbPoster className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`} />
        {live && (
          <div className="orb-fade-in absolute inset-0">
            <OrbCanvas active={active} onLost={() => setFailed(true)} />
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-white/70">
        {ORB_TIERS.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: t.hex }} aria-hidden />
            {t.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
