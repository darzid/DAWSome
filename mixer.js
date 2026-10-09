class Mixer {
  _vuMetersToCreate = [];
  _masterChannel;
  _masterFaderContainer;
  _insertBefore;
    constructor(audio, state) {
      this.audio = audio;
      this.state = state;
      this.mixer = document.querySelector(".mixer");
      
      this._masterChannel = new MasterChannel(audio, state);
      
      this._masterFaderContainer = document.createElement("div");
      this._masterFaderContainer.className = "channel-fader-container master faders";
      this.mixer.appendChild(this._masterFaderContainer);
      this._insertBefore = this._masterFaderContainer;
      
      this.addFader(this._masterChannel, this._masterFaderContainer);
      this.addVuMeter(this._masterChannel, this._masterFaderContainer);
    }
    
    addReturnFader(returnChannel) {
      let faderContainer = document.createElement("div");
      faderContainer.className = "channel-fader-container return faders";
      this.mixer.insertBefore(faderContainer, this._masterFaderContainer);
      if (this._insertBefore == this._masterFaderContainer) this._insertBefore = faderContainer;
      
      
      this.addFader(returnChannel, faderContainer);
      this.addTrackMuteButton(returnChannel, faderContainer);
      this.addTrackSoloButton(returnChannel, faderContainer);
      this.addTrackEvents(returnChannel, faderContainer);
      this.addVuMeter(returnChannel, faderContainer);
      
      console.log("addReturnFader", returnChannel)
      return faderContainer;
    }
    
    addTrackFader(track) {
      let faderContainer = document.createElement("div");
      faderContainer.className = "channel-fader-container faders";
      this.mixer.insertBefore(faderContainer, this._insertBefore);
      
      this.addFader(track, faderContainer);
      
      this.addTrackMuteButton(track, faderContainer);
      this.addTrackSoloButton(track, faderContainer);
      this.addTrackSends(track, faderContainer);
      this.addTrackEvents(track, faderContainer);
      this.addVuMeter(track, faderContainer);
      return faderContainer;
    }
    
    addFader(channel, faderContainer) {
      faderContainer.innerHTML += `<label>${channel.name}</label>
        <input type="number" min="-100" max="10.0" step="0.1" value="${channel.volume}" class="channel-fader-value">
        <input id="${channel.id}-fader" type="range" min="-100" max="10.0" step="0.1" readonly="readonly" value="${channel.volume}">
        `;
      
      let fader = faderContainer.querySelector("input[type=range]");
      let faderValue = faderContainer.querySelector("input[type=number]");
      fader.oninput = ()=> {
        channel.volume = fader.value;
        faderValue.value = fader.value;
       // console.log("vol change", channel)
        document.dispatchEvent(new CustomEvent("VolumeChanged", { detail: { channelId: channel.id, volume: channel.volume }}));
      }
      
      faderValue.oninput = ()=> {
        channel.volume = faderValue.value;
        fader.value = faderValue.value;
        document.dispatchEvent(new CustomEvent("VolumeChanged", { detail: { channelId: channel.id, volume: channel.volume }}));
      }
      faderValue.ondblclick = ()=> {
        faderValue.value = 0;
        channel.volume = fader.value;
        fader.value = faderValue.value;
        console.log("dbl click vol change", channel)
        document.dispatchEvent(new CustomEvent("VolumeChanged", { detail: { channelId: channel.id, volume: channel.volume }}));
      }
    }
    
    addTrackMuteButton(track, faderContainer) {
      let muteButton = document.createElement("button");
      muteButton.id=`${track.id}-mute`;
      muteButton.innerText = "Mute";
      muteButton.className = "btn mute-button";
      faderContainer.appendChild(muteButton);
      muteButton.classList.toggle("on", track.mute);
      
      muteButton.onclick = async () => {
        let oldMute = track.mute;
        muteButton.classList.toggle("on");
        if (!muteButton.classList.contains("on")) {
          track.mute = false;
          document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: track.mute }}));
          console.log("track unmuted")
        }
        else {
          track.mute = true;
          document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: track.mute }}));
          console.log("track muted")
        }
        if (track.mute != oldMute) {
         // this.audio.updateTrack(track);
          document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: track.mute }}));
        }
      };
    }
    
    addTrackSoloButton(track, faderContainer) {
      let soloButton = document.createElement("button");
      soloButton.innerText = "Solo";
      soloButton.className = "btn cyan solo-button";
      soloButton.id=`${track.id}-solo`;
      faderContainer.appendChild(soloButton);
      
      let soloedMuteButtons = [];
      let muteButton = faderContainer.querySelector("button.mute-button");
      soloButton.onclick = async () => {
        let muteButtons = this.mixer.querySelectorAll(".mute-button");
        
        soloButton.classList.toggle("on");
        if (soloButton.classList.contains("on")) {
          track.mute = false;
          document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: false }}));
          soloedMuteButtons.push(muteButton);
        //  soloedMuteButtons = soloedMuteButtons.splice(soloedMuteButtons.indexOf(muteButton),1);
          this.state.tracks.forEach(projectTrack => {
            if (track != projectTrack) {
              projectTrack.mute = true;
            //  this.audio.updateTrack(projectTrack);
              document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: projectTrack.id, muted: true }}));
            }
          })
          muteButtons.forEach(projectMuteButton => {
            if (projectMuteButton != muteButton) {
              
              projectMuteButton.classList.add("on");
              projectMuteButton.disabled="true";
              let muteTrackId = projectMuteButton.id.replace("-mute", "");
              document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: muteTrackId, muted: true }}));
            }
          })
          
          console.log("track solod")
        }
        else {
          muteButtons.forEach(projectMuteButton => {
            projectMuteButton.disabled="";
            projectMuteButton.classList.remove("on");
            let muteTrackId = projectMuteButton.id.replace("-mute", "");
            document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: muteTrackId, muted: false }}));
          })
          
          this.state.tracks.forEach(projectTrack => {
            if (track != projectTrack) {
              projectTrack.mute = false;
            //  this.audio.updateTrack(projectTrack);
              document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: projectTrack.id, muted: false }}));
            }
          })
          muteButtons.forEach(projectMuteButton => {
            //if (projectMuteButton != muteButton) {
            
              let projectSoloButton = document.getElementById(projectMuteButton.id.replace("mute", "solo"));
              if (!projectSoloButton.classList.contains("on")) {
                projectMuteButton.disabled="";
                projectMuteButton.classList.remove("on");
               // let muteTrack = this.state.tracks.find(track => track.id == projectMuteButton.id.replace("-mute", ""));
                //this.audio.updateTrack(muteTrack);
                let muteTrackId = projectMuteButton.id.replace("-mute", "");
                document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: muteTrackId, muted: false }}));

              }
           // }
            console.log("soloed", soloedMuteButtons)
          })
          muteButton.classList.remove("on");
        
          console.log("track unsolod")
        }
      };
    }

    addTrackSends(track, faderContainer) {
      let sendSelect = document.createElement("select");
      sendSelect.id = `${track.id}-sendselect`;
      sendSelect.className = "send";
      const returnChannels = this.audio.getReturnChannels();
      console.log("ret channels", returnChannels);
      sendSelect.innerHTML = "<option value=''>-Send-</option>";
      returnChannels.forEach(returnChannel => sendSelect.innerHTML += `<option value="${returnChannel.name}">${returnChannel.name}</option>`);
      faderContainer.appendChild(sendSelect);
      
      const updateSendInput = () => {
        if (track.sends[0]) {
          sendAmountInput.value = track.sends[0].volume;
          sendAmountInput.style.opacity = 1;
        }
        else {
          sendAmountInput.style.opacity  = 0;
          sendAmountInput.value = "";
        }
      };
      
      sendSelect.onchange = () => {
        if (!track.sends) track.sends = [];
        
        if (!sendSelect.value)
          track.sends = [];
        else 
          track.sends[0] = { name: sendSelect.value, volume: 0 };
        document.dispatchEvent(new CustomEvent("SendChanged", { detail: { trackId: track.id, sends: track.sends }}));
        updateSendInput();
      }
      if (track.sends[0]) sendSelect.value = track.sends[0].name;
      
      let sendAmountInput = document.createElement("number-input");
      //sendAmountInput.type = "number";
      sendAmountInput.min = "-100";
      sendAmountInput.max = 10;
      sendAmountInput.step = 0.1;
      sendAmountInput.id = `${track.id}-sendamount`;
      sendAmountInput.className = "send-amount";

      faderContainer.appendChild(sendAmountInput);
      
      updateSendInput();
    }
    
    addTrackEvents(track, faderContainer) {
      document.addEventListener("TrackRemoved", (e) => {
        if (e.detail.trackId !== track.id) return;
        console.log("Track removed", e.detail)
        this.mixer.removeChild(faderContainer);
      })
      document.addEventListener("TrackNameChanged", (e) => {
        if (e.detail.trackId !== track.id) return;
        console.log("Trackname changed", e.detail)
        faderContainer.querySelector("label").innerText = e.detail.trackName;
      })
      document.addEventListener("MuteChanged", (e) => {
        if (e.detail.trackId !== track.id) return;
        console.log("Mute changed", e.detail)
        let muteButton = faderContainer.querySelector("button.mute-button");
        muteButton.classList.toggle("on", e.detail.muted);
      })
    }
    
    addVuMeter(channel, faderContainer) {
      let faderMeterCanvas = document.createElement("canvas");
      faderMeterCanvas.className = "vu-meter";
      faderMeterCanvas.width = "5";
      faderMeterCanvas.height = "100";
      faderMeterCanvas.dataset.val = 400;
      faderMeterCanvas.dataset.channelName = channel.name;
      faderContainer.after(faderMeterCanvas);
      /*if (faderContainer !== this._insertBefore)
        this.mixer.insertBefore(faderMeterCanvas, this._insertBefore);
      else
        this.mixer.appendChild(faderMeterCanvas);*/
        
      let chain = this.audio.getChain(channel.id);
      levelMeterManager.register(chain.channel.output, faderMeterCanvas, this.mixer);
    }
    
    removeTrackFader() {}
  }
  
  class MasterChannel {
    constructor(audio, state) {
      this.audio = audio;
      this.state = state;
      this.chain = audio.getChain(this.id);
    }
    
    get id() { return 0; }
    get name() { return "Master"; }
    
    get volume() { return this.state.masterVolume; }
    set volume(value) { 
      this.state.masterVolume = value;
      this.chain.channel.volume.value = value;
    }
  }