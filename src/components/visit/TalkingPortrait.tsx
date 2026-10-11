"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

/** Where the mouth is in a portrait, as fractions of the image: centre, and the face width. */
export interface Mouth {
  x: number;
  y: number;
  w: number;
}

// Portraits are AI-generated photos with the face anywhere from 25% to 45% down the frame, so the mouth is
// located per image with a small face detector. It loads on demand; if it cannot, the portrait still moves
// (head motion only) and nothing else changes.
interface Detector {
  detect(img: HTMLImageElement): { detections: { boundingBox?: { width: number }; keypoints?: { x: number; y: number }[] }[] };
}
let detectorP: Promise<Detector | null> | null = null;
const found = new Map<string, Mouth | null>();

function loadDetector(): Promise<Detector | null> {
  detectorP ||= (async () => {
    try {
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${MP}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      return (await mod.FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE" })) as Detector;
    } catch (e) {
      console.warn("[avatar] face detector unavailable:", (e as Error).message);
      return null;
    }
  })();
  return detectorP;
}

async function locateMouth(img: HTMLImageElement): Promise<Mouth | null> {
  const key = img.currentSrc || img.src;
  if (found.has(key)) return found.get(key)!;
  let m: Mouth | null = null;
  try {
    const d = await (await loadDetector())?.detect(img).detections[0];
    const mouth = d?.keypoints?.[3]; // BlazeFace order: eyes, nose, mouth, ears
    if (d && mouth && d.boundingBox) {
      m = { x: mouth.x, y: mouth.y, w: d.boundingBox.width / img.naturalWidth };
      if (m.x < 0.2 || m.x > 0.8 || m.y < 0.15 || m.y > 0.7 || m.w < 0.1 || m.w > 0.7) m = null; // implausible, stay still
    }
  } catch {
    m = null;
  }
  found.set(key, m);
  return m;
}

/**
 * The patient's portrait, animated while they speak. `level` returns the current mouth openness (0-1) and is
 * polled every frame only while `talking`; styles are written straight to the DOM so speech never re-renders React.
 */
function Photo({ src, alt, fill, imgRef, onLoad }: { src: string; alt: string; fill: boolean; imgRef?: React.Ref<HTMLImageElement>; onLoad?: React.ReactEventHandler<HTMLImageElement> }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imgRef} src={src} alt={alt} onLoad={onLoad} draggable={false} className={`absolute inset-0 h-full w-full ${fill ? "object-fill" : "object-cover object-[50%_30%]"}`} />
  );
}

export default function TalkingPortrait({ src, alt, talking, enabled, level }: { src: string; alt: string; talking: boolean; enabled: boolean; level: () => number }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const jaw = useRef<HTMLDivElement>(null);
  const gap = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ w: number; h: number; l: number; t: number; ar: number } | null>(null);
  const [mouth, setMouth] = useState<Mouth | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // The photo may finish loading before React attaches (server-rendered), so also check on attach.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    img.current = el;
    if (el?.complete && el.naturalWidth) setNatural((n) => n || { w: el.naturalWidth, h: el.naturalHeight });
  }, []);
  const live = useRef({ level, mouth, geo });
  useEffect(() => {
    live.current = { level, mouth, geo };
  });

  // Lay the stage over exactly the area the cropped photo occupies (object-cover, anchored 50% / 30%).
  useEffect(() => {
    const el = box.current;
    if (!el || !natural) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      const s = Math.max(W / natural.w, H / natural.h);
      const w = natural.w * s, h = natural.h * s;
      setGeo({ w, h, l: (W - w) * 0.5, t: (H - h) * 0.3, ar: natural.w / natural.h });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  useEffect(() => {
    if (!enabled || !natural || !img.current) return;
    let dead = false;
    locateMouth(img.current).then((m) => !dead && setMouth(m));
    return () => {
      dead = true;
    };
  }, [enabled, natural, src]);

  useEffect(() => {
    if (!talking) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const [st, jw, gp] = [stage.current, jaw.current, gap.current];
    let raf = 0, cur = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const { level, mouth, geo } = live.current;
      let target = 0;
      try {
        target = level();
      } catch {}
      // Open quickly, close a little slower, so it reads as a jaw and not a flicker.
      cur += (target - cur) * (target > cur ? 0.55 : 0.28);
      const sec = (now - t0) / 1000;
      if (st && !reduce) {
        const rot = Math.sin(sec * 1.1) * 0.35 + cur * 0.25 * Math.sin(sec * 2.3);
        st.style.transform = `translateY(${(-cur * 1.2).toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(1.012 + cur * 0.006).toFixed(4)})`;
      }
      if (mouth && geo && jw && gp) {
        const drop = cur * mouth.w * geo.w * 0.05; // px the lower face slides down
        jw.style.transform = `translateY(${drop.toFixed(2)}px)`;
        gp.style.opacity = String(Math.min(0.6, Math.max(0, cur - 0.2) * 1.1));
        gp.style.transform = `translate(-50%, calc(-50% + ${(drop * 0.3).toFixed(2)}px)) scaleY(${(0.1 + cur).toFixed(3)})`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      // Settle back to rest instead of freezing mid-word.
      if (st) st.style.transform = "";
      if (jw) jw.style.transform = "";
      if (gp) gp.style.opacity = "0";
    };
  }, [talking, mouth]);

  const fw = mouth && geo ? mouth.w * geo.w : 0; // face width in px
  const place: React.CSSProperties = geo ? { left: geo.l, top: geo.t, width: geo.w, height: geo.h } : { inset: 0 };

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div ref={stage} className="absolute will-change-transform [transform-origin:50%_85%]" style={place}>
        <Photo src={src} alt={alt} fill={!!geo} imgRef={imgRef} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {mouth && geo && (
          <>
            {/* The lower face again, softly masked and slid down with the jaw. */}
            <div
              ref={jaw}
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                WebkitMaskImage: `radial-gradient(ellipse ${fw * 0.6}px ${fw * 0.34}px at ${mouth.x * geo.w}px ${mouth.y * geo.h + fw * 0.2}px, #000 40%, transparent 100%)`,
                maskImage: `radial-gradient(ellipse ${fw * 0.6}px ${fw * 0.34}px at ${mouth.x * geo.w}px ${mouth.y * geo.h + fw * 0.2}px, #000 40%, transparent 100%)`,
              }}
            >
              <Photo src={src} alt="" fill={!!geo} />
            </div>
            {/* The dark of an open mouth, between the lips. */}
            <div
              ref={gap}
              aria-hidden
              className="pointer-events-none absolute rounded-[50%] opacity-0"
              style={{
                left: mouth.x * geo.w,
                top: mouth.y * geo.h,
                width: fw * 0.15,
                height: fw * 0.05,
                transform: "translate(-50%, -50%) scaleY(0.15)",
                background: "radial-gradient(ellipse at center, rgba(20,6,8,0.9) 25%, rgba(45,15,18,0.55) 65%, transparent 100%)",
                filter: "blur(1px)",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
