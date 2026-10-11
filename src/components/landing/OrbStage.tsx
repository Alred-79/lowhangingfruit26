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
  // Pointer position over the window, -1..1, read by the canvas each frame (a ref: no re-renders).
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (reduced) return;
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduced]);

  // Mount the canvas once the browser is idle, so the form is interactive first.
  useEffect(() => {
    if (reduced) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    // Phones and narrow windows keep the poster: no three.js download, no battery cost.
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const go = () => setReady(window.matchMedia("(min-width: 768px)").matches && !nav.connection?.saveData && webglAvailable());
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
            <OrbCanvas active={active} onLost={() => setFailed(true)} pointer={pointer} />
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[12.5px] font-semibold text-white/90">
        {ORB_TIERS.map((t, i) => (
          <span key={t.id} className="pop-spring inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15" style={{ ["--i" as string]: i + 4 }}>
            <span className="breathe h-2.5 w-2.5 rounded-full" style={{ background: t.hex, boxShadow: `0 0 10px ${t.hex}`, animationDelay: `${i * 0.6}s` }} aria-hidden />
            {t.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
