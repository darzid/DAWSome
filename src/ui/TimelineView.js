import { COLORS } from "../util/theme.js";
import { BEATS_PER_BAR, EPS, DRAG_THRESHOLD, clamp } from "../util/music.js";
import { sizeCanvas, wheelDeltas } from "./dom.js";

/**
 * TimelineView: zoom, scroll, pinch, ruler — shared by arrangement and clip editor.
 *
 * The view owns the horizontal (pxPerBeat) and vertical (rowHeight) zoom, the
 * scroller geometry and the ruler interaction; the owner supplies the elements
 * and the callbacks that describe and draw its own content.
 */
export class TimelineView {
  /**
   * @param {Object} o options bag, kept on the instance as `this.o`:
   *   { gridWrap, gridCanvas, rulerWrap, rulerCanvas, scroller, spacer, hZoom, vZoom,
   *     rowHeight, rowCount, contentBeats, render, onLocate, onZoom, unlock }
   *   `unlock` is optional and returns a Promise; it is called on ruler
   *   pointerdown so the audio context can be resumed from a user gesture.
   */
  constructor(o) {
    this.o = o;   // { gridWrap, gridCanvas, rulerWrap, rulerCanvas, scroller, spacer, hZoom, vZoom, rowHeight, rowCount, contentBeats, render, onLocate, onZoom, unlock }
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

  /** Resize both canvases to their wrappers and schedule a render. */
  layout() {
    this.grid = sizeCanvas(this.o.gridCanvas, this.o.gridWrap.clientWidth, this.o.gridWrap.clientHeight);
    this.ruler = sizeCanvas(this.o.rulerCanvas, this.o.rulerWrap.clientWidth, this.o.rulerWrap.clientHeight);
    this.requestRender();
  }

  /** Resize the scroll spacer so the scrollbars match the content extent. */
  updateSpacer() {
    this.o.spacer.style.width = `${Math.ceil(this.beatToX(this.o.contentBeats()))}px`;
    this.o.spacer.style.height = `${this.o.rowCount() * this.rowHeight}px`;
  }

  /** Coalesce render requests into one animation frame. */
  requestRender() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      if (this.grid) this.o.render();
    });
  }

  /**
   * Content x of a beat position.
   * @param {number} beat
   * @returns {number}
   */
  beatToX(beat) { return beat * this.pxPerBeat; }

  /**
   * Visible viewport in content units.
   * @returns {{ W: number, H: number, sx: number, sy: number, drawW: number,
   *   beat0: number, beat1: number, firstRow: number, lastRow: number }}
   */
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

  /**
   * Pointer position in viewport, content, beat and row coordinates.
   * @param {PointerEvent|MouseEvent} e
   * @returns {{ vx: number, vy: number, x: number, y: number, beat: number, row: number }}
   */
  point(e) {
    const r = this.o.scroller.getBoundingClientRect();
    const vx = e.clientX - r.left, vy = e.clientY - r.top;
    const x = vx + this.o.scroller.scrollLeft, y = vy + this.o.scroller.scrollTop;
    return { vx, vy, x, y, beat: x / this.pxPerBeat, row: clamp(Math.floor(y / this.rowHeight), 0, Math.max(0, this.o.rowCount() - 1)) };
  }

  /**
   * Set the horizontal zoom, keeping `beatAtAnchor` under `anchorX`.
   * @param {number} value new pixels per beat, clamped to o.hZoom
   * @param {number} anchorX viewport x to keep fixed
   * @param {number} beatAtAnchor beat currently at anchorX
   */
  setPxPerBeat(value, anchorX, beatAtAnchor) {
    this.pxPerBeat = clamp(value, this.o.hZoom.min, this.o.hZoom.max);
    this.updateSpacer();
    this.o.scroller.scrollLeft = this.beatToX(beatAtAnchor) - anchorX;
    if (this.o.onZoom) this.o.onZoom();
    this.requestRender();
  }

  /**
   * Set the vertical zoom, keeping `rowAtAnchor` under `anchorY`.
   * @param {number} value new row height, clamped to o.vZoom
   * @param {number} anchorY viewport y to keep fixed
   * @param {number} rowAtAnchor row currently at anchorY
   */
  setRowHeight(value, anchorY, rowAtAnchor) {
    this.rowHeight = clamp(value, this.o.vZoom.min, this.o.vZoom.max);
    this.updateSpacer();
    this.o.scroller.scrollTop = rowAtAnchor * this.rowHeight - anchorY;
    if (this.o.onZoom) this.o.onZoom();
    this.requestRender();
  }

  /**
   * Zoom horizontally by a factor around an anchor.
   * @param {number} factor
   * @param {number} [anchorX] viewport x, defaults to the scroller centre
   */
  zoomH(factor, anchorX = this.o.scroller.clientWidth / 2) {
    this.setPxPerBeat(this.pxPerBeat * factor, anchorX, (this.o.scroller.scrollLeft + anchorX) / this.pxPerBeat);
  }

  /**
   * Zoom vertically by a factor around an anchor.
   * @param {number} factor
   * @param {number} [anchorY] viewport y, defaults to the scroller centre
   */
  zoomV(factor, anchorY = this.o.scroller.clientHeight / 2) {
    this.setRowHeight(this.rowHeight * factor, anchorY, (this.o.scroller.scrollTop + anchorY) / this.rowHeight);
  }

  /**
   * Wheel handling: ctrl/meta zooms horizontally, alt zooms vertically,
   * shift scrolls horizontally.
   * @param {WheelEvent} e
   * @param {HTMLElement} el element the wheel event is measured against
   */
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

  /**
   * Register a pointer down.
   * @param {PointerEvent} e
   * @returns {boolean} true when the gesture is a pinch and the caller should stop
   */
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

  /**
   * Update a pinch in progress.
   * @param {PointerEvent} e
   * @returns {boolean} true when the pinch consumed the event
   */
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

  /**
   * Release a pointer and end the pinch when fewer than two remain.
   * @param {PointerEvent} e
   * @returns {boolean} true when the pinch consumed the event
   */
  trackUp(e) {
    this.pointers.delete(e.pointerId);
    if (!this.pinch) return false;
    if (this.pointers.size < 2) this.pinch = null;
    return true;
  }

  // --- ruler: tap locates, drag ↕ zooms, drag ↔ scrolls ---

  /** Attach the ruler pointer and wheel handlers. Called by the constructor. */
  bindRuler() {
    const canvas = this.o.rulerCanvas;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (this.o.unlock) this.o.unlock().catch(() => {});
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
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
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

  /**
   * Draw the sub-step, beat and bar lines across the grid.
   * @param {CanvasRenderingContext2D} c
   * @param {number} H height in CSS pixels
   * @param {number|null} subStep sub-division in beats, or null for none
   * @param {number} drawW width of the drawn content area
   */
  drawVerticalLines(c, H, subStep, drawW) {
    const { sx, beat0, beat1 } = this.viewport();
    const ppb = this.pxPerBeat;
    if (subStep && subStep * ppb >= 3) {
      c.fillStyle = COLORS.lineSub;
      for (let k = Math.ceil(beat0 / subStep - EPS); k * subStep <= beat1 + EPS; k++) {
        const beat = k * subStep;
        if (Math.abs(beat - Math.round(beat)) < EPS) continue;
        c.fillRect(Math.round(this.beatToX(beat) - sx), 0, 1, H);
      }
    }
    for (let beat = Math.ceil(beat0 - EPS); beat <= beat1 + EPS; beat++) {
      const isBar = beat % BEATS_PER_BAR === 0;
      if (!isBar && ppb < 3) continue;
      if (isBar && ppb * BEATS_PER_BAR < 3) continue;
      c.fillStyle = isBar ? COLORS.lineBar : COLORS.lineBeat;
      c.fillRect(Math.round(this.beatToX(beat) - sx), 0, 1, H);
    }
    void drawW;
  }

  /**
   * Shade everything past the end of the region and draw its edge.
   * @param {CanvasRenderingContext2D} c
   * @param {number} H height in CSS pixels
   * @param {number} regionEnd region end in beats
   * @param {number} drawW width of the drawn content area
   */
  drawRegion(c, H, regionEnd, drawW) {
    const x = this.beatToX(regionEnd) - this.o.scroller.scrollLeft;
    if (x < drawW) {
      c.fillStyle = COLORS.regionShade;
      c.fillRect(Math.max(0, x), 0, drawW - Math.max(0, x), H);
    }
    if (x >= 0 && x <= drawW) {
      c.fillStyle = COLORS.regionEdge;
      c.fillRect(Math.round(x), 0, 1, H);
    }
  }

  /**
   * Draw the playhead line in the grid.
   * @param {CanvasRenderingContext2D} c
   * @param {number} H height in CSS pixels
   * @param {number} beat playhead position in beats
   */
  drawPlayhead(c, H, beat) {
    const px = Math.round(this.beatToX(beat) - this.o.scroller.scrollLeft);
    if (px < 0 || px > this.o.gridCanvas.clientWidth) return;
    c.fillStyle = COLORS.playhead;
    c.fillRect(px, 0, 1, H);
  }

  /**
   * Draw the whole ruler: region tint, ticks, bar/beat labels and playhead.
   * @param {{ subStep: number|null, regionEnd: number, playheadBeat: number|null }} params
   */
  drawRuler({ subStep, regionEnd, playheadBeat }) {
    const c = this.ruler;
    const W = this.o.rulerCanvas.clientWidth, H = this.o.rulerCanvas.clientHeight;
    const { sx, beat0, beat1, drawW } = this.viewport();
    const ppb = this.pxPerBeat;
    c.fillStyle = COLORS.ruler;
    c.fillRect(0, 0, W, H);
    c.fillStyle = COLORS.rulerRegion;
    c.fillRect(0, 0, Math.min(drawW, this.beatToX(regionEnd) - sx), H);

    c.fillStyle = COLORS.rulerTick;
    if (subStep && subStep * ppb >= 6) {
      for (let k = Math.ceil(beat0 / subStep - EPS); k * subStep <= beat1 + EPS; k++) {
        const beat = k * subStep;
        if (Math.abs(beat - Math.round(beat)) < EPS) continue;
        c.fillRect(Math.round(this.beatToX(beat) - sx), H - 4, 1, 4);
      }
    }
    const barPx = ppb * BEATS_PER_BAR;
    const labelEvery = Math.max(1, Math.ceil(28 / barPx));
    const showBeats = ppb >= 40;
    c.font = "10px system-ui, sans-serif";
    c.textBaseline = "top";
    c.textAlign = "left";
    for (let beat = Math.ceil(beat0 - EPS); beat <= beat1 + EPS; beat++) {
      const x = Math.round(this.beatToX(beat) - sx);
      const bar = Math.floor(beat / BEATS_PER_BAR);
      const beatInBar = beat % BEATS_PER_BAR;
      if (beatInBar === 0) {
        const labelled = bar % labelEvery === 0;
        if (!labelled && barPx < 6) continue;
        c.fillStyle = COLORS.rulerTick;
        c.fillRect(x, labelled ? 0 : H - 8, 1, labelled ? H : 8);
        if (labelled) {
          c.fillStyle = COLORS.rulerText;
          c.fillText(String(bar + 1), x + 3, 2);
        }
      } else if (showBeats) {
        c.fillStyle = COLORS.rulerTick;
        c.fillRect(x, H - 8, 1, 8);
        c.fillStyle = COLORS.rulerText;
        c.fillText(`${bar + 1}.${beatInBar + 1}`, x + 3, 2);
      } else if (ppb >= 6) {
        c.fillStyle = COLORS.rulerTick;
        c.fillRect(x, H - 5, 1, 5);
      }
    }
    if (playheadBeat === null) return;
    const px = Math.round(this.beatToX(playheadBeat) - sx);
    if (px < 0 || px > W) return;
    c.fillStyle = COLORS.playhead;
    c.fillRect(px, 0, 1, H);
    c.beginPath();
    c.moveTo(px - 5, 0);
    c.lineTo(px + 6, 0);
    c.lineTo(px + 0.5, 7);
    c.closePath();
    c.fill();
  }
}
