export default class PresetManager {
  _visiblePresetListElement = null;
  _lastPresetDevice = null;
  
  constructor(presets = [], instrumentPresets = [], instrumentPresetNames = [], effectPresets = [], effectPresetNames = []) {
    this.presets = presets;
    this.instrumentPresets = instrumentPresets;
    this.instrumentPresetNames = instrumentPresetNames;
    this.effectPresets = effectPresets;
    this.effectPresetNames = effectPresetNames;
  }
  
  async loadPresets() {
    if (presetBankJson) {
      // console.log("Use presets")
      try {
        this.parsePresets(presetBankJson);
      }
      catch (error) {
        console.error("failed to parse presets", error)
        throw error;
      }
     //   console.log("parsed presets")
    }
    else {
      //  console.log("Load presets")
      await fetch('preset-bank.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
         this.parsePresets(data);
      })
      .catch(error => {
        console.error('Error loading JSON:', error);
      });
    }
  }
    
  parsePresets(data) {
    this.presets = data;
    let presetPaths = Object.keys(data);
    presetPaths.forEach(fullPresetPath => {
      let presetPath = fullPresetPath.replace("effect\\", "").replace("instrument\\", "").replace(".json", "");
      let deviceName = presetPath.split("\\")[0];
      let presetName = presetPath.split("\\")[1];
      if (fullPresetPath.startsWith("instrument")) {
          this.instrumentPresetNames.push(presetPath);
          if (!this.instrumentPresets[deviceName]) {
            this.instrumentPresets[deviceName] = {};
          }
          this.instrumentPresets[deviceName][presetName] = data[fullPresetPath];
        }
      else if (fullPresetPath.startsWith("effect")) {
          this.effectPresetNames.push(presetPath);
          if (!this.effectPresets[deviceName]) {
            this.effectPresets[deviceName] = {};
          }
          this.effectPresets[deviceName][presetName] = data[fullPresetPath];
        }
    });
       //   console.log(`Loaded presets to presets-data`, document.getElementById("presets-data"));
  }
}