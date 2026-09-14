/**
 * Musical constants and pure helper functions shared by the whole app.
 *
 * Everything here is stateless: no DOM, no audio engine, no app globals. The
 * values are the ones the original single-file app used, kept verbatim so
 * behaviour is unchanged.
 */

export const PITCH_COUNT = 128;
export const TOP_PITCH = PITCH_COUNT - 1;
export const BEATS_PER_BAR = 4;                 // fixed 4/4
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
export const DEFAULT_VELOCITY = 100;
export const MIN_FREE_DURATION = 1 / 16;
export const EPS = 1e-6;
export const DRAG_THRESHOLD = 4;
export const TAP_SLOP = 8;
export const ZOOM_BUTTON_FACTOR = 1.25;
export const MIN_SONG_BEATS = 16;
export const SONG_TAIL_BEATS = 16;              // empty space kept after the last clip

export const FIXED_GRIDS = { "1bar": 4, "1/2": 2, "1/4": 1, "1/8": 0.5, "1/16": 0.25, "1/32": 0.125 };
export const ADAPTIVE_MIN_PX = { widest: 96, wide: 48, medium: 24, narrow: 12, narrowest: 6 };
export const ADAPTIVE_STEPS = [4, 2, 1, 0.5, 0.25, 0.125, 0.0625];
export const STEP_LABELS = new Map([[4, "1 Bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"], [0.125, "1/32"], [0.0625, "1/64"]]);
export const TRACK_COLORS = ["#f2b544", "#5fc9d8", "#e07a7a", "#9bd76e", "#c58cf0", "#f08c4a", "#7ea6f0", "#e6d35a"];

/**
 * Constrain a value to an inclusive range.
 * @param {number} v value to constrain
 * @param {number} lo lower bound
 * @param {number} hi upper bound
 * @returns {number}
 */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Name of a MIDI pitch, e.g. 60 becomes "C3".
 * @param {number} pitch MIDI note number
 * @returns {string}
 */
export const midiName = (pitch) => NOTE_NAMES[pitch % 12] + (Math.floor(pitch / 12) - 2);   // Ableton: C3 = MIDI 60

/**
 * Snap a beat position down to the previous grid line.
 * @param {number} beat position in beats
 * @param {number|null} step grid step in beats; falsy means no snapping
 * @returns {number}
 */
export const snapFloor = (beat, step) => (step ? Math.floor(beat / step + EPS) * step : beat);

/**
 * Snap a beat position to the nearest grid line.
 * @param {number} beat position in beats
 * @param {number|null} step grid step in beats; falsy means no snapping
 * @returns {number}
 */
export const snapRound = (beat, step) => (step ? Math.round(beat / step) * step : beat);

/**
 * Round a length in beats up to a whole number of bars.
 * @param {number} beats length in beats
 * @returns {number}
 */
export const ceilBars = (beats) => Math.ceil(beats / BEATS_PER_BAR - EPS) * BEATS_PER_BAR;

/**
 * Piano-roll row index of a pitch (row 0 is the highest pitch).
 * @param {number} pitch MIDI note number
 * @returns {number}
 */
export const pitchToRow = (pitch) => TOP_PITCH - pitch;

/**
 * Pitch shown on a piano-roll row (row 0 is the highest pitch).
 * @param {number} row row index
 * @returns {number}
 */
export const rowToPitch = (row) => TOP_PITCH - row;

/**
 * Resolve a grid mode to a concrete step in beats plus its display label.
 *
 * Fixed modes come straight from FIXED_GRIDS. Adaptive modes pick the finest
 * step from ADAPTIVE_STEPS that is still at least ADAPTIVE_MIN_PX wide at the
 * current zoom.
 *
 * @param {string} mode "off", a FIXED_GRIDS key, or an ADAPTIVE_MIN_PX key
 * @param {boolean} triplet whether the step is divided into triplets
 * @param {number} pxPerBeat current horizontal zoom
 * @returns {{ step: number|null, label: string }}
 */
export function gridStep(mode, triplet, pxPerBeat) {
  if (mode === "off") return { step: null, label: "Off" };
  let base = FIXED_GRIDS[mode];
  if (base === undefined) {
    const minPx = ADAPTIVE_MIN_PX[mode];
    const scale = triplet ? 2 / 3 : 1;
    base = ADAPTIVE_STEPS[0];
    for (const step of ADAPTIVE_STEPS) {
      if (step * scale * pxPerBeat >= minPx) base = step;
      else break;
    }
  }
  const label = STEP_LABELS.get(base) + (triplet ? (base === 4 ? " T" : "T") : "");
  return { step: triplet ? (base * 2) / 3 : base, label };
}
