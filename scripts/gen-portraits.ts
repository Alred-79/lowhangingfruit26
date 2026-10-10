/**
 * Best-effort portraits for AI-drafted seed cases, using Stable Diffusion 3.5 Large on Bedrock.
 *
 * Run:  npx tsx --env-file=.env.local scripts/gen-portraits.ts [filter] [--force] [--dry]
 *   filter   substring of the case file name
 *   --force  regenerate even if the JPEG exists
 *   --dry    print the prompts only
 * Writes public/portraits/<case-file-slug>.jpg (max 640 px, via macOS `sips`) and sets
 * profile.patient.portrait. Never touches sample-*.json. Review the images before shipping them.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { CaseProfile } from "../src/lib/types";

const MODEL = process.env.PORTRAIT_MODEL || "stability.sd3-5-large-v1:0";
const caseDir = path.join("data", "seed", "cases");
const outDir = path.join("public", "portraits");
const args = process.argv.slice(2);
const filter = (args.find((a) => !a.startsWith("--")) || "").toLowerCase();
const force = args.includes("--force");
const dry = args.includes("--dry");
const client = new BedrockRuntimeClient({ region: "us-west-2", maxAttempts: 3 });

function ageWords(age: number): string {
  if (age < 2) return "a toddler";
  if (age < 13) return `a ${age}-year-old child`;
  if (age < 20) return `a ${age}-year-old teenager`;
  return `a ${age}-year-old`;
}

/** Cases where a parent speaks for a small child: show the parent with the child. */
function promptFor(c: CaseProfile): string {
  const p = c.patient;
  const sex = /^f|woman|girl/i.test(p.sex) ? (p.age < 18 ? "girl" : "woman") : /^m|man|boy/i.test(p.sex) ? (p.age < 18 ? "boy" : "man") : "person";
  const subject = p.age < 10 ? `a parent sitting with ${ageWords(p.age)} ${sex} (${p.ethnicity})` : `${ageWords(p.age)} ${p.ethnicity} ${sex}`;
  return [
    `Candid photograph, laptop webcam view of ${subject} on a video call at home, head and shoulders, facing the camera, neutral calm expression.`,
    p.appearance,
    "Ordinary everyday clothing, real skin texture, natural window light, slightly soft webcam focus, plain lived-in home background. Photorealistic, documentary style, unposed.",
  ].join(" ");
}

const NEGATIVE = "text, caption, watermark, logo, user interface, video call overlay, frame, border, cartoon, illustration, 3d render, painting, airbrushed skin, glamour, studio lighting, hospital, medical equipment, stethoscope, white coat, blood, wound, injury, bandage, distorted face, extra fingers, deformed hands, multiple people, nudity";

async function one(file: string): Promise<string> {
  const full = path.join(caseDir, file);
  const data = JSON.parse(fs.readFileSync(full, "utf8")) as { profile: CaseProfile };
  const slug = file.replace(/\.json$/, "");
  const jpg = path.join(outDir, slug + ".jpg");
  const prompt = promptFor(data.profile);
  if (dry) {
    console.log(`${slug}\n  ${prompt}\n`);
    return "dry";
  }
  if (!fs.existsSync(jpg) || force) {
    const res = await client.send(
      new InvokeModelCommand({
        modelId: MODEL,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ prompt, negative_prompt: NEGATIVE, mode: "text-to-image", aspect_ratio: "1:1", output_format: "png" }),
      }),
    );
    const out = JSON.parse(new TextDecoder().decode(res.body)) as { images?: string[]; finish_reasons?: (string | null)[] };
    const reason = out.finish_reasons?.[0];
    if (reason) throw new Error("filtered by the model: " + reason);
    if (!out.images?.[0]) throw new Error("no image returned");
    const png = path.join(outDir, `.${slug}.tmp.png`);
    fs.writeFileSync(png, Buffer.from(out.images[0], "base64"));
    try {
      execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "640", png, "--out", jpg], { stdio: "ignore" });
    } finally {
      fs.rmSync(png, { force: true });
    }
  }
  const portrait = `/portraits/${slug}.jpg`;
  if (data.profile.patient.portrait !== portrait) {
    data.profile.patient.portrait = portrait;
    fs.writeFileSync(full, JSON.stringify(data, null, 1));
  }
  return "ok";
}

(async () => {
  const files = fs.readdirSync(caseDir).filter((f) => f.endsWith(".json") && !f.startsWith("sample-") && f.toLowerCase().includes(filter)).sort();
  let next = 0, ok = 0, failed = 0, stop = "";
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: Number(process.env.CONCURRENCY) || 3 }, async () => {
      while (next < files.length && !stop) {
        const f = files[next++];
        try {
          const r = await one(f);
          if (r === "ok") ok++;
          if (r === "ok") console.log("ok   ", f);
        } catch (e) {
          failed++;
          const err = e as { name?: string; message?: string };
          const msg = `${err.name}: ${err.message}`;
          console.error("error", f, msg.slice(0, 240));
          if (/AccessDenied|ExpiredToken|UnrecognizedClient|ValidationException|ResourceNotFound|not authorized/i.test(msg)) stop = msg;
        }
      }
    }),
  );
  console.log(`${ok} portraits, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)}s`);
  if (stop) {
    console.error("STOPPED: the image model is not usable with these credentials. " + stop.slice(0, 240));
    process.exit(2);
  }
})();
