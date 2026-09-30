class Mixer {
    constructor(audio, state) {
      this.audio = audio;
      this.state = state;
      this.mixer = document.querySelector(".mixer");
    }
    
    addTrackFader(track) {
      try {
        
      
      let faderContainer = document.createElement("div");
      faderContainer.className = "track-fader-container faders";
      this.mixer.appendChild(faderContainer);
      
    
      faderContainer.innerHTML += `<label>${track.name}</label>
        <input type="number" min="-500" max="0.0" step="0.1" value="${track.volume}" class="track-fader-value" />
        <input id="${track.id}-fader" type="range" min="-500" max="0.0" step="0.1" value="${track.volume}" />`;
        
      let faderInput = faderContainer.querySelector("input[type=range]");
      let faderValue = faderContainer.querySelector("input[type=number]");
      faderInput.oninput = ()=> {
        track.volume = faderInput.value;
        faderValue.value = faderInput.value;
        this.audio.updateTrack(track);
      }
      faderValue.oninput = ()=> {
        track.volume = faderValue.value;
        faderInput.value = faderValue.value;
        this.audio.updateTrack(track);
      }
      console.log("track vol", track)
      
      let muteButton = document.createElement("button");
      muteButton.id=`${track.id}-mute`;
      muteButton.innerText = "Mute";
      muteButton.className = "btn mute-button";
      faderContainer.appendChild(muteButton);
      muteButton.classList.toggle("on", track.mute);
      
      let soloedMuteButtons = [];
      muteButton.onclick = async () => {
        let oldMute = track.mute;
        muteButton.classList.toggle("on");
        if (!muteButton.classList.contains("on")) {
          track.mute = false;
          console.log("track unmuted")
        }
        else {
          track.mute = true;
          console.log("track muted")
        }
        if (track.mute != oldMute) {
          this.audio.updateTrack(track);
          document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: track.mute }}));
        }
      };
      
      document.addEventListener("MuteChanged", (e) => {
        if (e.detail.trackId !== track.id) return;
        console.log("Mute changed", e.detail)
        muteButton.classList.toggle("on", e.detail.muted);
      })
      
      let soloButton = document.createElement("button");
      soloButton.innerText = "Solo";
      soloButton.className = "btn cyan solo-button";
      soloButton.id=`${track.id}-solo`;
      faderContainer.appendChild(soloButton);
      soloButton.onclick = async () => {
        let muteButtons = this.mixer.querySelectorAll(".mute-button");
        
        soloButton.classList.toggle("on");
        if (soloButton.classList.contains("on")) {
          track.mute = false;
        
          soloedMuteButtons.push(muteButton);
        //  soloedMuteButtons = soloedMuteButtons.splice(soloedMuteButtons.indexOf(muteButton),1);
          this.state.tracks.forEach(projectTrack => {
            if (track != projectTrack) {
              projectTrack.mute = true;
              this.audio.updateTrack(projectTrack);
              document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: projectTrack.id, muted: true }}));
            }
          })
          muteButtons.forEach(projectMuteButton => {
            if (projectMuteButton != muteButton) {
              
              projectMuteButton.classList.add("on");
              projectMuteButton.disabled="true";
            }
          })
          
          console.log("track solod")
        }
        else {
          muteButtons.forEach(projectMuteButton => {
            projectMuteButton.disabled="";
            projectMuteButton.classList.remove("on");
          })
          
          this.state.tracks.forEach(projectTrack => {
            if (track != projectTrack) {
              projectTrack.mute = false;
              this.audio.updateTrack(projectTrack);
              document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: projectTrack.id, muted: false }}));
            }
          })
          muteButtons.forEach(projectMuteButton => {
            //if (projectMuteButton != muteButton) {
            
              let projectSoloButton = document.getElementById(projectMuteButton.id.replace("mute", "solo"));
              if (!projectSoloButton.classList.contains("on")) {
                projectMuteButton.disabled="";
                projectMuteButton.classList.remove("on");
                let muteTrack = this.state.tracks.find(track => track.id == projectMuteButton.id.replace("-mute", ""));
                this.audio.updateTrack(muteTrack);
              }
           // }
            console.log("soloed", soloedMuteButtons)
          })
          muteButton.classList.remove("on");
        
          console.log("track unsolod")
        }
        this.audio.updateTrack(track);
      };
      }
      catch (error) {
        console.log("AddTrackFader: " + error);
      }
    }
    
    removeTrackFader(track) {
      
    }
  }
  