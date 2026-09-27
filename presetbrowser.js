class PresetBrowser {
    _visiblePresetListElement = null;
    _lastPresetDevice = null;
  
    constructor(presets, instrumentPresets, instrumentPresetNames, effectPresets, effectPresetNames) {
      this.presets = presets;
      this.instrumentPresets = instrumentPresets;
      this.instrumentPresetNames = instrumentPresetNames;
      this.effectPresets = effectPresets;
      this.effectPresetNames = effectPresetNames;
    }
  
    async loadPresets() {
      if (presetBankJson) {
        console.log("Use presets")
        try {
        
        this.parsePresets(presetBankJson);
        }
        catch (error) {
          console.error("failed to parse prezets", error)
          throw error;
        }
        console.log("parsed presets")
      }
      else {
        console.log("Load presets")
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
          
          console.log("getting elements")
          let presetBrowser = document.getElementById("PresetBrowser");
          document.getElementById('presets-data').textContent = JSON.stringify(data, null, 2);
          console.log("parsing presets")
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
            let devicePresetSelect = document.getElementById(deviceName + "-presets");
            if (!devicePresetSelect) {
              devicePresetSelect = document.createElement("select");
              devicePresetSelect.id = `${deviceName}-presets`;
              devicePresetSelect.size = 5;
              devicePresetSelect.style.display = "none";
              presetBrowser.appendChild(devicePresetSelect);
            }
  
            let option = document.createElement("option");
            option.innerText = presetPath.split("\\")[1];
            devicePresetSelect.appendChild(option);
          })
          console.log(`Loaded presets to presets-data`, document.getElementById("presets-data"));
    }
  }
  