// The per-device game layer preference (On / Minimal / Off). Display only: nothing is stored server-side.
export const GAME_LAYER_KEY = "poscere-game-layer";

/** Applies the saved level before first paint, so a student who chose "Off" never sees XP flash in. */
export const GAME_LAYER_SCRIPT = `try{var g=localStorage.getItem("${GAME_LAYER_KEY}");if(g)document.documentElement.dataset.game=g}catch(e){}`;
