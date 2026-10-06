class VuMeter {
    constructor(elem, config) {
        this._elem = elem;
        
        // Settings
        this._max             = config.max || 500;
        this._boxCount        = config.boxCount || 10;
        this._boxCountRed     = config.boxCountRed || 2;
        this._boxCountYellow  = config.boxCountYellow || 3;
        this._boxGapFraction  = config.boxGapFraction || 0.2;
        this._jitter          = config.jitter || 0.02;
    
        // Colours
        // PrimaryOn = 255, Off = 64
        this._redOn     = 'rgba( 20,  20, 255, 0.6)'; //'rgba(255,  47,  30, 0.6)';
        this._redOff    = 'rgba( 10,  10,  64, 0.2)'; //''rgba( 64,  12,   8, 0.2)';
        
        this._yellowOn  = 'rgba(255, 215,   5, 0.6)';
        this._yellowOff = 'rgba(120,  90,   0, 0.2)';
        
        this._greenOn   = 'rgba(190, 140,  50, 0.6)'; //'rgba( 53, 255,  30, 0.6)';
        this._greenOff  = 'rgba( 80,  40,  10, 0.2)'; // 'rgba( 64,  32,   8, 0.6)'; //'rgba(13,64,8,0.2)';
    
        // Derived and starting values
        this._width = elem.width;
        this._height = elem.height;
        this._curVal = 0;
    
        // Gap between boxes and box height
        this._boxHeight = this._height / (this._boxCount + (this._boxCount+1) * this._boxGapFraction);
        this._boxGapY = this._boxHeight * this._boxGapFraction;
    
        this._boxWidth = this._width - (this._boxGapY * 2);
        this._boxGapX = (this._width - this._boxWidth) / 2;
    
        // Canvas starting state
        this._c = this._elem.getContext('2d');
    }
    
    draw() {
        var targetVal = parseInt(this._elem.dataset.val, 10);
      
        // Gradual approach
        if (this._curVal <= targetVal) {
          this._curVal += (targetVal - this._curVal) / 5;
        } else {
          this._curVal -= (this._curVal - targetVal) / 5;
        }
        
        // Apply jitter
        if (this._jitter > 0 && this._curVal > 0) {
          var amount = (Math.random() * this._jitter * this._max);
          if (Math.random() > 0.5) {
            amount = -amount;
          }
          this._curVal += amount;
        }
        if (this._curVal < 0) {
          this._curVal = 0;
        }
        
        let c = this._c;
        c.save();
        c.beginPath();
        c.rect(0, 0, this._width, this._height);
        c.fillStyle = 'rgba(255, 251, 243, 0.85)'; //'rgba(32,32,32, 0.1)';
        c.fill();
        c.restore();
        this.drawBoxes(c, this._curVal);
    }
    
    drawBoxes(c, val) {
        c.save();
        c.translate(this._boxGapX, this._boxGapY);
        for (var i = 0; i < this._boxCount; i++) {
          var id = this.getId(i);
          
          c.beginPath();
          if (this.isOn(id, val)) {
            c.shadowBlur = 10;
            c.shadowColor = this.getBoxColor(id, val);
          }
          c.rect(0, 0, this._boxWidth, this._boxHeight);
          c.fillStyle = this.getBoxColor(id, val);
          c.fill();
          c.translate(0, this._boxHeight + this._boxGapY);
        }
        c.restore();
    }
    
    getBoxColor(id, val) {
        // on colours
        if (id > this._boxCount - this._boxCountRed) {
          return this.isOn(id, val) ? this._redOn : this._redOff;
        }
        if (id > this._boxCount - this._boxCountRed - this._boxCountYellow) {
          return this.isOn(id, val) ? this._yellowOn : this._yellowOff;
        }
        return this.isOn(id, val) ? this._greenOn : this._greenOff;
    }
    
    getId(index) {
        // The ids are flipped, so zero is at the top and
        // boxCount-1 is at the bottom. The values work
        // the other way around, so align them first to
        // make things easier to think about.
        return Math.abs(index - (this._boxCount - 1)) + 1;
    }
    
    isOn(id, val) {
        // We need to scale the input value (0-max)
        // so that it fits into the number of boxes
        var maxOn = Math.ceil((val / this._max) * this._boxCount);
        return (id <= maxOn);
    }
}

