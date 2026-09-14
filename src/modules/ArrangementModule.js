import { Module } from "../core/Module.js";
import { DEFAULT_TRACK_DEVICE } from "../devices/defaultDevices.js";
import { $ } from "../ui/dom.js";
import { TimelineView } from "../ui/TimelineView.js";
import {
  BEATS_PER_BAR,
  DRAG_THRESHOLD,
  SONG_TAIL_BEATS,
  ZOOM_BUTTON_FACTOR,
  clamp,
  gridStep,
  snapFloor,
  snapRound,
} from "../util/music.js";
import { COLORS } from "../util/theme.js";

/**
 * The arrangement: a timeline of clip lanes plus the DOM track headers beside
 * them. It owns the lane canvas, the arrangement ruler, the track header list
 * and the four track/clip commands, and it redraws itself from bus events, so
 * no other module ever has to call into it.
 */
export class ArrangementModule extends Module {
  /**
   * Timeline view driving zoom, scroll, pinch and the ruler of the lanes.
   * @type {TimelineView|null}
   */
  view = null;

  #app = null;
  #commands = null;
  #project = null;
  #transport = null;
  #audio = null;
  #catalog = null;
  #presets = null;

  #trackHeaders = null;
  #addClipBtn = null;
  #dupClipBtn = null;
  #delClipBtn = null;

  /** @type {{ type: "move"|"resize", pointerId: number, clip: object, start0: number, length0: number, beat0: number, row0: number, x0: number, vx0: number, vy0: number, moved: boolean }|null} */
  #drag = null;
  #resizeObserver = null;
  #teardown = [];
  #subscriptions = [];
  #unregisterCommands = [];

  /**
   * Resolve the services that already exist at install time and register the
   * arrangement commands. `catalog` and `presets` arrive in start().
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    this.#app = app;
    this.#commands = app.get("commands");
    this.#project = app.get("project");
    this.#transport = app.get("transport");
    this.#audio = app.get("audio");

    const project = this.#project;
    this.#unregisterCommands.push(
      this.#commands.register({
        id: "track.add",
        title: "Add track",
        run: () => {
          project.addTrack({
            name: `Track ${project.tracks.length + 1}`,
            devices: [
              this.#catalog.create(DEFAULT_TRACK_DEVICE.typeName, {
                options: structuredClone(DEFAULT_TRACK_DEVICE.options),
              }),
            ],
          });
        },
      }),
      this.#commands.register({
        id: "clip.add",
        title: "Add clip",
        when: () => project.selectedTrackId !== null,
        run: () => {
          const track = project.selectedTrack;
          if (!track) return;
          const start = snapFloor(this.#transport.playheadBeat, BEATS_PER_BAR);
          const clip = project.addClip({ trackId: track.id, start, length: BEATS_PER_BAR });
          project.select({ trackId: track.id, clipId: clip.id });
        },
      }),
      this.#commands.register({
        id: "clip.duplicate",
        title: "Duplicate clip",
        shortcut: "Ctrl+D",
        when: () => !!project.selectedClip,
        run: () => {
          const clip = project.selectedClip;
          if (!clip) return;
          const copy = project.duplicateClip(clip);
          project.select({ trackId: copy.trackId, clipId: copy.id });
        },
      }),
      this.#commands.register({
        id: "clip.delete",
        title: "Delete clip",
        when: () => !!project.selectedClip,
        run: () => {
          const clip = project.selectedClip;
          if (!clip) return;
          project.removeClip(clip.id);
        },
      }),
    );
  }

  /**
   * Build the timeline view, bind the DOM and subscribe to the bus. The app,
   * and with it the bus and the late services, is the one kept by install().
   */
  async start() {
    const app = this.#app;
    this.#catalog = app.get("catalog");
    this.#presets = app.get("presets");

    const project = this.#project;
    const transport = this.#transport;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    this.#trackHeaders = $("trackHeaders");
    this.#addClipBtn = $("addClipBtn");
    this.#dupClipBtn = $("dupClipBtn");
    this.#delClipBtn = $("delClipBtn");

    this.view = new TimelineView({
      gridWrap: $("arrGridWrap"),
      gridCanvas: $("arrGridCanvas"),
      rulerWrap: $("arrRulerWrap"),
      rulerCanvas: $("arrRulerCanvas"),
      scroller: $("arrScroller"),
      spacer: $("arrSpacer"),
      hZoom: { min: 3, max: 200 },
      vZoom: { min: 40, max: 120 },
      rowHeight: coarse ? 60 : 52,
      rowCount: () => project.tracks.length,
      contentBeats: () => project.endBeats() + SONG_TAIL_BEATS,
      render: () => this.render(),
      onLocate: (beat) => transport.setPlayhead(clamp(snapRound(beat, this.arrangementStep()), 0, project.endBeats())),
      onZoom: () => this.renderTrackHeaders(),
      unlock: () => this.#audio.unlock(),
    });
    this.view.layout();

    this.#resizeObserver = new ResizeObserver(() => this.view.layout());
    for (const el of [$("arrGridWrap"), $("arrRulerWrap")]) this.#resizeObserver.observe(el);

    const aw = this.view.o.scroller.clientWidth || 800;
    this.view.pxPerBeat = clamp(aw / (8 * BEATS_PER_BAR), this.view.o.hZoom.min, this.view.o.hZoom.max);

    this.#bindTrackHeaders();
    this.#bindScroller();
    this.#bindButtons();
    this.#subscribe(app.bus);

    this.refresh();
  }

  /**
   * Release every listener, observer, subscription and command this module
   * added. The TimelineView keeps the listeners it binds on itself; the shared
   * view exposes no teardown, so it is left in place.
   */
  dispose() {
    for (const off of this.#subscriptions) off();
    this.#subscriptions = [];
    for (const off of this.#teardown) off();
    this.#teardown = [];
    for (const unregister of this.#unregisterCommands) unregister();
    this.#unregisterCommands = [];
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#drag = null;
  }

  // ===== Geometry =====

  /**
   * Snap step of the arrangement grid, in beats.
   * @returns {number|null}
   */
  arrangementStep() {
    return gridStep("wide", false, this.view.pxPerBeat).step;
  }

  /**
   * Topmost clip under a lane position, or null.
   * @param {number} beat
   * @param {number} row
   * @returns {object|null}
   */
  clipAt(beat, row) {
    const track = this.#project.tracks[row];
    if (!track) return null;
    const clips = this.#project.clips;
    for (let i = clips.length - 1; i >= 0; i--) {
      const c = clips[i];
      if (c.trackId === track.id && beat >= c.start && beat < c.end) return c;
    }
    return null;
  }

  /**
   * True when a content x lands on a clip's resize edge.
   * @param {object} clip
   * @param {number} x content x in pixels
   * @returns {boolean}
   */
  onClipRightEdge(clip, x) {
    return x >= this.view.beatToX(clip.end) - Math.min(8, this.view.beatToX(clip.length) * 0.4);
  }

  // ===== Drawing =====

  /** Draw the lanes, the clips, the playhead and the ruler. */
  render() {
    const view = this.view;
    const project = this.#project;
    const c = view.grid;
    const { W, H, sx, sy, drawW, firstRow, lastRow } = view.viewport();
    const rh = view.rowHeight;
    c.fillStyle = COLORS.void;
    c.fillRect(0, 0, W, H);

    for (let row = firstRow; row <= lastRow; row++) {
      const y = row * rh - sy;
      c.fillStyle = row % 2 ? COLORS.laneB : COLORS.laneA;
      c.fillRect(0, y, drawW, rh);
      c.fillStyle = COLORS.laneLine;
      c.fillRect(0, y + rh - 1, drawW, 1);
    }
    view.drawVerticalLines(c, H, this.arrangementStep(), drawW);
    view.drawRegion(c, H, project.endBeats(), drawW);

    c.font = "11px system-ui, sans-serif";
    c.textBaseline = "top";
    c.textAlign = "left";
    for (const clip of project.clips) {
      const row = project.trackIndex(clip.trackId);
      if (row < firstRow || row > lastRow) continue;
      const x0 = view.beatToX(clip.start) - sx, x1 = view.beatToX(clip.end) - sx;
      if (x1 < 0 || x0 > W) continue;
      const y = row * rh - sy + 2, h = rh - 5;
      const w = Math.max(2, x1 - x0 - 1);
      const track = project.trackById(clip.trackId);
      const selected = clip.id === project.selectedClipId;
      c.fillStyle = track.color;
      c.globalAlpha = track.mute ? 0.45 : 1;
      c.fillRect(Math.round(x0), y, w, h);
      c.globalAlpha = 1;
      if (w > 24) {
        c.save();
        c.beginPath();
        c.rect(Math.round(x0), y, w, 14);
        c.clip();
        c.fillStyle = COLORS.clipText;
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
        c.fillStyle = COLORS.clipNote;
        for (const n of clip.notes) {
          if (n.start >= clip.length) continue;
          const nx = x0 + view.beatToX(n.start), nw = Math.max(1, view.beatToX(Math.min(n.duration, clip.length - n.start)) - 1);
          const ny = y + 15 + (hi - n.pitch) * rowPx;
          c.fillRect(Math.round(nx), ny, nw, Math.max(1, rowPx - 1));
        }
      }
      if (selected) {
        c.strokeStyle = COLORS.clipSelected;
        c.lineWidth = 2;
        c.strokeRect(Math.round(x0) + 1, y + 1, w - 2, h - 2);
      }
    }
    view.drawPlayhead(c, H, this.#transport.playheadBeat);
    view.drawRuler({
      subStep: this.arrangementStep(),
      regionEnd: project.endBeats(),
      playheadBeat: this.#transport.playheadBeat,
    });
  }

  /**
   * Rebuild the track headers. They are DOM so names and instruments are
   * editable; they scroll with the lanes. Existing rows are reused so an
   * in-progress edit keeps its focus.
   */
  renderTrackHeaders() {
    const rh = this.view.rowHeight;
    this.#trackHeaders.style.transform = `translateY(${-this.view.o.scroller.scrollTop}px)`;
    const existing = new Map([...this.#trackHeaders.children].map((el) => [Number(el.dataset.id), el]));
    this.#trackHeaders.replaceChildren();
    for (const track of this.#project.tracks) {
      let el = existing.get(track.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "track";
        el.dataset.id = track.id;
        el.innerHTML = `<span class="swatch"></span>
          <button class="btn mini mute" title="Mute">M</button><button class="btn mini del" title="Delete track">×</button>
          <input class="name" type="text" title="Track name"><br>
          <select class="inst" title="Instrument">${this.#catalog.instruments().map((i) => `<option value="${i}">${i}</option>`).join("")}</select>
          <select class="instPreset" title="Preset"></select>`;
      }
      el.style.height = `${rh}px`;
      el.classList.toggle("selected", track.id === this.#project.selectedTrackId);
      el.querySelector(".swatch").style.background = track.color;
      const nameInput = el.querySelector(".name");
      if (document.activeElement !== nameInput) nameInput.value = track.name;
      el.querySelector(".inst").value = track.instrument?.typeName ?? "";
      this.#fillInstrumentPresets(el, track);
      el.querySelector(".mute").classList.toggle("on", track.mute);
      this.#trackHeaders.appendChild(el);
    }
  }

  /**
   * Fill one header's preset select from the preset bank of its instrument.
   * "Custom" comes first and is selected while the device carries no preset.
   * @param {HTMLElement} el track header element
   * @param {object} track
   */
  #fillInstrumentPresets(el, track) {
    const presetSelect = el.querySelector(".instPreset");
    const device = track.instrument;
    const names = device ? this.#presets.names(device.typeName) : [];
    presetSelect.innerHTML = `<option value="">Custom</option>` +
      names.map((presetName) => `<option value="${presetName}">${presetName}</option>`).join("");
    presetSelect.value = device?.presetName ?? "";
  }

  /**
   * Scroll the lanes so the playhead stays visible.
   * @param {number} beat
   */
  followPlayhead(beat) {
    const s = this.view.o.scroller;
    const x = this.view.beatToX(beat);
    if (x < s.scrollLeft || x > s.scrollLeft + s.clientWidth) s.scrollLeft = x - 8;
  }

  /** Enable or disable the clip toolbar buttons for the current selection. */
  updateClipButtons() {
    const hasClip = !!this.#project.selectedClip;
    this.#dupClipBtn.disabled = !hasClip;
    this.#delClipBtn.disabled = !hasClip;
    this.#addClipBtn.disabled = this.#project.selectedTrackId === null;
  }

  /** Everything that must follow a change to clip placement, tracks or selection. */
  refresh() {
    this.view.updateSpacer();
    this.renderTrackHeaders();
    this.view.requestRender();
    this.updateClipButtons();
  }

  // ===== Binding =====

  /**
   * Add a DOM listener and remember how to remove it again.
   * @param {EventTarget} target
   * @param {string} type
   * @param {(event: any) => void} handler
   * @param {AddEventListenerOptions} [options]
   */
  #listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#teardown.push(() => target.removeEventListener(type, handler, options));
  }

  /**
   * Resolve the track a header event belongs to.
   * @param {HTMLElement} el track header element
   * @returns {object}
   */
  #trackOf(el) {
    const id = Number(el.dataset.id);
    const track = this.#project.trackById(id);
    if (!track) throw new Error(`Track header refers to unknown track ${id}.`);
    return track;
  }

  /** Bind the track header list: selection, mute, delete, instrument, preset, rename. */
  #bindTrackHeaders() {
    const project = this.#project;

    this.#listen(this.#trackHeaders, "click", (e) => {
      const el = e.target.closest(".track");
      if (!el) return;
      const track = this.#trackOf(el);
      if (e.target.classList.contains("mute")) {
        project.setTrackMute(track, !track.mute);
      } else if (e.target.classList.contains("del")) {
        project.removeTrack(track.id);
      } else if (
        e.target.classList.contains("inst") ||
        e.target.classList.contains("instPreset") ||
        e.target.classList.contains("name")
      ) {
        return;
      } else {
        project.select({ trackId: track.id });
      }
    });

    this.#listen(this.#trackHeaders, "change", (e) => {
      const el = e.target.closest(".track");
      if (!el) return;
      const track = this.#trackOf(el);
      if (e.target.classList.contains("inst")) {
        project.setInstrument(track, this.#catalog.create(e.target.value));
      } else if (e.target.classList.contains("instPreset")) {
        if (e.target.value === "") return;
        project.applyPreset(track, track.instrument, this.#presets.get(track.instrument.typeName, e.target.value));
      } else if (e.target.classList.contains("name")) {
        const name = e.target.value.trim() || track.name;
        e.target.value = name;
        project.renameTrack(track, name);
      }
    });

    this.#listen(this.#trackHeaders, "keydown", (e) => {
      if (e.key === "Enter") e.target.blur();
    });

    this.#listen(this.view.o.scroller, "scroll", () => {
      this.#trackHeaders.style.transform = `translateY(${-this.view.o.scroller.scrollTop}px)`;
    });
  }

  /** Bind the lane scroller: clip drag, resize, create and delete. */
  #bindScroller() {
    const view = this.view;
    const project = this.#project;
    const scroller = view.o.scroller;

    this.#listen(scroller, "pointerdown", (e) => {
      if (e.button !== 0) return;
      this.#audio.unlock().catch(() => {});
      if (view.trackDown(e)) { this.#drag = null; return; }
      const p = view.point(e);
      const clip = this.clipAt(p.beat, p.row);
      if (!clip) return;
      project.select({ trackId: clip.trackId, clipId: clip.id });
      this.#drag = {
        type: this.onClipRightEdge(clip, p.x) ? "resize" : "move", pointerId: e.pointerId, clip,
        start0: clip.start, length0: clip.length, beat0: p.beat, row0: p.row, x0: p.x, vx0: p.vx, vy0: p.vy, moved: false,
      };
      if (e.pointerType !== "touch") scroller.setPointerCapture(e.pointerId);
      view.requestRender();
    });

    this.#listen(scroller, "pointermove", (e) => {
      if (view.trackMove(e)) return;
      const d = this.#drag;
      if (!d || d.pointerId !== e.pointerId) {
        if (e.pointerType === "mouse") {
          const p = view.point(e);
          const clip = this.clipAt(p.beat, p.row);
          scroller.style.cursor = clip ? (this.onClipRightEdge(clip, p.x) ? "ew-resize" : "move") : "default";
        }
        return;
      }
      const p = view.point(e);
      if (!d.moved) {
        if (Math.hypot(p.vx - d.vx0, p.vy - d.vy0) < DRAG_THRESHOLD) return;
        d.moved = true;
      }
      const step = this.arrangementStep();
      if (d.type === "move") {
        d.clip.start = Math.max(0, snapRound(d.start0 + (p.beat - d.beat0), step));
        const track = project.tracks[p.row];
        if (track && track.id !== d.clip.trackId) {
          d.clip.trackId = track.id;
          project.select({ trackId: track.id });
          this.renderTrackHeaders();
        }
      } else {
        const end = snapRound(d.start0 + d.length0 + (p.x - d.x0) / view.pxPerBeat, step);
        d.clip.length = Math.max(step, end - d.clip.start);
      }
      view.updateSpacer();
      view.requestRender();
    });

    const endPointer = (e) => {
      if (view.trackUp(e)) return;
      const d = this.#drag;
      if (!d || d.pointerId !== e.pointerId) return;
      this.#drag = null;
      if (d.moved) project.clipChanged(d.clip);
    };
    this.#listen(scroller, "pointerup", endPointer);
    this.#listen(scroller, "pointercancel", endPointer);

    this.#listen(scroller, "touchmove", (e) => {
      if (e.touches.length >= 2 || this.#drag) e.preventDefault();
    }, { passive: false });

    this.#listen(scroller, "dblclick", (e) => {
      const p = view.point(e);
      const track = project.tracks[p.row];
      if (!track || this.clipAt(p.beat, p.row)) return;
      const start = snapFloor(p.beat, BEATS_PER_BAR);
      const clip = project.addClip({ trackId: track.id, start, length: BEATS_PER_BAR });
      project.select({ trackId: track.id, clipId: clip.id });
    });

    this.#listen(scroller, "contextmenu", (e) => {
      e.preventDefault();
      const p = view.point(e);
      const clip = this.clipAt(p.beat, p.row);
      if (!clip) return;
      project.removeClip(clip.id);
    });
  }

  /** Bind the toolbar buttons to the commands and to the zoom controls. */
  #bindButtons() {
    const view = this.view;
    this.#listen($("addTrackBtn"), "click", () => this.#commands.run("track.add"));
    this.#listen(this.#addClipBtn, "click", () => this.#commands.run("clip.add"));
    this.#listen(this.#dupClipBtn, "click", () => this.#commands.run("clip.duplicate"));
    this.#listen(this.#delClipBtn, "click", () => this.#commands.run("clip.delete"));
    this.#listen($("arrZoomInH"), "click", () => view.zoomH(ZOOM_BUTTON_FACTOR));
    this.#listen($("arrZoomOutH"), "click", () => view.zoomH(1 / ZOOM_BUTTON_FACTOR));
    this.#listen($("arrZoomInV"), "click", () => view.zoomV(ZOOM_BUTTON_FACTOR));
    this.#listen($("arrZoomOutV"), "click", () => view.zoomV(1 / ZOOM_BUTTON_FACTOR));
  }

  /**
   * Subscribe to every event the arrangement reacts to.
   * @param {import("../core/EventBus.js").EventBus} bus
   */
  #subscribe(bus) {
    const events = [
      "track:added", "track:removed", "track:changed", "track:devices",
      "clip:added", "clip:removed", "clip:changed", "clip:notes",
      "selection",
    ];
    for (const event of events) this.#subscriptions.push(bus.on(event, () => this.refresh()));

    this.#subscriptions.push(bus.on("parameter:changed", ({ parameter }) => {
      if (!parameter.address.startsWith("track/")) return;
      this.renderTrackHeaders();
      this.view.requestRender();
    }));

    this.#subscriptions.push(bus.on("transport:playhead", () => this.view.requestRender()));

    this.#subscriptions.push(bus.on("transport:tick", ({ beat }) => {
      if (this.#transport.follow) this.followPlayhead(beat);
      this.view.requestRender();
    }));
  }
}
