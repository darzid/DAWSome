class TB303ViewModel extends CustomDeviceViewModel {
  knobs = {};
  waveformButtons = {};
    
  constructor() {
    super("DAWSome.TB303");
    this.init();
  }
  
  init() {
    super.init();
    
    this.knobs.cutoff = new TB303Knob('knob-cutoff', 100, 8000, (val) => {
      this.state.cutoff = val;
      this.device.cutoff = val;
      document.getElementById('val-cutoff').textContent = `${Math.round(val)} Hz`;
    });
      
    this.knobs.resonance = new TB303Knob('knob-reso', 1, 20, (val) => {
      this.state.resonance = val;
      this.device.resonance.value = val;
      document.getElementById('val-reso').textContent = parseFloat(val).toFixed(1);
    });

    this.knobs.envelopeModulation = new TB303Knob('knob-envmod', 0, 1, (val) => {
      this.state.envelopeModulation = val;
      this.device.envelopeModulation = val;
      document.getElementById('val-envmod').textContent = `${Math.round(val * 100)}%`;
    });
  
    this.knobs.decay = new TB303Knob('knob-decay', 0.1, 1.2, (val) => {
      this.state.decay = val;
      this.device.decay = val;
      document.getElementById('val-decay').textContent = `${Math.round(val * 1000)}ms`;
    });
  
    this.knobs.accent = new TB303Knob('knob-accent', 0, 1, (val) => {
      this.state.accent = val;
      this.device.accent = val;
      document.getElementById('val-accent').textContent = `${Math.round(val * 100)}%`;
    });
  
    this.knobs.drive = new TB303Knob('knob-drive', 0.1, 1.2, (val) => {
      this.state.drive = val;
      this.device.drive = val;
      document.getElementById('val-drive').textContent = `${Math.round(val * 100)}%`;
    });
    
    this.waveformButtons.saw = document.getElementById("wave-saw");
    this.waveformButtons.saw.onclick = ()=> {
      this.state.waveform = "sawtooth";
      this.device.waveform = "sawtooth";
      this.updateWaveformButtons();
    }
    this.waveformButtons.square = document.getElementById("wave-sqr");
    this.waveformButtons.square.onclick = ()=> {
      this.state.waveform = "square";
      this.device.waveform = "square";
      this.updateWaveformButtons();
    }
  }
    
  attach(device, state) {
    super.attach(device, state);
    
    this.device = device;
    this.state = state;
    
    this.knobs.cutoff.value = this.device.cutoff;
    this.knobs.resonance.value = this.device.resonance.value;
    this.knobs.envelopeModulation.value = this.device.envelopeModulation;
    this.knobs.decay.value = this.device.decay;
    this.knobs.accent.value = this.device.accent;
    this.knobs.drive.value = this.device.drive;
    this.updateWaveformButtons();
  }
  
  updateWaveformButtons() {
    this.waveformButtons.square.classList.toggle("active-led", this.device.waveform == "sawtooth");
    this.waveformButtons.saw.classList.toggle("active-led", this.device.waveform == "square");
  }
}


class TB303Knob {
  constructor(id, min, max, onChange) {
    
    this.id = id;
    this.min = min;
    this.max = max;
    this.range = max - min;
    this.onChange = onChange;
      
    this.knob = document.getElementById(id);
    this.knob.dataset.value = 0;
    this.isDragging = false;
    this.startY = 0;
      
    this.knob.addEventListener('pointerdown', (e) => this.onPointerDown(e));
  }
  
  get value() { return parseFloat(this.knob.dataset.value); }
  set value(value) { 
    this.knob.dataset.value = value; 
    this.updateRotation();
    this.onChange(value);
  }
  
  get normalizedValue() { return (this.value - this.min) / this.range; }
  set normalizedValue(value) { this.value = this.min + (value * this.range); }
  
  get angle() { return -135 + (this.normalizedValue * 270); }
  
  updateRotation() {
    this.knob.style.transform = `rotate(${this.angle}deg)`;
  }
    
  onPointerDown(e) {
    this.isDragging = true;
    this.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    document.addEventListener('pointermove', (e) => this.onPointerMove(e));
    document.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  onPointerMove(e) {
    if (!this.isDragging) return;
    const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    const deltaY = this.startY - currentY;
    this.startY = currentY;

    this.normalizedValue = Math.min(1, Math.max(0, this.normalizedValue + deltaY * 0.008));
    this.updateRotation();
    this.onChange(this.value);
  }

  onPointerUp() {
    this.isDragging = false;
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
  }
}
