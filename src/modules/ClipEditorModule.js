import { Module } from "../core/Module.js";
import { Note } from "../model/Note.js";
import { $, sizeCanvas, wheelDeltas } from "../ui/dom.js";
import { TimelineView } from "../ui/TimelineView.js";
import {
  BEATS_PER_BAR,
  BLACK_KEYS,
  DEFAULT_VELOCITY,
  DRAG_THRESHOLD,
  EPS,
  MIN_FREE_DURATION,
  PITCH_COUNT,
  TAP_SLOP,
  TOP_PITCH,
  ZOOM_BUTTON_FACTOR,
  ceilBars,
  clamp,
  gridStep,
  midiName,
  pitchToRow,
  rowToPitch,
  snapFloor,
  snapRound,
} from "../util/music.js";
import { COLORS } from "../util/theme.js";

/**
 * The clip editor: a piano roll for the notes of the selected clip.
 *
 * The module owns one TimelineView (grid, ruler, zoom, pinch), the piano-key
 * strip to its left and the editor toolbar. It never reaches into the
 * arrangement: it edits the notes of `project.selectedClip`, announces the
 * change through the project, and redraws itself from bus events.
 */
export class ClipEditorModule extends Module {
  /** Grid mode of the editor: the value of the grid select in the toolbar. */
  gridMode = "medium";
  /** Whether the grid is divided into triplets. */
  triplet = false;
  /** Whether edits snap to the grid. */
  snap = true;
  /** Draw mode: clicking empty space adds a note, clicking a note deletes it. */
  drawMode = true;
  /** Duration of the note resized last, used when the grid is off. */
  lastDuration = 0.25;
  /** Ids of the selected notes. @type {Set<number>} */
  selected = new Set();
  /** Pitch of the piano key held down, or null. @type {number|null} */
  activeKey = null;
  /** The piano-roll timeline view. @type {TimelineView|null} */
  view = null;

  /** @type {import("../core/CommandRegistry.js").CommandRegistry|null} */
  #commands = null;
  /** @type {import("../core/PanelRegistry.js").PanelRegistry|null} */
  #panels = null;
  /** @type {import("../model/Project.js").Project|null} */
  #project = null;
  #audio = null;
  #transport = null;
  #dom = null;
  #keysCtx = null;
  #nDrag = null;   // { type: "tap" | "paint" | "move" | "resize", pointerId, ... }
  #keyDrag = null;
  #observer = null;
  /** Undo actions collected by install() and start(), replayed by dispose(). */
  #cleanups = [];

  /**
   * Register the clip-editor panel and the note editing commands.
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    this.#commands = app.get("commands");
    this.#panels = app.get("panels");
    this.#project = app.get("project");
    const project = this.#project;

    this.#cleanups.push(
      this.#panels.register({ id: "clip-editor", title: "Clip editor", element: $("clipEditorPanel") }),
    );

    this.#cleanups.push(
      this.#commands.register({
        id: "editor.toggleDraw",
        title: "Draw mode",
        shortcut: "B",
        run: () => this.setDrawMode(!this.drawMode),
      }),
      this.#commands.register({
        id: "editor.clearSelection",
        title: "Clear note selection",
        shortcut: "Escape",
        run: () => {
          this.selected.clear();
          this.view.requestRender();
        },
      }),
      this.#commands.register({
        id: "editor.selectAll",
        title: "Select all notes",
        shortcut: "Ctrl+A",
        when: () => !!project.selectedClip,
        run: () => {
          const clip = project.selectedClip;
          this.selected = new Set(clip.notes.map((n) => n.id));
          this.view.requestRender();
        },
      }),
      this.#commands.register({
        id: "editor.clearNotes",
        title: "Clear notes",
        when: () => !!project.selectedClip,
        run: () => {
          const clip = project.selectedClip;
          clip.notes = [];
          this.selected.clear();
          project.notesChanged(clip);
        },
      }),
      this.#commands.register({
        id: "edit.delete",
        title: "Delete",
        shortcut: ["Delete", "Backspace"],
        when: () => !!project.selectedClip,
        run: () => {
          const clip = project.selectedClip;
          if (this.selected.size) this.#deleteNotes(clip, [...this.selected]);
          else project.removeClip(clip.id);
        },
      }),
    );
  }

  /**
   * Build the piano roll, bind the toolbar and the pointer handlers, and
   * subscribe to the events that make the editor follow the selection.
   * @param {import("../core/App.js").App} app
   */
  async start(app) {
    const project = this.#project;
    this.#audio = app.get("audio");
    this.#transport = app.get("transport");

    this.#dom = {
      clipTitle: $("clipTitle"),
      lenInput: $("lenInput"),
      gridSelect: $("gridSelect"),
      tripletBtn: $("tripletBtn"),
      snapBtn: $("snapBtn"),
      gridReadout: $("gridReadout"),
      drawBtn: $("drawBtn"),
      clearBtn: $("clearBtn"),
      keysWrap: $("edKeysWrap"),
      keysCanvas: $("edKeysCanvas"),
    };

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.view = new TimelineView({
      gridWrap: $("edGridWrap"),
      gridCanvas: $("edGridCanvas"),
      rulerWrap: $("edRulerWrap"),
      rulerCanvas: $("edRulerCanvas"),
      scroller: $("edScroller"),
      spacer: $("edSpacer"),
      hZoom: { min: 8, max: 400 },
      vZoom: { min: 6, max: 40 },
      rowHeight: coarse ? 22 : 18,
      rowCount: () => PITCH_COUNT,
      contentBeats: () => {
        const clip = project.selectedClip;
        if (!clip) return BEATS_PER_BAR;
        const lastEnd = clip.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
        return Math.max(ceilBars(clip.length), ceilBars(lastEnd));
      },
      render: () => this.render(),
      onLocate: (beat) => {
        const clip = project.selectedClip;
        if (!clip) return;
        this.#transport.setPlayhead(
          clip.start + clamp(this.snap ? snapRound(beat, this.editorStep()) : beat, 0, clip.length),
        );
      },
      onZoom: () => {
        this.#dom.gridReadout.textContent = this.editorGrid().label;
      },
      unlock: () => this.#audio.unlock(),
    });

    this.#layoutAll();
    this.#observer = new ResizeObserver(() => this.#layoutAll());
    for (const el of [$("edGridWrap"), $("edRulerWrap"), this.#dom.keysWrap]) this.#observer.observe(el);

    const ew = this.view.o.scroller.clientWidth || 800;
    this.view.pxPerBeat = clamp(ew / (ew < 600 ? BEATS_PER_BAR : 2 * BEATS_PER_BAR), 30, 160);
    this.#dom.gridReadout.textContent = this.editorGrid().label;

    this.#bindToolbar();
    this.#bindScroller();
    this.#bindKeys();
    this.#subscribe(app.bus);

    this.refreshClip();
    this.view.updateSpacer();
    this.view.o.scroller.scrollTop = pitchToRow(60) * this.view.rowHeight - this.view.o.scroller.clientHeight / 2;
  }

  /** Release every listener, subscription, command and panel of this module. */
  dispose() {
    for (const undo of this.#cleanups.reverse()) undo();
    this.#cleanups = [];
    if (this.#observer) this.#observer.disconnect();
    this.#observer = null;
    this.view = null;
    this.#dom = null;
    this.#keysCtx = null;
    this.#nDrag = null;
    this.#keyDrag = null;
  }

  // ===== Grid and playhead =====

  /**
   * The grid of the editor at the current zoom.
   * @returns {{ step: number|null, label: string }}
   */
  editorGrid() {
    return gridStep(this.gridMode, this.triplet, this.view.pxPerBeat);
  }

  /**
   * Snap step of the editor in beats, or null when the grid is off.
   * @returns {number|null}
   */
  editorStep() {
    return this.editorGrid().step;
  }

  /**
   * Playhead position in beats relative to the selected clip, or null when no
   * clip is selected or the playhead lies outside it.
   * @returns {number|null}
   */
  editorPlayhead() {
    const clip = this.#project.selectedClip;
    if (!clip) return null;
    const local = this.#transport.playheadBeat - clip.start;
    return local >= 0 && local <= this.view.o.contentBeats() ? local : null;
  }

  /**
   * Scroll the piano roll so a beat stays visible.
   * @param {number} beat position in beats, relative to the clip start
   */
  followPlayhead(beat) {
    const s = this.view.o.scroller;
    const x = this.view.beatToX(beat);
    if (x < s.scrollLeft || x > s.scrollLeft + s.clientWidth) s.scrollLeft = x - 8;
  }

  // ===== Drawing =====

  /** Draw the piano roll: lanes, grid, region, notes, playhead and ruler. */
  render() {
    const c = this.view.grid;
    const { W, H, sx, sy, drawW, firstRow, lastRow } = this.view.viewport();
    const rh = this.view.rowHeight;
    const clip = this.#project.selectedClip;
    c.fillStyle = COLORS.void;
    c.fillRect(0, 0, W, H);
    this.renderKeys();
    if (!clip) {
      this.view.drawRuler({ subStep: null, regionEnd: 0, playheadBeat: null });
      c.fillStyle = COLORS.message;
      c.font = "13px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("Select a clip above, or press + Clip", W / 2, Math.min(H / 2, 60));
      return;
    }
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = rowToPitch(row);
      const y = row * rh - sy;
      c.fillStyle = BLACK_KEYS.has(pitch % 12) ? COLORS.rowBlack : COLORS.rowWhite;
      c.fillRect(0, y, drawW, rh);
      if (pitch % 12 === 0) {
        c.fillStyle = COLORS.octaveLine;
        c.fillRect(0, y + rh - 1, drawW, 1);
      }
    }
    const step = this.editorStep();
    this.view.drawVerticalLines(c, H, step, drawW);
    this.view.drawRegion(c, H, clip.length, drawW);

    for (const n of clip.notes) {
      const x0 = this.view.beatToX(n.start) - sx, x1 = this.view.beatToX(n.start + n.duration) - sx;
      const y = pitchToRow(n.pitch) * rh - sy;
      if (x1 < 0 || x0 > W || y + rh < 0 || y > H) continue;
      const w = Math.max(2, x1 - x0 - 1), h = Math.max(2, rh - 2);
      c.fillStyle = this.selected.has(n.id) ? COLORS.noteSelected : COLORS.note;
      c.fillRect(Math.round(x0), y + 1, w, h);
      c.strokeStyle = COLORS.noteBorder;
      c.lineWidth = 1;
      c.strokeRect(Math.round(x0) + 0.5, y + 1.5, w - 1, h - 1);
    }
    const ph = this.editorPlayhead();
    if (ph !== null) this.view.drawPlayhead(c, H, ph);
    this.view.drawRuler({ subStep: step, regionEnd: clip.length, playheadBeat: ph });
  }

  /** Draw the piano-key strip left of the grid. */
  renderKeys() {
    const c = this.#keysCtx;
    if (!c) return;
    const W = this.#dom.keysCanvas.clientWidth, H = this.#dom.keysCanvas.clientHeight;
    const { sy, firstRow, lastRow } = this.view.viewport();
    const rh = this.view.rowHeight;
    const blackW = Math.round(W * 0.62);
    const showAll = rh >= 16;
    c.fillStyle = COLORS.void;
    c.fillRect(0, 0, W, H);
    c.font = `${clamp(rh - 5, 8, 11)}px system-ui, sans-serif`;
    c.textBaseline = "middle";
    c.textAlign = "right";
    for (let row = firstRow; row <= lastRow; row++) {
      const pitch = rowToPitch(row);
      const y = row * rh - sy;
      const black = BLACK_KEYS.has(pitch % 12);
      const active = this.activeKey === pitch;
      c.fillStyle = active ? COLORS.keyActive : COLORS.keyWhite;
      c.fillRect(0, y, W, rh);
      if (black) {
        c.fillStyle = active ? COLORS.keyActive : COLORS.keyBlack;
        c.fillRect(0, y, blackW, rh);
      }
      if (pitch % 12 === 0 || pitch % 12 === 5) {
        c.fillStyle = COLORS.keyBorder;
        c.fillRect(0, y + rh - 1, W, 1);
      }
      if (rh >= 8 && (pitch % 12 === 0 || showAll)) {
        c.fillStyle = black ? COLORS.keyTextLight : COLORS.keyTextDark;
        c.fillText(midiName(pitch), (black ? blackW : W) - 3, y + rh / 2 + 0.5);
      }
    }
  }

  // ===== State changes =====

  /** Announce a change to the notes of the selected clip and redraw. */
  notesChanged() {
    const clip = this.#project.selectedClip;
    if (clip) this.#project.notesChanged(clip);
    this.view.updateSpacer();
    this.view.requestRender();
  }

  /** Update the toolbar and the roll after the selected clip changed. */
  refreshClip() {
    const clip = this.#project.selectedClip;
    this.#dom.clipTitle.textContent = clip
      ? `${clip.name} (${this.#project.trackById(clip.trackId).name})`
      : "No clip selected";
    this.#dom.lenInput.value = clip ? clip.length / BEATS_PER_BAR : 1;
    this.#dom.lenInput.disabled = !clip;
    this.#dom.clearBtn.disabled = !clip;
    this.view.updateSpacer();
    this.view.requestRender();
  }

  /**
   * Switch between draw mode and select mode.
   * @param {boolean} on true for draw mode
   */
  setDrawMode(on) {
    this.drawMode = on;
    this.#dom.drawBtn.classList.toggle("on", on);
    if (on) this.selected.clear();
    this.view.requestRender();
  }

  // ===== Layout and bindings =====

  #layoutAll() {
    this.view.layout();
    this.#keysCtx = sizeCanvas(this.#dom.keysCanvas, this.#dom.keysWrap.clientWidth, this.#dom.keysWrap.clientHeight);
  }

  #listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  #bindToolbar() {
    const controls = this.#dom;

    this.#listen(controls.lenInput, "change", () => {
      const clip = this.#project.selectedClip;
      if (!clip) return;
      clip.length = clamp(Number(controls.lenInput.value) || clip.length / BEATS_PER_BAR, 0.25, 256) * BEATS_PER_BAR;
      controls.lenInput.value = clip.length / BEATS_PER_BAR;
      this.#project.clipChanged(clip);
      this.view.updateSpacer();
      this.view.requestRender();
    });

    this.#listen(controls.gridSelect, "change", () => {
      this.gridMode = controls.gridSelect.value;
      controls.gridReadout.textContent = this.editorGrid().label;
      this.view.requestRender();
    });

    this.#listen(controls.tripletBtn, "click", () => {
      this.triplet = !this.triplet;
      controls.tripletBtn.classList.toggle("on", this.triplet);
      controls.gridReadout.textContent = this.editorGrid().label;
      this.view.requestRender();
    });

    this.#listen(controls.snapBtn, "click", () => {
      this.snap = !this.snap;
      controls.snapBtn.classList.toggle("on", this.snap);
    });

    this.#listen(controls.drawBtn, "click", () => this.setDrawMode(!this.drawMode));
    this.#listen(controls.clearBtn, "click", () => this.#commands.run("editor.clearNotes"));

    this.#listen($("edZoomInH"), "click", () => this.view.zoomH(ZOOM_BUTTON_FACTOR));
    this.#listen($("edZoomOutH"), "click", () => this.view.zoomH(1 / ZOOM_BUTTON_FACTOR));
    this.#listen($("edZoomInV"), "click", () => this.view.zoomV(ZOOM_BUTTON_FACTOR));
    this.#listen($("edZoomOutV"), "click", () => this.view.zoomV(1 / ZOOM_BUTTON_FACTOR));
  }

  #subscribe(bus) {
    this.#cleanups.push(
      bus.on("selection", ({ clipId, previousClipId }) => {
        if (clipId !== previousClipId) this.selected.clear();
        this.refreshClip();
      }),
    );
    for (const event of ["clip:changed", "clip:removed", "clip:notes", "track:changed", "track:removed"]) {
      this.#cleanups.push(bus.on(event, () => this.refreshClip()));
    }
    this.#cleanups.push(bus.on("transport:playhead", () => this.view.requestRender()));
    this.#cleanups.push(
      bus.on("transport:tick", () => {
        if (this.#transport.follow) {
          const local = this.editorPlayhead();
          if (local !== null) this.followPlayhead(local);
        }
        this.view.requestRender();
      }),
    );
  }

  // ===== Note editing =====

  #onNoteRightEdge(n, x) {
    return x >= this.view.beatToX(n.start + n.duration) - Math.min(8, this.view.beatToX(n.duration) * 0.4);
  }

  #addNoteAt(clip, beat, pitch) {
    const step = this.editorStep();
    const start = Math.max(0, this.snap ? snapFloor(beat, step) : beat);
    if (clip.noteAt(start + EPS, pitch)) return null;
    let duration = step ?? this.lastDuration;
    for (const o of clip.notes) {
      if (o.pitch === pitch && o.start > start + EPS) duration = Math.min(duration, o.start - start);
    }
    if (duration < EPS) return null;
    const note = new Note({ id: this.#project.nextId(), pitch, start, duration, velocity: DEFAULT_VELOCITY });
    clip.notes.push(note);
    this.#audio.preview(clip.trackId, pitch);
    this.notesChanged();
    return note;
  }

  #pruneNotes(clip, ids) {
    const set = new Set(ids);
    if (!set.size) return;
    clip.notes = clip.notes.filter((n) => !set.has(n.id));
    for (const id of set) this.selected.delete(id);
  }

  #deleteNotes(clip, ids) {
    this.#pruneNotes(clip, ids);
    this.notesChanged();
  }

  #resolveOverlaps(clip, note) {
    const end = note.start + note.duration;
    const doomed = [];
    for (const other of clip.notes) {
      if (other === note || other.pitch !== note.pitch) continue;
      const otherEnd = other.start + other.duration;
      if (otherEnd <= note.start + EPS || other.start >= end - EPS) continue;
      if (other.start < note.start - EPS) other.duration = note.start - other.start;
      else if (otherEnd > end + EPS) { other.duration = otherEnd - end; other.start = end; }
      else doomed.push(other.id);
    }
    this.#pruneNotes(clip, doomed);
  }

  #beginNoteMove(clip, note, p, pointerId) {
    const group = !this.drawMode && this.selected.has(note.id)
      ? clip.notes.filter((n) => this.selected.has(n.id))
      : [note];
    this.#nDrag = {
      type: "move", pointerId, anchor: note, moved: false,
      items: group.map((n) => ({ note: n, start: n.start, pitch: n.pitch })),
      beat0: p.beat, pitch0: rowToPitch(p.row), vx0: p.vx, vy0: p.vy, lastPreview: note.pitch,
    };
  }

  #updateNoteMove(clip, p) {
    const d = this.#nDrag;
    if (!d.moved) {
      if (Math.hypot(p.vx - d.vx0, p.vy - d.vy0) < DRAG_THRESHOLD) return;
      d.moved = true;
    }
    const step = this.editorStep();
    const anchor = d.items.find((it) => it.note === d.anchor);
    const target = anchor.start + (p.beat - d.beat0);
    const minStart = Math.min(...d.items.map((it) => it.start));
    const minPitch = Math.min(...d.items.map((it) => it.pitch));
    const maxPitch = Math.max(...d.items.map((it) => it.pitch));
    const dBeat = Math.max((this.snap ? snapRound(target, step) : target) - anchor.start, -minStart);
    const dPitch = clamp(rowToPitch(p.row) - d.pitch0, -minPitch, TOP_PITCH - maxPitch);
    for (const it of d.items) {
      it.note.start = it.start + dBeat;
      it.note.pitch = it.pitch + dPitch;
    }
    if (d.anchor.pitch !== d.lastPreview) {
      d.lastPreview = d.anchor.pitch;
      this.#audio.preview(clip.trackId, d.anchor.pitch);
    }
    this.view.updateSpacer();
    this.view.requestRender();
  }

  #updateNoteResize(p) {
    const d = this.#nDrag;
    const step = this.editorStep();
    const rawEnd = d.note.start + d.duration0 + (p.x - d.x0) / this.view.pxPerBeat;
    const end = this.snap ? snapRound(rawEnd, step) : rawEnd;
    d.note.duration = Math.max(step ?? MIN_FREE_DURATION, end - d.note.start);
    this.lastDuration = d.note.duration;
    this.view.updateSpacer();
    this.view.requestRender();
  }

  #updatePaint(clip, p) {
    const step = this.editorStep();
    if (!step || !this.snap) return;
    const cell = snapFloor(p.beat, step);
    if (cell === this.#nDrag.lastCell) return;
    this.#nDrag.lastCell = cell;
    this.#addNoteAt(clip, cell, this.#nDrag.pitch);
  }

  #commitNoteEdit(clip, d) {
    const notes = d.type === "move" ? d.items.map((it) => it.note) : [d.note];
    for (const n of notes) {
      if (clip.notes.includes(n)) this.#resolveOverlaps(clip, n);
    }
    this.notesChanged();
  }

  // ===== Grid pointer handling =====

  #bindScroller() {
    const scroller = this.view.o.scroller;

    this.#listen(scroller, "pointerdown", (e) => {
      if (e.button !== 0) return;
      this.#audio.unlock().catch(() => {});
      if (this.view.trackDown(e)) { this.#nDrag = null; return; }
      const clip = this.#project.selectedClip;
      if (!clip) return;
      const p = this.view.point(e);
      const pitch = rowToPitch(p.row);
      const touch = e.pointerType === "touch";
      const hit = clip.noteAt(p.beat, pitch);
      if (hit) {
        if (!this.drawMode) {
          if (e.shiftKey) {
            if (this.selected.has(hit.id)) this.selected.delete(hit.id);
            else this.selected.add(hit.id);
          } else if (!this.selected.has(hit.id)) {
            this.selected.clear();
            this.selected.add(hit.id);
          }
        }
        if (this.#onNoteRightEdge(hit, p.x)) {
          this.#nDrag = { type: "resize", pointerId: e.pointerId, note: hit, x0: p.x, duration0: hit.duration };
        } else {
          this.#beginNoteMove(clip, hit, p, e.pointerId);
        }
        this.#nDrag.shift = e.shiftKey;
      } else if (this.drawMode) {
        if (touch) {
          this.#nDrag = { type: "tap", pointerId: e.pointerId, vx0: p.vx, vy0: p.vy, beat: p.beat, pitch };
        } else {
          const note = this.#addNoteAt(clip, p.beat, pitch);
          this.#nDrag = { type: "paint", pointerId: e.pointerId, pitch, lastCell: note ? note.start : null };
        }
      } else if (!e.shiftKey) {
        this.selected.clear();
      }
      if (this.#nDrag && !touch) scroller.setPointerCapture(e.pointerId);
      this.view.requestRender();
    });

    this.#listen(scroller, "pointermove", (e) => {
      if (this.view.trackMove(e)) return;
      const clip = this.#project.selectedClip;
      if (!clip) return;
      if (!this.#nDrag || this.#nDrag.pointerId !== e.pointerId) {
        if (e.pointerType === "mouse") {
          const p = this.view.point(e);
          const hit = clip.noteAt(p.beat, rowToPitch(p.row));
          scroller.style.cursor = hit ? (this.#onNoteRightEdge(hit, p.x) ? "ew-resize" : this.drawMode ? "pointer" : "move")
            : this.drawMode ? "crosshair" : "default";
        }
        return;
      }
      const p = this.view.point(e);
      switch (this.#nDrag.type) {
        case "tap": if (Math.hypot(p.vx - this.#nDrag.vx0, p.vy - this.#nDrag.vy0) > TAP_SLOP) this.#nDrag = null; break;
        case "paint": this.#updatePaint(clip, p); break;
        case "move": this.#updateNoteMove(clip, p); break;
        case "resize": this.#updateNoteResize(p); break;
      }
    });

    this.#listen(scroller, "pointerup", (e) => this.#endEditorPointer(e, false));
    this.#listen(scroller, "pointercancel", (e) => this.#endEditorPointer(e, true));
    this.#listen(scroller, "touchmove", (e) => {
      if (e.touches.length >= 2 || (this.#nDrag && (this.#nDrag.type === "move" || this.#nDrag.type === "resize"))) e.preventDefault();
    }, { passive: false });

    this.#listen(scroller, "contextmenu", (e) => {
      e.preventDefault();
      const clip = this.#project.selectedClip;
      if (!clip) return;
      const p = this.view.point(e);
      const hit = clip.noteAt(p.beat, rowToPitch(p.row));
      if (hit) this.#deleteNotes(clip, [hit.id]);
    });

    this.#listen(scroller, "dblclick", (e) => {
      const clip = this.#project.selectedClip;
      if (!clip || this.drawMode) return;
      const p = this.view.point(e);
      if (!clip.noteAt(p.beat, rowToPitch(p.row))) this.#addNoteAt(clip, p.beat, rowToPitch(p.row));
    });
  }

  #endEditorPointer(e, cancelled) {
    if (this.view.trackUp(e)) return;
    if (!this.#nDrag || this.#nDrag.pointerId !== e.pointerId) return;
    const d = this.#nDrag;
    this.#nDrag = null;
    const clip = this.#project.selectedClip;
    if (!clip) return;
    if (d.type === "tap") {
      if (!cancelled) this.#addNoteAt(clip, d.beat, d.pitch);
    } else if (d.type === "move") {
      if (d.moved) this.#commitNoteEdit(clip, d);
      else if (!cancelled && this.drawMode) this.#deleteNotes(clip, [d.anchor.id]);
      else if (!cancelled && !d.shift) { this.selected.clear(); this.selected.add(d.anchor.id); }
    } else if (d.type === "resize") {
      this.#commitNoteEdit(clip, d);
    }
    this.view.requestRender();
  }

  // ===== Piano keys: tap plays, drag vertically scrolls, drag horizontally zooms =====

  #keyPitchAt(e) {
    const canvas = this.#dom.keysCanvas;
    return rowToPitch(
      clamp(
        Math.floor(
          (e.clientY - canvas.getBoundingClientRect().top + this.view.o.scroller.scrollTop) / this.view.rowHeight,
        ),
        0,
        TOP_PITCH,
      ),
    );
  }

  #keyOff() {
    if (this.activeKey === null) return;
    const clip = this.#project.selectedClip;
    this.#audio.noteOff(clip ? clip.trackId : this.#project.selectedTrackId, this.activeKey);
    this.activeKey = null;
    this.view.requestRender();
  }

  #bindKeys() {
    const canvas = this.#dom.keysCanvas;

    this.#listen(canvas, "pointerdown", (e) => {
      if (e.button !== 0) return;
      this.#audio.unlock().catch(() => {});
      canvas.setPointerCapture(e.pointerId);
      const anchorY = e.clientY - canvas.getBoundingClientRect().top;
      this.#keyDrag = {
        pointerId: e.pointerId, mode: "key", x0: e.clientX, y0: e.clientY, anchorY,
        scrollTop0: this.view.o.scroller.scrollTop, rowHeight0: this.view.rowHeight,
        rowAtAnchor: (this.view.o.scroller.scrollTop + anchorY) / this.view.rowHeight,
      };
      const clip = this.#project.selectedClip;
      this.activeKey = this.#keyPitchAt(e);
      this.#audio.noteOn(clip ? clip.trackId : this.#project.selectedTrackId, this.activeKey);
      this.view.requestRender();
    });

    this.#listen(canvas, "pointermove", (e) => {
      if (!this.#keyDrag || this.#keyDrag.pointerId !== e.pointerId) return;
      const dx = e.clientX - this.#keyDrag.x0, dy = e.clientY - this.#keyDrag.y0;
      if (this.#keyDrag.mode === "key") {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        this.#keyOff();
        this.#keyDrag.mode = Math.abs(dx) > Math.abs(dy) ? "zoom" : "scroll";
      }
      if (this.#keyDrag.mode === "scroll") this.view.o.scroller.scrollTop = this.#keyDrag.scrollTop0 - dy;
      else this.view.setRowHeight(this.#keyDrag.rowHeight0 * Math.exp(dx * 0.01), this.#keyDrag.anchorY, this.#keyDrag.rowAtAnchor);
    });

    const endKeyPointer = () => { this.#keyOff(); this.#keyDrag = null; };
    this.#listen(canvas, "pointerup", endKeyPointer);
    this.#listen(canvas, "pointercancel", endKeyPointer);

    this.#listen(canvas, "wheel", (e) => {
      e.preventDefault();
      const { dy } = wheelDeltas(e);
      if (e.altKey || e.ctrlKey || e.metaKey) {
        this.view.zoomV(Math.exp(-dy * 0.002), e.clientY - canvas.getBoundingClientRect().top);
      } else {
        this.view.o.scroller.scrollTop += dy;
      }
    }, { passive: false });
  }
}
