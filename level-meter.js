class LevelMeterManager {
  meters = [];

  register(audioNode, meterCanvasElement) {
    console.log("Register " + meterCanvasElement.getAttribute("name"), meterCanvasElement.parentElement.parentElement);
    if (!meterCanvasElement.width) {
      console.error("Element doesnt have width");
    }

    let vuMeter = new VuMeter(meterCanvasElement, {
      "boxCount": 15,
      "boxGapFraction": 0.1,
      "max": 100,
    });
    let levelMeter = new LevelMeter(audioNode, meterCanvasElement, vuMeter);
    this.meters.push(levelMeter);
    
    if (this.meters.length == 1) {
      this.updateMeters();
    }

    return levelMeter.analyser;
  }

  updateMeters() {
    this.meters.forEach((meter) => meter.update());
    window.requestAnimationFrame(() => this.updateMeters());
  }
}

const levelMeterManager = new LevelMeterManager();

class LevelMeter {
  _maxValue = null;
  constructor(audioNode, meterCanvasElement, vuMeter) {
    this.audioNode = audioNode;
    this.meterCanvasElement = meterCanvasElement;
    this.vuMeter = vuMeter;
    this.meter = new Tone.Meter();
    audioNode.connect(this.meter);
  }

  update() {
    if (!this.isVisible()) {
      console.log("Skipping collapsed meter", this.meterCanvasElement);
      return;
    }
    
    // 100 = vol rood
    // 80 = vol oranje
    // 60 = vol groen
    
    
    let rawValueInDb = this.meter.getValue(); // in decibels
    let transposedValue = rawValueInDb + 80; // 0db -> 80 = vol oranje
    let roundedValue = parseInt(Math.round(transposedValue)).toString();
    
    if (this._maxValue == null || this._maxValue < rawValueInDb)
    {
      this._maxValue = rawValueInDb;
      //console.log(`"${this.meterCanvasElement.dataset.trackName}" peak ${rawValueInDb.toFixed(1)} db, transposed ${roundedValue}`);
    }
    
    if (isNaN(roundedValue)) {
      return;
    }
    let value = roundedValue;
    /*let value = Math.round((rawValue + 100) * 1);

    if (value == undefined) return;
    let stringValue = parseInt(value).toString();
    if (isNaN(stringValue)) return;*/
    
    if (this.meterCanvasElement.getAttribute("data-val") != value) {
      this.meterCanvasElement.setAttribute("data-val", value);
      this.vuMeter.draw();
    }

    let peak = value;
    if (this.meterCanvasElement.getAttribute("data-peak")) {
      let peakTime = this.meterCanvasElement.getAttribute("data-peaktime");
      if (Tone.now().currentTime - peakTime < 10) {
        let lastPeak = parseFloat(this.meterCanvasElement.getAttribute("data-peak"));
        if (peak < lastPeak) {
          peak = lastPeak;
        } else {
          this.meterCanvasElement.setAttribute("data-peak", peak);
          this.meterCanvasElement.setAttribute("data-peaktime", Tone.now());
        }
      }
    }
    else {
      this.meterCanvasElement.setAttribute("data-peak", peak);
      this.meterCanvasElement.setAttribute("data-peaktime", Tone.now());
    }
    this.meterCanvasElement.title = `Peak=${peak}, Value=${value}`;
  }

  isVisible() {
    /*if (this.meterCanvasElement.offsetParent != null)
      return true;
    else {
      //consoleLog("not visible", this.meterCanvasElement)
      return false;
    }*/

    return true;
    
    let ancestor = this.meterCanvasElement.parentElement;
    while (ancestor) {
      if (ancestor.classList.contains("collapsed"))
        return false;
      if (!ancestor.classList.contains("Track"))
        ancestor = ancestor.parentElement;
      else {
        return true;
      }
    }

    return true;
  }
}