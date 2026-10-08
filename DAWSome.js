(async () => {
  let toneInitialized = false;
  let toneLookAhead = 0.15;

  let swRegistration = null;

  if (location.origin !== "file://") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("./service-worker.js")
        .then((reg) => {
          swRegistration = reg;
        });
    }
  }

  // ===== Constants =====
  const Constants = {
    PITCH_COUNT: 128,
    TOP_PITCH: 127,
    BEATS_PER_BAR: 4,                 // fixed 4/4
    NOTE_NAMES: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    BLACK_KEYS: new Set([1, 3, 6, 8, 10]),
    DEFAULT_VELOCITY: 0.75,
    ACCENT_VELOCITY: 1.0,
    MIN_FREE_DURATION: 1 / 16,
    EPS: 1e-6,
    DRAG_THRESHOLD: 4,
    TAP_SLOP: 8,
    ZOOM_BUTTON_FACTOR: 1.25,
    MIN_SONG_BEATS: 16,
    SONG_TAIL_BEATS: 16,              // empty space kept after the last clip

    FIXED_GRIDS: { "1bar": 4, "1/2": 2, "1/4": 1, "1/8": 0.5, "1/16": 0.25, "1/32": 0.125 },
    ADAPTIVE_MIN_PX: { widest: 96, wide: 48, medium: 24, narrow: 12, narrowest: 6 },
    ADAPTIVE_STEPS: [4, 2, 1, 0.5, 0.25, 0.125, 0.0625],
    STEP_LABELS: new Map([[4, "1 Bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"], [0.125, "1/32"], [0.0625, "1/64"]]),
    TRACK_COLORS: ["#f2b544", "#5fc9d8", "#e07a7a", "#9bd76e", "#c58cf0", "#f08c4a", "#7ea6f0", "#e6d35a"],

    DEFAULT_INSTRUMENT: {
      name: "MonoSynth",
      type: "Instrument",
      parameters: {
        "volume": 0,
        "portamento": 0,
        "oscillator": {
          "type": "sawtooth"
        }
      }
    },
    COLORS: {
      void: "#141414", rowWhite: "#262626", rowBlack: "#1e1e1e", octaveLine: "#3a3a3a",
      laneA: "#222222", laneB: "#1f1f1f", laneLine: "#2e2e2e",
      lineSub: "#2e2e2e", lineBeat: "#3d3d3d", lineBar: "#5a5a5a",
      regionShade: "rgba(0, 0, 0, 0.4)", regionEdge: "#707070",
      note: "#f2b544", noteBorder: "#7a5312", noteSelected: "#fff1c9",
      accentNote: "#f244b5", accentNoteSelected: "#ffc9f1",
      slideNoteBorder: "#0000ff",
      playhead: "#ececec", ruler: "#262626", rulerRegion: "#333333", rulerTick: "#5c5c5c", rulerText: "#c0c0c0",
      keyWhite: "#d8d8d8", keyBlack: "#1a1a1a", keyBorder: "#a9a9a9", keyActive: "#f2b544",
      keyTextDark: "#333333", keyTextLight: "#b0b0b0",
      clipText: "#1a1a1a", clipNote: "rgba(0, 0, 0, 0.55)", clipRepeatNote: "rgba(0,0,0, 0.35)", clipSelected: "#ffffff", message: "#777777",
    }
  }
  
  // ===== State =====
  var projectState = {
    name: "DemoProject",
    masterVolume: 0,
    bpm: 130,
    loop: true,
    loopLength: 16,
    follow: true,
    drawClips: false,
    playing: false,
    playheadBeat: 0,
    tracks: [],          // { id, name, color, instrument, mute }
    clips: [],           // { id, trackId, name, start, length (beats), notes: [{ id, pitch, start, duration, velocity }] }
    sends: [],
    nextId: 1,
    selectedTrackId: null,
    selectedClipId: null,
  };
  const ed = {           // clip-editor settings
    gridMode: "medium", triplet: false, accent: false, slide: false, snap: true, loop: true, drawMode: true,
    lastDuration: 0.25, selected: new Set(), activeKey: null,
  };
  
  var deviceList = null;
  var instrumentNames = [];
  var effectNames = [];
  var instrumentPresetNames = [];
  var instrumentPresets = {};
  var effectPresetNames = [];
  var effectPresets = {};
  var modulatorNames = ["LFO"];
  var modulatorPresets = {};
  var presets = null;

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);
  const dom = {
    projectName: $("project-name"),
    play: $("playBtn"), pos: $("posReadout"), bpm: $("bpmInput"), songLoopLength: $("songLenInput"), loop: $("loopBtn"), follow: $("followBtn"), drawClips: $("drawClipsBtn"),
    importBtn: $("importBtn"), midiFile: $("midiFile"), addTrack: $("addTrackBtn"), addClip: $("addClipBtn"),
    dupClip: $("dupClipBtn"), delClip: $("delClipBtn"),
    loadBtn: $("loadBtn"), projectFile: $("projectFile"), saveBtn: $("saveBtn"),
    trackHeadersWrap: $("trackHeadersWrap"), trackHeaders: $("trackHeaders"),
    clipTitle: $("clipTitle"), len: $("lenInput"), loopClip: $("loopClipBtn"), end: $("endInput"), gridSelect: $("gridSelect"), triplet: $("tripletBtn"),
    snap: $("snapBtn"), gridReadout: $("gridReadout"), draw: $("drawBtn"), clear: $("clearBtn"), accent: $("accentBtn"), slide: $("slideBtn"),
    edKeysWrap: $("edKeysWrap"), edKeysCanvas: $("edKeysCanvas"), hint: $("hint"),
    
    clipEditorTabBtn: $("clip-editor-tab-button"), 
    instrumentTabBtn: $("instrument-panel-tab-button"), 
    effectsTabBtn: $("effects-panel-tab-button"), 
    modulationTabBtn: $("modulation-panel-tab-button"), 
    xypadTabBtn: $("xypad-panel-tab-button"),
    mixerTabBtn: $("mixer-tab-button"),
  };

  function gridStep(mode, triplet, pxPerBeat) {
    if (mode === "off") return { step: null, label: "Off" };
    let base = Constants.FIXED_GRIDS[mode];
    if (base === undefined) {
      const minPx = Constants.ADAPTIVE_MIN_PX[mode];
      const scale = triplet ? 2 / 3 : 1;
      base = Constants.ADAPTIVE_STEPS[0];
      for (const step of Constants.ADAPTIVE_STEPS) {
        if (step * scale * pxPerBeat >= minPx) base = step;
        else break;
      }
    }
    const label = Constants.STEP_LABELS.get(base) + (triplet ? (base === 4 ? " T" : "T") : "");
    return { step: triplet ? (base * 2) / 3 : base, label };
  }

  function wheelDeltas(e) {
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    return { dx: e.deltaX * unit, dy: e.deltaY * unit };
  }

  function sizeCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  // ===== TimelineView: zoom, scroll, pinch, ruler — shared by arrangement and clip editor =====
  class TimelineView {
    constructor(o) {
      this.o = o;   // { gridWrap, gridCanvas, rulerWrap, rulerCanvas, scroller, spacer, hZoom, vZoom, rowHeight, rowCount, contentBeats, render, onLocate, onZoom }
      this.pxPerBeat = 80;
      this.rowHeight = o.rowHeight;
      this.grid = null;
      this.ruler = null;
      this.queued = false;
      this.pointers = new Map();
      this.pinch = null;
      this.rulerDrag = null;
      o.scroller.addEventListener("scroll", () => this.requestRender());
      o.scroller.addEventListener("wheel", (e) => this.onWheel(e, o.scroller), { passive: false });
      this.bindRuler();
    }

    layout() {
      this.grid = sizeCanvas(this.o.gridCanvas, this.o.gridWrap.clientWidth, this.o.gridWrap.clientHeight);
      this.ruler = sizeCanvas(this.o.rulerCanvas, this.o.rulerWrap.clientWidth, this.o.rulerWrap.clientHeight);
      this.requestRender();
    }

    updateSpacer() {
      this.o.spacer.style.width = `${Math.ceil(this.beatToX(this.o.contentBeats()))}px`;
      this.o.spacer.style.height = `${this.o.rowCount() * this.rowHeight}px`;
    }

    requestRender() {
      if (this.queued) return;
      this.queued = true;
      requestAnimationFrame(() => {
        if (this.grid) this.o.render();
        this.queued = false;
      });
    }

    beatToX(beats) { return beats * this.pxPerBeat; }

    // Visible viewport in content units.
    viewport() {
      const s = this.o.scroller;
      const W = this.o.gridCanvas.clientWidth, H = this.o.gridCanvas.clientHeight;
      const sx = s.scrollLeft, sy = s.scrollTop;
      const drawW = Math.min(W, this.beatToX(this.o.contentBeats()) - sx);
      return {
        W, H, sx, sy, drawW,
        beat0: sx / this.pxPerBeat, beat1: (sx + drawW) / this.pxPerBeat,
        firstRow: Math.max(0, Math.floor(sy / this.rowHeight)),
        lastRow: Math.min(this.o.rowCount() - 1, Math.floor((sy + H) / this.rowHeight)),
      };
    }

    point(e) {
      const r = this.o.scroller.getBoundingClientRect();
      const vx = e.clientX - r.left, vy = e.clientY - r.top;
      const x = vx + this.o.scroller.scrollLeft, y = vy + this.o.scroller.scrollTop;
      return { vx, vy, x, y, beat: x / this.pxPerBeat, row: helpers.clamp(Math.floor(y / this.rowHeight), 0, Math.max(0, this.o.rowCount() - 1)) };
    }

    setPxPerBeat(value, anchorX, beatAtAnchor) {
      this.pxPerBeat = helpers.clamp(value, this.o.hZoom.min, this.o.hZoom.max);
      this.updateSpacer();
      this.o.scroller.scrollLeft = this.beatToX(beatAtAnchor) - anchorX;
      if (this.o.onZoom) this.o.onZoom();
      this.requestRender();
    }

    setRowHeight(value, anchorY, rowAtAnchor) {
      this.rowHeight = helpers.clamp(value, this.o.vZoom.min, this.o.vZoom.max);
      this.updateSpacer();
      this.o.scroller.scrollTop = rowAtAnchor * this.rowHeight - anchorY;
      if (this.o.onZoom) this.o.onZoom();
      this.requestRender();
    }

    zoomH(factor, anchorX = this.o.scroller.clientWidth / 2) {
      this.setPxPerBeat(this.pxPerBeat * factor, anchorX, (this.o.scroller.scrollLeft + anchorX) / this.pxPerBeat);
    }

    zoomV(factor, anchorY = this.o.scroller.clientHeight / 2) {
      this.setRowHeight(this.rowHeight * factor, anchorY, (this.o.scroller.scrollTop + anchorY) / this.rowHeight);
    }

    onWheel(e, el) {
      const { dx, dy } = wheelDeltas(e);
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.zoomH(Math.exp(-dy * 0.002), e.clientX - r.left);
      } else if (e.altKey) {
        e.preventDefault();
        this.zoomV(Math.exp(-dy * 0.002), e.clientY - r.top);
      } else if (e.shiftKey && dx === 0) {
        e.preventDefault();
        this.o.scroller.scrollLeft += dy;
      }
    }

    // --- pinch bookkeeping; view-specific handlers call these first ---
    trackDown(e) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const r = this.o.scroller.getBoundingClientRect();
        const midX = (a.x + b.x) / 2 - r.left, midY = (a.y + b.y) / 2 - r.top;
        this.pinch = {
          dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1, ppb0: this.pxPerBeat,
          beat: (this.o.scroller.scrollLeft + midX) / this.pxPerBeat, contentY: this.o.scroller.scrollTop + midY,
        };
        return true;
      }
      return this.pointers.size > 2 || !!this.pinch;
    }

    trackMove(e) {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.pinch) return false;
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const r = this.o.scroller.getBoundingClientRect();
        const midX = (a.x + b.x) / 2 - r.left, midY = (a.y + b.y) / 2 - r.top;
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        this.setPxPerBeat((this.pinch.ppb0 * dist) / this.pinch.dist0, midX, this.pinch.beat);
        this.o.scroller.scrollTop = this.pinch.contentY - midY;
      }
      return true;
    }

    trackUp(e) {
      this.pointers.delete(e.pointerId);
      if (!this.pinch) return false;
      if (this.pointers.size < 2) this.pinch = null;
      return true;
    }

    // --- ruler: tap locates, drag ↕ zooms, drag ↔ scrolls ---
    bindRuler() {
      const canvas = this.o.rulerCanvas;
      canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        audio.unlock();//.catch(() => { });
        canvas.setPointerCapture(e.pointerId);
        const vx = e.clientX - canvas.getBoundingClientRect().left;
        this.rulerDrag = {
          pointerId: e.pointerId, moved: false, x0: e.clientX, y0: e.clientY, vx0: vx,
          ppb0: this.pxPerBeat, beat0: (this.o.scroller.scrollLeft + vx) / this.pxPerBeat,
        };
      });
      canvas.addEventListener("pointermove", (e) => {
        const d = this.rulerDrag;
        if (!d || d.pointerId !== e.pointerId) return;
        const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
        if (!d.moved && Math.hypot(dx, dy) < Constants.DRAG_THRESHOLD) return;
        d.moved = true;
        this.setPxPerBeat(d.ppb0 * Math.exp(dy * 0.01), d.vx0 + dx, d.beat0);
      });
      const end = (e) => {
        const d = this.rulerDrag;
        if (!d || d.pointerId !== e.pointerId) return;
        this.rulerDrag = null;
        if (!d.moved && e.type !== "pointercancel") this.o.onLocate(d.beat0);
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const { dx, dy } = wheelDeltas(e);
        if (e.ctrlKey || e.metaKey) this.zoomH(Math.exp(-dy * 0.002), e.clientX - canvas.getBoundingClientRect().left);
        else this.o.scroller.scrollLeft += dx || dy;
      }, { passive: false });
    }

    // --- shared drawing ---
    drawVerticalLines(c, H, subStep, drawW) {
      const { sx, beat0, beat1 } = this.viewport();
      const ppb = this.pxPerBeat;
      if (subStep && subStep * ppb >= 3) {
        c.fillStyle = Constants.COLORS.lineSub;
        for (let k = Math.ceil(beat0 / subStep - Constants.EPS); k * subStep <= beat1 + Constants.EPS; k++) {
          const beat = k * subStep;
          if (Math.abs(beat - Math.round(beat)) < Constants.EPS) continue;
          c.fillRect(Math.round(this.beatToX(beat) - sx), 0, 1, H);
        }
      }
      for (let beat = Math.ceil(beat0 - Constants.EPS); beat <= beat1 + Constants.EPS; beat++) {
        const isBar = beat % Constants.BEATS_PER_BAR === 0;
        if (!isBar && ppb < 3) continue;
        if (isBar && ppb * Constants.BEATS_PER_BAR < 3) continue;
        c.fillStyle = isBar ? Constants.COLORS.lineBar : Constants.COLORS.lineBeat;
        c.fillRect(Math.round(this.beatToX(beat) - sx), 0, 1, H);
      }
      void drawW;
    }

    drawRegion(c, H, regionEnd, drawW) {
      const x = this.beatToX(regionEnd) - this.o.scroller.scrollLeft;
      if (x < drawW) {
        c.fillStyle = Constants.COLORS.regionShade;
        c.fillRect(Math.max(0, x), 0, drawW - Math.max(0, x), H);
      }
      if (x >= 0 && x <= drawW) {
        c.fillStyle = Constants.COLORS.regionEdge;
        c.fillRect(Math.round(x), 0, 1, H);
      }
    }

    drawPlayhead(c, H, beat) {
      const px = Math.round(this.beatToX(beat) - this.o.scroller.scrollLeft);
      if (px < 0 || px > this.o.gridCanvas.clientWidth) return;
      c.fillStyle = Constants.COLORS.playhead;
      c.fillRect(px, 0, 1, H);
    }

    drawRuler({ subStep, regionEnd, playheadBeat }) {
      const c = this.ruler;
      const W = this.o.rulerCanvas.clientWidth, H = this.o.rulerCanvas.clientHeight;
      const { sx, beat0, beat1, drawW } = this.viewport();
      const ppb = this.pxPerBeat;
      c.fillStyle = Constants.COLORS.ruler;
      c.fillRect(0, 0, W, H);
      c.fillStyle = Constants.COLORS.rulerRegion;
      c.fillRect(0, 0, Math.min(drawW, this.beatToX(regionEnd) - sx), H);

      c.fillStyle = Constants.COLORS.rulerTick;
      if (subStep && subStep * ppb >= 6) {
        for (let k = Math.ceil(beat0 / subStep - Constants.EPS); k * subStep <= beat1 + Constants.EPS; k++) {
          const beat = k * subStep;
          if (Math.abs(beat - Math.round(beat)) < Constants.EPS) continue;
          c.fillRect(Math.round(this.beatToX(beat) - sx), H - 4, 1, 4);
        }
      }
      const barPx = ppb * Constants.BEATS_PER_BAR;
      const labelEvery = Math.max(1, Math.ceil(28 / barPx));
      const showBeats = ppb >= 40;
      c.font = "10px system-ui, sans-serif";
      c.textBaseline = "top";
      c.textAlign = "left";
      for (let beat = Math.ceil(beat0 - Constants.EPS); beat <= beat1 + Constants.EPS; beat++) {
        const x = Math.round(this.beatToX(beat) - sx);
        const bar = Math.floor(beat / Constants.BEATS_PER_BAR);
        const beatInBar = beat % Constants.BEATS_PER_BAR;
        if (beatInBar === 0) {
          const labelled = bar % labelEvery === 0;
          if (!labelled && barPx < 6) continue;
          c.fillStyle = Constants.COLORS.rulerTick;
          c.fillRect(x, labelled ? 0 : H - 8, 1, labelled ? H : 8);
          if (labelled) {
            c.fillStyle = Constants.COLORS.rulerText;
            c.fillText(String(bar + 1), x + 3, 2);
          }
        } else if (showBeats) {
          c.fillStyle = Constants.COLORS.rulerTick;
          c.fillRect(x, H - 8, 1, 8);
          c.fillStyle = Constants.COLORS.rulerText;
          c.fillText(`${bar + 1}.${beatInBar + 1}`, x + 3, 2);
        } else if (ppb >= 6) {
          c.fillStyle = Constants.COLORS.rulerTick;
          c.fillRect(x, H - 5, 1, 5);
        }
      }
      if (playheadBeat === null) return;
      const px = Math.round(this.beatToX(playheadBeat) - sx);
      if (px < 0 || px > W) return;
      c.fillStyle = Constants.COLORS.playhead;
      c.fillRect(px, 0, 1, H);
      c.beginPath();
      c.moveTo(px - 5, 0);
      c.lineTo(px + 6, 0);
      c.lineTo(px + 0.5, 7);
      c.closePath();
      c.fill();
    }
  }

  // ===== Audio (Tone.js) =====
  function createAudio() {
    if (typeof Tone === "undefined") return null;
    console.log("Creating Tone.js audio context");
    const transport = Tone.getTransport();
    const PPQ = transport.PPQ;
    const masterChannel = new Tone.Channel(projectState.masterVolume).toDestination();
    const chains = new Map();   // trackId → { instrument, channel, device name }
    chains.set(0, {
      channel: masterChannel
    });
    const returnChannels = new Map();
    const parts = new Map();    // clipId → Tone.Part
    const toTicks = (beats) => Tone.Ticks(Math.round(beats * PPQ));
    const hz = (pitch) => Tone.Frequency(pitch, "midi").toFrequency();
    const makeToneNode = (deviceInfo) => {
      const logSteps = false;

      if (logSteps) console.log(`makeToneNode: creating device "${deviceInfo.name}"`);
      const getValueParams = (deviceContext, deviceInfoContext, deviceMetadataContext, paramContextPath) => {
        if (paramContextPath)
          if (logSteps) console.log(`getValueParams: ${paramContextPath}`, deviceMetadataContext);
          else
            if (logSteps) console.log(`getValueParams: ${deviceInfo.name}`, deviceMetadataContext);
        Object.keys(deviceMetadataContext).forEach(paramName => {

          let paramPath = paramContextPath ? paramContextPath + "." + paramName : paramName;

          let paramMetadataPath = deviceMetadataContext[paramName];
          if (logSteps) console.log(`Device param "${paramPath}" metadata path: ${paramMetadataPath}`);

          let parts = paramMetadataPath.split("/");
          if (parts[0] != "unitTypes" && parts[0] != "enumTypes") {
            if (!deviceInfoContext[paramName])
              deviceInfoContext[paramName] = {};
            getValueParams(
              deviceContext[paramName],
              deviceInfoContext[paramName],
              deviceList[parts[0]][parts[1]].parameters,
              paramPath
            );
          }
          else {
            if (deviceContext[paramName].name && (deviceContext[paramName].name == "Signal" || deviceContext[paramName].name == "Param"))
              deviceInfoContext[paramName] = deviceContext[paramName].value;
            else
              deviceInfoContext[paramName] = deviceContext[paramName];
            if (logSteps) console.log(`Device param "${paramPath}" set: ${deviceInfoContext}`);
          }
        })
      }
      let deviceNameParts = deviceInfo.name.split(".");
      let deviceNamespace = deviceNameParts.length > 1 ? deviceNameParts[0] : "Tone";
      let deviceName = deviceNameParts[deviceNameParts.length - 1];
      
      if (deviceNameParts.length > 1) {
        console.log("Creating DAWSome device " + deviceName)
      }
      let device = (deviceNameParts.length === 1) ? new Tone[deviceName](deviceInfo.parameters) : DAWSome[deviceName](deviceInfo.parameters);
      if (logSteps) console.log(`makeToneNode: created device "${deviceInfo.name}"`, device);

      let deviceContext = device;
      let deviceMetadataContext = deviceList.devices[deviceInfo.name].parameters;
      let deviceInfoContext = deviceInfo.parameters;
      let paramContextPath = "";

      if (logSteps) console.log(`Device "${deviceInfo.name}": Filling device projectState (deviceContext, deviceMetadataContext)`, deviceContext, deviceMetadataContext);
      try {
        getValueParams(deviceContext, deviceInfoContext, deviceMetadataContext, paramContextPath);
        if (logSteps) console.log(`Device "${deviceInfo.name}": Device projectState filled`, deviceInfo);

      }
      catch (error) {
        console.error("error while trying to create device projectState", error);
        throw error;
      }

      return device;
    };
    const makeToneNodes = (deviceInfos) => {
      let devices = [];
      if (!deviceInfos || deviceInfos.length == 0) return devices;

      deviceInfos.forEach(deviceInfo => {
        try {
        //  console.log("Making tone node " + deviceInfo.name, deviceInfo.parameters);
          let device = makeToneNode(deviceInfo);
        //  console.log("Made tone node " + deviceInfo.name, device);
          devices.push(device);
        }
        catch (error) {
          console.error("error", error);
          throw error;
        }
      });
      return devices;
    }
    const connectDevices = (ch) => {
      console.log("connecting devices");
      let source = ch.instrument;
      console.log("connecting devices, src", source);
      ch.effects.forEach(fx => {
        source.connect(fx);
        source = fx;
      });
      source.connect(ch.channel);
    };
    const connectModulators = (ch, track) => {
      console.log("connect modulators");
      try {
        let modulatorIndex = 0;
        let devices = audio.getTrackDevices(track);
        console.log("Connect modulators: track devices", devices)
        ch.modulators.forEach(modulator => {
          let trackModulator = track.modulators[modulatorIndex];
          console.log("Connect modulators: Modulator " + modulatorIndex, trackModulator, modulator)
          if (trackModulator.targetDeviceIndex >= devices.length)
            console.warn("Target device index out of range", trackModulator.targetDeviceIndex, devices)
          let device = devices[trackModulator.targetDeviceIndex];
          if (!device)
            console.warn("Target device not found", trackModulator.targetDeviceIndex, devices)

          let parts = trackModulator.targetParameter.split(".");
          let target = device;
          for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
            target = target[parts[partIndex]];
          }
          modulator.connect(target);
          modulator.start();
          console.log(`connected modulator to ${track.name}.${device.name}.${trackModulator.targetParameter}`, modulator, target)
          modulatorIndex++;
        });
      }
      catch (error) {
        console.error("Failed to connect modulators", error);
        throw error;
      }
    }
    const updateInstrument = (trackId, instrumentName) => {
      const ch = chain(trackId);
      const track = projectState.tracks.find(track => track.id == trackId);
      track.devices[0].name = instrumentName;
      track.devices[0].parameters = {};

      console.log("updating instrument", instrumentName, ch.instrumentName, ch.instrumentParameters, track.instrumentParameters);
      ch.instrument.dispose();
      //track.devices[0].parameters = track.instrumentParameters;
      ch.instrument = makeToneNode(track.devices[0].name);
      track.instrumentName = track.devices[0].name;

      //console.log("updated instrument", track.instrumentName, track.instrumentParameters);
      ch.instrumentName = track.instrumentName;
      ch.instrumentParameters = track.instrumentParameters;
      connectDevices(ch);
    };
    const chain = (trackId) => chains.get(trackId);
    document.addEventListener("MuteChanged", (e) => {
      const ch = chain(e.detail.trackId);
      ch.channel.mute = e.detail.muted;
      console.log(`audio.MuteChanged: ${e.detail.trackId}, mute changed to ${ch.channel.mute}`);
    });
    document.addEventListener("VolumeChanged", (e) => {
      const ch = chain(e.detail.channelId);
      ch.channel.volume.value = e.detail.volume;
      console.log(`audio.VolumeChanged: ${e.detail.channelId}, volume changed to ${ch.channel.volume}`);
    });
    document.addEventListener("InstrumentChanged", (e) => {
      //updateInstrument(e.detail.trackId, e.detail.instrumentName);
      console.log(`audio.InstrumentChanged: ${e.detail.trackId}, instrument changed to ${e.detail.instrumentName}`);
    });

    return {
      available: true,
      unlock: async () => await initializeTone(),
      setBpm: (bpm) => { transport.bpm.value = bpm; },
      setLoop: (on, endBeats) => {
        transport.loop = on;
        transport.loopStart = 0;
        transport.loopEnd = toTicks(endBeats);
      },
      addReturnChannel: (send) => {
        const channel = new Tone.Channel(send.volume);
        channel.receive(send.name);
        const effectNode = makeToneNode(send.sendEffect);
        const chain = {
          name: send.name,
          channel: channel,
          effect: effectNode
        };
        returnChannels.set(send.id, chain);
        chains.set(send.id, chain);
        channel.connect(effectNode);
        effectNode.connect(masterChannel);
      },
      getReturnChannel: (send) => { return returnChannels(send.id) },
      getReturnChannels: (send) => { return returnChannels },
      addTrack: (track) => {
        //console.log("adding track")
        const channel = new Tone.Channel(track.volume).connect(masterChannel);
        channel.mute = track.mute;
        track.devices[0].parameters = track.instrumentParameters;
        //console.log("making chain");
        chains.set(track.id,
          {
            instrument: makeToneNode(track.devices[0]),
            channel,
            instrumentName: track.devices[0].name,
            instrumentParameters: track.instrumentParameters,
            effects: makeToneNodes(track.effects),
            modulators: makeToneNodes(track.modulators.map(m => m.modulator))
          });
        //console.log("made chain");
        
        track.sends.forEach(send => channel.send(send.name, send.volume));
        const ch = chain(track.id);
        if (ch.instrument == null) throw "instrument null"
        connectDevices(ch);
        connectModulators(ch, track);
        //console.log("added track", chain(track.id));
      },
      updateTrack: (track) => {
        console.log("updating track")
        const ch = chain(track.id);
        if (ch.instrumentName !== track.instrumentName || ch.instrumentParameters !== track.instrumentParameters) {
          console.log("updating instrument", track.instrumentName, ch.instrumentName, ch.instrumentParameters, track.instrumentParameters);
          ch.instrument.dispose();
          track.devices[0] = {
            name: track.instrumentName,
            presetName: "",
            parameters: {}
          }
          track.devices[0].parameters = track.instrumentParameters;
          console.log("making device node")
          ch.instrument = makeToneNode(track.devices[0]);
          //console.log("updated instrument", track.instrumentName, track.instrumentParameters);
          ch.instrumentName = track.instrumentName;
          ch.instrumentParameters = track.instrumentParameters;
          connectDevices(ch);
          console.log("made device node")
        }
        if (ch.instrumentParameters !== track.instrumentParameters) {
          console.log("updating instrument", track.devices[0].name, ch.instrumentName, ch.instrumentParameters, track.instrumentParameters);
          ch.instrument.dispose();
          track.devices[0].parameters = track.instrumentParameters;
          ch.instrument = makeToneNode(track.devices[0]);
          //console.log("updated instrument", track.instrumentName, track.instrumentParameters);
          ch.instrumentName = track.instrumentName;
          ch.instrumentParameters = track.instrumentParameters;
          connectDevices(ch);
        }
        if (track.effects.length != ch.effects.length) {
          ch.effects = makeToneNodes(track.effects);
          connectDevices(ch);
        }
        if (track.modulators.length != ch.modulators.length) {
          ch.modulators = makeToneNodes(track.modulators.map(m => m.modulator));
          connectModulators(ch, track);
        }
        track.sends.forEach(send => ch.channel.send(send.name, send.volume));
      },
      getChain: (trackId) => { 
        const ch = chain(trackId);
        return ch; },
      getTrackInstrument: (track) => {
        const ch = chain(track.id);
        return ch.instrument;
      },
      getTrackEffects: (track) => {
        const ch = chain(track.id);
        return ch.effects;
      },
      getTrackDevices: (track) => {
        const ch = chain(track.id);
        let devices = [ch.instrument];
        ch.effects.forEach(fx => devices.push(fx));
        ch.modulators.forEach(mod => devices.push(mod));
        return devices;
      },
      getTrackModulators: (track) => {
        const ch = chain(track.id);
        if (!ch.modulators) {
          console.log("chain doesnt have modulstora")
          return [];
        }
        return ch.modulators;
      },
      removeTrack: (trackId) => {
        const ch = chain(trackId);
        if (!ch) return;
        ch.instrument.dispose();
        ch.channel.dispose();
        chains.delete(trackId);
      },
      rebuildClip: (clip) => {

        try {
          const old = parts.get(clip.id);
          if (old) old.dispose();

          const ch = chain(clip.trackId);
          if (!ch) throw "No chain found for track " + clip.trackId;
          //console.log("rebuildClip, create events", clip)
          const events = clip.notes
            .filter((n) => n.start < clip.length - Constants.EPS)
            .map((n) => ({
              //time: toTicks(clip.start + n.start),
              time: toTicks(n.start),
              hz: hz(n.pitch),
              dur: toTicks(Math.min(n.duration, clip.length - n.start)),
              vel: n.velocity,
              slide: n.slide
            }));

          const part = new Tone.Part((time, ev) => ch.instrument.triggerAttackRelease(ev.hz, ev.dur, time, ev.vel, ev.slide), events);
          part.start(helpers.beatsToTime(clip.start));
          //console.log("part started", audio.helpers.beatsToTime(clip.start));

          //part.start(0);
          //console.log("check repeating clip")
          if (clip.loop) { //clip.end > clip.start + clip.length
            // console.log("repeating clip")
            let loopEnd = helpers.beatsToTime(clip.length);
            let partStop = helpers.beatsToTime(clip.end);
            part.loopStart = 0;
            part.loopEnd = loopEnd;
            part.loop = true;
            part.stop(helpers.beatsToTime(clip.end));
            // console.log("part, start, loopEnd, clipEnd, partStop", clip.start, loopEnd.toBarsBeatsSixteenths(), clip.end, partStop.toBarsBeatsSixteenths())
          }
          //console.log("rebuild clip")
          parts.set(clip.id, part);
        }
        catch (error) {
          console.error("rebuild clip", error)
        }
      },
      removeClip: (clipId) => {
        const part = parts.get(clipId);
        if (!part) return;
        part.dispose();
        parts.delete(clipId);
      },
      play: async () => {
        await initializeTone();
        transport.start("+0.1");
      },
      stop: () => {
        transport.stop();
        for (const ch of chains.values()) {
          if (ch.instrument) ch.instrument.triggerRelease();
        }
      },
      seek: (beat) => { transport.ticks = Math.round(beat * PPQ); },
      positionBeat: () => transport.getTicksAtTime(Tone.immediate()) / PPQ,
      keyOn: (trackId, pitch) => chain(trackId)?.instrument.triggerAttackRelease(hz(pitch), ed.slide ? 0.50 : 0.15, Tone.now(), ed.accent ? Constants.ACCENT_VELOCITY / 2: Constants.DEFAULT_VELOCITY / 2, ed.slide),
      keyOff: (trackId, pitch) => chain(trackId)?.instrument.triggerRelease(hz(pitch), Tone.now()),
      preview: (trackId, pitch) => chain(trackId)?.instrument.triggerAttackRelease(hz(pitch), ed.slide ? 0.50 : 0.15, Tone.now(), ed.accent ? Constants.ACCENT_VELOCITY / 2 : Constants.DEFAULT_VELOCITY / 2),
    };

    async function initializeTone() {
      if (!toneInitialized) {
        console.log('initializing Tone.js context, context state: ' + Tone.getContext().state);
        //Tone.setContext(new Tone.Context({ latencyHint: "playback" }));
        Tone.getContext().lookAhead = toneLookAhead;
        console.log("Tone.js context lookahead latency: " + Tone.getContext().lookAhead);
        toneInitialized = true;
        console.log('Starting Tone, context state: ' + Tone.getContext().state);
        await Tone.start();
      }
    }
  }

  const audio = createAudio() ?? {
    available: false, unlock: () => Promise.resolve(),
    setBpm() { }, setLoop() { }, addTrack() { }, updateTrack() { }, removeTrack() { }, rebuildClip() { }, removeClip() { },
    async play() { }, stop() { }, seek() { }, positionBeat: () => 0, keyOn() { }, keyOff() { }, preview() { },
  };

  // ===== Standard MIDI File parser (SMF format 0/1, PPQ division) =====
  function parseMidiFile(buffer) {
    const bytes = new Uint8Array(buffer);
    let pos = 0;
    const u8 = () => bytes[pos++];
    const u16 = () => { const v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; };
    const u32 = () => { const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0; pos += 4; return v; };
    const str = (n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[pos++]); return s; };
    const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    if (str(4) !== "MThd") throw new Error("Not a MIDI file (missing MThd header).");
    const headerLength = u32();
    const format = u16();
    const trackCount = u16();
    const division = u16();
    pos += headerLength - 6;
    if (division & 0x8000) throw new Error("SMPTE time division is not supported.");
    const ppq = division;

    let bpm = null;
    const tracks = [];
    for (let t = 0; t < trackCount && pos < bytes.length; t++) {
      if (str(4) !== "MTrk") throw new Error("Malformed track chunk.");
      const length = u32();
      const end = pos + length;
      let tick = 0, status = 0, name = "";
      const open = new Map();         // channel*128+pitch → { tick, vel }
      const byChannel = new Map();    // channel → notes
      const noteOff = (key, at) => {
        const o = open.get(key);
        if (!o) return;
        open.delete(key);
        byChannel.get(key >> 7).push({
          pitch: key & 127, start: o.tick / ppq, duration: Math.max(at - o.tick, 1) / ppq, velocity: o.vel,
        });
      };
      while (pos < end) {
        tick += vlq();
        let b = u8();
        if (b === 0xff) {                       // meta event
          const type = u8();
          const len = vlq();
          if (type === 0x03 && !name) name = str(len);
          else if (type === 0x51 && bpm === null) {
            bpm = 60000000 / ((bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2]);
            pos += len;
          } else pos += len;
          continue;
        }
        if (b === 0xf0 || b === 0xf7) { const len = vlq(); pos += len; continue; }   // sysex
        if (b >= 0xf1 && b <= 0xfe) { pos += b === 0xf2 ? 2 : (b === 0xf1 || b === 0xf3) ? 1 : 0; continue; }
        if (b & 0x80) { status = b; b = u8(); }                            // else running status
        const type = status & 0xf0, channel = status & 0x0f;
        const d1 = b;
        const d2 = (type === 0xc0 || type === 0xd0) ? 0 : u8();
        const key = channel * 128 + d1;
        if (type === 0x90 && d2 > 0) {
          if (!byChannel.has(channel)) byChannel.set(channel, []);
          noteOff(key, tick);
          open.set(key, { tick, vel: d2 });
        } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
          noteOff(key, tick);
        }
      }
      pos = end;
      for (const key of [...open.keys()]) noteOff(key, tick);
      for (const [channel, notes] of byChannel) {
        if (notes.length) tracks.push({ name, channel, notes });
      }
    }
    return { format, bpm, tracks };
  }


  // ===== Arrangement view =====
  const av = new TimelineView({
    gridWrap: $("arrGridWrap"), gridCanvas: $("arrGridCanvas"), rulerWrap: $("arrRulerWrap"), rulerCanvas: $("arrRulerCanvas"),
    scroller: $("arrScroller"), spacer: $("arrSpacer"),
    hZoom: { min: 3, max: 200 },
    vZoom: { min: 40, max: 120 },
    rowHeight: 52,
    rowCount: () => projectState.tracks.length,
    contentBeats: () => stateHelper.songEndBeats() + Constants.SONG_TAIL_BEATS,
    render: renderArrangement,
    onLocate: (beat) => setPlayhead(helpers.clamp(snapRound(beat, arrangementStep()), 0, stateHelper.songEndBeats())),
    onZoom: () => renderTrackHeaders(),
  });

  const arrangementStep = () => gridStep("wide", false, av.pxPerBeat).step;
  const clipAt = (beat, row) => {
    const track = projectState.tracks[row];
    if (!track) return null;
    for (let i = projectState.clips.length - 1; i >= 0; i--) {
      const c = projectState.clips[i];
      if (c.trackId === track.id && beat >= c.start && beat < helpers.clipEnd(c)) return c;
    }
    return null;
  };
  const onClipRightEdge = (clip, x) => x >= av.beatToX(helpers.clipEnd(clip)) - Math.min(8, av.beatToX(clip.length) * 0.4);

  function renderArrangement() {
    const c = av.grid;
    const { W, H, sx, sy, drawW, firstRow, lastRow } = av.viewport();
    const rh = av.rowHeight;
    c.fillStyle = Constants.COLORS.void;
    c.fillRect(0, 0, W, H);

    for (let row = firstRow; row <= lastRow; row++) {
      const y = row * rh - sy;
      c.fillStyle = row % 2 ? Constants.COLORS.laneB : Constants.COLORS.laneA;
      c.fillRect(0, y, drawW, rh);
      c.fillStyle = Constants.COLORS.laneLine;
      c.fillRect(0, y + rh - 1, drawW, 1);
    }
    av.drawVerticalLines(c, H, arrangementStep(), drawW);
    av.drawRegion(c, H, stateHelper.songEndBeats(), drawW);

    c.font = "1.5vh system-ui, sans-serif";
    c.textBaseline = "top";
    c.textAlign = "left";
    for (const clip of projectState.clips) {
      const row = projectState.tracks.findIndex((t) => t.id === clip.trackId);
      if (row < firstRow || row > lastRow) continue;
      const x0 = av.beatToX(clip.start) - sx;
      const x1 = av.beatToX(helpers.clipEnd(clip)) - sx;
      if (x1 < 0 || x0 > W) continue;
      const y = row * rh - sy + 2, h = rh - 5;
      const w = Math.max(2, x1 - x0 - 1);
      const track = stateHelper.trackById(clip.trackId);
      const selected = clip.id === projectState.selectedClipId;
      c.fillStyle = track.color;
      c.globalAlpha = track.mute ? 0.45 : 1;
      c.fillRect(Math.round(x0), y, w, h);
      c.globalAlpha = 1;
      if (w > 24) {
        c.save();
        c.beginPath();
        c.rect(Math.round(x0), y, w, 24);
        c.clip();
        c.fillStyle = Constants.COLORS.clipText;
        c.fillText(clip.name, Math.round(x0) + 4, y + 2);
        c.restore();
      }
      // mini note preview
      const body = h - 16;

      if (body > 6 && clip.notes.length) {
        let lo = 127, hi = 0;
        for (const n of clip.notes) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); }
        const span = Math.max(hi - lo + 1, 12);
        const rowPx = body / span;


        let clipRepeatStart = clip.start;
        let clipRepeats = (clip.end - clip.start) / clip.length;
        let clipWidth = (x1 - x0) / clipRepeats;
        let clipStartX = x0;
        c.strokeStyle = "rgba(100,100,100,0.2)";
        c.lineWidth = "5px";
        for (let clipRepeatIndex = 0; clipRepeatIndex < clipRepeats; clipRepeatIndex++) {
          c.fillStyle = clipRepeatIndex == 0 ? Constants.COLORS.clipNote : Constants.COLORS.clipRepeatNote;
          for (const n of clip.notes) {
            if (n.start >= clip.length) continue;
            const nx = clipStartX + av.beatToX(n.start);
            if (nx > x1) continue;
            const nw = Math.max(1, av.beatToX(Math.min(n.duration, clip.length - n.start)) - 1);
            const ny = y + 15 + (hi - n.pitch) * rowPx;
            c.fillRect(Math.round(nx), ny, nw, Math.max(1, rowPx - 1));
          }

          clipStartX += clipWidth;
          c.beginPath();
          c.moveTo(clipStartX + 0.5, y);
          c.lineTo(clipStartX + 0.5, y + h);
          c.closePath();
          c.stroke();
        }
        /* let clipStartX = x0;
         while (clipRepeatStart <= clip.end) {
           c.fillStyle = clipRepeatStart == clip.start ? Constants.COLORS.clipNote : Constants.COLORS.clipRepeatNote;
           
           
           for (const n of clip.notes) {
             let noteStart = clipRepeatStart + n.start;
             if (noteStart >= clip.end) continue;
             const nx = clipStartX + av.beatToX(noteStart);
             const nw = Math.max(1, av.beatToX(Math.min(n.duration, clip.end - noteStart)) - 1);
             const ny = y + 15 + (hi - n.pitch) * rowPx;
             c.fillRect(Math.round(nx), ny, nw, Math.max(1, rowPx - 1));
           }
           clipStartX += 
           clipRepeatStart += clip.length;
         }*/
      }

      if (selected) {
        c.strokeStyle = Constants.COLORS.clipSelected;
        c.lineWidth = 2;
        c.strokeRect(Math.round(x0) + 1, y + 1, w - 2, h - 2);
      }
    }
    av.drawPlayhead(c, H, projectState.playheadBeat);
    av.drawRuler({ subStep: arrangementStep(), regionEnd: stateHelper.songEndBeats(), playheadBeat: projectState.playheadBeat });
  }

  // Track headers are DOM so names and instruments are editable; they scroll with the lanes.
  function renderTrackHeaders() {
    const rh = av.rowHeight;
    dom.trackHeaders.style.transform = `translateY(${-av.o.scroller.scrollTop}px)`;
    const existing = new Map([...dom.trackHeaders.children].map((el) => [Number(el.dataset.id), el]));
    dom.trackHeaders.replaceChildren();
    for (const track of projectState.tracks) {
      let el = existing.get(track.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "track";
        el.dataset.id = track.id;
        el.innerHTML = `<span class="swatch"></span>    
          <button class="btn mini mute" title="Mute">M</button>
          <input class="name" type="text" title="Track name" readonly="readonly">
          <button class="btn mini del" title="Delete track">×</button>`;
      }
      el.style.height = `${rh}px`;
      el.classList.toggle("selected", track.id === projectState.selectedTrackId);
      el.querySelector(".swatch").style.background = track.color;

      const nameInput = el.querySelector(".name");
      if (document.activeElement !== nameInput) nameInput.value = track.name;
      nameInput.ondblclick = () => { if (nameInput.readOnly) nameInput.readOnly = false };
      nameInput.onblur = () => nameInput.readOnly = true;

      el.querySelector(".mute").classList.toggle("on", track.mute);

      dom.trackHeaders.appendChild(el);

      document.addEventListener("MuteChanged", (e) => {
        if (e.detail.trackId !== track.id) return;
        el.querySelector(".mute").classList.toggle("on", track.mute);
      })
    }
  }

  av.o.scroller.addEventListener("scroll", () => {
    dom.trackHeaders.style.transform = `translateY(${-av.o.scroller.scrollTop}px)`;
  });

  dom.trackHeadersWrap.addEventListener("click", (e) => {
    console.log("click", e.currentTarget, e.target, e.srcElement)
    if (e.target === dom.trackHeadersWrap) trackManager.deselectTrack();
  }
  );
  dom.trackHeaders.addEventListener("click", async (e) => {
    const el = e.target.closest(".track");
    if (!el) return;
    const track = stateHelper.trackById(Number(el.dataset.id));
    trackManager.selectTrack(track);
    if (e.target.classList.contains("mute")) {
      track.mute = !track.mute;
      audio.updateTrack(track);
      document.dispatchEvent(new CustomEvent("MuteChanged", { detail: { trackId: track.id, muted: track.mute } }));
    } else if (e.target.classList.contains("del")) {
      trackManager.removeTrack(track.id);
      if (!stateHelper.currentClip()) updateManager.editorClipChanged();
      document.dispatchEvent(new CustomEvent("TrackRemoved", { detail: { trackId: track.id } }));
    } else if (e.target.classList.contains("name")) {
      bottomPanelManager.refreshActivePanel();
      return false;
    }
    updateManager.arrangementChanged();
    e.preventDefault();
    //e.cancelBubble();
  });

  dom.trackHeaders.addEventListener("change", (e) => {
    const el = e.target.closest(".track");
    if (!el) return;
    const track = stateHelper.trackById(Number(el.dataset.id));

    if (e.target.classList.contains("name")) {
      track.name = e.target.value.trim() || track.name;
      e.target.value = track.name;
      updateManager.editorClipChanged();
      document.dispatchEvent(new CustomEvent("TrackNameChanged", { detail: { trackId: track.id, trackName: track.name } }));
    }
    updateManager.arrangementChanged();
  });

  function fillDevicePresets(el, presets, deviceName) {
    console.log("fillDevicePresets", presets, deviceName)

    let instSelect = el.querySelector(".inst");
    let presetSelect = el.querySelector(".instPreset");
    presetSelect.innerHTML = "";
    if (!presets[deviceName])
      return;
    console.log("found presets for " + deviceName, presets[deviceName])
    Object.keys(presets[deviceName]).forEach(presetName => {
      presetSelect.innerHTML += `<option value="${presetName}">${presetName}</option>`;
    })
  }

  dom.trackHeaders.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

  let aDrag = null;   // { type: "move" | "resize", pointerId, clip, start0, length0, beat0, row0, x0, vx0, vy0, moved }

  av.o.scroller.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    audio.unlock();//.catch(() => { });
    if (av.trackDown(e)) { aDrag = null; return; }
    const p = av.point(e);
    const clip = clipAt(p.beat, p.row);
    if (!clip) {
      clipManager.deselectClip();
      console.log("deselect xlip")
      return;
    }
    clipManager.selectClip(clip);
    if (!projectState.drawClips) return;
    aDrag = {
      type: onClipRightEdge(clip, p.x) ? "resize" : "move", pointerId: e.pointerId, clip,
      start0: clip.start, length0: clip.length, beat0: p.beat, row0: p.row, x0: p.x, vx0: p.vx, vy0: p.vy, moved: false,
    };
    if (e.pointerType !== "touch") av.o.scroller.setPointerCapture(e.pointerId);
    av.requestRender();
  });

  av.o.scroller.addEventListener("pointermove", (e) => {
    if (av.trackMove(e)) return;
    if (!aDrag || aDrag.pointerId !== e.pointerId) {
      if (e.pointerType === "mouse") {
        const p = av.point(e);
        const clip = clipAt(p.beat, p.row);
        av.o.scroller.style.cursor = clip ? (onClipRightEdge(clip, p.x) ? "ew-resize" : "move") : "default";
      }
      return;
    }
    const p = av.point(e);
    const d = aDrag;
    if (!d.moved) {
      if (Math.hypot(p.vx - d.vx0, p.vy - d.vy0) < Constants.DRAG_THRESHOLD) return;
      d.moved = true;
    }
    const step = arrangementStep();
    if (d.type === "move") {
      d.clip.start = Math.max(0, snapRound(d.start0 + (p.beat - d.beat0), step));
      const track = projectState.tracks[p.row];
      if (track && track.id !== d.clip.trackId) {
        d.clip.trackId = track.id;
        trackManager.selectTrack(track);
        renderTrackHeaders();
      }
    } else {
      const end = snapRound(d.start0 + d.length0 + (p.x - d.x0) / av.pxPerBeat, step);
      d.clip.length = Math.max(step, end - d.clip.start);
    }
    av.updateSpacer();
    av.requestRender();
  });

  function endArrangementPointer(e) {
    if (av.trackUp(e)) return;
    if (!aDrag || aDrag.pointerId !== e.pointerId) return;
    const d = aDrag;
    aDrag = null;
    if (d.moved) {
      audio.rebuildClip(d.clip);
      updateManager.arrangementChanged();
      updateManager.editorClipChanged();
    }
  }
  av.o.scroller.addEventListener("pointerup", endArrangementPointer);
  av.o.scroller.addEventListener("pointercancel", endArrangementPointer);
  av.o.scroller.addEventListener("touchmove", (e) => {
    if (e.touches.length >= 2 || aDrag) e.preventDefault();
  }, { passive: false });
  av.o.scroller.addEventListener("dblclick", (e) => {
    const p = av.point(e);
    const track = projectState.tracks[p.row];
    if (!track || clipAt(p.beat, p.row)) return;
    const start = snapFloor(p.beat, Constants.BEATS_PER_BAR);
    if (!projectState.drawClips) return;
    clipManager.selectClip(clipManager.createClip(track, start, Constants.BEATS_PER_BAR));
    updateManager.arrangementChanged();
  });
  av.o.scroller.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const p = av.point(e);
    const clip = clipAt(p.beat, p.row);
    if (!clip) return;
    clipManager.removeClip(clip.id);
    updateManager.arrangementChanged();
    updateManager.editorClipChanged();
  });

  // ===== Clip editor (piano roll) =====
  const ev = new TimelineView({
    gridWrap: $("edGridWrap"), gridCanvas: $("edGridCanvas"), rulerWrap: $("edRulerWrap"), rulerCanvas: $("edRulerCanvas"),
    scroller: $("edScroller"), spacer: $("edSpacer"),
    hZoom: { min: 8, max: 400 }, vZoom: { min: 6, max: 40 }, rowHeight: 18,
    rowCount: () => Constants.PITCH_COUNT,
    contentBeats: () => {
      const clip = stateHelper.currentClip();
      if (!clip) return Constants.BEATS_PER_BAR;
      const lastEnd = clip.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
      return Math.max(helpers.ceilBars(clip.length), helpers.ceilBars(lastEnd));
    },
    render: renderEditor,
    onLocate: (beat) => {
      const clip = stateHelper.currentClip();
      if (!clip) return;
      setPlayhead(clip.start + helpers.clamp(ed.snap ? snapRound(beat, editorStep()) : beat, 0, clip.length));
    },
    onZoom: () => { dom.gridReadout.textContent = editorGrid().label; },
  });

  const editorGrid = () => gridStep(ed.gridMode, ed.triplet, ev.pxPerBeat);
  const editorStep = () => editorGrid().step;
  const pitchToRow = (pitch) => Constants.TOP_PITCH - pitch;
  const rowToPitch = (row) => Constants.TOP_PITCH - row;
  const editorPlayhead = () => {
    const clip = stateHelper.currentClip();
    if (!clip) return null;
    const local = projectState.playheadBeat - clip.start;
    return local >= 0 && local <= ev.o.contentBeats() ? local : null;
  };

  function renderEditor() {
    const c = ev.grid;
    const { W, H, sx, sy, drawW, firstRow, lastRow } = ev.viewport();
    const rh = ev.rowHeight;
    const clip = stateHelper.currentClip();
    c.fillStyle = Constants.COLORS.void;
    c.fillRect(0, 0, W, H);
    renderKeys();
    if (!clip) {
      ev.drawRuler({ subStep: null, regionEnd: 0, playheadBeat: null });
      c.fillStyle = Constants.COLORS.message;
      c.font = "13px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("Select a clip above, or press + Clip", W / 2, Math.min(H / 2, 60));
      return;
    }
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = rowToPitch(row);
      const y = row * rh - sy;
      c.fillStyle = Constants.BLACK_KEYS.has(pitch % 12) ? Constants.COLORS.rowBlack : Constants.COLORS.rowWhite;
      c.fillRect(0, y, drawW, rh);
      if (pitch % 12 === 0) {
        c.fillStyle = Constants.COLORS.octaveLine;
        c.fillRect(0, y + rh - 1, drawW, 1);
      }
    }
    const step = editorStep();
    ev.drawVerticalLines(c, H, step, drawW);
    ev.drawRegion(c, H, clip.length, drawW);

    for (const n of clip.notes) {
      const x0 = ev.beatToX(n.start) - sx, x1 = ev.beatToX(n.start + n.duration) - sx;
      const y = pitchToRow(n.pitch) * rh - sy;
      if (x1 < 0 || x0 > W || y + rh < 0 || y > H) continue;
      const w = Math.max(2, x1 - x0 - 1), h = Math.max(2, rh - 2);
      c.fillStyle = ed.selected.has(n.id) ? n.velocity == Constants.ACCENT_VELOCITY ? Constants.COLORS.accentNoteSelected : Constants.COLORS.noteSelected : n.velocity == Constants.ACCENT_VELOCITY ? Constants.COLORS.accentNote : Constants.COLORS.note;
      c.fillRect(Math.round(x0), y + 1, w, h);
      c.strokeStyle = n.slide ? Constants.COLORS.slideNoteBorder : Constants.COLORS.noteBorder;
      c.lineWidth = 1;
      c.strokeRect(Math.round(x0) + 0.5, y + 1.5, w - 1, h - 1);
    }
    const ph = editorPlayhead();
    if (ph !== null) ev.drawPlayhead(c, H, ph);
    ev.drawRuler({ subStep: step, regionEnd: clip.length, playheadBeat: ph });
  }

  let keysCtx = null;
  function renderKeys() {
    const c = keysCtx;
    if (!c) return;
    const W = dom.edKeysCanvas.clientWidth, H = dom.edKeysCanvas.clientHeight;
    const { sy, firstRow, lastRow } = ev.viewport();
    const rh = ev.rowHeight;
    const blackW = Math.round(W * 0.62);
    const showAll = rh >= 16;
    c.fillStyle = Constants.COLORS.void;
    c.fillRect(0, 0, W, H);
    c.font = `${helpers.clamp(rh - 5, 8, 11)}px system-ui, sans-serif`;
    c.textBaseline = "middle";
    c.textAlign = "right";
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = rowToPitch(row);
      const y = row * rh - sy;
      const black = Constants.BLACK_KEYS.has(pitch % 12);
      const active = ed.activeKey === pitch;
      c.fillStyle = active ? Constants.COLORS.keyActive : Constants.COLORS.keyWhite;
      c.fillRect(0, y, W, rh);
      if (black) {
        c.fillStyle = active ? Constants.COLORS.keyActive : Constants.COLORS.keyBlack;
        c.fillRect(0, y, blackW, rh);
      }
      if (pitch % 12 === 0 || pitch % 12 === 5) {
        c.fillStyle = Constants.COLORS.keyBorder;
        c.fillRect(0, y + rh - 1, W, 1);
      }
      if (rh >= 8 && (pitch % 12 === 0 || showAll)) {
        c.fillStyle = black ? Constants.COLORS.keyTextLight : Constants.COLORS.keyTextDark;
        c.fillText(helpers.midiName(pitch), (black ? blackW : W) - 3, y + rh / 2 + 0.5);
      }
    }
  }

  // --- note editing ---
  function noteAt(clip, beat, pitch) {
    for (let i = clip.notes.length - 1; i >= 0; i--) {
      const n = clip.notes[i];
      if (n.pitch === pitch && beat >= n.start && beat < n.start + n.duration) return n;
    }
    return null;
  }
  const onNoteRightEdge = (n, x) => x >= ev.beatToX(n.start + n.duration) - Math.min(8, ev.beatToX(n.duration) * 0.4);

  function addNoteAt(clip, beat, pitch) {
    const step = editorStep();
    const start = Math.max(0, ed.snap ? snapFloor(beat, step) : beat);
    if (noteAt(clip, start + Constants.EPS, pitch)) return null;
    let duration = step ?? ed.lastDuration;
    for (const o of clip.notes) {
      if (o.pitch === pitch && o.start > start + Constants.EPS) duration = Math.min(duration, o.start - start);
    }
    if (duration < Constants.EPS) return null;
    const note = { id: projectState.nextId++, pitch, start, duration, velocity: ed.accent ? Constants.ACCENT_VELOCITY : Constants.DEFAULT_VELOCITY, slide: ed.slide };
    clip.notes.push(note);
    audio.preview(clip.trackId, pitch);
    updateManager.notesChanged();
    return note;
  }

  function pruneNotes(clip, ids) {
    const set = new Set(ids);
    if (!set.size) return;
    clip.notes = clip.notes.filter((n) => !set.has(n.id));
    for (const id of set) ed.selected.delete(id);
  }

  function deleteNotes(clip, ids) {
    pruneNotes(clip, ids);
    updateManager.notesChanged();
  }

  function resolveOverlaps(clip, note) {
    const end = note.start + note.duration;
    const doomed = [];
    for (const other of clip.notes) {
      if (other === note || other.pitch !== note.pitch) continue;
      const otherEnd = other.start + other.duration;
      if (otherEnd <= note.start + Constants.EPS || other.start >= end - Constants.EPS) continue;
      if (other.start < note.start - Constants.EPS) other.duration = note.start - other.start;
      else if (otherEnd > end + Constants.EPS) { other.duration = otherEnd - end; other.start = end; }
      else doomed.push(other.id);
    }
    pruneNotes(clip, doomed);
  }

  let nDrag = null;   // { type: "tap" | "paint" | "move" | "resize", pointerId, ... }

  function beginNoteMove(clip, note, p, pointerId) {
    const group = !ed.drawMode && ed.selected.has(note.id) ? clip.notes.filter((n) => ed.selected.has(n.id)) : [note];
    nDrag = {
      type: "move", pointerId, anchor: note, moved: false,
      items: group.map((n) => ({ note: n, start: n.start, pitch: n.pitch })),
      beat0: p.beat, pitch0: rowToPitch(p.row), vx0: p.vx, vy0: p.vy, lastPreview: note.pitch,
    };
  }

  function updateNoteMove(clip, p) {
    const d = nDrag;
    if (!d.moved) {
      if (Math.hypot(p.vx - d.vx0, p.vy - d.vy0) < Constants.DRAG_THRESHOLD) return;
      d.moved = true;
    }
    const step = editorStep();
    const anchor = d.items.find((it) => it.note === d.anchor);
    const target = anchor.start + (p.beat - d.beat0);
    const minStart = Math.min(...d.items.map((it) => it.start));
    const minPitch = Math.min(...d.items.map((it) => it.pitch));
    const maxPitch = Math.max(...d.items.map((it) => it.pitch));
    const dBeat = Math.max((ed.snap ? snapRound(target, step) : target) - anchor.start, -minStart);
    const dPitch = helpers.clamp(rowToPitch(p.row) - d.pitch0, -minPitch, Constants.TOP_PITCH - maxPitch);
    for (const it of d.items) {
      it.note.start = it.start + dBeat;
      it.note.pitch = it.pitch + dPitch;
    }
    if (d.anchor.pitch !== d.lastPreview) {
      d.lastPreview = d.anchor.pitch;
      audio.preview(clip.trackId, d.anchor.pitch);
    }
    ev.updateSpacer();
    ev.requestRender();
  }

  function updateNoteResize(p) {
    const d = nDrag;
    const step = editorStep();
    const rawEnd = d.note.start + d.duration0 + (p.x - d.x0) / ev.pxPerBeat;
    const end = ed.snap ? snapRound(rawEnd, step) : rawEnd;
    d.note.duration = Math.max(step ?? Constants.MIN_FREE_DURATION, end - d.note.start);
    ed.lastDuration = d.note.duration;
    ev.updateSpacer();
    ev.requestRender();
  }

  function updatePaint(clip, p) {
    const step = editorStep();
    if (!step || !ed.snap) return;
    const cell = snapFloor(p.beat, step);
    if (cell === nDrag.lastCell) return;
    nDrag.lastCell = cell;
    addNoteAt(clip, cell, nDrag.pitch);
  }

  function commitNoteEdit(clip, d) {
    const notes = d.type === "move" ? d.items.map((it) => it.note) : [d.note];
    for (const n of notes) {
      if (clip.notes.includes(n)) resolveOverlaps(clip, n);
    }
    updateManager.notesChanged();
  }

  ev.o.scroller.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    audio.unlock();//.catch(() => { });
    if (ev.trackDown(e)) { nDrag = null; return; }
    const clip = stateHelper.currentClip();
    if (!clip) return;
    const p = ev.point(e);
    const pitch = rowToPitch(p.row);
    const touch = e.pointerType === "touch";
    const hit = noteAt(clip, p.beat, pitch);
    if (hit) {
      if (!ed.drawMode) {
        if (e.shiftKey) {
          if (ed.selected.has(hit.id)) ed.selected.delete(hit.id);
          else ed.selected.add(hit.id);
        } else if (!ed.selected.has(hit.id)) {
          ed.selected.clear();
          ed.selected.add(hit.id);
        }
      }
      if (onNoteRightEdge(hit, p.x)) nDrag = { type: "resize", pointerId: e.pointerId, note: hit, x0: p.x, duration0: hit.duration };
      else beginNoteMove(clip, hit, p, e.pointerId);
      nDrag.shift = e.shiftKey;
    } else if (ed.drawMode) {
      if (touch) {
        nDrag = { type: "tap", pointerId: e.pointerId, vx0: p.vx, vy0: p.vy, beat: p.beat, pitch };
      } else {
        const note = addNoteAt(clip, p.beat, pitch);
        nDrag = { type: "paint", pointerId: e.pointerId, pitch, lastCell: note ? note.start : null };
      }
    } else if (!e.shiftKey) {
      ed.selected.clear();
    }
    if (nDrag && !touch) ev.o.scroller.setPointerCapture(e.pointerId);
    ev.requestRender();
  });
  ev.o.scroller.addEventListener("pointermove", (e) => {
    if (ev.trackMove(e)) return;
    const clip = stateHelper.currentClip();
    if (!clip) return;
    if (!nDrag || nDrag.pointerId !== e.pointerId) {
      if (e.pointerType === "mouse") {
        const p = ev.point(e);
        const hit = noteAt(clip, p.beat, rowToPitch(p.row));
        ev.o.scroller.style.cursor = hit ? (onNoteRightEdge(hit, p.x) ? "ew-resize" : ed.drawMode ? "pointer" : "move")
          : ed.drawMode ? "crosshair" : "default";
      }
      return;
    }
    const p = ev.point(e);
    switch (nDrag.type) {
      case "tap": if (Math.hypot(p.vx - nDrag.vx0, p.vy - nDrag.vy0) > Constants.TAP_SLOP) nDrag = null; break;
      case "paint": updatePaint(clip, p); break;
      case "move": updateNoteMove(clip, p); break;
      case "resize": updateNoteResize(p); break;
    }
  });

  function endEditorPointer(e, cancelled) {
    if (ev.trackUp(e)) return;
    if (!nDrag || nDrag.pointerId !== e.pointerId) return;
    const d = nDrag;
    nDrag = null;
    const clip = stateHelper.currentClip();
    if (!clip) return;
    if (d.type === "tap") {
      if (!cancelled) addNoteAt(clip, d.beat, d.pitch);
    } else if (d.type === "move") {
      if (d.moved) commitNoteEdit(clip, d);
      else if (!cancelled && ed.drawMode) deleteNotes(clip, [d.anchor.id]);
      else if (!cancelled && !d.shift) { ed.selected.clear(); ed.selected.add(d.anchor.id); }
    } else if (d.type === "resize") {
      commitNoteEdit(clip, d);
    }
    ev.requestRender();
  }
  ev.o.scroller.addEventListener("pointerup", (e) => endEditorPointer(e, false));
  ev.o.scroller.addEventListener("pointercancel", (e) => endEditorPointer(e, true));
  ev.o.scroller.addEventListener("touchmove", (e) => {
    if (e.touches.length >= 2 || (nDrag && (nDrag.type === "move" || nDrag.type === "resize"))) e.preventDefault();
  }, { passive: false });
  ev.o.scroller.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const clip = stateHelper.currentClip();
    if (!clip) return;
    const p = ev.point(e);
    const hit = noteAt(clip, p.beat, rowToPitch(p.row));
    if (hit) deleteNotes(clip, [hit.id]);
  });
  ev.o.scroller.addEventListener("dblclick", (e) => {
    const clip = stateHelper.currentClip();
    if (!clip || ed.drawMode) return;
    const p = ev.point(e);
    if (!noteAt(clip, p.beat, rowToPitch(p.row))) addNoteAt(clip, p.beat, rowToPitch(p.row));
  });

  // --- piano keys: tap plays, drag ↕ scrolls, drag ↔ zooms ---
  let keyDrag = null;
  const keyPitchAt = (e) => rowToPitch(helpers.clamp(Math.floor((e.clientY - dom.edKeysCanvas.getBoundingClientRect().top + ev.o.scroller.scrollTop) / ev.rowHeight), 0, Constants.TOP_PITCH));

  function keyOff() {
    if (ed.activeKey === null) return;
    const clip = stateHelper.currentClip();
    audio.keyOff(clip ? clip.trackId : projectState.selectedTrackId, ed.activeKey);
    ed.activeKey = null;
    ev.requestRender();
  }
  dom.edKeysCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    audio.unlock();//.catch(() => { });
    dom.edKeysCanvas.setPointerCapture(e.pointerId);
    const anchorY = e.clientY - dom.edKeysCanvas.getBoundingClientRect().top;
    keyDrag = {
      pointerId: e.pointerId, mode: "key", x0: e.clientX, y0: e.clientY, anchorY,
      scrollTop0: ev.o.scroller.scrollTop, rowHeight0: ev.rowHeight,
      rowAtAnchor: (ev.o.scroller.scrollTop + anchorY) / ev.rowHeight,
    };
    const clip = stateHelper.currentClip();
    ed.activeKey = keyPitchAt(e);
    audio.keyOn(clip ? clip.trackId : projectState.selectedTrackId, ed.activeKey);
    ev.requestRender();
  });
  dom.edKeysCanvas.addEventListener("pointermove", (e) => {
    if (!keyDrag || keyDrag.pointerId !== e.pointerId) return;
    const dx = e.clientX - keyDrag.x0, dy = e.clientY - keyDrag.y0;
    if (keyDrag.mode === "key") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      keyOff();
      keyDrag.mode = Math.abs(dx) > Math.abs(dy) ? "zoom" : "scroll";
    }
    if (keyDrag.mode === "scroll") ev.o.scroller.scrollTop = keyDrag.scrollTop0 - dy;
    else ev.setRowHeight(keyDrag.rowHeight0 * Math.exp(dx * 0.01), keyDrag.anchorY, keyDrag.rowAtAnchor);
  });
  const endKeyPointer = () => { keyOff(); keyDrag = null; };
  dom.edKeysCanvas.addEventListener("pointerup", endKeyPointer);
  dom.edKeysCanvas.addEventListener("pointercancel", endKeyPointer);
  dom.edKeysCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const { dy } = wheelDeltas(e);
    if (e.altKey || e.ctrlKey || e.metaKey) ev.zoomV(Math.exp(-dy * 0.002), e.clientY - dom.edKeysCanvas.getBoundingClientRect().top);
    else ev.o.scroller.scrollTop += dy;
  }, { passive: false });

  // ===== Transport =====
  function updatePosReadout() {
    const b = projectState.playheadBeat;
    dom.pos.textContent = `${Math.floor(b / Constants.BEATS_PER_BAR) + 1}.${Math.floor(b % Constants.BEATS_PER_BAR) + 1}.${Math.floor((b % 1) * 4) + 1}`;
  }

  function setPlayhead(beat) {
    projectState.playheadBeat = beat;
    audio.seek(beat);
    updatePosReadout();
    av.requestRender();
    ev.requestRender();
  }

  function followPlayhead(view, beat) {
    const s = view.o.scroller;
    const x = view.beatToX(beat);
    if (x < s.scrollLeft || x > s.scrollLeft + s.clientWidth) s.scrollLeft = x - 8;
  }

  function tickPlayhead() {
    if (!projectState.playing) return;
    projectState.playheadBeat = audio.positionBeat();
    updatePosReadout();
    if (projectState.follow) {
      followPlayhead(av, projectState.playheadBeat);
      const local = editorPlayhead();
      if (local !== null) followPlayhead(ev, local);
    }
    av.requestRender();
    ev.requestRender();
    requestAnimationFrame(tickPlayhead);
  }

  async function togglePlay() {
    if (projectState.playing) {
      audio.stop();
      projectState.playing = false;
      setPlayhead(0);
    } else {
      try {
        await audio.play();
        projectState.playing = true;
        requestAnimationFrame(tickPlayhead);
      } catch (err) {
        console.error("Playback could not start:", err);
      }
    }
    dom.play.textContent = projectState.playing ? "■" : "▶";
    dom.play.classList.toggle("on", projectState.playing);
  }

  // ===== MIDI import =====
  function importMidi(parsed, fileName) {
    if (parsed.bpm) setBpm(helpers.clamp(Math.round(parsed.bpm), 20, 300));
    const startBeat = snapFloor(projectState.playheadBeat, Constants.BEATS_PER_BAR);
    let first = null;
    for (const t of parsed.tracks) {
      
        
      const track = trackManager.addTrack(t.name || `${fileName} ch${t.channel + 1}`, Constants.DEFAULT_INSTRUMENT);
      const lastEnd = t.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
      const notes = t.notes.map((n) => ({ id: projectState.nextId++, ...n }));
      const clip = clipManager.createClip(track, startBeat, Math.max(Constants.BEATS_PER_BAR, helpers.ceilBars(lastEnd)), notes);
      first = first ?? clip;
    }
    if (first) clipManager.selectClip(first);
    updateManager.arrangementChanged();
    updateManager.editorClipChanged();
    return parsed.tracks.length;
  }

  function loadProject(projectData, fileName) {
    console.log("loadProject " + fileName, projectData)
    const startBeat = snapFloor(projectState.playheadBeat, Constants.BEATS_PER_BAR);
    let first = null;
    for (const t of projectData.tracks) {
      let track = trackManager.addTrack(t.name || `${fileName} ch${t.channel + 1}`, t.devices[0]);
      console.log("added track");

      let clips = projectData.clips.filter(c => c.trackId == t.id);
      clips.forEach(c => {
        console.log("adding clip", c)
        const lastEnd = c.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
        const clip = clipManager.createClip(track, startBeat, Math.max(Constants.BEATS_PER_BAR, helpers.ceilBars(lastEnd)), c.notes, c.end);
        console.log("added clip")
        first = first ?? clip;
      })
    }

    console.log("loadProject parsed " + fileName, projectData)
    projectState = projectData;
    if (first) clipManager.selectClip(first);
    updateManager.arrangementChanged();
    updateManager.editorClipChanged();
    console.log("loaded project", projectState.tracks.length)
    return projectData.tracks.length;
  }

  function saveProject() {
    let projectJson = JSON.stringify(projectState);
    if (window.navigator.userAgent.toString().startsWith("Mozilla/5.0 (Linux; Android 16; SM-A556B")) {
      console.log("Project saved", { "json": projectJson });
      return;
    }

    var a = document.createElement("a");
    var file = new Blob([projectJson], { type: "text/plain" });
    a.href = URL.createObjectURL(file);
    a.download = `${projectState.name}.json`;
    a.click();
  }

  function updateSongSettingsUI() {
    dom.projectName.value = projectState.name;
    dom.bpm.value = projectState.bpm;
    dom.songLoopLength.value = stateHelper.songEndBeats();
    dom.follow.classList.toggle("on", projectState.follow);
    dom.loop.classList.toggle("on", projectState.loop);
    dom.drawClips.classList.toggle("on", projectState.drawClips);
  }

  dom.importBtn.addEventListener("click", () => dom.midiFile.click());
  dom.midiFile.addEventListener("change", async () => {
    const file = dom.midiFile.files[0];
    dom.midiFile.value = "";
    if (!file) return;
    try {
      const count = importMidi(parseMidiFile(await file.arrayBuffer()), file.name.replace(/\.midi?$/i, ""));
      dom.hint.textContent = count ? `Imported ${count} track${count === 1 ? "" : "s"} from ${file.name} at the playhead.`
        : `${file.name} contains no notes.`;
    } catch (err) {
      dom.hint.textContent = `Could not import ${file.name}: ${err.message}`;
    }
  });
  dom.loadBtn.addEventListener("click", () => dom.projectFile.click());
  dom.projectFile.addEventListener("change", async () => {
    const file = dom.projectFile.files[0];
    console.log("loading file", file)
    dom.projectFile.value = "";
    if (!file) return;
    try {
      var reader = new FileReader();
      reader.addEventListener("load", (e) => {
        var contents = e.target.result;
        try {
          let projectFile = JSON.parse(contents);
          console.log("loading file", projectFile);
          loadProject(projectFile, file.name.replace(/\.json?$/i, ""));
        }
        catch (error) {
          console.error("Error while loading project", error)
        }
        finally {
          projectFile.style.display = "none";
        }
      });

      reader.readAsText(file);
    } catch (err) {
      dom.hint.textContent = `Could not import ${file.name}: ${err.message}`;
    }
  });
  dom.saveBtn.addEventListener("click", () => saveProject());

  // ===== Controls =====
  function setBpm(bpm) {
    projectState.bpm = bpm;
    dom.bpm.value = bpm;
    audio.setBpm(bpm);
  }

  function setDrawMode(on) {
    ed.drawMode = on;
    dom.draw.classList.toggle("on", on);
    if (on) ed.selected.clear();
    ev.requestRender();
  }

  function bindToggle(button, target, key, onChange) {
    button.addEventListener("click", () => {
      target[key] = !target[key];
      button.classList.toggle("on", target[key]);
      onChange();
    });
  }


  dom.projectName.addEventListener("change", () => projectState.name = dom.projectName.value);

  dom.play.addEventListener("click", togglePlay);
  dom.bpm.addEventListener("input", () => {
    const v = Number(dom.bpm.value);
    if (v >= 20 && v <= 300) { projectState.bpm = v; audio.setBpm(v); }
  });
  dom.bpm.addEventListener("change", () => setBpm(helpers.clamp(Number(dom.bpm.value) || projectState.bpm, 20, 300)));
  bindToggle(dom.loop, projectState, "loop", () => audio.setLoop(projectState.loop, stateHelper.songEndBeats()));
  bindToggle(dom.follow, projectState, "follow", () => { });
  bindToggle(dom.drawClips, projectState, "drawClips", () => { });
  dom.addTrack.addEventListener("click", async () => {
    trackManager.addTrack(`Track ${projectState.tracks.length + 1}`, Constants.DEFAULT_INSTRUMENT);
    updateManager.arrangementChanged();
  });
  dom.addClip.addEventListener("click", () => {
    const track = stateHelper.trackById(projectState.selectedTrackId);
    if (!track) return;
    const start = snapFloor(projectState.playheadBeat, Constants.BEATS_PER_BAR);
    // selectClip(clipManager.createClip(track, start, Constants.BEATS_PER_BAR));
    clipManager.createClip(track, start, Constants.BEATS_PER_BAR);
    updateManager.arrangementChanged();
  });
  dom.dupClip.addEventListener("click", duplicateClip);
  dom.delClip.addEventListener("click", () => {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    clipManager.removeClip(clip.id);
    updateManager.arrangementChanged();
    updateManager.editorClipChanged();
  });

  function duplicateClip() {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    const copy = clipManager.createClip(
      stateHelper.trackById(clip.trackId),
      helpers.clipEnd(clip),
      clip.length,
      clip.notes.map((n) => ({ ...n, id: projectState.nextId++ })),
      helpers.clipEnd(clip) + (clip.end - clip.start));
    clipManager.selectClip(copy);
    updateManager.arrangementChanged();
  }

  dom.len.addEventListener("change", () => {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    clip.length = helpers.clamp(Number(dom.len.value) || clip.length / Constants.BEATS_PER_BAR, 0.25, 256) * Constants.BEATS_PER_BAR;
    dom.len.value = clip.length / Constants.BEATS_PER_BAR;
    audio.rebuildClip(clip);
    updateManager.arrangementChanged();
    ev.updateSpacer();
    ev.requestRender();
  });
  dom.end.addEventListener("change", () => {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    clip.end = parseInt(dom.end.value);
    audio.rebuildClip(clip);
    updateManager.arrangementChanged();
    ev.updateSpacer();
    ev.requestRender();
    av.requestRender();
  });

  dom.gridSelect.addEventListener("change", () => {
    ed.gridMode = dom.gridSelect.value;
    dom.gridReadout.textContent = editorGrid().label;
    ev.requestRender();
  });
  dom.loopClip.addEventListener("click", () => {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    dom.loopClip.classList.toggle("on");
    clip.loop = dom.loopClip.classList.contains("on");
    console.log("loop changed", clip.loop)
  });
  bindToggle(dom.loopClip, ed, "loop", () => { });
  bindToggle(dom.triplet, ed, "triplet", () => { dom.gridReadout.textContent = editorGrid().label; ev.requestRender(); });
  bindToggle(dom.snap, ed, "snap", () => { });
  bindToggle(dom.accent, ed, "accent", () => { });
  bindToggle(dom.slide, ed, "slide", () => { });
  dom.draw.addEventListener("click", () => setDrawMode(!ed.drawMode));
  dom.clear.addEventListener("click", () => {
    const clip = stateHelper.currentClip();
    if (!clip) return;
    clip.notes = [];
    ed.selected.clear();
    updateManager.notesChanged();
  });

  $("arrZoomInH").addEventListener("click", () => av.zoomH(Constants.ZOOM_BUTTON_FACTOR));
  $("arrZoomOutH").addEventListener("click", () => av.zoomH(1 / Constants.ZOOM_BUTTON_FACTOR));
  $("arrZoomInV").addEventListener("click", () => av.zoomV(Constants.ZOOM_BUTTON_FACTOR));
  $("arrZoomOutV").addEventListener("click", () => av.zoomV(1 / Constants.ZOOM_BUTTON_FACTOR));
  $("edZoomInH").addEventListener("click", () => ev.zoomH(Constants.ZOOM_BUTTON_FACTOR));
  $("edZoomOutH").addEventListener("click", () => ev.zoomH(1 / Constants.ZOOM_BUTTON_FACTOR));
  $("edZoomInV").addEventListener("click", () => ev.zoomV(Constants.ZOOM_BUTTON_FACTOR));
  $("edZoomOutV").addEventListener("click", () => ev.zoomV(1 / Constants.ZOOM_BUTTON_FACTOR));

  for (const b of document.querySelectorAll(".toolbar .btn")) b.addEventListener("click", () => b.blur());

  window.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const clip = stateHelper.currentClip();
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    else if (e.key === "b" || e.key === "B") setDrawMode(!ed.drawMode);
    else if (e.key === "Escape") { ed.selected.clear(); ev.requestRender(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateClip(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && clip) {
      e.preventDefault();
      ed.selected = new Set(clip.notes.map((n) => n.id));
      ev.requestRender();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (clip && ed.selected.size) deleteNotes(clip, [...ed.selected]);
      else if (clip) { clipManager.removeClip(clip.id); updateManager.arrangementChanged(); updateManager.editorClipChanged(); }
    }
  });

  const helpers = {
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    midiName: (pitch) => Constants.NOTE_NAMES[pitch % 12] + (Math.floor(pitch / 12) - 2),  // Ableton: C3 = MIDI 60
    snapFloor: (beat, step) => (step ? Math.floor(beat / step + Constants.EPS) * step : beat),
    snapRound: (beat, step) => (step ? Math.round(beat / step) * step : beat),
    ceilBars: (beats) => Math.ceil(beats / Constants.BEATS_PER_BAR - Constants.EPS) * Constants.BEATS_PER_BAR,
    clipEnd: (clip) => clip.end ? clip.end : clip.start + clip.length,
    beatsToTime: (beats) => {
      let remainingBeats = beats;
      let bars = Math.floor(beats / 4);
      remainingBeats -= (bars * 4);
      let barBeats = Math.floor(beats % 4);
      remainingBeats -= barBeats;
      if (remainingBeats > 1) throw "eeror";
      let beatSixteenths = remainingBeats * 4;
      return Tone.Time(`${bars}:${barBeats}:${beatSixteenths}`);
    },
    isObject: (value) => { typeof value === 'object' && !Array.isArray(value) && value !== null; }
  }
  
  class StateHelper {
    constructor(projectState, helpers) {
      this.projectState = projectState;
      this.helpers = helpers;
    }
    
    trackById(id) { return this.projectState.tracks.find((t) => t.id === id); }
    clipById(id) { return this.projectState.clips.find((c) => c.id === id); }
    currentClip() { return this.clipById(this.projectState.selectedClipId) ?? null; }
    songEndBeats() {
      let endBeats = Math.max(Constants.MIN_SONG_BEATS, this.helpers.ceilBars(this.projectState.clips.reduce((m, c) => Math.max(m, this.helpers.clipEnd(c)), 0)));
      if (endBeats > this.projectState.loopLength)
        projectState.loopLength = endBeats;
      return endBeats;
    }
  }

  class MetadataManager {
    metadata;
    deviceParameters = {};
    
    async loadDevices() {
      if (devicesJson) {
        this.parseDevices(devicesJson);
      }
      else {
        console.log("Load devices")
        await fetch('devices.json')
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            this.parseDevices(data);
          })
          .catch(error => {
            console.error('Error loading JSON:', error);
          });
      }
    }

    parseDevices(data) {
      console.log("parsing devices");
      deviceList = data;
      this.metadata = data;
      Object.keys(data.devices).forEach(deviceName => {
        if (data.devices[deviceName].type == "Instrument") {
          instrumentNames.push(deviceName);
        } else if (data.devices[deviceName].type == "Effect") {
          effectNames.push(deviceName);
        }
      });
    }
    
    getDeviceMetadata(deviceName) {
      console.log("getDeviceMetadata for " + deviceName)
      if (!this.deviceParameters[deviceName]) {
        let componentMetadata = this.metadata.devices[deviceName] ? this.metadata.devices[deviceName] : this.metadata.modules[deviceName];
        if (!componentMetadata.parameters) console.warn("No params", componentMetadata)
        this._traverseParams(deviceName, componentMetadata.parameters, "");
      }
      return this.deviceParameters[deviceName];
    }
    
    getDeviceNumberParameters(deviceName) {
      //console.log("getDeviceNumberParameters for " + deviceName)
      let deviceMetadata = this.getDeviceMetadata(deviceName);
      
      let results = [];
      Object.entries(deviceMetadata).forEach(item => {
        if (item[1].type == "Number") results.push({ name: item[0], metadata: item[1].metadata}) });
        
      //console.log("number params ", results);
      return results;
    }
    
    buildDeviceState(device, deviceState) {
      let deviceMetadata = this.getDeviceMetadata(device.name);
      let deviceContext = device;
      let deviceStateContext = deviceState.parameters;
      Object.keys(deviceMetadata).forEach(paramNamespace => {
        let parts = paramNamespace.split(".");
        let deviceContext = device;
        let deviceStateContext = deviceState.parameters;
        for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
          let part = parts[partIndex];
          deviceContext = deviceContext[part];
          if (!deviceStateContext[part]) deviceStateContext[part] = {};
          deviceStateContext = deviceStateContext[part];
        }
        let paramName = parts[parts.length - 1];
        if (!deviceStateContext[paramName]) {
          let paramValue = deviceContext[paramName].name ? deviceContext[paramName].value : deviceContext[paramName];
          deviceStateContext[paramName] = paramValue;
        }
      })
    }
    
    _traverseParams(deviceName, metadataContext, paramPath) {
      console.log("traverseParams for " + deviceName + "." + paramPath)
      Object.keys(metadataContext).forEach(parameterName => {
        if (!parameterName) throw "empty param name"
        let paramMetadataPath = metadataContext[parameterName];
        //console.log("Param metadata of " + deviceName + "." + parameterName, metadataContext)
        if (!paramMetadataPath) throw `missing param metadata for "${paramPath}.${parameterName}"`;
        
        if (paramMetadataPath.startsWith("unitTypes") || paramMetadataPath.startsWith("enumTypes")) {
          let currentParamPath = paramPath ? paramPath + "." + parameterName : parameterName;
          let parts = paramMetadataPath.split("/");
          let metadataContainer = this.metadata[parts[0]];
          //console.log("Looking up " + parts[1] + " in " + parts[0], metadataContainer);
          let paramMetadata = metadataContainer[parts[1]];
          let paramType = paramMetadataPath.startsWith("unitTypes") ? "Number" : "Option";
          this._addParameterMetadata(deviceName, currentParamPath, paramType, paramMetadata);
        }
        else if (paramMetadataPath.startsWith("device") || paramMetadataPath.startsWith("module")) {
          let childParamPath = paramPath ? paramPath + "." + parameterName : parameterName;
          let parts = paramMetadataPath.split("/");
          let componentName = parts[1];
          let componentMetadata = parts[0] == "devices" ? this.metadata.devices[componentName] : this.metadata.modules[componentName];
          this._traverseParams(deviceName, componentMetadata.parameters, childParamPath);
        }
      });
    }
    
    _addParameterMetadata(deviceName, parameterPath, parameterType, parameterMetadata) {
      if (!this.deviceParameters[deviceName]) this.deviceParameters[deviceName] = {};
      this.deviceParameters[deviceName][parameterPath] = { type: parameterType, metadata: parameterMetadata };
      console.log("added parameter metadata for " + deviceName + "." + parameterPath, parameterMetadata);
    }
  }

  const fillTargetParameters = (track, targetDeviceSelect, targetParameterSelect) => {
        targetParameterSelect.innerHTML = "";
        let trackDevice = track.devices[targetDeviceSelect.value];
        let trackDeviceMetadata = deviceList.devices[trackDevice.name].parameters;

        let targetParameters = [];
        let paramContext = trackDevice.parameters;
        let paramPath = "";
        
        
        traverseParams(paramContext, paramPath, trackDeviceMetadata);

        targetParameters.sort().forEach(parameterName => {
          targetParameterSelect.innerHTML += `<option value="${parameterName}">${parameterName}</option>`;
        })

        function traverseParams(paramContext, paramPath, deviceMetadata) {
          Object.keys(paramContext).forEach(parameterName => {
            if (!parameterName) {
              throw "empty param name"
            }
            let paramMetadata = deviceMetadata[parameterName];
            if (!paramMetadata) {
              throw `missing param metadata for "${paramPath}.${parameterName}"`;
            }

            if (paramMetadata.startsWith("unitTypes")) {
              if (paramPath)
                targetParameters.push(paramPath + "." + parameterName)
              else
                targetParameters.push(parameterName)
            }
            else if (paramMetadata.startsWith("device") || paramMetadata.startsWith("module")) {
              let childParamPath = paramPath ? paramPath + "." + parameterName : parameterName;
              let parts = paramMetadata.split("/");
              let deviceName = parts[1];
              console.log("device nane", deviceName)
              let deviceMetadata = parts[0] == "devices" ? deviceList.devices[deviceName] : deviceList.modules[deviceName];
              console.log("device metadata", deviceMetadata)
              traverseParams(paramContext[parameterName], childParamPath, deviceMetadata.parameters);
            }
          });
        }
      }
      
  class BottomPanelManager {
    _xyPad;
    constructor() {
      this.editor = document.querySelector(".editor");
      this.instrumentPanel = document.querySelector(".instrument-panel");
      this.effectsPanel = document.querySelector(".effects-panel");
      this.modulationPanel = document.querySelector(".modulation-panel");
      this.xypadPanel = document.querySelector(".xypad-panel");
      this.mixerPanel = document.querySelector(".mixer");
      
      this._xyPad = new XypadPanel(this.xypadPanel);
      this.xypadPanel.style.display = "none";
      
      dom.clipEditorTabBtn.addEventListener("click", () => {
        dom.clipEditorTabBtn.classList.toggle("on");
        if (dom.clipEditorTabBtn.classList.contains("on")) {
          this.showClipEditorPanel();
        }
        else {
          this.editor.style.display = "none";
        }
      });

      dom.instrumentTabBtn.addEventListener("click", () => {
        dom.instrumentTabBtn.classList.toggle("on");
        if (dom.instrumentTabBtn.classList.contains("on")) {
          this.showInstrumentPanel()
        }
        else {
          this.instrumentPanel.style.display = "none";
        }
      });

      dom.effectsTabBtn.addEventListener("click", () => {
        dom.effectsTabBtn.classList.toggle("on");
        if (dom.effectsTabBtn.classList.contains("on")) {
          this.showEffectsPanel();
        }
        else {
          this.effectsPanel.style.display = "none";
        }
      });

      dom.modulationTabBtn.addEventListener("click", () => {
        dom.modulationTabBtn.classList.toggle("on");
        if (dom.modulationTabBtn.classList.contains("on")) {
          this.showModulationPanel();
        }
        else {
          this.modulationPanel.style.display = "none";
        }
      });

      dom.xypadTabBtn.addEventListener("click", () => {
        dom.xypadTabBtn.classList.toggle("on");
        if (dom.xypadTabBtn.classList.contains("on")) {
          this.showXypadPanel();
        }
        else {
          this.xypadPanel.style.display = "none";
        }
      });
      
      dom.mixerTabBtn.addEventListener("click", () => {
        dom.mixerTabBtn.classList.toggle("on");
        if (dom.mixerTabBtn.classList.contains("on")) {
          this.showMixerPanel()
        }
        else {
          this.mixerPanel.style.display = "none";
        }
      });
    }

    showClipEditorPanel() {
    /*  if (!currentClip())
        dom.loopClip.classList.remove("on");
      else*/
        this.showPanel(this.editor, dom.clipEditorTabBtn);

      /*let trackHeader = dom.trackHeaders.querySelector(`[data-id="${projectState.selectedTrackId}"]`);
      const trackElement = trackHeader.closest(".track");
      trackElement.scrollIntoView();
      console.log("scroll into view", trackElement);*/
    }

    showInstrumentPanel() {
      this.showPanel(this.instrumentPanel, dom.instrumentTabBtn);
      this.renderInstrumentPanel();
    }

    showEffectsPanel() {
      this.showPanel(this.effectsPanel, dom.effectsTabBtn);
      this.renderEffectsPanel();
    }

    showModulationPanel() {
      this.showPanel(this.modulationPanel, dom.modulationTabBtn);
      this.renderModulationPanel();
    }

    showXypadPanel() {
      this.showPanel(this.xypadPanel, dom.xypadTabBtn);
      this.renderXypadPanel();
    }
    
    showMixerPanel() {
      this.showPanel(this.mixerPanel, dom.mixerTabBtn);
    }

    showPanel(panelToShow, tabButtonToShow) {
      const panels = document.querySelector(".bottom-panel").querySelectorAll(".panel");
      panels.forEach(panel => {
        if (panel != panelToShow) {
          panel.style.display = "none";
        }
        else {
          panel.style.display = "flex";
        }
      })
      const tabButtons = document.querySelector(".bottom-panel").querySelectorAll(".tab-strip button");
      tabButtons.forEach(button => {
        if (button != tabButtonToShow) {
          button.classList.remove("on");
        }
        else {
          button.classList.add("on");
        }
      });
    }

    refreshActivePanel() {
      const activeButton = document.querySelector(".bottom-panel").querySelector(".tab-strip button.on");
      if (!activeButton) return;
      if (activeButton.id == "instrument-panel-tab-button")
        this.renderInstrumentPanel();
      else if (activeButton.id == "effects-panel-tab-button")
        this.renderEffectsPanel();
      else if (activeButton.id == "modulation-panel-tab-button")
        this.renderModulationPanel();
      else if (activeButton.id == "xypad-panel-tab-button")
        this.renderXypadPanel();
    }

    renderInstrumentPanel() {
      let parentPanel = this.instrumentPanel;
      this.instrumentPanel.style.display = "flex";
      let track = projectState.tracks.find(track => track.id === projectState.selectedTrackId);
      if (!track) {
        parentPanel.style.display = "none";
        return;
      }

      let deviceToInspect = audio.getTrackInstrument(track);
      parentPanel.innerHTML = "";
      this.renderDevice(parentPanel, track, deviceToInspect, 0, instrumentNames, instrumentPresets, "Instrument");
    }

    renderEffectsPanel() {
      this.effectsPanel.style.display = "flex";
      let track = projectState.tracks.find(track => track.id === projectState.selectedTrackId);
      if (!track) {
        console.log("no track fx")
        this.effectsPanel.style.display = "none";
        return;
      }

      let trackEffects = audio.getTrackEffects(track);

      this.effectsPanel.innerHTML = "";
      trackEffects.forEach(fx => this.renderDevice(this.effectsPanel, track, fx, 1 + trackEffects.indexOf(fx), effectNames, effectPresets, "Effect"));
      this.renderDevice(this.effectsPanel, track, { name: "" }, trackEffects.length, effectNames, effectPresets, "Effect");
    }

    renderModulationPanel() {
      this.modulationPanel.style.display = "flex";
      let track = projectState.tracks.find(track => track.id === projectState.selectedTrackId);
      if (!track) {
        console.log("no track")
        this.modulationPanel.style.display = "none";
        return;
      }
      else {
        if (!dom.modulationTabBtn.classList.contains("on")) {
          dom.modulationTabBtn.classList.add("on");
        }
      }

      let trackModulators = audio.getTrackModulators(track);
      let modulatorsStartIndex = 1 + track.effects.length;

      this.modulationPanel.innerHTML = "";
      console.log("show modulators", trackModulators, modulatorsStartIndex, track.devices[modulatorsStartIndex]);
      try {
        trackModulators.forEach(mod => this.renderDevice(this.modulationPanel, track, mod, modulatorsStartIndex + trackModulators.indexOf(mod), modulatorNames, modulatorPresets, "LFO"));
      }
      catch (error) {
        console.error("Error while creating modulatoe html", error)
      }
      this.renderDevice(this.modulationPanel, track, { name: "", parameters: {} }, modulatorsStartIndex + trackModulators.length, modulatorNames, modulatorPresets, "LFO");
    }

    renderXypadPanel() {
      console.log("xypad render")
      this.xypadPanel.style.display = "flex";
      let track = projectState.tracks.find(track => track.id === projectState.selectedTrackId);
      if (!track) {
        console.log("no track")
        this.xypadPanel.style.display = "none";
        return;
      }
      else {
        if (!dom.xypadTabBtn.classList.contains("on")) {
          dom.xypadTabBtn.classList.add("on");
        }
      }
      
      this._xyPad.init(track);
    }
    

    renderDevice(parentPanel, track, trackDeviceNode, deviceIndex, deviceNames, devicePresets, panelType = "Instrument") {
      let devicePanel = document.createElement("div");
      devicePanel.className = "device";
      devicePanel.dataset.trackid = track.id;
      parentPanel.appendChild(devicePanel);

      let isInstrument = panelType == "Instrument";
      let isLFO = panelType == "LFO";
      let hasPresets = !isLFO;

      let isMultiDevicePanel = panelType != "Instrument";
      if (isLFO) {
        let targetDeviceOptionsHtml = track.devices.map((d) => `<option value="${track.devices.indexOf(d)}">${d.name}</option>`).join("");
        devicePanel.innerHTML += `<div class="device-header"><button class="prev">⏪️</button>
          To: <select class="targetDevice" title="Target device">${targetDeviceOptionsHtml}</select>
          <select class="targetParameter" title="Target parameter"></select><button class="next">⏩️</button>
        </div>
        <div class="device-parameters"></div>`;
      } else {
        let deviceOptionsHtml = deviceNames.map((i) => `<option value="${i}">${i}</option>`).join("");
        devicePanel.innerHTML += `<div class="device-header"><button class="prev">⏪️</button>
          <select class="inst" title="Instrument">${deviceOptionsHtml}</select>
          <select class="instPreset" title="Preset"></select><button class="next">⏩️</button>
        </div>
        <div class="device-parameters"></div>`;
      }

      let parametersPanel = devicePanel.querySelector(".device-parameters");
      let prevBtn = devicePanel.querySelector(".prev");
      let nextBtn = devicePanel.querySelector(".next");
      let lastEffectIndex = track.effects.length + 1;
      if (isMultiDevicePanel) {
        prevBtn.style.display = "inline";
        nextBtn.style.display = "inline";
        prevBtn.disabled = deviceIndex == 1 ? "disabled" : "";

        nextBtn.disabled = deviceIndex == lastEffectIndex ? "disabled" : "";
        prevBtn.onclick = (e) => devicePanel.previousElementSibling.scrollIntoView();
        nextBtn.onclick = (e) => devicePanel.nextElementSibling.scrollIntoView();
      }
      else {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
      }

      let targetParamMetadata = null;
      if (hasPresets) {
        let instrumentSelect = devicePanel.querySelector(".inst");
        console.log("get instrument select", instrumentSelect);
        let instrumentPresetSelect = devicePanel.querySelector(".instPreset");
        console.log("inst preset select", instrumentPresetSelect);

        instrumentSelect.value = trackDeviceNode.name;
        fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);
        if (isInstrument) {
          instrumentPresetSelect.value = track.devices[0].presetName;
          console.log("Preset", track.devices[0].presetName)
        }

        instrumentSelect.oninput = async (e) => {
          if (isInstrument) {
            track.instrumentName = e.target.value;
            console.log("Selected instrument " + track.instrumentName)
            audio.updateTrack(track);
            console.log("Yrack updated for Selected instrument " + track.instrumentName)
            track.devices[0].presetName = "default";
            console.log("Preset set for Selected instrument " + track.instrumentName)
            trackDeviceNode = audio.getTrackInstrument(track);
            if (trackDeviceNode.name !== track.instrumentName)
              throw "mismatch"
            fillDevicePresets(devicePanel, devicePresets, track.instrumentName);
            console.log("device changed to " + track.instrumentName, trackDeviceNode)
          }
          else {
            if (trackDeviceNode.name === "") {
              let newFx = { name: e.target.value, parameters: {} };
              track.effects.push(newFx);
              track.devices.push(newFx);
              audio.updateTrack(track);
              console.log("updated track with new effect " + e.target.value);
              let effects = audio.getTrackEffects(track);
              trackDeviceNode = effects[effects.length - 1];
              console.log("added effect", trackDeviceNode)
              fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);

              nextBtn.disabled = deviceIndex == lastEffectIndex ? "disabled" : "";
              renderDeviceParameters();
              renderDevice(effectsPanel, track, { name: "", parameters: {} }, track.effects.length, effectNames, effectPresets, "Effect");
            }
            else {
              fillDevicePresets(devicePanel, devicePresets, trackDeviceNode.name);
            }
          }

          renderDeviceParameters();
          renderDeviceLists();
          document.dispatchEvent(new CustomEvent("InstrumentChanged", { detail: { trackId: track.id, instrumentName: e.target.value } }));
          audio.updateTrack(track);
        };

        instrumentPresetSelect.oninput = (e) => {
          if (isInstrument) {
            track.instrumentParameters = devicePresets[track.instrumentName][e.target.value];
            track.devices[0].presetName = e.target.value;
          }

          console.log("Preset selected " + e.target.value, track.instrumentParameters)
          audio.updateTrack(track);
          renderDeviceParameters();
          document.dispatchEvent(new CustomEvent("InstrumentPresetChanged", { detail: { trackId: track.id, presetName: e.target.value } }));
        };

      }
      else if (isLFO) {
        let modulatorsStartIndex = 1 + track.effects.length;
        let modulatorIndex = deviceIndex - modulatorsStartIndex;
        let modulation = track.modulators[0];

        let targetDeviceSelect = devicePanel.querySelector(".targetDevice");
        if (modulation) {
          targetDeviceSelect.value = modulation.targetDeviceIndex;

          let targetParameterSelect = devicePanel.querySelector(".targetParameter");

          fillTargetParameters(track, targetDeviceSelect, targetParameterSelect);
          targetParameterSelect.value = modulation.targetParameter;
          let targetDevice = track.devices[targetDeviceSelect.value];
          targetParamMetadata = deviceList.devices[targetDevice.name].parameters[modulation.targetParameter];

          targetDeviceSelect.oninput = (e) => fillTargetParameters(track, targetDeviceSelect, targetParameterSelect);
          targetParameterSelect.oninput = (e) => {
            console.log("param selected")
            modulation.targetParameter = targetParameterSelect.value;
            let targetDevice = track.devices[targetDeviceSelect.value];
            let targetDeviceMetadata = deviceList.devices[targetDevice.name];
            targetParamMetadata = targetDeviceMetadata.parameters[modulation.targetParameter];
            console.log("param render " + modulation.targetParameter, targetDeviceMetadata, targetParamMetadata)
            renderDeviceParameters(targetParamMetadata);
          }
        }
        else {
          console.log("modulation not found", track.modulators, modulatorIndex)
        }
      }

      renderDeviceParameters(targetParamMetadata);
      renderDeviceLists();

      
      function renderDeviceParameters(targetParamMetadata = null) {
        console.log("renderDeviceParameters", targetParamMetadata)
        parametersPanel.innerHTML = "";
        if (trackDeviceNode.name == "") {
          return;
        }
        if (deviceIndex < track.devices.length) {
          let trackDeviceState = track.devices[deviceIndex].parameters;
          let trackDeviceMetadata = deviceList.devices[trackDeviceNode.name];
          console.log("create device html, track/trackDeviceNode/trackDeviceState/trackDeviceMetadata", track, trackDeviceNode, trackDeviceState, trackDeviceMetadata);

          Object.keys(trackDeviceMetadata.parameters).forEach(parameterName => renderDeviceParameter(parameterName, trackDeviceMetadata, trackDeviceState, targetParamMetadata));
        }
        
        function renderDeviceParameter(parameterPath, deviceMetadata, trackDeviceState, targetParameterMetadata = null) {
          const useDeviceStateOnly = true;
  
          let parameterPathParts = parameterPath.split(".");
          let parameterName = parameterPathParts[parameterPathParts.length - 1];
          let parameterGroup = parameterPathParts.length > 1 ? parameterPath.substring(0, parameterPath.length - (parameterName.length + 1)) : "";
          if (parameterGroup) {
            console.log("group: " + parameterGroup)
          }
          if (parameterName === "frequency")
            console.warn("frequency", trackDeviceState)
  
          let parameterMetadataPath = deviceMetadata.parameters[parameterName];
          let parts = parameterMetadataPath.split("/");
          let paramMetadata = targetParameterMetadata && (parameterName == "min" || parameterName == "max") ? targetParameterMetadata : deviceList[parts[0]][parts[1]];
  
          //console.log("param metadata", parameterMetadataPath, paramMetadata);
  
          let paramElement = document.createElement("div");
          paramElement.className = "parameter";
          paramElement.dataset.group = parameterGroup;
          if (parameterGroup)
            paramElement.classList.add("hidden");
          parametersPanel.appendChild(paramElement);
  
          if (parts[0] == "unitTypes" || parts[0] == "enumTypes") {
            let stateValue = getParamState(parameterPath);
            let paramContext = getParameterContext(parameterPath, trackDeviceState);
  
            let paramIsObject = paramContext[parameterName].name == "Signal" || paramContext[parameterName].name == "Param" || helpers.isObject(paramContext[parameterName]);
            //console.log(`param ${parameterName} is object: ${paramIsObject}`);
            let paramValue = paramIsObject ? paramContext[parameterName].value : paramContext[parameterName];
  
            if (stateValue != undefined && stateValue !== paramValue) {
              console.warn(`using state value for "${parameterPath}", stateValue/paramValue`, stateValue, paramValue)
              paramValue = stateValue;
            }
            else {
              if (stateValue !== paramValue && stateValue == undefined)
                console.warn("using param context value " + parameterPath, paramValue, stateValue, trackDeviceState)
            }
  
            if (useDeviceStateOnly) {
              paramValue = stateValue;
            }
  
            let label = document.createElement("label");
            let prefix = parameterGroup ? "> " : "";
            label.innerText = prefix + parameterName; // parameterPath.replace(".", " ");
            paramElement.appendChild(label);
  
            let valueGroup = document.createElement("div");
            valueGroup.className = "value-group";
            paramElement.appendChild(valueGroup);
  
            if (parts[0] == "unitTypes") {
  
              let input = document.createElement("number-input");
              input.readOnly = true;
              valueGroup.appendChild(input);
              input.name = parameterPath;
              input.min = paramMetadata.min;
              input.max = paramMetadata.max;
              input.step = paramMetadata.step;
              input.value = paramValue;
              input.fill = "#d29524";
              input.focusFill = "#f2b544";
              if (parameterName == "frequency")
                console.warn(`frequency input`, input);
              else
                console.log("input", input)
              input.oninput = () => {
                if (paramIsObject)
                  paramContext[parameterName].value = input.value;
                else
                  paramContext[parameterName] = input.value;
  
                updateParamState(parameterPath, input.value);
              }
              
              let unitLabel = document.createElement("label");
              unitLabel.className = "unit";
              valueGroup.appendChild(unitLabel);
              if (targetParameterMetadata && (parameterName == "min" || parameterName == "max")) {
                if (targetParameterMetadata.unit)
                  unitLabel.innerText = targetParameterMetadata.unit
              }
              else if (paramMetadata.unit) {
                unitLabel.innerText = paramMetadata.unit
              }
  
            }
            else if (parts[0] == "enumTypes") {
              let select = document.createElement("select");
              let optionsHtml = "";
              paramMetadata.values.forEach(value => {
                let option = document.createElement("option");
                option.value = value;
                option.innerText = value;
                if (paramValue == value) {
                  option.selected = "selected";
                }
                select.appendChild(option);
              });
              valueGroup.appendChild(select);
              select.oninput = () => {
                if (paramIsObject)
                  paramContext[parameterName].value = select.value;
                else
                  paramContext[parameterName] = select.value;
                updateParamState(parameterPath, input.value);
              }
              let unitLabel = document.createElement("label");
              unitLabel.className = "unit";
              valueGroup.appendChild(unitLabel);
            }
          }
          else {
            let label = document.createElement("label");
            label.className = "paramgroup";
            label.dataset.group = parameterPath;
            label.innerText = parameterPath.replace(".", " ");
            paramElement.appendChild(label);
            label.addEventListener("click", () => {
              const groupParams = parametersPanel.querySelectorAll(`div.parameter[data-group="${parameterPath}"]`);
              groupParams.forEach(param => param.classList.toggle("hidden"));
            })
  
            if (parts[0] == "modules") {
              let moduleMetadata = deviceList.modules[parts[1]];
              Object.keys(moduleMetadata.parameters).forEach(childParameterName => renderDeviceParameter(parameterName + "." + childParameterName, moduleMetadata, trackDeviceState));
            }
            else if (parts[0] == "devices") {
              let moduleMetadata = deviceList.devices[parts[1]];
              Object.keys(moduleMetadata.parameters).forEach(childParameterName => renderDeviceParameter(parameterName + "." + childParameterName, moduleMetadata, trackDeviceState));
            }
          }

          function getParameterContext(parameterPath, trackDeviceState) {
            let paramValue, paramStateValue = null;
            try {
              //console.log("getting value for " + parameterPath);
              let trackDeviceNodeParamContext = trackDeviceNode;
  
              if (parameterPath == "oscillator.detune") {
                console.log("osc detune")
              }
              for (let partIndex = 0; partIndex < parameterPathParts.length - 1; partIndex++) {
                let pathPart = parameterPathParts[partIndex];
                trackDeviceNodeParamContext = trackDeviceNodeParamContext[pathPart];
              }
              return trackDeviceNodeParamContext;
            }
            catch (error) {
              console.error("Traverse error", error);
            }
          }
  
          function getParamState(parameterPath) {
            let parts = parameterPath.split(".");
            let paramName = parts[parts.length - 1];
            let stateContext = trackDeviceState;
            if (parts.length > 1) {
              // console.log(`getParamState("${parameterPath}"): nested value`, trackDeviceState);
            }
            for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
              stateContext = stateContext[parts[partIndex]];
            }
            let paramValue = stateContext[paramName];
            if (paramValue == undefined) {
              console.warn(`getParamState("${parameterPath}"): value undefined`, stateContext);
            }
            return paramValue;
          }
  
          function updateParamState(parameterPath, value) {
            // console.log("updateParamState",trackDeviceState, parameterPath, value)
            trackDeviceState[parameterName] = value;
            //console.log("paramState updated",trackDeviceState, parameterPath, value)
          }
        }
      }

      function renderDeviceLists() {
        console.log("renderDeviceLists")
        if (deviceIndex < track.devices.length) {
          let trackDeviceListsState = track.devices[deviceIndex].lists;
          let trackDeviceMetadata = deviceList.devices[trackDeviceNode.name];
          if (trackDeviceMetadata.lists) {
            console.log("create device lists html", track, trackDeviceNode, trackDeviceListsState, trackDeviceMetadata);
          
            Object.keys(trackDeviceMetadata.lists).forEach(listName => {
              let listMetadata = trackDeviceMetadata.lists[listName];
              let listContainer = document.createElement("div");
              listContainer.className = "list-container";
              parametersPanel.appendChild(listContainer);
              
              let label = document.createElement("label");
              label.innerText = listName;
              listContainer.appendChild(label);
              
              let listElement = document.createElement("div");
              listElement.className = "list";
              listElement.name = listName;
              let templateColumns = "";
              listMetadata.columns.forEach(name => {
                if (listMetadata.columns.indexOf(name) == listMetadata.columns.length - 1) {
                  templateColumns += "auto ";
                  console.log("add column for " + name)
                }
                else {
                  templateColumns += "min-content ";
                }
              });
            //  templateColumns += "min-content";
             /* if (listMetadata.itemMethods) {
                templateColumns += "min-content";
                console.log("add column for methods")
              }*/
              
              listContainer.appendChild(listElement);
              listElement.style.gridTemplateColumns = templateColumns;
              
              listMetadata.columns.forEach(name => {
                let listColumn = document.createElement("div");
                listColumn.className = "listcolumn";
                listColumn.innerText = name;
                listElement.appendChild(listColumn);
              });
              if (!trackDeviceListsState) {
                track.devices[deviceIndex].lists = { samples: [] };
                trackDeviceListsState = track.devices[deviceIndex].lists;
              }
              if (trackDeviceListsState && trackDeviceListsState[listName]) {
                trackDeviceListsState[listName].forEach(listItem => {
                  addListItem(listMetadata, trackDeviceListsState[listName], listItem, listElement);
                });
              }
              
              Object.keys(listMetadata.listMethods).forEach(methodName => {
                let method = listMetadata.listMethods[methodName];
                let methodButton = document.createElement("button");
                methodButton.className = "btn listmethod";
                methodButton.innerHTML = method.displayName;
                listContainer.appendChild(methodButton);
                methodButton.onclick = () => eval(`${method.functionName}(methodButton, listMetadata, trackDeviceListsState[listName], listElement, trackDeviceNode)`);
              });
            });
          }
        }
      }
      
      function addListItem(listMetadata, list, listItem, listElement) {
        console.log("addListItem", listMetadata, list, listItem, listElement);
        
        listMetadata.columns.forEach(name => {
          let listItemValue = document.createElement("div");
          listItemValue.innerText = listItem[name];
          listElement.appendChild(listItemValue);
        });
        /*
        Object.keys(listMetadata.itemMethods).forEach(methodName => {
          let method = listMetadata.itemMethods[methodName];
          let methodButton = document.createElement("button");
          methodButton.className = "btn itemmethod";
          methodButton.innerHTML = methodName;
          listElement.appendChild(methodButton);
          methodButton.onclick = () => eval(`${method.functionName}(listItem, listMetadata, trackDeviceListsState[listName], listElement, trackDeviceNode)`);
        });*/
      }
      
      function addSample(srcElement, listMetadata, list, listElement, sampler) {
        const fileInput = document.createElement("input");
        fileInput.style.display = "none";
        fileInput.type = "file";
        fileInput.accept = ".wav,.mp3";
        srcElement.parentElement.appendChild(fileInput);
        
        fileInput.addEventListener("change", async (e) => {
          console.log("chanhe")
          const file = fileInput.files[0];
          const filePath = fileInput.value;
          const fileName = filePath.substr(filePath.lastIndexOf('\\') + 1);


          if (!file) return;
          try {
            
            const fileReader = new FileReader();
            // when it's read into an ArrayBuffer, we can access that in the result property of the event target
            fileReader.onload = async (event) => {
              // create a ToneAudioBuffer from the ArrayBuffer with file contents. event.target.result is the ArrayBuffer with the file content
              const buffer = await sampler.context.decodeAudioData(event.target.result); 
  
              let noteFreq = Tone.Frequency("C2");
              if (list.length > 0) {
                noteFreq = noteFreq.transpose(list.length);
              }
              const listItem = {note: noteFreq.toNote(), name: fileName, url: buffer };
              list.push(listItem);
              addListItem(listMetadata, list, listItem, listElement);
              srcElement.parentElement.removeChild(fileInput);
              sampler.add(listItem.note, buffer);
              sampler.triggerAttackRelease(listItem.note, 1, 0, 127);
              fileInput.value = "";
            }
            // read the selected file into an ArrayBuffer
            fileReader.readAsArrayBuffer(file);
            
          } catch (err) {
            console.error(`Could not import ${file.name}: ${err.message}`, err);
            dom.hint.textContent = `Could not import ${file.name}: ${err.message}`;
          }
        });
        fileInput.click();
      }
      
    }
  }

  class TrackManager {
    constructor(projectState, audio, bottomPanelManager, mixer) {
      this.projectState = projectState;
      this.audio = audio;
      this.bottomPanelManager = bottomPanelManager;
      this.mixer = mixer;
      
      document.addEventListener("SelectTrack", (e) => this.selectTrackById(e.detail.trackId));
      document.addEventListener("SendChanged", (e) => this.updateTrackSends(e.detail.trackId));
    }
    
    deselectTrack() {
      if (!this.projectState.selectedTrackId) {
        return;
      }
      let trackElement = document.querySelector(`.track[data-id="${projectState.selectedTrackId}"]`);
      if (trackElement) {
        trackElement.classList.remove("selected");
      }
      this.projectState.selectedTrackId = null;
  
     // console.log("track cleared")
      this.bottomPanelManager.refreshActivePanel();
    }
  
    selectTrackById(trackId) {
      if (trackId === this.projectState.selectedTrackId) {
        return;
      }
      this.deselectTrack();
      this.projectState.selectedTrackId = trackId;
  
      let trackElement = document.querySelector(`.track[data-id="${projectState.selectedTrackId}"]`);
      if (trackElement) {
        trackElement.classList.add("selected");
      }
    }
  
    selectTrack(track) {
      if (track)
        this.selectTrackById(track.id);
      else
        this.deselectTrack();
    }
    
    addReturn(name, volume, sendEffect) {
      const send = { id: this.projectState.nextId++, name: name, volume: volume, mute: false, sendEffect: sendEffect };
      this.projectState.sends.push(send);
      this.audio.addReturnChannel(send);
      this.mixer.addReturnFader(send);
    }
    
    addTrack(name, instrument, effects, modulators = null, volume = 0, mute = false, sends = []) {
      if (!effects) effects = []
      if (!modulators) modulators = [];
  
     // console.log("addTrack " + name)
      let devices = [];
      instrument.presetName = "Default";
      devices.push(instrument);
      effects.forEach(fx => {
        fx.type = "Effect";
        fx.presetName = "Default";
        devices.push(fx);
      });
      //console.log("addingTrack " + name)
      modulators.forEach(modulator => devices.push(modulator.modulator));
      //console.log("add track model", devices)
      const track = {
        id: this.projectState.nextId++,
        name,
        color: Constants.TRACK_COLORS[this.projectState.tracks.length % Constants.TRACK_COLORS.length],
        instrumentName: instrument.name,
        instrumentParameters: instrument.parameters,
        //device: instrument, 
        devices: devices,
        effects: effects,
        modulators: modulators,
        mute: mute,
        volume: volume,
        sends: sends
      };
      try {
        this.projectState.tracks.push(track);
        this.audio.addTrack(track);
        this.selectTrack(track);
        this.mixer.addTrackFader(track);
        //console.log("added track model", track)
      }
      catch (error) {
        console.error("error while adding track", error)
      }
      return track;
    }
  
    updateTrackSends(trackId) {
      const track = trackById(trackId);
      this.audio.updateTrack(track);
      console.log("Sends updated for " + trackId)
    }
    
    removeTrack(trackId) {
      for (const clip of this.projectState.clips.filter((c) => c.trackId === trackId))
        document.dispatchEvent(new CustomEvent("RemoveClip", { detail: { clipId: clip.id } }));
        
      this.audio.removeTrack(trackId);
      this.mixer.removeTrackFader(this.projectState.tracks.find((t) => t.id == trackId));
      this.projectState.tracks = this.projectState.tracks.filter((t) => t.id !== trackId);
      if (this.projectState.selectedTrackId === trackId) this.selectTrack(this.projectState.tracks[0]?.id ?? null);
    }
  }
  
  class ClipManager {
    constructor(projectState, audio, bottomPanelManager, clipEditor) {
      this.projectState = projectState;
      this.audio = audio;
      this.bottomPanelManager = bottomPanelManager;
      this.ed = clipEditor;
      
      document.addEventListener("RemoveClip", (e) => this.removeClip(e.detail.clipId));
    }
    
    createClip(track, start, length, notes = [], end = null) {
      const count = this.projectState.clips.filter((c) => c.trackId === track.id).length + 1;
  
      if (!end) {
        end = start + length;
        console.log("determined clip end, start, length, end", start, length, end)
      }
      let loop = end - start > length;
      const clip = { id: this.projectState.nextId++, trackId: track.id, name: `${track.name} ${count}`, start: start, length: length, end: end, loop: loop, notes: notes };
      this.projectState.clips.push(clip);
      this.audio.rebuildClip(clip);
      return clip;
    }
  
    removeClip(clipId) {
      this.audio.removeClip(clipId);
      this.projectState.clips = this.projectState.clips.filter((c) => c.id !== clipId);
      if (this.projectState.selectedClipId === clipId) 
        this.projectState.selectedClipId = null;
    }
  
    deselectClip() {
      this.projectState.selectedClipId = null;
      this.ed.selected.clear();
      document.dispatchEvent(new CustomEvent("ClipChanged", { detail: { } }));
    }
    
    selectClip(clip) {
      console.log("select clip")
      if (this.projectState.selectedClipId === clip.id) return;
      if (clip.trackId !== this.projectState.selectedTrackId)
        document.dispatchEvent(new CustomEvent("SelectTrack", { detail: { trackId: clip.trackId } }));
  
      this.projectState.selectedClipId = clip.id;
      console.log("clip selected");
  
      this.bottomPanelManager.showClipEditorPanel();
  
      this.ed.selected.clear();
      document.dispatchEvent(new CustomEvent("ClipChanged", { detail: { } }));
    }
  }

  class UpdateManager {
    constructor(projectState, audio, arrangementView, editorView, dom, renderTrackHeadersCallback) {
      this.projectState = projectState;
      this.audio = audio;
      this.av = arrangementView;
      this.ev = editorView;
      this.dom = dom;
      this.renderTrackHeaders = renderTrackHeadersCallback;
      
      document.addEventListener("ClipChanged", (e) => this.editorClipChanged());
    }
    
      // Everything that must follow a change to clip placement, tracks, or loop length.
    arrangementChanged() {
      this.audio.setLoop(this.projectState.loop, stateHelper.songEndBeats());
      this.av.updateSpacer();
      this.renderTrackHeaders();
      this.av.requestRender();
      this.updateClipButtons();
    }
  
    // Everything that must follow a change to the selected clip's notes.
    notesChanged() {
      const clip = stateHelper.currentClip();
      if (clip) this.audio.rebuildClip(clip);
      this.ev.updateSpacer();
      this.ev.requestRender();
      this.av.requestRender();
    }
  
    editorClipChanged() {
    //  console.log("clip changed")
      const clip = stateHelper.currentClip();
      this.dom.clipTitle.textContent = clip ? `${clip.name} (${stateHelper.trackById(clip.trackId).name})` : "No clip selected";
      this.dom.len.value = clip ? clip.length / Constants.BEATS_PER_BAR : 1;
      this.dom.end.value = clip ? clip.end : 1;
      this.dom.len.disabled = !clip;
      this.ev.updateSpacer();
      this.ev.requestRender();
      this.av.requestRender();
      this.updateClipButtons();
    }
  
    updateClipButtons() {
      const hasClip = !!stateHelper.currentClip();
      this.dom.dupClip.disabled = !hasClip;
      this.dom.delClip.disabled = !hasClip;
      this.dom.clear.disabled = !hasClip;
      this.dom.addClip.disabled = !this.projectState.selectedTrackId;
    }
  }
  
  class XypadPanel {
    mouseDown = false;
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
    updateDelayInSecs = 0.1;
    
    constructor(xypadPanelElement) {
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
      
      this.ctx = sizeCanvas(this.canvas, this.canvas.clientWidth, this.canvas.clientHeight);
      
      this.ctx.strokeStyle = "rgba(255,255,255,0.5)";;
      this.ctx.fillStyle = "rgba(255,255,100,0.5)";
      this.ctx.shadowColor = this.ctx.fillStyle;
      this.ctx.shadowBlur = 5;
      
      this.size = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
      this.center = { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
    
      this.updatePosition(this.center)

      this.canvas.ontouchstart = (e) => {
        this.mouseDown = true;
        this.updatePosition(this.getMousePositionOnCanvas(e));
      }
      this.canvas.ontouchend = () => {
        this.mouseDown = false;
      }
      this.canvas.ontouchmove = (e) => {
        if (!this.mouseDown) return;
        this.updatePosition(this.getMousePositionOnCanvas(e));
      }
    }
    
    get xDeviceIndex() { return this.xDeviceSelect.value; }
    get xDeviceState() { return this.track.devices[this.xDeviceIndex]; }
    get xDevice() { return this.trackAudioDevices[this.xDeviceIndex]; }
    get xDeviceName() { return this.xDevice.name; }
    get xParameterName() { return this.xParameterSelect.value ? this.xParameterSelect.selectedOptions[0].text : ""; }
    get xParameter() { return this.xParameterName ? this.xDevice[this.xParameterName] : null; }
    get xParameterValue() { return this.xParameter?.name ? this.xParameter.value : this.xParameter;  }
    set xParameterValue(value) { 
      this.xDeviceState.parameters[this.xParameterName] = value;
      this.xParamValueOutput.innerText = value;
      if (this.xParameterValue == value) return;
      
      let timestamp = Tone.now();
      if (this.xParameterUpdateTimestamp && timestamp - this.xParameterUpdateTimestamp < this.updateDelayInSecs) {
       // console.log("skipping x update", timestamp - this.xParameterUpdateTimestamp);
        return;
      }
      else {
     //   console.log("updating x")
      }
      this.updateDeviceParameter(this.xDevice, this.xParameterName, value); 
      this.xParameterUpdateTimestamp = timestamp;
    }
    
    get yDeviceIndex() { return this.yDeviceSelect.value; }
    get yDeviceState() { return this.track.devices[this.yDeviceIndex]; }
    get yDevice() { return this.trackAudioDevices[this.yDeviceIndex]; }
    get yDeviceName() { return this.yDevice.name; }
    get yParameterName() { return this.yParameterSelect.value ? this.yParameterSelect.selectedOptions[0].text : ""; }
    get yParameter() { return this.yParameterName ? this.yDevice[this.yParameterName] : null; }
    get yParameterValue() { return this.yParameter?.name ? this.yParameter.value : this.yParameter;  }
    set yParameterValue(value) { 
      this.yDeviceState.parameters[this.yParameterName] = value;
      this.yParamValueOutput.innerText = value;
    
      if (this.yParameterValue == value) return;
      
      let timestamp = Tone.now();
      if (this.yParameterUpdateTimestamp && timestamp - this.yParameterUpdateTimestamp < this.updateDelayInSecs) {
       // console.log("skipping y update", timestamp - this.yParameterUpdateTimestamp);
        return;
      }
      else {
        //console.log("updating y")
      }
      this.updateDeviceParameter(this.yDevice, this.yParameterName, value); 
      this.yParameterUpdateTimestamp = timestamp;
    }
    
    init(track) {
      if (this.track == track) return;
      this.track = track;
      this.trackAudioDevices = audio.getTrackDevices(track);
      
      let targetDeviceOptionsHtml = '<option>-Select device-</option>';
      targetDeviceOptionsHtml += track.devices.map((d) => `<option value="${track.devices.indexOf(d)}">${d.name}</option>`).join("");
      this.xDeviceSelect.innerHTML = targetDeviceOptionsHtml;
      this.yDeviceSelect.innerHTML = targetDeviceOptionsHtml;
      this.xDeviceSelect.disabled = false;
      this.yDeviceSelect.disabled = false;
    }
    
    xDeviceSelected() {
      if (!this.track) return;
      if (!this.xDeviceSelect.value) return;
      
      console.log("Device selected ", this.xDeviceName)
      this.xParameterSelect.innerHTML = '<option>-Select parameter-</option>';
      let deviceNumberParameters = metadataManager.getDeviceNumberParameters(this.xDeviceName);
      deviceNumberParameters.forEach(param => this.xParameterSelect.innerHTML += `<option value="${deviceNumberParameters.indexOf(param)}">${param.name}</option>`);
      this.xParameterSelect.onchange = (e) => this.xParameterSelected(deviceNumberParameters);
      this.xParameterSelect.disabled = false;
    }
    
    xParameterSelected(deviceNumberParameters) {
     if (!this.xParameterSelect.value) {
        this.xParameterMetadata = null;
        this.position = this.center;
      } else {
        this.xParameterMetadata = deviceNumberParameters[this.xParameterSelect.value].metadata;
        let xRange = this.xParameterMetadata.max - this.xParameterMetadata.min;
        let xOffset = (this.xParameterValue - this.xParameterMetadata.min) / xRange;
        this.position.x = xOffset * this.size.width;
      }
      this.updatePosition(this.position);
    }
    
    yDeviceSelected() {
      if (!this.track) return;
      if (!this.yDeviceSelect.value) return;
      this.yParameterSelect.innerHTML = '<option>-Select parameter-</option>';
      let deviceNumberParameters = metadataManager.getDeviceNumberParameters(this.yDeviceName);
      deviceNumberParameters.forEach(param => this.yParameterSelect.innerHTML += `<option value="${deviceNumberParameters.indexOf(param)}">${param.name}</option>`);
      this.yParameterSelect.onchange = (e) => this.yParameterSelected(deviceNumberParameters);
      this.yParameterSelect.disabled = false;
    }
    
    yParameterSelected(deviceNumberParameters) {
      if (!this.yParameterSelect.value) {
        this.yParameterMetadata = null;
        this.position = this.center;
      } else {
        this.yParameterMetadata = deviceNumberParameters[this.yParameterSelect.value].metadata;
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
      position.x = helpers.clamp(position.x, 0, this.size.width);
      position.y = helpers.clamp(position.y, 0, this.size.height);
      this.position = position;
      let xNormalizedOffset = position.x / this.size.width;
      let yNormalizedOffset = (this.size.height - position.y) / this.size.height;
      
      if (this.xParameterMetadata) {
        let xParameterRange = this.xParameterMetadata.max - this.xParameterMetadata.min;
        let xParameterModulation = xParameterRange * xNormalizedOffset;
        let snapMultiplier = 1 / this.xParameterMetadata.step;
        this.xParameterValue = this.xParameterMetadata.min + (Math.round(xParameterModulation * snapMultiplier) / snapMultiplier);
      } 
      
      if (this.yParameterMetadata) {
        let yParameterRange = this.yParameterMetadata.max - this.yParameterMetadata.min;
        let yParameterModulation = yParameterRange * yNormalizedOffset;
        let snapMultiplier = 1 / this.yParameterMetadata.step;
        this.yParameterValue = this.yParameterMetadata.min + (Math.round(yParameterModulation * snapMultiplier) / snapMultiplier);
      } 
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
      if (audioDevice[parameterName].name) {
        audioDevice[parameterName].cancelScheduledValues(Tone.now());
        audioDevice[parameterName].setValueAtTime(value, "+0.05");
       // audioDevice[parameterName].value = value;
      }
      else
        audioDevice[parameterName] = value;
    }
  }
  
  // ===== Init =====
  function layoutAll() {
    av.layout();
    ev.layout();
    keysCtx = sizeCanvas(dom.edKeysCanvas, dom.edKeysWrap.clientWidth, dom.edKeysWrap.clientHeight);
    av.zoomV(1 / Constants.ZOOM_BUTTON_FACTOR);
    av.zoomV(1 / Constants.ZOOM_BUTTON_FACTOR);
  }

  var stateHelper = new StateHelper(projectState, helpers);
  var metadataManager = new MetadataManager();
  var presetBrowser = new PresetBrowser(presets, instrumentPresets, instrumentPresetNames, effectPresets, effectPresetNames);
  var bottomPanelManager = new BottomPanelManager();
  var mixer = new Mixer(audio, projectState);
  var trackManager = new TrackManager(projectState, audio, bottomPanelManager, mixer);
  var clipManager = new ClipManager(projectState, audio, bottomPanelManager, ed);
  var updateManager = new UpdateManager(projectState, audio, av, ev, dom, renderTrackHeaders);
  
  async function init() {
    await metadataManager.loadDevices();
    //console.log("Metadata test", metadataManager.getDeviceMetadata("MonoSynth"));
    //console.log("Metadata number test", metadataManager.getDeviceNumberParameters("MonoSynth"));
    
    let deviceState = { name: "MonoSynth", parameters: { volume: -10 }};
    let device = new Tone.MonoSynth();
    metadataManager.buildDeviceState(device, deviceState);
    console.log("Device state", deviceState);
    
    await presetBrowser.loadPresets();

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    dom.hint.textContent = coarse
      ? "Arrangement: tap clip to edit, drag to move, drag edge to resize, pinch to zoom. Editor: tap adds, tap note deletes, drag moves. Rulers: tap to locate, drag ↕ zoom ↔ scroll."
      : "Arrangement: double-click lane = new clip · drag clip = move · right edge = resize · right-click = delete · Ctrl+D duplicate. Editor: click adds · click note deletes (Draw) · Ctrl+wheel zoom · Shift+wheel scroll · Space play · B draw/select";
    if (!audio.available) {
      dom.play.disabled = true;
      dom.hint.textContent = "Tone.js could not be loaded (network). Editing works; playback is disabled.";
    }
    ev.rowHeight = coarse ? 22 : 18;
    av.rowHeight = coarse ? 60 : 52;
    layoutAll();
    const aw = av.o.scroller.clientWidth || 800;
    av.pxPerBeat = helpers.clamp(aw / (8 * Constants.BEATS_PER_BAR), av.o.hZoom.min, av.o.hZoom.max);
    const ew = ev.o.scroller.clientWidth || 800;
    ev.pxPerBeat = helpers.clamp(ew / (ew < 600 ? Constants.BEATS_PER_BAR : 2 * Constants.BEATS_PER_BAR), 30, 160);

    

    audio.setBpm(projectState.bpm);
    createDemoSong();
    updateSongSettingsUI(dom, projectState);

    dom.gridReadout.textContent = editorGrid().label;
    updatePosReadout();
    updateManager.arrangementChanged();
    updateManager.editorClipChanged();
    ev.o.scroller.scrollTop = pitchToRow(60) * ev.rowHeight - ev.o.scroller.clientHeight / 2;

    const observer = new ResizeObserver(layoutAll);
    for (const el of [$("arrGridWrap"), $("arrRulerWrap"), $("edGridWrap"), $("edRulerWrap"), dom.edKeysWrap]) observer.observe(el);

    function createDemoSong() {
      console.log("creating demo song");
      
      const returnReverb = {
        name: "Reverb",
        parameters: {
          roomSize: 0.25,
          wet: 1
        }
      };
      trackManager.addReturn("Reverb", 10, returnReverb);
      /*
      const returnDelay = {
        name: "PingPongDelay",
        parameters: {
          delayTime: "8n",
          feedback: 0.3,
          wet: 1
        }
      }
      trackManager.addReturn("Delay", 10, returnDelay);
      */
      const mk = (list) => list.map(([pitch, start, duration, velocity, slide]) => ({ id: projectState.nextId++, pitch, start, duration, velocity, slide }));

      console.log("creating kick");
      const kickSynth = {
        name: "MembraneSynth",
        type: "Instrument",
        parameters: {
          "detune": -1000,
          "pitchDecay": 0.05,
          "octaves": 8,
          "volume": -3,
          "envelope": {
            "attack": 0.001,
            "attackCurve": "linear",
            "decay": 0.1,
            "sustain": 0.5,
            "release": 0.1
          }
        }
      };
      const kickDistortion = {
        name: "Distortion",
        parameters: {
          "distortion": 0.1,
          "wet": 0.5
        }
      };
      const kickCompressor = {
        name: "Compressor",
        parameters: {
          "threshold": -24,
          "knee": 15,
          "ratio": 10,
          "attack": 0.6,
          "release": 0.25
        }
      };
      const kick = trackManager.addTrack("Kick", kickSynth, [kickDistortion, kickCompressor], null, -3);
      console.log("creating kick clip");
      const kickNotes = mk([[36, 0, 0.25, Constants.DEFAULT_VELOCITY]]);
      clipManager.createClip(kick, 16, Constants.BEATS_PER_BAR / 4, kickNotes, 63);
      clipManager.createClip(kick, 64, Constants.BEATS_PER_BAR / 4, kickNotes, 95);
      console.log("created kick clip");

      console.log("creating bass");
      const bassSynth = {
        name: "DAWSome.Tb303",
        type: "Instrument",
        parameters: {
          cutoff: 300,
          resonance: 3,
          envelopeModulation: 0.1,
          decay: 0.15,
          accent: 0.32,
          drive: 0.8,
          waveform: "sawtooth",
          volume: 0
        }
      };
      const bass = trackManager.addTrack("Bass", bassSynth, []);
      const bassNotes = mk([
        [25, 0.00, 0.1, 0.4],
        [27, 0.25, 0.2, Constants.DEFAULT_VELOCITY],
        [32, 0.5, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 0.75, 0.2, Constants.ACCENT_VELOCITY],

        [27, 1.00, 0.1, 0.4],
        [29, 1.25, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 1.5, 0.25, Constants.DEFAULT_VELOCITY],
        [32, 1.75, 0.25, Constants.DEFAULT_VELOCITY],

        [30, 2.00, 0.2, 0.4],
        [32, 2.25, 0.2, Constants.DEFAULT_VELOCITY],
        [27, 2.5, 0.25, Constants.DEFAULT_VELOCITY],
        [27, 2.75, 0.2, Constants.ACCENT_VELOCITY],

        [32, 3.00, 0.2, 0.4],
        [34, 3.25, 0.25, Constants.DEFAULT_VELOCITY],
        [37, 3.50, 0.25, Constants.DEFAULT_VELOCITY, true],
        [32, 3.75, 0.25, Constants.DEFAULT_VELOCITY],

        [27, 4.00, 0.2, 0.4],
        [29, 4.25, 0.2, Constants.DEFAULT_VELOCITY],
        [32, 4.50, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 4.75, 0.2, Constants.DEFAULT_VELOCITY, true],

        [27, 5.00, 0.2, 0.4],
        [29, 5.25, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 5.50, 0.25, Constants.DEFAULT_VELOCITY],
        [32, 5.75, 0.25, Constants.DEFAULT_VELOCITY],

        [30, 6.00, 0.2, 0.4],
        [32, 6.25, 0.2, Constants.DEFAULT_VELOCITY, true],
        [29, 6.5, 0.25, Constants.DEFAULT_VELOCITY],
        [27, 6.75, 0.2, Constants.ACCENT_VELOCITY],
        
        [30, 7.00, 0.2, 0.4],
        [32, 7.25, 0.25, Constants.DEFAULT_VELOCITY],
        [29, 7.50, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 7.75, 0.25, Constants.DEFAULT_VELOCITY]
      ]);
      clipManager.createClip(bass, 0, Constants.BEATS_PER_BAR * 2, bassNotes, 15);
      clipManager.createClip(bass, 16, Constants.BEATS_PER_BAR * 2, bassNotes, 31);
      clipManager.createClip(bass, 32, Constants.BEATS_PER_BAR * 2, bassNotes, 63);
      clipManager.createClip(bass, 64, Constants.BEATS_PER_BAR * 2, bassNotes, 95);
      console.log("created bass");

      const hatReverbSend = { name: "Reverb", volume: 0 };
      
      console.log("creating closedhat");
      const closedHatSynth = {
        name: "MetalSynth",
        type: "Instrument",
        parameters: {
          volume: -17,
          portamento: 100,
          modulationIndex: 1,
          octaves: 0,
          envelope: {
            attack: 0.01,
            decay: 0.02,
            sustain: 0.1,
            release: 1.0
          }
        }
      };
      
      const closedHat = trackManager.addTrack("ClosedHat", closedHatSynth, [], [], 0, false, [hatReverbSend]);
      let chNotes1 = mk([
        [42, 1.0, 0.125],
      ]);
      let chNotes2 = mk([
        [42, 0.0, 0.125],
        [42, 0.25, 0.125],
        [42, 0.5, 0.125],
        [42, 0.75, 0.125]
      ]);
      clipManager.createClip(closedHat, 0, Constants.BEATS_PER_BAR / 2, chNotes1, 31);
      clipManager.createClip(closedHat, 32, Constants.BEATS_PER_BAR / 4, chNotes2, 63);
      clipManager.createClip(closedHat, 64, Constants.BEATS_PER_BAR / 4, chNotes2, 95);
      console.log("created closed hat");

      console.log("creating openhat");
      const openHatSynth = {
        name: "MetalSynth",
        type: "Instrument",
        parameters: {
          "volume": -20,
          "portamento": 0,
          "harmonicity": 0.65,
          "modulationIndex": 1,
          "octaves": 0,
          "envelope": {
            "attack": 0.01,
            "attackCurve": "linear",
            "decay": 0.715,
            "decayCurve": "exponential",
            "sustain": 0.05,
            "release": 0.3,
            "releaseCurve": "exponential"
          }
        }
      };
      const openHat = trackManager.addTrack("OpenHat", openHatSynth, [], [], 0, false, [hatReverbSend]);
      let ohNotes = mk([[42, 0.5, 0.125]]);
      clipManager.createClip(openHat, 48, Constants.BEATS_PER_BAR / 4, ohNotes, 63);
      clipManager.createClip(openHat, 64, Constants.BEATS_PER_BAR / 4, ohNotes, 95);
      console.log("created open hat");

      console.log("creating 303");
      const tb303Synth = {
        name: "DAWSome.Tb303",
        parameters: {
          cutoff: 500,
          resonance: 8,
          envelopeModulation: 0.03,
          decay: 0.75,
          accent: 0.5,
          drive: 0.35,
          waveform: "sawtooth",
          volume: -9
        }
      };
      const tb303Delay = {
        name: "PingPongDelay",
        parameters: {
          delayTime: "8n",
          feedback: 0.3,
          wet: 0.25
        }
      }
  
      const tb303 = trackManager.addTrack("303", tb303Synth, [tb303Delay], [], 0, false, []);
      const tb303Notes = mk([
        [31, 2.25, 0.25, Constants.DEFAULT_VELOCITY, true],
        [37, 3.00, 0.25, Constants.DEFAULT_VELOCITY, true],
        [34, 3.75, 0.25, Constants.DEFAULT_VELOCITY, true],
        
        [31, 6.25, 0.25, Constants.DEFAULT_VELOCITY, true],
        [35, 7.00, 0.125, Constants.ACCENT_VELOCITY, true],
        [37, 7.25, 0.25, Constants.DEFAULT_VELOCITY],
        [34, 7.75, 0.25, Constants.ACCENT_VELOCITY, true],
      ]);
      clipManager.createClip(tb303, 0, Constants.BEATS_PER_BAR * 2, tb303Notes, 96);
      console.log("created 303");
      

      console.log("created demo song");

      clipManager.deselectClip();
      trackManager.deselectTrack();
    }
  }

  class Tb303  {
    constructor(parameters) {
      
      console.log("Tb303 create")
      if (parameters.cutoff == undefined) parameters.cutoff = 400;
      if (parameters.resonance == undefined) parameters.resonance = 7;
      if (parameters.envelopeModulation == undefined) parameters.envelopeModulation = 0.6;
      if (parameters.decay == undefined) parameters.decay = 0.3;
      if (parameters.accent == undefined) parameters.accent = 0.8;
      if (parameters.drive == undefined) parameters.drive = 0.35;
      if (parameters.waveform == undefined) parameters.waveform = "sawtooth";
      if (parameters.volume == undefined) parameters.volume = -30;
      
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
      
      console.log("Tb303 setup", parameters.resonance)
      this.cutoff = parameters.cutoff;
      this.resonance = parameters.resonance;
      this._envelopeModulation = parameters.envelopeModulation;
      this._decay = parameters.decay;
      this._accent = parameters.accent;
      this.drive = parameters.drive;
      this.waveform = parameters.waveform;
      this.volume = parameters.volume;
      console.log("Tb303 created")
    }
       
    get name() { return "DAWSome.Tb303"; }
    
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
      if (value < 0 || value > 1) throw "Decay must be between 0 and 1.2";
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
        
    connect(destination) {
      this._distortion.connect(destination);
    }
    
    triggerAttack(note, time = 0, velocity, slide = false) {
      this._prepareNote(time, velocity, slide);
      this._monoSynth.triggerAttack(note, time, velocity);
    }
    
    triggerRelease(time) {
      this._monoSynth.triggerRelease(time);
    }
    
    triggerAttackRelease(note, duration = "16n", time = 0, velocity, slide = false) {
      this._prepareNote(time, velocity, slide)
      this._monoSynth.triggerAttackRelease(note, duration, time, velocity);
    }
    
    _prepareNote(time, velocity, slide) {
      if (velocity == Constants.ACCENT_VELOCITY) {
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
     
  const DAWSome = {
    Tb303: (parameters) => new Tb303(parameters)
  }
  
  await init();
})();
