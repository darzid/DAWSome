import PresetManager from "./PresetManager.js";
import * as PresetBank from "./preset-bank.js";

const presetManager = new PresetManager();
document.getElementById("loadPresets").onclick = async () => {
  await presetManager.loadPresets();
  alert(presetManager.effectPresetNames.length + " Effect Presets loaded")
}