export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seed } = await import("./lib/seed");
    const added = seed();
    if (added) console.log(`[seed] loaded ${added} cases`);
  }
}
