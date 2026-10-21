class XYPadViewModel {
    mouseDown = false;
    pointerType = "";
    xDeviceSelect;
    xParameterSelect;
    xParameterMetadata;
    xParameterUpdateTimestamp;
    yDeviceSelect;
    yParameterSelect;
    yParameterMetadata;
    yParameterUpdateTimestamp;
    canvas;
    ctx;
    size;
    center;
    track;
    trackAudioDevices;
    position;
    updateDelayInSecs = 0.05;
    
    constructor(xypadPanelElement, helpers, audio, metadataManager) {
      this.helpers = helpers;
      this.audio = audio;
      this.metadataManager = metadataManager;
      
      this.xDeviceSelect = xypadPanelElement.querySelector("select[name='x-device-select']");
      this.xParameterSelect = xypadPanelElement.querySelector("select[name='x-parameter-select']");
      this.xParamValueOutput = xypadPanelElement.querySelector("output[name='x-param-value']");
      this.yDeviceSelect = xypadPanelElement.querySelector("select[name='y-device-select']");
      this.yParameterSelect = xypadPanelElement.querySelector("select[name='y-parameter-select']");
      this.yParamValueOutput = xypadPanelElement.querySelector("output[name='y-param-value']");
      this.canvas = xypadPanelElement.querySelector("canvas");
      
      this.xDeviceSelect.addEventListener("change", () => this.xDeviceSelected());
      this.yDeviceSelect.addEventListener("change", () => this.yDeviceSelected());
      
      this.xDeviceSelect.disabled = true;
      this.yDeviceSelect.disabled = true;
      
      this.xParameterSelect.disabled = true;
      this.yParameterSelect.disabled = true;
      
      this.ctx = this.helpers.sizeCanvas(this.canvas, this.canvas.clientWidth, this.canvas.clientHeight);
      
      this.ctx.strokeStyle = "rgba(255,255,255,0.5)";;
      this.ctx.fillStyle = "rgba(255,255,100,0.5)";
      this.ctx.shadowColor = this.ctx.fillStyle;
      this.ctx.shadowBlur = 5;
      
      this.size = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
      this.center = { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
    
      this.updatePosition(this.center)

      this.canvas.onpointerdown = (e) => {
        this.mouseDown = true;
        this.pointerType = e.pointerType;
        this.updatePosition(this.getMousePositionOnCanvas(e));
      }
      this.canvas.onpointerup = () => {
        this.mouseDown = false;
      }
      this.canvas.onmousemove = (e) => {
        if (!this.mouseDown) return;
        if (this.pointerType == "touch") return;
        this.updatePosition(this.getMousePositionOnCanvas(e));
      }
      this.canvas.ontouchmove = (e) => {
        if (!this.mouseDown) return;
        if (this.pointerType != "touch") return;
        this.updatePosition(this.getMousePositionOnCanvas(e));
      }
    }
    
    get xDeviceIndex() { return this.xDeviceSelect.value; }
    get xDeviceState() { return this.track.devices[this.xDeviceIndex]; }
    get xDevice() { return this.trackAudioDevices[this.xDeviceIndex]; }
    get xDeviceName() { return this.xDevice.name; }
    get xParameterName() { return this.xParameterSelect.value; }
    get xParameter() { return this.xParameterName ? this.xDevice[this.xParameterName] : null; }
    get xParameterValue() { return this.xParameter?.name ? this.xParameter.value : this.xParameter;  }
    set xParameterValue(value) { 
      if (!this.xDeviceState) return;
      
      let parts = this.xParameterName.split(".");
      let context = this.xDeviceState.parameters;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        context = context[parts[partIndex]];
      }
      context[this.xParameterName] = value;
      
      this.xParamValueOutput.innerText = value.toFixed(2);
      if (this.xParameterValue == value) return;
      
      if (this.updateDelayInSecs > 0) {
        let timestamp = Tone.now();
        if (this.xParameterUpdateTimestamp && timestamp - this.xParameterUpdateTimestamp < this.updateDelayInSecs) {
         // console.log("skipping x update", timestamp - this.xParameterUpdateTimestamp);
          return;
        }
        else {
          this.xParameterUpdateTimestamp = timestamp;
        }
      }
      
      this.updateDeviceParameter(this.xDevice, this.xParameterName, value); 
    }
    
    get yDeviceIndex() { return this.yDeviceSelect.value; }
    get yDeviceState() { return this.track.devices[this.yDeviceIndex]; }
    get yDevice() { return this.trackAudioDevices[this.yDeviceIndex]; }
    get yDeviceName() { return this.yDevice.name; }
    get yParameterName() { return this.yParameterSelect.value; }
    get yParameter() { return this.yParameterName ? this.yDevice[this.yParameterName] : null; }
    get yParameterValue() { return this.yParameter?.name ? this.yParameter.value : this.yParameter;  }
    set yParameterValue(value) { 
      if (!this.yDeviceState) return;
      
      let parts = this.yParameterName.split(".");
      let context = this.yDeviceState.parameters;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        context = context[parts[partIndex]];
      }
      context[this.yParameterName] = value;
      //this.yDeviceState.parameters[this.yParameterName] = value;
      this.yParamValueOutput.innerText = value.toFixed(2);
    
      if (this.yParameterValue == value) return;
      
      if (this.updateDelayInSecs > 0) {
        let timestamp = Tone.now();
        if (this.yParameterUpdateTimestamp && timestamp - this.yParameterUpdateTimestamp < this.updateDelayInSecs) {
         // console.log("skipping y update", timestamp - this.yParameterUpdateTimestamp);
          return;
        } 
        else {
          this.yParameterUpdateTimestamp = timestamp;
        }
      }
      this.updateDeviceParameter(this.yDevice, this.yParameterName, value); 
    }
    
    init(track) {
      console.log("XypadPanel.init", track.xyPad);
      if (this.track == track) return;

      this.track = track;
      this.trackAudioDevices = this.audio.getTrackDevices(track);
      
      let targetDeviceOptionsHtml = "<option value=''>-Select device-</option>";
      targetDeviceOptionsHtml += track.devices.map((d) => `<option value="${track.devices.indexOf(d)}">${this.helpers.toShortDeviceName(d.name)}</option>`).join("");
      this.xDeviceSelect.innerHTML = targetDeviceOptionsHtml;
      this.yDeviceSelect.innerHTML = targetDeviceOptionsHtml;
      this.xDeviceSelect.disabled = false;
      this.yDeviceSelect.disabled = false;
      
      
      this.xDeviceSelect.value = track.xyPad.xDevice;
      this.xDeviceSelected();
      this.xParameterSelect.value = track.xyPad.xParameter;
      this.xParameterSelected();
      this.yDeviceSelect.value = track.xyPad.yDevice;
      this.yDeviceSelected();
      this.yParameterSelect.value = track.xyPad.yParameter;
      this.yParameterSelected();
      this.updatePosition();
      console.log("XypadPanel.initialized", this);
    }
    
    xDeviceSelected() {
      this.track.xyPad.xDevice = this.xDeviceSelect.value;
      if (!this.xDeviceSelect.value) {
        this.xParameterSelect.innerHTML = "";
        return;
      }
      console.log("Device selected ", this.xDeviceName)
      this.xParameterSelect.innerHTML = "<option>-Select parameter-</option>";
      let deviceNumberParameters = this.metadataManager.getDeviceNumberParameters(this.xDeviceName);
      deviceNumberParameters.forEach(param => this.xParameterSelect.innerHTML += `<option value="${param.name}">${param.name}</option>`);
      this.xParameterSelect.onchange = (e) => this.xParameterSelected();
      this.xParameterSelect.disabled = false;
    }
    
    xParameterSelected() {
      console.log("xParam selected ", this.xParameterSelect.value)
      this.track.xyPad.xParameter = this.xParameterSelect.value;
      console.log("projectstate", this.track.xyPad.xParameter, projectState.tracks)
      if (!this.xParameterSelect.value) {
        this.xParameterMetadata = null;
        this.position.x = this.center.x;
      } else {
        this.xParameterMetadata = this.metadataManager.getParameter(this.xDeviceName, this.xParameterName);
        let xRange = this.xParameterMetadata.max - this.xParameterMetadata.min;
        let xOffset = (this.xParameterValue - this.xParameterMetadata.min) / xRange;
        this.position.x = xOffset * this.size.width;
      }
      this.updatePosition(this.position);
    }
    
    yDeviceSelected() {
      this.track.xyPad.yDevice = this.yDeviceSelect.value;
      if (!this.yDeviceSelect.value) {
        this.yParameterSelect.innerHTML = "";
        return;
      }
      this.yParameterSelect.innerHTML = "<option>-Select parameter-</option>";
      let deviceNumberParameters = this.metadataManager.getDeviceNumberParameters(this.yDeviceName);
      deviceNumberParameters.forEach(param => this.yParameterSelect.innerHTML += `<option value="${param.name}">${param.name}</option>`);
      this.yParameterSelect.onchange = (e) => this.yParameterSelected();
      this.yParameterSelect.disabled = false;
    }
    
    yParameterSelected() {
      console.log("yParam selected ", this.yParameterSelect.value)
      this.track.xyPad.yParameter = this.yParameterSelect.value;
      if (!this.yParameterSelect.value) {
        this.yParameterMetadata = null;
        this.position.y = this.center.y;
      } else {
        this.yParameterMetadata = this.metadataManager.getParameter(this.yDeviceName, this.yParameterName);
        let yRange = this.yParameterMetadata.max - this.yParameterMetadata.min;
        let yOffset = (this.yParameterValue - this.yParameterMetadata.min) / yRange;
        this.position.y = this.size.height - (yOffset * this.size.height);
      }
      this.updatePosition(this.position);
    }
    
    getMousePositionOnCanvas(event) {
      const clientX = event.clientX || event.touches[0].clientX;
      const clientY = event.clientY || event.touches[0].clientY;
      const { offsetLeft, offsetTop } = event.target;
      const canvasX = clientX - offsetLeft;
      const canvasY = clientY - offsetTop;
      
      return { x: canvasX, y: canvasY };
    }
    
    updatePosition(position) {
      if (position == undefined) position = this.center;
      
      position.x = this.helpers.clamp(position.x, 0, this.size.width);
      position.y = this.helpers.clamp(position.y, 0, this.size.height);
      this.position = position;
      let xNormalizedOffset = position.x / this.size.width;
      let yNormalizedOffset = (this.size.height - position.y) / this.size.height;
      
      if (this.xParameterMetadata) {
        let xParameterRange = this.xParameterMetadata.max - this.xParameterMetadata.min;
        let xParameterModulation = xParameterRange * xNormalizedOffset;
        let snapMultiplier = 1 / this.xParameterMetadata.step;
        this.xParameterValue = this.xParameterMetadata.min + (Math.round(xParameterModulation * snapMultiplier) / snapMultiplier);
      } 
      else
        this.xParamValueOutput.innerText = "0";
      
      if (this.yParameterMetadata) {
        let yParameterRange = this.yParameterMetadata.max - this.yParameterMetadata.min;
        let yParameterModulation = yParameterRange * yNormalizedOffset;
        let snapMultiplier = 1 / this.yParameterMetadata.step;
        this.yParameterValue = this.yParameterMetadata.min + (Math.round(yParameterModulation * snapMultiplier) / snapMultiplier);
      } 
      else
        this.yParamValueOutput.innerText = "0";
      window.requestAnimationFrame(() => this.draw());
    }
    
    draw() {
      this.ctx.clearRect(0,0,this.size.width,this.size.height);
      //this.drawAxis();
      this.drawCircle();
    }
    
    drawAxis() {
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(this.center.x, 0);
      this.ctx.lineTo(this.center.x, this.size.height);
      this.ctx.stroke();
      this.ctx.moveTo(0, this.center.y);
      this.ctx.lineTo(this.size.width, this.center.y);
      this.ctx.stroke();
    }
    
    drawCircle() {
      this.ctx.lineWidth = 10;
      this.ctx.beginPath();
      this.ctx.arc(this.position.x, this.position.y, 10, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.fill();
    }
    
    updateDeviceParameter(audioDevice, parameterName, value) {
      let parts = parameterName.split(".");
      let context = audioDevice;
      for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
        context = context[parts[partIndex]];
      }
      parameterName = parts[parts.length - 1];
      if (context[parameterName].name) {
        context[parameterName].cancelScheduledValues(Tone.now());
        context[parameterName].setValueAtTime(value, Constants.TONE_PARAM_SCHEDULEAHEAD);
       // audioDevice[parameterName].value = value;
      }
      else
        context[parameterName] = value;
    };
    
    
  }
  