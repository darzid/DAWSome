// Unit tests for the musical helpers (src/util/music.js).
//
// These are a verbatim port of the timing maths from the original index.html:
// bar/beat constants, note naming (Ableton style, C3 = MIDI 60), snapping,
// rounding up to whole bars, and the grid resolution picker - both the fixed
// grids and the adaptive ones, which choose the smallest step that still has
// enough pixels per beat.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  BEATS_PER_BAR,
  MIN_SONG_BEATS,
  EPS,
  DEFAULT_VELOCITY,
  FIXED_GRIDS,
  ADAPTIVE_STEPS,
  STEP_LABELS,
  clamp,
  midiName,
  snapFloor,
  snapRound,
  ceilBars,
  gridStep,
} from "../src/util/music.js";

describe("constants", () => {
  test("timing constants match the original", () => {
    assert.equal(BEATS_PER_BAR, 4);
    assert.equal(MIN_SONG_BEATS, 16);
    assert.equal(EPS, 1e-6);
    assert.equal(DEFAULT_VELOCITY, 100);
  });

  test("grid tables match the original", () => {
    assert.deepEqual(FIXED_GRIDS, {
      "1bar": 4, "1/2": 2, "1/4": 1, "1/8": 0.5, "1/16": 0.25, "1/32": 0.125,
    });
    assert.deepEqual(ADAPTIVE_STEPS, [4, 2, 1, 0.5, 0.25, 0.125, 0.0625]);
    assert.equal(STEP_LABELS.get(4), "1 Bar");
    assert.equal(STEP_LABELS.get(1), "1/4");
    assert.equal(STEP_LABELS.get(0.25), "1/16");
    assert.equal(STEP_LABELS.get(0.0625), "1/64");
  });
});

describe("clamp", () => {
  test("bounds a value to the range", () => {
    assert.equal(clamp(0.5, 0, 1), 0.5);
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(clamp(-30, -60, 0), -30);
  });
});

describe("midiName", () => {
  test("names pitches the way Ableton does (C3 = 60)", () => {
    assert.equal(midiName(60), "C3");
    assert.equal(midiName(61), "C#3");
    assert.equal(midiName(72), "C4");
    assert.equal(midiName(59), "B2");
    assert.equal(midiName(0), "C-2");
    assert.equal(midiName(127), "G8");
  });
});

describe("ceilBars", () => {
  test("rounds up to whole bars, leaving exact bars alone", () => {
    assert.equal(ceilBars(5), 8);
    assert.equal(ceilBars(4), 4);
    assert.equal(ceilBars(1), 4);
    assert.equal(ceilBars(8), 8);
    assert.equal(ceilBars(8.5), 12);
    assert.equal(ceilBars(21), 24);
  });
});

describe("snapping", () => {
  test("snapFloor rounds down to the step", () => {
    assert.equal(snapFloor(1.3, 0.25), 1.25);
    assert.equal(snapFloor(2, 1), 2);
    assert.equal(snapFloor(3.9, 4), 0);
    assert.equal(snapFloor(5, 4), 4);
  });

  test("snapRound rounds to the nearest step", () => {
    assert.equal(snapRound(1.3, 0.25), 1.25);
    assert.equal(snapRound(1.4, 0.25), 1.5);
    assert.equal(snapRound(2.4, 1), 2);
    assert.equal(snapRound(2.6, 1), 3);
  });

  test("a null step leaves the beat untouched", () => {
    assert.equal(snapFloor(1.3, null), 1.3);
    assert.equal(snapRound(1.3, null), 1.3);
  });
});

describe("gridStep", () => {
  test("off has no step", () => {
    assert.deepEqual(gridStep("off", false, 80), { step: null, label: "Off" });
    assert.deepEqual(gridStep("off", true, 80), { step: null, label: "Off" });
  });

  test("fixed grids ignore the zoom level", () => {
    assert.deepEqual(gridStep("1/16", false, 80), { step: 0.25, label: "1/16" });
    assert.deepEqual(gridStep("1/16", false, 8), { step: 0.25, label: "1/16" });
    assert.deepEqual(gridStep("1bar", false, 80), { step: 4, label: "1 Bar" });
    assert.deepEqual(gridStep("1/4", false, 80), { step: 1, label: "1/4" });
    assert.deepEqual(gridStep("1/32", false, 80), { step: 0.125, label: "1/32" });
  });

  test("triplets scale the step by two thirds and mark the label", () => {
    assert.deepEqual(gridStep("1/16", true, 80), { step: (0.25 * 2) / 3, label: "1/16T" });
    assert.deepEqual(gridStep("1/4", true, 80), { step: (1 * 2) / 3, label: "1/4T" });
    assert.deepEqual(gridStep("1bar", true, 80), { step: (4 * 2) / 3, label: "1 Bar T" });
  });

  test("adaptive grids pick the smallest step that still has room", () => {
    // medium needs 24px per step: 0.5 * 80 = 40 fits, 0.25 * 80 = 20 does not.
    assert.deepEqual(gridStep("medium", false, 80), { step: 0.5, label: "1/8" });
    // wide needs 48px, widest 96px, narrow 12px, narrowest 6px.
    assert.deepEqual(gridStep("wide", false, 80), { step: 1, label: "1/4" });
    assert.deepEqual(gridStep("widest", false, 80), { step: 2, label: "1/2" });
    assert.deepEqual(gridStep("narrow", false, 80), { step: 0.25, label: "1/16" });
    assert.deepEqual(gridStep("narrowest", false, 80), { step: 0.125, label: "1/32" });
  });

  test("adaptive grids fall back to one bar when nothing fits", () => {
    assert.deepEqual(gridStep("widest", false, 1), { step: 4, label: "1 Bar" });
  });

  test("adaptive grids measure the triplet step", () => {
    // 0.5 * (2/3) * 80 = 26.7 still clears 24px, 0.25 * (2/3) * 80 = 13.3 does not.
    assert.deepEqual(gridStep("medium", true, 80), { step: (0.5 * 2) / 3, label: "1/8T" });
  });
});
