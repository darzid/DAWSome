export class TB303  {
    constructor(parameters) {
      
     // console.log("Tb303 create")
      if (!parameters) parameters = {};
      if (parameters.cutoff == undefined) parameters.cutoff = 400;
      if (parameters.resonance == undefined) parameters.resonance = 7;
      if (parameters.envelopeModulation == undefined) parameters.envelopeModulation = 0.6;
      if (parameters.decay == undefined) parameters.decay = 0.3;
      if (parameters.accent == undefined) parameters.accent = 0.8;
      if (parameters.drive == undefined) parameters.drive = 0.35;
      if (parameters.waveform == undefined) parameters.waveform = "sawtooth";
      if (parameters.volume == undefined) parameters.volume = 0;
      
      this._monoSynth = new Tone.MonoSynth({
        portamento: 0.08,
        volume: 0,
        oscillator: {
          type: "sawtooth"
        },
        envelope: {
          attack: 0.005,
          decay: 0.2,
          sustain: 0,
          release: 0.1
        },
        filter: {
          Q: 6, 
          type: "lowpass",
          rolloff: -24 
        },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.25,
          sustain: 0.0,
          release: 0.2,
          baseFrequency: 400,
          octaves: 4.5,
          exponent: 2
        }
      });
      this._distortion = new Tone.Distortion({
        distortion: 0.35,
        wet: 0.6
      });
      this._monoSynth.connect(this._distortion);
      
      this.cutoff = parameters.cutoff;
      this.resonance = parameters.resonance;
      this.envelopeModulation = parameters.envelopeModulation;
      this.decay = parameters.decay;
      this.accent = parameters.accent;
      this.drive = parameters.drive;
      this.waveform = parameters.waveform;
      this.volume = parameters.volume;
      console.log("Tb303 created")
    }
       
    get name() { return "DAWSome.TB303"; }
    
    get cutoff() { return this._monoSynth.filterEnvelope.baseFrequency; }
    set cutoff(value) { this._monoSynth.filterEnvelope.baseFrequency = value; }
        
    get resonance() { return this._monoSynth.filter.Q; }
    set resonance(value) { this._monoSynth.filter.Q.value = value; }
        
    get envelopeModulation() { return this._envelopeModulation; }
    set envelopeModulation(value) { 
      if (value < 0 || value > 1) throw "Envelope modulation must be between 0 and 1";
      this._envelopeModulation = value;
    }
           
    get decay() { return this._decay; }
    set decay(value) { 
      if (value < 0 || value > 1.2) throw "Decay must be between 0 and 1.2";
      this._decay = value; 
    }
        
    get accent() { return this._accent; }
    set accent(value) { 
      if (value < 0 || value > 1) throw "Accent must be between 0 and 1";
      this._accent = value;
    }
        
    get drive() { return this._distortion.distortion; }
    set drive(value) {
      if (value < 0 || value > 1) throw "Drive must be between 0 and 1";
      this._distortion.distortion = value;
    }
        
    get waveform() { return this._monoSynth.oscillator.type; }
    set waveform(value) {
      if (value !== "sawtooth" && value != "square") throw "Waveform must be 'sawtooth' or 'square'";
      this._monoSynth.oscillator.type = value;
    }
        
    get volume() { return this._volume; }
    set volume(value) {
      if (value < -100 || value > 0) throw "Volume must be between -100 and 0";
      this._volume = value;
    }
        
    get output() { return this._distortion; }
    
    // Koppel direct aan de eindbestemming (speakers)
    toDestination() {
      this.output.toDestination();
      return this;
    }
    
    connect(destination) {
      this.output.connect(destination);
    }
    
    triggerAttack(note = "C1", time = 0, velocity = 1, slide = false) {
      this._prepareNote(time, velocity, slide);
      this._monoSynth.triggerAttack(note, time, velocity);
    }
    
    triggerRelease(time) {
      this._monoSynth.triggerRelease(time);
    }
    
    triggerAttackRelease(note = "C1", duration = "16n", time = 0, velocity = 1, slide = false) {
      this._prepareNote(time, velocity, slide)
      this._monoSynth.triggerAttackRelease(note, duration, time, velocity);
    }
    
    dispose() {
      this._monoSynth.dispose();
      this._distortion.dispose();
    }
    
    _prepareNote(time, velocity, slide) {
      if (velocity == 1) {
       // console.log("Accent")
        this._monoSynth.volume.setValueAtTime(this.volume, time);
        this._monoSynth.filterEnvelope.octaves = this.envelopeModulation * 7.5 * this.accent;
        this._monoSynth.envelope.decay = this.decay * 0.7; 
      } else {
        //console.log("Default")
        this._monoSynth.volume.setValueAtTime(this.volume - 4, time);
        this._monoSynth.filterEnvelope.octaves = this.envelopeModulation * 4.5;
        this._monoSynth.envelope.decay = this.decay;
      }
           
      if (slide) {
      //  console.log("Slide")
        this._monoSynth.portamento = 0.08;
      } else {
        this._monoSynth.portamento = 0;
      }
    }
  }
  
export class TR909Snare {
    constructor(options = {}) {
      // 1. De Body (de toon / ketel van de snare, meestal rond G2 / F#2)
      this.bodySynth = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 3,
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.001,
          decay: 0.18,
          sustain: 0,
          release: 0.1
        }
      });
      
      // 2. De Snappy (de ruis / matjes onder de snare)
      this.noiseSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: {
          attack: 0.001,
          decay: 0.15,
          sustain: 0,
          release: 0.1
        }
      });
      
      // Optioneel: een filter om de ruis wat warmer/minder scherp te maken (typisch 909)
      this.filter = new Tone.Filter({
        frequency: 2500,
        type: "highpass"
      });
      
      // Master kanaal voor deze snare om volumes te balanceren
      this.output = new Tone.Channel({
        volume: options.volume || 0,
        pan: options.pan || 0
      });
      
      // Routing koppelen
      this.bodySynth.connect(this.output);
      this.noiseSynth.connect(this.filter);
      this.filter.connect(this.output);
    }
    
    get name() { return "DAWSome.TR909Snare"}
    get volume() { return this.output.volume; }
    set volume(value) {
      if (value < -100 || value > 0) throw "Volume must be between -100 and 0";
      this.output.volume.value = value;
    }
    
    // Koppel direct aan de eindbestemming (speakers)
    toDestination() {
      this.output.toDestination();
      return this;
    }
    
    // Ondersteuning voor standaard Tone.js routing
    connect(destination) {
      this.output.connect(destination);
      return this;
    }
    
    // Trigger methode die beide componenten tegelijk aanstuurt
    triggerAttackRelease(note = "G2", duration = "16n", time = Tone.now(),
      velocity = 1) {
      // Speel de toonhoogte voor de body af
      this.bodySynth.triggerAttackRelease(note, duration, time, velocity);
      
      // Start de ruis exact op hetzelfde moment
      this.noiseSynth.triggerAttackRelease(duration, time, velocity);
    }
    
    triggerRelease( time = Tone.now()) {
      // Speel de toonhoogte voor de body af
      this.bodySynth.triggerRelease(time);
      
      // Start de ruis exact op hetzelfde moment
      this.noiseSynth.triggerRelease(time);
    }
    
    // Netjes opruimen (handig tegen memory leaks!)
    dispose() {
      this.bodySynth.dispose();
      this.noiseSynth.dispose();
      this.filter.dispose();
      this.output.dispose();
    }
  }