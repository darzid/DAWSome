class BottomPanelManager {
    panels;
    panelButtons = [];
    
    xyPadViewModel;
    constructor(helpers, metadataManager, presetManager, projectState, audio, customDeviceViews) {
      this.helpers = helpers;
      this.metadataManager = metadataManager;
      this.projectState = projectState;
      this.audio = audio;
    
      this.bottomPanel = document.getElementById("bottom-panel");
      this.panels = this.bottomPanel.querySelectorAll(".panel");
      this.tabStrip = this.bottomPanel.querySelector(".tab-strip");
      
      this.panels.forEach(panel => {
        const panelButton = document.createElement("button");
        panelButton.dataset.panelId = panel.id;
        panelButton.className = "btn";
        panelButton.innerText = panel.title;
        this.tabStrip.appendChild(panelButton);
        this.panelButtons.push(panelButton);
        
        panelButton.onclick = () => {
          panelButton.classList.toggle("on");
          if (panelButton.classList.contains("on"))
            this.showPanel(panelButton.dataset.panelId);
          else
            this.hidePanel(panelButton.dataset.panelId);
        };
      });
      
      this.editor = document.querySelector(".editor");
      this.instrumentPanel = document.querySelector(".instrument-panel");
      this.instPanel = document.querySelector(".inst-panel");
      this.effectsPanel = document.querySelector(".effects-panel");
      this.fxPanel = document.querySelector(".fx-panel");
      this.modulationPanel = document.querySelector(".modulation-panel");
      this.xypadPanel = document.querySelector(".xypad-panel");
      this.mixerPanel = document.querySelector(".mixer");
      
      this.xyPadViewModel = new XYPadViewModel(this.xypadPanel, this.helpers, this.audio, this.metadataManager);
      this.xypadPanel.style.display = "none";
      
      this.instView = new InstrumentPanelViewModel(this.helpers, this.metadataManager, this.audio, this.projectState, presetManager, customDeviceViews, this.instPanel);
      this.fxView = new EffectsPanelViewModel(this.helpers, this.metadataManager, this.audio, this.projectState, presetManager, customDeviceViews, this.fxPanel);
      
      document.addEventListener("ProjectLoaded", (e) => this.projectState = e.detail.projectState);
      document.addEventListener("ClipChanged", (e) => this.setButtonStates());
      document.addEventListener("SelectTrack", (e) => this.setButtonStates());
      this.setButtonStates();
    }

    showPanel(panelId) {
      this.panels.forEach(panel => panel.style.display = panel.id != panelId ? "none" : "flex");
      this.panelButtons.forEach(panelButton => panelButton.classList.toggle("on", panelButton.dataset.panelId == panelId))
      this.renderPanel(panelId);
    }

    hidePanel(panelId) {
      document.getElementById(panelId).style.display = "none";
      this.panelButtons.find(panelButton => panelButton.dataset.panelId == panelId).classList.remove("on");
    }
    
    setButtonStates() {
      this.panelButtons.forEach(panelButton => {
        switch (panelButton.dataset.panelId) {
          case "clipeditor-panel":
            panelButton.disabled = (this.projectState.selectedClipId == null);
            break;
          case "instrument-panel": 
          case "inst-panel":
          case "effects-panel": 
          case "fx-panel":
          case "modulation-panel":
          case "xypad-panel": 
            panelButton.disabled = (this.projectState.selectedTrackId == null);
            break;
        }
        if (panelButton.classList.contains("on") && panelButton.disabled) {
          this.hidePanel(panelButton.dataset.panelId);
          //console.log("setButtonStates: hidden disabled panel " + panelButton.dataset.panelId, this.projectState.selectedTrackId)
        }
      });
    }
    
    renderPanel(panelId) {
      this.setButtonStates();
      const panel = document.getElementById(panelId);
      panel.style.display = "flex";
      switch (panelId) {
        case "instrument-panel": 
          this.renderInstrumentPanel(panel);
          break;
        case "inst-panel":
          this.renderInstPanel(panel);
          break;
        case "effects-panel": 
          this.renderEffectsPanel(panel);
          break;
        case "fx-panel":
          this.renderFxPanel(panel);
          break;
        case "modulation-panel":
          this.renderModulationPanel(panel);
          break;
        case "xypad-panel": 
          this.renderXypadPanel(panel);
          return;
      }
    }
    
    refreshActivePanel() {
      //console.log("refresh active panel")
      this.setButtonStates();
      const activeButton = document.querySelector(".bottom-panel").querySelector(".tab-strip button.on");
      if (!activeButton) return;
      this.renderPanel(activeButton.dataset.panelId);
    }

    renderInstrumentPanel(panel) {
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        panel.style.display = "none";
        return;
      }

      let deviceToInspect = this.audio.getTrackInstrument(track);
      panel.innerHTML = "";
      this.renderDevice(panel, track, deviceToInspect, 0, this.metadataManager, instrumentPresets, "Instrument");
    }

    renderInstPanel(panel) {
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        panel.style.display = "none";
        return;
      }

      let deviceToInspect = this.audio.getTrackInstrument(track);
      this.instView.init(track, track.devices[0], deviceToInspect);
    }
    
    renderEffectsPanel(panel) {
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        console.warn("no track fx")
        panel.style.display = "none";
        return;
      }

      let trackEffects = this.audio.getTrackEffects(track);

      panel.innerHTML = "";
      trackEffects.forEach(fx => this.renderDevice(panel, track, fx, 1 + trackEffects.indexOf(fx), metadataManager.effectNames, effectPresets, "Effect", trackEffects.indexOf(fx)));
     // this.renderDevice(panel, track, { name: "" }, 1, metadataManager.effectNames, effectPresets, "Effect");
    }

    renderFxPanel(panel) {
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        //console.log("no track fx")
        panel.style.display = "none";
        return;
      }

      let trackEffects = this.audio.getTrackEffects(track);
      this.fxView.init(track, track.effects, trackEffects);
    }
    
    renderModulationPanel(panel) {
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        console.warn("no track")
        panel.style.display = "none";
        return;
      }

      let trackModulators = this.audio.getTrackModulators(track);
      let modulatorsStartIndex = 1 + track.effects.length;

      panel.innerHTML = "";
      //console.log("show modulators", trackModulators, modulatorsStartIndex, track.devices[modulatorsStartIndex]);
      try {
        trackModulators.forEach(mod => this.renderDevice(panel, track, mod, modulatorsStartIndex + trackModulators.indexOf(mod), modulatorNames, modulatorPresets, "LFO"));
      }
      catch (error) {
        console.error("Error while creating modulatoe html", error)
      }
      this.renderDevice(panel, track, { name: "", parameters: {} }, modulatorsStartIndex + trackModulators.length, modulatorNames, modulatorPresets, "LFO");
    }

    renderXypadPanel(panel) {
      //console.log("xypad render", this.projectState.tracks, this.projectState.selectedTrackId)
      let track = this.projectState.tracks.find(track => track.id === this.projectState.selectedTrackId);
      if (!track) {
        console.warn("no track")
        panel.style.display = "none";
        return;
      }
      
      this.xyPadViewModel.init(track);
    }
    
    renderDevice(parentPanel, track, trackDeviceNode, deviceIndex, deviceNames, devicePresets, panelType = "Instrument", pageNumber = 0) {
      let devicePanel = document.createElement("div");
      devicePanel.className = "device";
      devicePanel.dataset.trackid = track.id;
      parentPanel.appendChild(devicePanel);

      let isInstrument = panelType == "Instrument";
      let isLFO = panelType == "LFO";
      let hasPresets = !isLFO;

      let isMultiDevicePanel = panelType != "Instrument";
      if (isLFO) {
        let targetDeviceOptionsHtml = track.devices.map((d) => `<option value="${track.devices.indexOf(d)}">${helpers.toShortDeviceName(d.name)}</option>`).join("");
        devicePanel.innerHTML += `<div class="device-header"><button class="prev">⏪️</button>
          To: <select class="targetDevice" title="Target device">${targetDeviceOptionsHtml}</select>
          <select class="targetParameter" title="Target parameter"></select><button class="next">⏩️</button>
        </div>
        <div class="device-parameters"></div>`;
      } else {
        let deviceOptionsHtml = deviceNames.map((i) => `<option value="${i}">${helpers.toShortDeviceName(i)}</option>`).join("");
        devicePanel.innerHTML += `<div class="device-header"><button class="prev">⏪️</button>
          <select class="inst" title="Instrument">${deviceOptionsHtml}</select>
          <select class="instPreset" title="Preset"></select><button class="next">⏩️</button>
        </div>
        <div class="device-parameters"></div>`;
      }

      let parametersPanel = devicePanel.querySelector(".device-parameters");
      
      let prevBtn = devicePanel.querySelector(".prev");
      let nextBtn = devicePanel.querySelector(".next");
      
      let lastEffectIndex = track.effects.length - 1;
      
      const updateButtonStates = (pageNumber) => {
      
        prevBtn.disabled = pageNumber == 0 ? "disabled" : "";
        //prevBtn.disabled = false;
        nextBtn.disabled = pageNumber === lastEffectIndex + 1 ? "disabled" : "";
        //console.log("updateButtonStates " + deviceIndex, prevBtn.disabled, nextBtn.disabled);
      }
      
      if (isMultiDevicePanel) {
        prevBtn.style.display = "inline";
        nextBtn.style.display = "inline";
        updateButtonStates(pageNumber);
        prevBtn.onclick = (e) => {
          parametersPanel.previousSibling.scrollIntoView();
          deviceIndex--;
          pageNumber--;
          updateButtonStates(pageNumber);
        }
        nextBtn.onclick = (e) => {
  
          deviceIndex++;
          pageNumber++;
          prevBtn.disabled = false;
          updateButtonStates(pageNumber);
          //alert("next clicked")
        }
      }
      else {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
      }

      let targetParamMetadata = null;
      if (hasPresets) {
        let instrumentSelect = devicePanel.querySelector(".inst");
        //console.log("get instrument select", instrumentSelect);
        let instrumentPresetSelect = devicePanel.querySelector(".instPreset");
        //console.log("inst preset select", instrumentPresetSelect);

        instrumentSelect.value = trackDeviceNode.name;
        fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);
        if (isInstrument) {
          instrumentPresetSelect.value = track.devices[0].presetName;
          //console.log("Preset", track.devices[0].presetName)
        }

        instrumentSelect.oninput = async (e) => {
          if (isInstrument) {
            track.instrumentName = e.target.value;
           // console.log("Selected instrument " + track.instrumentName)
            this.audio.updateTrackChain(track);
            //console.log("Yrack updated for Selected instrument " + track.instrumentName)
            track.devices[0].presetName = "default";
            //console.log("Preset set for Selected instrument " + track.instrumentName)
            trackDeviceNode = this.audio.getTrackInstrument(track);
            if (trackDeviceNode.name !== track.instrumentName)
              throw "mismatch"
            fillDevicePresets(devicePanel, devicePresets, track.instrumentName);
           // console.log("device changed to " + track.instrumentName, trackDeviceNode)
          }
          else {
            if (trackDeviceNode.name === "") {
              let newFx = { name: e.target.value, parameters: {} };
              track.effects.push(newFx);
              track.devices.push(newFx);
              this.audio.updateTrackChain(track);
             // console.log("updated track with new effect " + e.target.value);
              let effects = this.audio.getTrackEffects(track);
              trackDeviceNode = effects[effects.length - 1];
             // console.log("added effect", trackDeviceNode)
              fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);

              updateButtonStates(deviceIndex);
              //nextBtn.disabled = deviceIndex == lastEffectIndex ? "disabled" : "";
              renderDeviceParameters();
              renderDevice(effectsPanel, track, { name: "", parameters: {} }, track.effects.length, metadataManager.effectNames, effectPresets, "Effect");
            }
            else {
              fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);
            }
          }

          renderDeviceParameters();
          renderDeviceLists();
          document.dispatchEvent(new CustomEvent("InstrumentChanged", { detail: { trackId: track.id, instrumentName: e.target.value } }));
          this.audio.updateTrackChain(track);
        };

        instrumentPresetSelect.oninput = (e) => {
          if (isInstrument) {
            track.instrumentParameters = devicePresets[track.instrumentName][e.target.value];
            track.devices[0].presetName = e.target.value;
          }

         // console.log("Preset selected " + e.target.value, track.instrumentParameters)
          this.audio.updateTrackChain(track);
          renderDeviceParameters();
          document.dispatchEvent(new CustomEvent("InstrumentPresetChanged", { detail: { trackId: track.id, presetName: e.target.value } }));
        };

      }
      else if (isLFO) {
        let modulatorsStartIndex = 1 + track.effects.length;
        let modulatorIndex = deviceIndex - modulatorsStartIndex;
        let modulation = track.modulators[0];

        let targetDeviceSelect = devicePanel.querySelector(".targetDevice");
        if (modulation) {
          targetDeviceSelect.value = modulation.targetDeviceIndex;

          let targetParameterSelect = devicePanel.querySelector(".targetParameter");

          fillTargetParameters(track, targetDeviceSelect, targetParameterSelect);
          targetParameterSelect.value = modulation.targetParameter;
          let targetDevice = track.devices[targetDeviceSelect.value];
          targetParamMetadata = metadataManager.deviceList.devices[targetDevice.name].parameters[modulation.targetParameter];

          targetDeviceSelect.oninput = (e) => fillTargetParameters(track, targetDeviceSelect, targetParameterSelect);
          targetParameterSelect.oninput = (e) => {
           // console.log("param selected")
            modulation.targetParameter = targetParameterSelect.value;
            let targetDevice = track.devices[targetDeviceSelect.value];
            let targetDeviceMetadata = metadataManager.deviceList.devices[targetDevice.name];
            targetParamMetadata = targetDeviceMetadata.parameters[modulation.targetParameter];
           // console.log("param render " + modulation.targetParameter, targetDeviceMetadata, targetParamMetadata)
            renderDeviceParameters(targetParamMetadata);
          }
        }
        else {
          console.log("modulation not found", track.modulators, modulatorIndex)
        }
      }

      renderDeviceParameters(targetParamMetadata);
      renderDeviceLists();

      
      function renderDeviceParameters(targetParamMetadata = null) {
        console.log("renderDeviceParameters", targetParamMetadata)
        parametersPanel.innerHTML = "";
        if (trackDeviceNode.name == "") {
          return;
        }
        if (deviceIndex < track.devices.length) {
          let trackDeviceState = track.devices[deviceIndex].parameters;
          let trackDeviceMetadata = metadataManager.deviceList.devices[trackDeviceNode.name];
          console.log("create device html, track/trackDeviceNode/trackDeviceState/trackDeviceMetadata", track, trackDeviceNode, trackDeviceState, trackDeviceMetadata);

          Object.keys(trackDeviceMetadata.parameters).forEach(parameterName => renderDeviceParameter(parameterName, trackDeviceMetadata, trackDeviceState, targetParamMetadata));
        }
        
        function renderDeviceParameter(parameterPath, deviceMetadata, trackDeviceState, targetParameterMetadata = null) {
          const useDeviceStateOnly = true;
  
          let parameterPathParts = parameterPath.split(".");
          let parameterName = parameterPathParts[parameterPathParts.length - 1];
          let parameterGroup = parameterPathParts.length > 1 ? parameterPath.substring(0, parameterPath.length - (parameterName.length + 1)) : "";
          if (parameterGroup) {
            console.log("group: " + parameterGroup)
          }
          if (parameterName === "frequency")
            console.warn("frequency", trackDeviceState)
  
          let parameterMetadataPath = deviceMetadata.parameters[parameterName];
          let parts = parameterMetadataPath.split("/");
          let paramMetadata = targetParameterMetadata && (parameterName == "min" || parameterName == "max") ? targetParameterMetadata : metadataManager.deviceList[parts[0]][parts[1]];
  
          //console.log("param metadata", parameterMetadataPath, paramMetadata);
  
          let paramElement = document.createElement("div");
          paramElement.className = "parameter";
          paramElement.dataset.group = parameterGroup;
          if (parameterGroup)
            paramElement.classList.add("hidden");
          parametersPanel.appendChild(paramElement);
  
          if (parts[0] == "unitTypes" || parts[0] == "enumTypes") {
            let stateValue = getParamState(parameterPath);
            let paramContext = getParameterContext(parameterPath, trackDeviceState);
  
            let paramIsObject = paramContext[parameterName].name == "Signal" || paramContext[parameterName].name == "Param" || helpers.isObject(paramContext[parameterName]);
            //console.log(`param ${parameterName} is object: ${paramIsObject}`);
            let paramValue = paramIsObject ? paramContext[parameterName].value : paramContext[parameterName];
  
            if (stateValue != undefined && stateValue !== paramValue) {
              console.warn(`using state value for "${parameterPath}", stateValue/paramValue`, stateValue, paramValue)
              paramValue = stateValue;
            }
            else {
              if (stateValue !== paramValue && stateValue == undefined)
                console.warn("using param context value " + parameterPath, paramValue, stateValue, trackDeviceState)
            }
  
            if (useDeviceStateOnly) {
              paramValue = stateValue;
            }
  
            let label = document.createElement("label");
            let prefix = parameterGroup ? "> " : "";
            label.innerText = prefix + parameterName; // parameterPath.replace(".", " ");
            paramElement.appendChild(label);
  
            let valueGroup = document.createElement("div");
            valueGroup.className = "value-group";
            paramElement.appendChild(valueGroup);
  
            if (parts[0] == "unitTypes") {
  
              let input = document.createElement("number-input");
              input.readOnly = true;
              valueGroup.appendChild(input);
              input.name = parameterPath;
              input.min = paramMetadata.min;
              input.max = paramMetadata.max;
              input.step = paramMetadata.step;
              input.value = paramValue;
              input.fill = "#d29524";
              input.focusFill = "#f2b544";
              if (parameterName == "frequency")
                console.warn(`frequency input`, input);
              else
                console.log("input", input)
              input.oninput = () => {
                if (paramIsObject)
                  paramContext[parameterName].value = input.value;
                else
                  paramContext[parameterName] = input.value;
  
                updateParamState(parameterPath, input.value);
              }
              
              let unitLabel = document.createElement("label");
              unitLabel.className = "unit";
              valueGroup.appendChild(unitLabel);
              if (targetParameterMetadata && (parameterName == "min" || parameterName == "max")) {
                if (targetParameterMetadata.unit)
                  unitLabel.innerText = targetParameterMetadata.unit
              }
              else if (paramMetadata.unit) {
                unitLabel.innerText = paramMetadata.unit
              }
  
            }
            else if (parts[0] == "enumTypes") {
              let select = document.createElement("select");
              let optionsHtml = "";
              paramMetadata.values.forEach(value => {
                let option = document.createElement("option");
                option.value = value;
                option.innerText = value;
                if (paramValue == value) {
                  option.selected = "selected";
                }
                select.appendChild(option);
              });
              valueGroup.appendChild(select);
              select.oninput = () => {
                if (paramIsObject)
                  paramContext[parameterName].value = select.value;
                else
                  paramContext[parameterName] = select.value;
                updateParamState(parameterPath, input.value);
              }
              let unitLabel = document.createElement("label");
              unitLabel.className = "unit";
              valueGroup.appendChild(unitLabel);
            }
          }
          else {
            let label = document.createElement("label");
            label.className = "paramgroup";
            label.dataset.group = parameterPath;
            label.innerText = parameterPath.replace(".", " ");
            paramElement.appendChild(label);
            label.addEventListener("click", () => {
              const groupParams = parametersPanel.querySelectorAll(`div.parameter[data-group="${parameterPath}"]`);
              groupParams.forEach(param => param.classList.toggle("hidden"));
            })
  
            if (parts[0] == "modules") {
              let moduleMetadata = metadataManager.deviceList.modules[parts[1]];
              Object.keys(moduleMetadata.parameters).forEach(childParameterName => renderDeviceParameter(parameterName + "." + childParameterName, moduleMetadata, trackDeviceState));
            }
            else if (parts[0] == "devices") {
              let moduleMetadata = metadataManager.deviceList.devices[parts[1]];
              Object.keys(moduleMetadata.parameters).forEach(childParameterName => renderDeviceParameter(parameterName + "." + childParameterName, moduleMetadata, trackDeviceState));
            }
          }

          function getParameterContext(parameterPath, trackDeviceState) {
            let paramValue, paramStateValue = null;
            try {
              //console.log("getting value for " + parameterPath);
              let trackDeviceNodeParamContext = trackDeviceNode;
  
              if (parameterPath == "oscillator.detune") {
                console.log("osc detune")
              }
              for (let partIndex = 0; partIndex < parameterPathParts.length - 1; partIndex++) {
                let pathPart = parameterPathParts[partIndex];
                trackDeviceNodeParamContext = trackDeviceNodeParamContext[pathPart];
              }
              return trackDeviceNodeParamContext;
            }
            catch (error) {
              console.error("Traverse error", error);
            }
          }
  
          function getParamState(parameterPath) {
            let parts = parameterPath.split(".");
            let paramName = parts[parts.length - 1];
            let stateContext = trackDeviceState;
            if (parts.length > 1) {
              // console.log(`getParamState("${parameterPath}"): nested value`, trackDeviceState);
            }
            for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
              stateContext = stateContext[parts[partIndex]];
            }
            let paramValue = stateContext[paramName];
            if (paramValue == undefined) {
              console.warn(`getParamState("${parameterPath}"): value undefined`, stateContext);
            }
            return paramValue;
          }
  
          function updateParamState(parameterPath, value) {
            // console.log("updateParamState",trackDeviceState, parameterPath, value)
            trackDeviceState[parameterName] = value;
            //console.log("paramState updated",trackDeviceState, parameterPath, value)
          }
        }
      }

      function renderDeviceLists() {
        console.log("renderDeviceLists")
        if (deviceIndex < track.devices.length) {
          let trackDeviceListsState = track.devices[deviceIndex].lists;
          let trackDeviceMetadata = metadataManager.deviceList.devices[track.devices[deviceIndex].name];
          if (!trackDeviceMetadata) console.error("Metadata not found for " + trackDeviceNode.name)
          if (trackDeviceMetadata.lists) {
            console.log("create device lists html", track, trackDeviceNode, trackDeviceListsState, trackDeviceMetadata);
          
            Object.keys(trackDeviceMetadata.lists).forEach(listName => {
              let listMetadata = trackDeviceMetadata.lists[listName];
              let listContainer = document.createElement("div");
              listContainer.className = "list-container";
              parametersPanel.appendChild(listContainer);
              
              let label = document.createElement("label");
              label.innerText = listName;
              listContainer.appendChild(label);
              
              let listElement = document.createElement("div");
              listElement.className = "list";
              listElement.name = listName;
              let templateColumns = "";
              listMetadata.columns.forEach(name => {
                if (listMetadata.columns.indexOf(name) == listMetadata.columns.length - 1) {
                  templateColumns += "auto ";
                  console.log("add column for " + name)
                }
                else {
                  templateColumns += "min-content ";
                }
              });
            //  templateColumns += "min-content";
             /* if (listMetadata.itemMethods) {
                templateColumns += "min-content";
                console.log("add column for methods")
              }*/
              
              listContainer.appendChild(listElement);
              listElement.style.gridTemplateColumns = templateColumns;
              
              listMetadata.columns.forEach(name => {
                let listColumn = document.createElement("div");
                listColumn.className = "listcolumn";
                listColumn.innerText = name;
                listElement.appendChild(listColumn);
              });
              if (!trackDeviceListsState) {
                track.devices[deviceIndex].lists = { samples: [] };
                trackDeviceListsState = track.devices[deviceIndex].lists;
              }
              if (trackDeviceListsState && trackDeviceListsState[listName]) {
                trackDeviceListsState[listName].forEach(listItem => {
                  addListItem(listMetadata, trackDeviceListsState[listName], listItem, listElement);
                });
              }
              
              Object.keys(listMetadata.listMethods).forEach(methodName => {
                let method = listMetadata.listMethods[methodName];
                let methodButton = document.createElement("button");
                methodButton.className = "btn listmethod";
                methodButton.innerHTML = method.displayName;
                listContainer.appendChild(methodButton);
                methodButton.onclick = () => eval(`${method.functionName}(methodButton, listMetadata, trackDeviceListsState[listName], listElement, trackDeviceNode)`);
              });
            });
          }
        }
      }
      
      function addListItem(listMetadata, list, listItem, listElement) {
        console.log("addListItem", listMetadata, list, listItem, listElement);
        
        listMetadata.columns.forEach(name => {
          let listItemValue = document.createElement("div");
          listItemValue.innerText = listItem[name];
          listElement.appendChild(listItemValue);
        });
        /*
        Object.keys(listMetadata.itemMethods).forEach(methodName => {
          let method = listMetadata.itemMethods[methodName];
          let methodButton = document.createElement("button");
          methodButton.className = "btn itemmethod";
          methodButton.innerHTML = methodName;
          listElement.appendChild(methodButton);
          methodButton.onclick = () => eval(`${method.functionName}(listItem, listMetadata, trackDeviceListsState[listName], listElement, trackDeviceNode)`);
        });*/
      }
      
      function addSample(srcElement, listMetadata, list, listElement, sampler) {
        const fileInput = document.createElement("input");
        fileInput.style.display = "none";
        fileInput.type = "file";
        fileInput.accept = ".wav,.mp3";
        srcElement.parentElement.appendChild(fileInput);
        
        fileInput.addEventListener("change", async (e) => {
          console.log("chanhe")
          const file = fileInput.files[0];
          const filePath = fileInput.value;
          const fileName = filePath.substr(filePath.lastIndexOf("\\") + 1);


          if (!file) return;
          try {
            
            const fileReader = new FileReader();
            // when it's read into an ArrayBuffer, we can access that in the result property of the event target
            fileReader.onload = async (event) => {
              // create a ToneAudioBuffer from the ArrayBuffer with file contents. event.target.result is the ArrayBuffer with the file content
              const buffer = await sampler.context.decodeAudioData(event.target.result); 
  
              let noteFreq = Tone.Frequency("C2");
              if (list.length > 0) {
                noteFreq = noteFreq.transpose(list.length);
              }
              const listItem = {note: noteFreq.toNote(), name: fileName, url: buffer };
              list.push(listItem);
              addListItem(listMetadata, list, listItem, listElement);
              srcElement.parentElement.removeChild(fileInput);
              sampler.add(listItem.note, buffer);
              sampler.triggerAttackRelease(listItem.note, 1, 0, 127);
              fileInput.value = "";
            }
            // read the selected file into an ArrayBuffer
            fileReader.readAsArrayBuffer(file);
            
          } catch (err) {
            console.error(`Could not import ${file.name}: ${err.message}`, err);
            dom.hint.textContent = `Could not import ${file.name}: ${err.message}`;
          }
        });
        fileInput.click();
      }
      
    }
  }
