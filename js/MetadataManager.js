class MetadataManager {
    metadata;
    deviceParameters = {};
    deviceList = [];
    instrumentNames = [];
    effectNames = [];
    
    async loadDevices() {
      if (devicesJson) {
        this.parseDevices(devicesJson);
      }
      else {
        //console.log("Load devices")
        await fetch("devices.json")
          .then(response => {
            if (!response.ok) {
              throw new Error("HTTP error! Status: ${response.status}");
            }
            return response.json();
          })
          .then(data => {
            this.parseDevices(data);
          })
          .catch(error => {
            console.error("Error loading JSON:", error);
          });
      }
    }

    parseDevices(data) {
     // console.log("parsing devices");
      this.deviceList = data;
      this.metadata = data;
      Object.keys(data.devices).forEach(deviceName => {
        if (data.devices[deviceName].type == "Instrument") {
          this.instrumentNames.push(deviceName);
        } else if (data.devices[deviceName].type == "Effect") {
          this.effectNames.push(deviceName);
        }
      });
    }
    
    getDeviceMetadata(deviceName) {
      //console.log("getDeviceMetadata for " + deviceName)
      if (!this.deviceParameters[deviceName]) {
        let componentMetadata = this.metadata.devices[deviceName] ? this.metadata.devices[deviceName] : this.metadata.modules[deviceName];
        if (!componentMetadata.parameters) console.warn("No params", componentMetadata)
        this._traverseParams(deviceName, componentMetadata.parameters, "");
      }
      return this.deviceParameters[deviceName];
    }
    
    getEffectNames() {
      return Object.entries(this.metadata.devices).filter(entry => entry[1].type == "Effect").map(entry => entry[0]);
    }
    
    getInstrumentNames() {
      return Object.entries(this.metadata.devices).filter(entry => entry[1].type == "Instrument").map(entry => entry[0]);
    }
    
    getDeviceNumberParameters(deviceName) {
      //console.log("getDeviceNumberParameters for " + deviceName)
      let deviceMetadata = this.getDeviceMetadata(deviceName);
      
      let results = [];
      Object.entries(deviceMetadata).forEach(item => {
        if (item[1].type == "Number") results.push({ name: item[0], metadata: item[1].metadata}) });
        
      //console.log("number params ", results);
      return results;
    }
    
    getDeviceValueParameters(deviceName) {
     // console.log("getDeviceValueParameters for " + deviceName)
      let deviceMetadata = this.getDeviceMetadata(deviceName);
      
      let results = [];
      Object.entries(deviceMetadata).forEach(item => {
        if (item[1].type == "Number" || item[1].type == "Option") results.push({ name: item[0], type: item[1].type, metadata: item[1].metadata}) });
        
      //console.log("value params ", results);
      return results;
    }
    
    getParameter(deviceName, parameterName) {
      //console.log("getDeviceNumberParameters for " + deviceName)
      let deviceMetadata = this.getDeviceMetadata(deviceName);
      return deviceMetadata[parameterName].metadata;
    }
    
    buildDeviceState(device, deviceState) {
      let deviceMetadata = this.getDeviceMetadata(device.name);
      let deviceContext = device;
      let deviceStateContext = deviceState.parameters;
      Object.keys(deviceMetadata).forEach(paramNamespace => {
        let parts = paramNamespace.split(".");
        let deviceContext = device;
        let deviceStateContext = deviceState.parameters;
        for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
          let part = parts[partIndex];
          deviceContext = deviceContext[part];
          if (!deviceStateContext[part]) deviceStateContext[part] = {};
          deviceStateContext = deviceStateContext[part];
        }
        let paramName = parts[parts.length - 1];
        if (!deviceStateContext[paramName] && deviceContext[paramName]) {
          try {
            let paramValue = deviceContext[paramName].name ? deviceContext[paramName].value : deviceContext[paramName];
            deviceStateContext[paramName] = paramValue;
          }
          catch (error) {
            console.error(`Failed to retrieve param value ${paramName}`, deviceContext[paramName]);
            
            throw error;
          }
          
        }
      })
    }
    
    _traverseParams(deviceName, metadataContext, paramPath) {
      //console.log("traverseParams for " + deviceName + "." + paramPath)
      Object.keys(metadataContext).forEach(parameterName => {
        if (!parameterName) throw "empty param name"
        let paramMetadataPath = metadataContext[parameterName];
        //console.log("Param metadata of " + deviceName + "." + parameterName, metadataContext)
        if (!paramMetadataPath) throw `missing param metadata for "${paramPath}.${parameterName}"`;
        
        if (paramMetadataPath.startsWith("unitTypes") || paramMetadataPath.startsWith("enumTypes")) {
          let currentParamPath = paramPath ? paramPath + "." + parameterName : parameterName;
          let parts = paramMetadataPath.split("/");
          let metadataContainer = this.metadata[parts[0]];
          //console.log("Looking up " + parts[1] + " in " + parts[0], metadataContainer);
          let paramMetadata = metadataContainer[parts[1]];
          let paramType = paramMetadataPath.startsWith("unitTypes") ? "Number" : "Option";
          this._addParameterMetadata(deviceName, currentParamPath, paramType, paramMetadata);
        }
        else if (paramMetadataPath.startsWith("device") || paramMetadataPath.startsWith("module")) {
          let childParamPath = paramPath ? paramPath + "." + parameterName : parameterName;
          let parts = paramMetadataPath.split("/");
          let componentName = parts[1];
          let componentMetadata = parts[0] == "devices" ? this.metadata.devices[componentName] : this.metadata.modules[componentName];
          this._traverseParams(deviceName, componentMetadata.parameters, childParamPath);
        }
      });
    }
    
    _addParameterMetadata(deviceName, parameterPath, parameterType, parameterMetadata) {
      if (!this.deviceParameters[deviceName]) this.deviceParameters[deviceName] = {};
      this.deviceParameters[deviceName][parameterPath] = { type: parameterType, metadata: parameterMetadata };
      //console.log("added parameter metadata for " + deviceName + "." + parameterPath, parameterMetadata);
    }
  }