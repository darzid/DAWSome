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
  constructor(audioNode, meterCanvasElement, vuMeter) {
    this.audioNode = audioNode;
    this.meterCanvasElement = meterCanvasElement;
    this.vuMeter = vuMeter;
    this.analyser = new Tone.Analyser();
    console.log("audionode", audioNode)
    audioNode.connect(this.analyser);
  }

  update() {
    if (!this.isVisible()) {
      console.log("Skipping collapsed meter", this.meterCanvasElement);
      return;
    }

    let values = this.analyser.getValue();
   // console.log("value", values)
    
    let sumSquares = 0.0;
    for (const amplitude of values) { sumSquares += amplitude * amplitude; }
    let value = Math.sqrt(sumSquares / values.length) * 1;
    value = Math.abs(Math.round(value * 1000) / 1000);

   // if (parseFloat(this.meterCanvasElement.getAttribute("data-val")) != value) {
      this.meterCanvasElement.setAttribute("data-val", value);
      this.vuMeter.draw();
    //}

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