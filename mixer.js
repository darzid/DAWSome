class Mixer {
  _vuMetersToCreate = [];
  _masterChannel;
  _masterFaderContainer;
    constructor(audio, state) {
      this.audio = audio;
      this.state = state;
      this.mixer = document.querySelector(".mixer");
      
      this._masterChannel = new MasterChannel(audio, state);
      
      this._masterFaderContainer = document.createElement("div");
      this._masterFaderContainer.className = "channel-fader-container faders";
      this.mixer.appendChild(this._masterFaderContainer);
      
      this.addFader(this._masterChannel, this._masterFaderContainer);
      this.addVuMeter(this._masterChannel, this._masterFaderContainer);
    }
    
    addTrackFader(track) {
      let faderContainer = document.createElement("div");
      faderContainer.className = "channel-fader-container faders";
      this.mixer.insertBefore(faderContainer, this._masterFaderContainer);
      
      this.addFader(track, faderContainer);
      this.addTrackMuteButton(track, faderContainer);
      this.addTrackSoloButton(track, faderContainer);
      this.addTrackEvents(track, faderContainer);
      this.addVuMeter(track, faderContainer);
      return faderContainer;
    }
    
    addFader(channel, faderContainer) {
      faderContainer.innerHTML += `<label>${channel.name}</label>
        <input type="number" min="-500" max="0.0" step="0.1" value="${channel.volume}" class="channel-fader-value">
        <input id="${channel.id}-fader" type="range" min="-500" max="0.0" step="0.1" value="${channel.volume}">
        `;
      
      let faderInput = faderContainer.querySelector("input[type=range]");
      let faderValue = faderContainer.querySelector("input[type=number]");
      faderInput.oninput = ()=> {
        channel.volume = faderInput.value;
        faderValue.value = faderInput.value;
        document.dispatchEvent(new CustomEvent("VolumeChanged", { detail: { channelId: channel.id, volume: channel.volume }}));
      }
      faderValue.oninput = ()=> {
        channel.volume = faderValue.value;
        faderInput.value = faderValue.value;
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
      if (faderContainer !== this._masterFaderContainer)
        this.mixer.insertBefore(faderMeterCanvas, this._masterFaderContainer);
      else
        this.mixer.appendChild(faderMeterCanvas);
        
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