class DevicePanelBaseViewModel {
  _track;
  _trackDeviceIndex = -1;
  _devicePickerList;
  _devicePresetPickerList;
  canAddNewDevice = false;
  customDeviceViewPanel = null;
  customDeviceView = null;
    
  constructor(helpers, metadataManager, audio, projectState, presetManager, customDeviceViews, panel) {
    this.helpers = helpers;
    this.metadataManager = metadataManager;
    this.audio = audio;
    this.projectState = projectState;
    this.presetManager = presetManager;
    this.customDeviceViews = customDeviceViews;
    this.panel = panel;
    this.header = panel.querySelector(".header");
    this.content = panel.querySelector(".content");
    this.genericParameterPanel = this.content.querySelector(".generic-device-view");
    this.parameterView = new DeviceParametersView(this.helpers, this.metadataManager, this.genericParameterPanel);
      
    this.devicePicker = panel.querySelector(".devicePicker");
    this.devicePicker.addEventListener("change", () => this.devicePicked());
    this.devicePresetPicker = panel.querySelector(".devicePresetPicker");
    this.devicePresetPicker.addEventListener("change", () => this.devicePresetPicked());
    
    this.upBtn = panel.querySelector(".up");
    this.downBtn = panel.querySelector(".down");
      
    this.upBtn.addEventListener("click", () => {
      this.customDeviceViewPanel.style.display = "flex";
      this.genericParameterPanel.style.display = "none";
      this.upBtn.style.display = "none";
      this.downBtn.style.display = "block";
      this.customDeviceView.attach(this.currentDevice, this.currentDeviceState);
    });
    this.downBtn.addEventListener("click", () => {
      this.genericParameterPanel.style.display = "block";
      this.customDeviceViewPanel.style.display = "none";
      this.upBtn.style.display = "block";
      this.downBtn.style.display = "none";
      this.parameterView.refreshValues();
    });
      
    this._devicePickerList = [];
    this._devicePresetPickerList = [];
      
    this._deviceStates = [];
    this._devices = [];
    this._currentDeviceState = null;
    this._currentDevice = null;
      
    this.pageIndex = -1;
  }
    
    get track() { return this._track; }
    get trackDeviceIndex() { return this._trackDeviceIndex; }
    get deviceStates() { return this._deviceStates; }
    get devices() { return this._devices; }
    get currentDeviceState() { return this.deviceStates[this.pageIndex]; }
    get currentDevice() { return this.devices[this.pageIndex]; }
    get devicePickerList() { return this._devicePickerList; }
    get devicePresetPickerList() { return this._devicePresetPickerList; }
    get lastPageIndex() { return this.canAddNewDevice ? this.deviceStates.length : this.deviceStates.length - 1; }
    get nextPageAvailable() { return this.pageIndex < this.lastPageIndex; }
    get previousPageAvailable() { return this.pageIndex > 0; }
    get isNewDevice() { return this.canAddNewDevice && this.pageIndex == this.deviceStates.length; }
    
    init(track, deviceStates, devices, devicePickerList, devicePresetPickerList) {
      if (this.customDeviceViewPanel)
        this.customDeviceViewPanel.style.display = "none";
      this._track = track;
      this._deviceStates = deviceStates;
      this._devices = devices;
      this.pageIndex = 0;
      this._trackDeviceIndex = this.track.devices.indexOf(this.currentDeviceState);
      this._devicePickerList = devicePickerList;
      this._devicePresetPickerList = devicePresetPickerList;
      this.render();
    }
    
    render() {
      //console.log("DeviceBaseView.render " + this.currentDevice?.name, this.currentDeviceState, this.devicePickerList)
      let devicePickerOptionsHtml = this.devicePickerList.map((deviceName) => `<option value="${deviceName}">${this.helpers.toShortDeviceName(deviceName)}</option>`).join("");
      this.devicePicker.innerHTML = "<option value=''>-Device-</option>";
      this.devicePicker.innerHTML += devicePickerOptionsHtml;
      if (this.currentDevice && this.currentDevice.name != this.devicePicker.value) {
        this.devicePicker.value = this.currentDevice.name;
        this.fillPresetsPicker();
      }
      
      this.customDeviceViewPanel = (this.currentDevice) ? this.panel.querySelector(`div[data-device="${this.currentDevice.name}"]`) : null;
      if (this.customDeviceViewPanel) {
        this.customDeviceView = this.customDeviceViews[this.currentDevice.name];
        if (!this.customDeviceView)
          throw new Error(`Found custom device panel for "${this.currentDevice.name}" but no registered view`);
          
        this.customDeviceViewPanel.style.display = "flex";
        this.customDeviceView.attach(this.currentDevice, this.currentDeviceState);
        this.genericParameterPanel.style.display = "none";
        this.upBtn.style.display = "none";
        this.downBtn.style.display = "block";
        this.parameterView.renderDevice(this.track, this.currentDeviceState, this.currentDevice);
      }
      else {
        this.genericParameterPanel.style.display = "block";
        this.upBtn.style.display = "none";
        this.downBtn.style.display = "none";
        this.parameterView.renderDevice(this.track, this.currentDeviceState, this.currentDevice);
      }
      
      this.updateUIState();
    }
    
    devicePicked() {
      
      if (!this.isNewDevice) {
        //console.log("DeviceBaseView.devicePicked existing device", this, this.lastPageIndex)
        if (this.devices[this.pageIndex].name == this.devicePicker.value) return;
       // console.log("DeviceBaseView.devicePicked start update existing " + this.devicePicker.value);
        this.track.devices[this.trackDeviceIndex] = { id: this.projectState.nextId++, name: this.devicePicker.value, parameters: {}};
        this.devices[this.pageIndex] = this.audio.rebuildDevice(this.track, this.trackDeviceIndex);
        this.audio.updateTrackChain(this.track);
        
      }
      else {
       // console.log("DeviceBaseView.devicePicked start add new " + this.devicePicker.value);
        
        const newDeviceState = { id: this.projectState.nextId++, name: this.devicePicker.value, parameters: {}};
        this.track.devices.push(newDeviceState);
        this.deviceStates.push(newDeviceState);
        
        this._trackDeviceIndex = this.track.devices.indexOf(newDeviceState);
       // console.log("Rebuild device " + this._trackDeviceIndex);
       
        
        let deviceNode = this.audio.rebuildDevice(this.track, this.trackDeviceIndex);

      }
      
      this.metadataManager.buildDeviceState(this.currentDevice, this.currentDeviceState);
      
      //console.log("Track updated for Selected device " + this.currentDevice.name)
      this.currentDeviceState.presetName = "";
    //  console.log("Preset set for Selected instrument " + this.currentDevice.name);
      
      this.fillPresetsPicker();
      
     // console.log("DeviceBaseView.devicePicked render params for " + this.devicePicker.value)
      this.parameterView.renderDevice(this.track, this.currentDeviceState, this.currentDevice);
      //this.render();
      this.updateUIState();
    }
  
    fillPresetsPicker() {
      
      if (!this.devicePicker.value) {
        this.devicePresetPicker.innerHTML = "";
        return;
      }
      //console.log("DeviceBaseView.devicePicked presets for " + this.devicePicker.value, this.devicePresetPickerList[this.devicePicker.value])
      
      this.devicePresetPicker.innerHTML = "<option value=''>-Preset-</option>";
      if (this.devicePresetPickerList[this.devicePicker.value]) {
        let devicePresetPickerOptionsHtml = Object.keys(this.devicePresetPickerList[this.devicePicker.value]).map((presetName) => `<option value="${presetName}">${presetName}</option>`).join("");
        this.devicePresetPicker.innerHTML += devicePresetPickerOptionsHtml;
      }
      if (this.currentDeviceState && this.currentDeviceState.presetName != "" && this.currentDeviceState.presetName != "default" ) {
        this.devicePresetPicker.value = this.currentDeviceState.presetName;
      }
    }
    
    devicePresetPicked() {
      let presetName = this.devicePresetPicker.value;
      if (!presetName) {
        return;
      }
      
      let preset = this.devicePresetPickerList[this.currentDevice.name][presetName];
      this.recursePreset(preset);
      this.track.devices[this.trackDeviceIndex].presetName = this.devicePresetPicker.value;
    }
    
    recursePreset(presetContext, parentPath = "") {
      Object.keys(presetContext).forEach(parameterName => {
        let parameterPath = (parentPath != "") ? parentPath + "." + parameterName : parameterName;
        let value = presetContext[parameterName];
        if (typeof value === "object") {
          this.recursePreset(value, parameterPath);
        }
        else {
          this.helpers.updateParameter(this.currentDevice, this.currentDeviceState, parameterPath, value);
          this.parameterView.refreshParameter(parameterPath, value);
        }
      });
    }
    
    updateUIState() {}
  }
  
class InstrumentPanelViewModel extends DevicePanelBaseViewModel {
    constructor(helpers, metadataManager, audio, projectState, presetManager, customInstrumentViews, panel) {
      super(helpers, metadataManager, audio, projectState, presetManager, customInstrumentViews, panel);
    }
    
    init(track, deviceState, device) {
      //console.log("InstrumentView.init, state, device", deviceState, device)
      super.init(track, [deviceState], [device], this.metadataManager.getInstrumentNames(), this.presetManager.instrumentPresets);
    }
    
    devicePicked() {
     // console.log("InstrumentView.devicePicked " + this.devicePicker.value)
      super.devicePicked();

      this.track.instrumentName = this.devicePicker.value;
     // console.log("Selected instrument " + this.track.instrumentName)
     // document.dispatchEvent(new CustomEvent("InstrumentChanged", { detail: { trackId: this.track.id, instrumentName: this.devicePicker.value } }));
    }
    
    devicePresetPicked() {
      super.devicePresetPicked();
      
      this.track.instrumentParameters = this.devicePresetPickerList[this.track.instrumentName][this.devicePresetPicker.value];
    //  this.track.devices[0].presetName = this.devicePresetPicker.value;
     // console.log("Preset selected " + this.devicePresetPicker.value, this.track.instrumentParameters);
      //audio.updateTrackChain(this.track);
    //  document.dispatchEvent(new CustomEvent("InstrumentPresetChanged", { detail: { trackId: this.track.id, presetName: this.devicePresetPicker.value } }));
    }
  }
  
class EffectsPanelViewModel extends DevicePanelBaseViewModel {
    constructor(helpers, metadataManager, audio, projectState, presetManager, customEffectViews, panel) {
      super(helpers, metadataManager, audio, projectState, presetManager, customEffectViews, panel);
      
      this.prevBtn = panel.querySelector(".prev");
      this.nextBtn = panel.querySelector(".next");
      
      this.prevBtn.addEventListener("click", () => this.previousPage());
      this.nextBtn.addEventListener("click", () => this.nextPage());
      
      this.canAddNewDevice = true;
    }
    
    init(track, deviceStates, devices) {
      super.init(track, deviceStates, devices, this.metadataManager.getEffectNames(), this.presetManager.effectPresets);
    }
    
    previousPage() {
      if (!this.previousPageAvailable) return;
      this.pageIndex--;
      this.render();
    }
    
    nextPage() {
      if (!this.nextPageAvailable) return;
     // alert("device1 " + this.currentDevice + " devices " + this.devices);

      this.pageIndex++;
    //  alert("device " + this.currentDevice + " devices " + this.devices);
      this.render();
    }
    
    devicePicked() {
      /*let effectName = this.devicePicker.value;
      if (this.isNewDevice) {
        if (effectName) {
          let newFx = { id: projectState.nextId++, name: effectName, parameters: {} };
          this.track.effects.push(newFx);
          this.track.devices.push(newFx);
        }
      }*/
      super.devicePicked();

    /*  super.devicePicked();
      
      let effectName = this.devicePicker.value;
      if (this.isNewDevice) {
        if (effectName) {
          let newFx = { name: effectName, parameters: {} };
          if (!this.track) alert("no track")
          console.log(this.track.effects)
          this.track.effects.push(newFx);
          this.track.devices.push(newFx);
          audio.updateTrackChain(this.track);
          console.log("updated track with new effect " + effectName);
        }
      }
      else {
        console.log("Update device " + effectName, this.metadataManager.deviceList);
        this.track.devices[1 + this.pageIndex] = this.metadataManager.deviceList.devices[effectName];
        audio.updateTrackChain(this.track);
        console.log("Track updated with new effect " + effectName);
        this.track.devices[1 + this.pageIndex].presetName = "default";
        console.log("Preset set for Selected fx " + effectName);
      }
      
      this.render();*/
    }
    
    devicePresetPicked() {
      super.devicePicked();
      
    }
    
    updateUIState() {
      this.prevBtn.disabled = this.previousPageAvailable ? false : true;
      this.nextBtn.disabled = this.nextPageAvailable ? false : true;
    }
  }
  
class DeviceParametersView {
    track;
    deviceState;
    device;
    valueParametersMetadata;
    groupName;
    valueElements = {};
    constructor(helpers, metadataManager, parametersPanel) {
      this.helpers = helpers;
      this.metadataManager = metadataManager;
      this.parametersPanel = parametersPanel;
    }
    
    renderDevice(track, deviceState, device) {
      try {
        
        if (device) console.log("DeviceParametersView.renderDevice for " + device.name);
  
        this.valueElements = {};
        this.track = track;
        this.deviceState = deviceState;
        this.device = device;
        this.refresh();
      }
      catch (err) {
        alert("error in refresh " + err + " at " + err.stack)
      }
    }
    
    refreshValues() {
      Object.keys(this.valueElements).forEach(paramPath => 
        this.valueElements[paramPath].value = this.helpers.getDeviceParameterValue(this.device, paramPath)
      );
    }
    
    refresh() {
      this.parametersPanel.innerHTML = "";
      if (!this.device || !this.deviceState) {
        return;
      }
      console.warn("DeviceParametersView.refresh for " + this.device.name);
      this.valueParametersMetadata = this.metadataManager.getDeviceValueParameters(this.device.name);
      this.valueParametersMetadata.forEach(parameterMetadata => {
        if (this.helpers.hasParameter(this.device, parameterMetadata.name))
          this.renderParameter(parameterMetadata)
      });
      this.renderLists();
    }
    
    renderParameter(parameterMetadata) {
      let parts = parameterMetadata.name.split(".");
      let shortName = parts[parts.length - 1];
      let groupName = parts.length > 1 ? parameterMetadata.name.substring(0, parameterMetadata.name.length - (shortName.length + 1)) : "";
     // console.log("renderParameter " + shortName, parameterMetadata)
      if (this.groupName != groupName && groupName != "") {
        this.renderGroupLabel(groupName);
        this.groupName = groupName;
      }
      
      let paramElement = document.createElement("div");
      paramElement.className = "parameter";
      paramElement.dataset.group = groupName;
      if (groupName)
        paramElement.classList.add("hidden");
      this.parametersPanel.appendChild(paramElement);
      
      let label = document.createElement("label");
      let prefix = groupName ? "> " : "";
      label.innerText = prefix + shortName; // parameterPath.replace(".", " ");
      paramElement.appendChild(label);
      
      let valueGroup = document.createElement("div");
      valueGroup.className = "value-group";
      paramElement.appendChild(valueGroup);
  
      if (parameterMetadata.type == "Number")
        this.renderNumberParameter(parameterMetadata, valueGroup);
      else
        this.renderOptionParameter(parameterMetadata, valueGroup);
        
      this.renderUnitLabel(parameterMetadata, valueGroup);
    }
    
    renderGroupLabel(groupName) {
      let paramElement = document.createElement("div");
      paramElement.className = "parameter";
      this.parametersPanel.appendChild(paramElement);
      
      let label = document.createElement("label");
      label.className = "paramgroup";
      label.dataset.group = groupName;
      label.innerText = groupName.replace(".", " ");
      paramElement.appendChild(label);
      
      label.addEventListener("click", () => {
        const groupParams = this.parametersPanel.querySelectorAll(`div.parameter[data-group="${groupName}"]`);
        groupParams.forEach(param => param.classList.toggle("hidden"));
      })
    }
              
    renderNumberParameter(parameterMetadata, valueGroup) {
      //console.log("renderNumberParameter " + parameterMetadata.name, parameterMetadata)
      let input = document.createElement("number-input");
      input.readOnly = true;
      valueGroup.appendChild(input);
      input.dataset.parameter = parameterMetadata.name.replace(".", "-");
      input.min = parameterMetadata.metadata.min;
      input.max = parameterMetadata.metadata.max;
      input.step = parameterMetadata.metadata.step;
      //console.log("renderNumberParameter getDeviceStateParameter for " + this.device.name + "." + parameterMetadata.name, this.deviceState, parameterMetadata);
      if (!parameterMetadata.name) alert("Trying to retrieve param without name " + parameterMetadata)
      let stateValue = this.helpers.getDeviceStateParameter(this.deviceState, parameterMetadata.name);
      if (stateValue) 
        input.value = stateValue;
      else 
        input.value = this.helpers.getDeviceParameter(this.device, parameterMetadata.name);
      input.fill = "#d29524";
      input.focusFill = "#f2b544";
      input.oninput = () => this.updateDeviceParameter(parameterMetadata.name, input.value);
      this.valueElements[parameterMetadata.name] = input;
    }
    
    renderOptionParameter(parameterMetadata, valueGroup) {
      let select = document.createElement("select");
      select.dataset.parameter = parameterMetadata.name.replace(".", "-");
      let optionsHtml = "";
     // console.log("renderOptionParameter getDeviceStateParameter for " + this.device.name + "." + parameterMetadata.name, this.deviceState, parameterMetadata)
     // console.log("renderOptionParameter", parameterMetadata.metadata.values)
      let parameterValue = this.helpers.getDeviceStateParameter(this.deviceState, parameterMetadata.name);
      parameterMetadata.metadata.values.forEach(value => {
        let option = document.createElement("option");
        option.value = value;
        option.innerText = value;
        if (parameterValue == value) {
          option.selected = "selected";
        }
        select.appendChild(option);
      });
      valueGroup.appendChild(select);
      
      select.oninput = () => this.updateDeviceParameter(parameterMetadata.name, select.value);
      this.valueElements[parameterMetadata.name] = select;
    }
  
    renderUnitLabel(parameterMetadata, valueGroup) {
      //console.log("renderUnitLabel ", parameterMetadata)
      let unitLabel = document.createElement("label");
      unitLabel.className = "unit";
      valueGroup.appendChild(unitLabel);
      if (parameterMetadata.metadata.unit)
        unitLabel.innerText = parameterMetadata.metadata.unit;
    }
  
    updateDeviceParameter(parameterPath, value) {
      console.log("updating " + parameterPath);
      this.helpers.updateParameter(this.device, this.deviceState, parameterPath, value);
    }
    
    refreshParameter(parameterPath, value) {
      let parameterControl = this.parametersPanel.querySelector(`[data-parameter="${parameterPath.replace(".", "-")}"]`);
      if (!parameterControl) {
        console.warn("RefreshParameter: Could not find control for parameter " + parameterPath, this.parametersPanel);
       // throw "RefreshParameter: Could not find control for parameter " + parameterPath;
       return;
      }
      parameterControl.value = value;
    }
    
    renderLists() {
   //   console.log("renderLists")
      let deviceIndex = this.track.devices.indexOf(this.deviceState);
      if (deviceIndex == this.track.devices.length) return;
      
      let trackDeviceMetadata = this.metadataManager.deviceList.devices[this.device.name];
      if (!trackDeviceMetadata) console.error("No metadata", this.deviceState);
      if (!trackDeviceMetadata.lists) return;
      Object.keys(trackDeviceMetadata.lists).forEach(listName => {
        let trackDeviceListsState = [];
        let listMetadata = trackDeviceMetadata.lists[listName];
        let listContainer = document.createElement("div");
        listContainer.className = "list-container";
        this.parametersPanel.appendChild(listContainer);
              
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
           // console.log("add column for " + name)
          }
          else {
            templateColumns += "min-content ";
          }
        });
        listContainer.appendChild(listElement);
        listElement.style.gridTemplateColumns = templateColumns;
              
        listMetadata.columns.forEach(name => {
          let listColumn = document.createElement("div");
          listColumn.className = "listcolumn";
          listColumn.innerText = name;
          listElement.appendChild(listColumn);
        });
        if (!this.deviceState.lists) {
          this.deviceState.lists = { samples: [] };
        }
        if (this.deviceState.lists && this.deviceState.lists[listName]) {
          this.deviceState.lists[listName].forEach(listItem => 
            this.addListItem(listMetadata, this.deviceState.lists[listName], listItem, listElement)
          );
        }
              
        Object.keys(listMetadata.listMethods).forEach(methodName => {
          let method = listMetadata.listMethods[methodName];
          let methodButton = document.createElement("button");
          methodButton.className = "btn listmethod";
          methodButton.innerHTML = method.displayName;
          listContainer.appendChild(methodButton);
          methodButton.onclick = () => eval(`${method.functionName}(methodButton, listMetadata, trackDeviceListsState[listName], listElement, this.deviceState)`);
        });
      });
    }
      
    addListItem(listMetadata, list, listItem, listElement) {
      //console.log("addListItem", listMetadata, list, listItem, listElement);
        
      listMetadata.columns.forEach(name => {
        let listItemValue = document.createElement("div");
        listItemValue.innerText = listItem[name];
        listElement.appendChild(listItemValue);
      });
    }
  }
  