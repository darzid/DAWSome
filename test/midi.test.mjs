// Unit tests for the Standard MIDI File parser (src/midi/SmfParser.js).
//
// Every fixture is a hand-built SMF byte sequence, so the expected note times
// can be derived from the ticks directly: start and duration are ticks / ppq,
// i.e. beats. Covers a minimal format-0 file (tempo meta, one note), the
// missing-tempo case, multi-byte delta times, running status, zero-length
// notes and the two documented error messages.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseMidiFile } from "../src/midi/SmfParser.js";

const PPQ = 96;

/** 14-byte MThd chunk with a PPQ (non-SMPTE) division. */
const header = (format, trackCount, division) => [
  0x4d, 0x54, 0x68, 0x64,             // "MThd"
  0x00, 0x00, 0x00, 0x06,             // header length
  (format >> 8) & 0xff, format & 0xff,
  (trackCount >> 8) & 0xff, trackCount & 0xff,
  (division >> 8) & 0xff, division & 0xff,
];

/** MTrk chunk wrapping the given event bytes. */
const trackChunk = (events) => [
  0x4d, 0x54, 0x72, 0x6b,             // "MTrk"
  (events.length >>> 24) & 0xff,
  (events.length >>> 16) & 0xff,
  (events.length >>> 8) & 0xff,
  events.length & 0xff,
  ...events,
];

/** Variable length quantity, most significant group first. */
const vlq = (value) => {
  const out = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return out;
};

const TEMPO_120 = [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20];   // 500000 us per quarter note
const END_OF_TRACK = [0xff, 0x2f, 0x00];

const midiFile = (bytes) => new Uint8Array(bytes).buffer;

describe("parseMidiFile", () => {
  test("reads a minimal format 0 file", () => {
    const events = [
      0, ...TEMPO_120,
      0, 0x90, 60, 100,                 // note on, channel 0, C3, velocity 100
      ...vlq(PPQ), 0x80, 60, 0,         // note off one beat later
      0, ...END_OF_TRACK,
    ];
    const song = parseMidiFile(midiFile([...header(0, 1, PPQ), ...trackChunk(events)]));

    assert.equal(song.format, 0);
    assert.equal(song.bpm, 120);
    assert.equal(song.tracks.length, 1);
    assert.equal(song.tracks[0].channel, 0);
    assert.deepEqual(song.tracks[0].notes, [
      { pitch: 60, start: 0, duration: 1, velocity: 100 },
    ]);
  });

  test("bpm is null without a tempo meta event, and long deltas decode", () => {
    const events = [
      0, 0x90, 60, 100,
      ...vlq(2 * PPQ), 0x80, 60, 0,     // 192 ticks needs a two byte delta
      0, ...END_OF_TRACK,
    ];
    const song = parseMidiFile(midiFile([...header(0, 1, PPQ), ...trackChunk(events)]));

    assert.equal(song.bpm, null);
    assert.equal(song.tracks.length, 1);
    assert.deepEqual(song.tracks[0].notes, [
      { pitch: 60, start: 0, duration: 2, velocity: 100 },
    ]);
  });

  test("reads the track name and follows running status", () => {
    const events = [
      0, 0xff, 0x03, 0x04, 0x42, 0x61, 0x73, 0x73,   // track name "Bass"
      0, ...TEMPO_120,
      0, 0x90, 60, 100,
      0, 62, 100,                        // running status: another note on
      ...vlq(PPQ), 0x80, 60, 0,
      0, 62, 0,                          // running status: another note off
      0, ...END_OF_TRACK,
    ];
    const song = parseMidiFile(midiFile([...header(0, 1, PPQ), ...trackChunk(events)]));

    assert.equal(song.tracks.length, 1);
    assert.equal(song.tracks[0].name, "Bass");
    assert.equal(song.tracks[0].channel, 0);
    assert.deepEqual(song.tracks[0].notes, [
      { pitch: 60, start: 0, duration: 1, velocity: 100 },
      { pitch: 62, start: 0, duration: 1, velocity: 100 },
    ]);
  });

  test("a zero length note keeps a one tick duration", () => {
    const events = [
      0, 0x90, 60, 100,
      0, 0x90, 60, 0,                    // note on with velocity 0 ends the note
      0, ...END_OF_TRACK,
    ];
    const song = parseMidiFile(midiFile([...header(0, 1, PPQ), ...trackChunk(events)]));

    assert.deepEqual(song.tracks[0].notes, [
      { pitch: 60, start: 0, duration: 1 / PPQ, velocity: 100 },
    ]);
  });

  test("rejects a file without an MThd header", () => {
    const bytes = midiFile([0x46, 0x41, 0x4b, 0x45, 0x00, 0x00, 0x00, 0x06]);   // "FAKE"
    assert.throws(() => parseMidiFile(bytes), {
      message: "Not a MIDI file (missing MThd header).",
    });
  });

  test("rejects an SMPTE time division", () => {
    const bytes = midiFile(header(0, 1, 0xe728));   // top bit set = SMPTE
    assert.throws(() => parseMidiFile(bytes), {
      message: "SMPTE time division is not supported.",
    });
  });
});
