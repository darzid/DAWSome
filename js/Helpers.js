const helpers = {
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    midiName: (pitch) => Constants.NOTE_NAMES[pitch % 12] + (Math.floor(pitch / 12) - 2),  // Ableton: C3 = MIDI 60
    snapFloor: (beat, step) => (step ? Math.floor(beat / step + Constants.EPS) * step : beat),
    snapRound: (beat, step) => (step ? Math.round(beat / step) * step : beat),
    ceilBars: (beats) => Math.ceil(beats / Constants.BEATS_PER_BAR - Constants.EPS) * Constants.BEATS_PER_BAR,
    clipEnd: (clip) => clip.end ? clip.end : clip.start + clip.length,
    noteNameToPitch: (noteName) => {
      let pitch = Tone.Frequency(noteName).toMidi();
        //console.log(`Converted notename ${noteName} to pitch ${pitch}`);
      return pitch;
    },
    noteTimeToBeats: (noteTime) => {
        let bbs = Tone.Time(noteTime).toBarsBeatsSixteenths();
        let parts = bbs.split(":");
        let beats = parseInt(parts[1]);
        beats += (parseFloat(parts[2]) / 4);
        beats += parseInt(parts[0]) * 4;
        //console=.log(`Converted notename ${noteName} to pitch ${pitch}`);
        return beats;
      },
    beatsToTime: (beats) => {
      let remainingBeats = beats;
      let bars = Math.floor(beats / 4);
      remainingBeats -= (bars * 4);
      let barBeats = Math.floor(beats % 4);
      remainingBeats -= barBeats;
      if (remainingBeats > 1) throw "error";
      let beatSixteenths = remainingBeats * 4;
      return Tone.Time(`${bars}:${barBeats}:${beatSixteenths}`);
    },
    isObject: (value) => { typeof value === "object" && !Array.isArray(value) && value !== null; },
    toShortDeviceName: (deviceName) => {
      let parts = deviceName.split(".");
      return parts[parts.length - 1];
    },
    hasParameter: (device, parameterPath) => {
      let parts = parameterPath.split(".");
      let name = parts[parts.length - 1];
      
      let parameterContext = device;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        parameterContext = parameterContext[parts[partIndex]];
      }
      if (parameterContext[name] == undefined)
        return false;
      else
        return true;
    },
    getDeviceParameter: (device, parameterPath) => {
      let parts = parameterPath.split(".");
      let name = parts[parts.length - 1];
      
      let parameterContext = device;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        parameterContext = parameterContext[parts[partIndex]];
      }
      let parameter = parameterContext[name];
      return parameter;
    },
    getDeviceParameterValue: (device, parameterPath) => {
  
      let parts = parameterPath.split(".");
      let name = parts[parts.length - 1];
      
      let parameter = helpers.getDeviceParameter(device, parameterPath);
    
      if (parameter.name) 
        return parameter.value;
      else 
        return parameter;
    },
    getDeviceParameterParent: (device, parameterPath) => {
      let parts = parameterPath.split(".");
      let name = parts[parts.length - 1];
      
      let parameterContext = device;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        parameterContext = parameterContext[parts[partIndex]];
      }
      return parameterContext;
    },
    getDeviceStateParameter: (deviceState, parameterPath) => {
      if (!parameterPath) alert("empty param " + deviceState)
      let parts = parameterPath.split(".");
      let name = parts[parts.length - 1];
      
      if (!deviceState) throw new Error("No device state");
      let parameterContext = deviceState.parameters ? deviceState.parameters : deviceState;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        parameterContext = parameterContext[parts[partIndex]];
      }
      let parameter = parameterContext[name];
      //if (parameter == null) throw `No parameter found with name ${name} for device ${deviceState.name}`;
      //, deviceState, parameterPath
      return parameter;
    },
    updateDeviceParameter: (device, parameterPath, value) => {
      let parts = parameterPath.split(".");
      let parameterName = parts[parts.length - 1];
      
      let parameterParent = helpers.getDeviceParameterParent(device, parameterPath);
      if (!parameterParent[parameterName]) 
        throw new Error(`Could not find parameter ${parameterPath} for device ${device.name}`);
      if (parameterParent[parameterName].name)
        parameterParent[parameterName].value = value;
      else
        parameterParent[parameterName] = value;
    },
    updateDeviceStateParameter: (deviceState, parameterPath, value) => {
      let parts = parameterPath.split(".");
      let context = deviceState.parameters;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        context = context[parts[partIndex]];
      }
      let parameterName = parts[parts.length - 1];
      context[parameterName] = value;
    },
    updateParameter: (device, deviceState, parameterPath, value) => {
      helpers.updateDeviceParameter(device, parameterPath, value);
      helpers.updateDeviceStateParameter(deviceState, parameterPath, value);
    },
    clone: (obj) => {
      if (null == obj || "object" != typeof obj) return obj;
      var copy = obj.constructor();
      for (var attr in obj) {
          if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
      }
      return copy;
    },
    sizeCanvas(canvas, width, height) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const c = canvas.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return c;
    }
  }
  