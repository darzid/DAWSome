import * as DAWSome from "./DAWSome.js";

var init = false;
const snare = new DAWSome.TR909Snare().toDestination();
console.log("Created snare");

const params = {
    cutoff: 300,
    resonance: 3,
    envelopeModulation: 0.1,
    decay: 1,
    accent: 1,
    drive: 1,
    waveform: "sawtooth",
    volume: 0
  }
const tb = new DAWSome.TB303(params).toDestination();
console.log("Created 303");

document.getElementById("playSnareBtn").onclick = async () => {
  if (!init) {
    await Tone.start();
    init = true;
  }
  
  snare.triggerAttackRelease();
  console.log("Triggered snare");
}

document.getElementById("play303Btn").onclick = async () => {
  if (!init) {
    await Tone.start();
    init = true;
  }
  tb.triggerAttackRelease("C3", "8n", Tone.now(), 1, true);
  tb.triggerAttackRelease("C2", "1n", Tone.now() + 0.5, 1, true);
  tb.triggerAttackRelease("C1", "1n", Tone.now() + 1, 1, true);
  console.log("Triggered 303");
}

