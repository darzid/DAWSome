// Unit tests for the project model (src/model) driven through an EventBus.
//
// Covers Project bookkeeping (ids, lookups, bpm/loop, song length), track and
// clip mutation together with the events each one emits, the channel strip
// parameters a track publishes into the parameter matrix, selection handling,
// and the small Clip / Note value objects.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EventBus } from "../src/core/EventBus.js";
import { Project } from "../src/model/Project.js";
import { Note } from "../src/model/Note.js";

const setup = () => {
  const bus = new EventBus();
  const project = new Project(bus);
  const record = (event) => {
    const seen = [];
    bus.on(event, (payload) => seen.push(payload));
    return seen;
  };
  return { bus, project, record };
};

const note = (id, pitch, start, duration, velocity = 100) =>
  new Note({ id, pitch, start, duration, velocity });

describe("Project bookkeeping", () => {
  test("starts empty with a parameter matrix", () => {
    const { project } = setup();
    assert.deepEqual(project.tracks, []);
    assert.deepEqual(project.clips, []);
    assert.equal(project.selectedTrackId, null);
    assert.equal(project.selectedClipId, null);
    assert.ok(project.parameters);
    assert.equal(typeof project.parameters.register, "function");
  });

  test("nextId hands out increasing ids", () => {
    const { project } = setup();
    const first = project.nextId();
    const second = project.nextId();
    assert.equal(typeof first, "number");
    assert.equal(second, first + 1);
  });

  test("setBpm and setLoop", () => {
    const { project } = setup();
    project.setBpm(120);
    assert.equal(project.bpm, 120);
    project.setLoop(false);
    assert.equal(project.loop, false);
    project.setLoop(true);
    assert.equal(project.loop, true);
  });

  test("lookups", () => {
    const { project } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({ trackId: track.id, start: 0, length: 4 });

    assert.equal(project.trackById(track.id), track);
    assert.equal(project.clipById(clip.id), clip);
    assert.ok(!project.trackById(9999));
    assert.ok(!project.clipById(9999));
    assert.equal(project.selectedTrack, track);

    project.select({ trackId: track.id, clipId: clip.id });
    assert.equal(project.selectedClip, clip);
  });
});

describe("tracks", () => {
  test("addTrack emits track:added and selects the new track", () => {
    const { project, record } = setup();
    const added = record("track:added");

    const track = project.addTrack({ name: "Kick" });

    assert.equal(added.length, 1);
    assert.equal(added[0].track, track);
    assert.equal(project.tracks.length, 1);
    assert.equal(project.tracks[0], track);
    assert.equal(project.selectedTrackId, track.id);
    assert.equal(track.name, "Kick");
    assert.ok(track.color);
    assert.ok(Array.isArray(track.devices));
  });

  test("a track publishes its channel strip into the parameter matrix", () => {
    const { project } = setup();
    const track = project.addTrack({ name: "Kick" });

    assert.equal(track.prefix, `track/${track.id}`);
    assert.equal(project.parameters.value(`track/${track.id}/volume`), -8);
    assert.equal(project.parameters.value(`track/${track.id}/pan`), 0);
    assert.equal(project.parameters.value(`track/${track.id}/mute`), false);
    assert.equal(track.volume, -8);
    assert.equal(track.pan, 0);
    assert.equal(track.mute, false);
  });

  test("setTrackMute writes through the matrix with origin \"ui\"", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const changes = record("parameter:changed");

    project.setTrackMute(track, true);

    assert.equal(track.mute, true);
    assert.equal(project.parameters.value(`track/${track.id}/mute`), true);
    const muteChanges = changes.filter((change) => change.parameter.address === `track/${track.id}/mute`);
    assert.equal(muteChanges.length, 1);
    assert.equal(muteChanges[0].value, true);
    assert.equal(muteChanges[0].previous, false);
    assert.equal(muteChanges[0].origin, "ui");
  });

  test("renameTrack emits track:changed", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const changed = record("track:changed");

    project.renameTrack(track, "Drums");

    assert.equal(track.name, "Drums");
    assert.equal(changed.length, 1);
  });

  test("removeTrack removes its clips, emits clip:removed for each and fixes the selection", () => {
    const { project, record } = setup();
    const first = project.addTrack({ name: "Kick" });
    const second = project.addTrack({ name: "Bass" });
    const clipA = project.addClip({ trackId: first.id, start: 0, length: 4 });
    project.addClip({ trackId: first.id, start: 4, length: 4 });
    project.addClip({ trackId: second.id, start: 0, length: 4 });
    project.select({ trackId: first.id, clipId: clipA.id });

    const removedClips = record("clip:removed");
    const removedTracks = record("track:removed");

    project.removeTrack(first.id);

    assert.equal(removedClips.length, 2);
    assert.equal(removedTracks.length, 1);
    assert.equal(project.tracks.length, 1);
    assert.equal(project.tracks[0], second);
    assert.equal(project.clips.length, 1);
    assert.equal(project.clips[0].trackId, second.id);
    assert.equal(project.selectedTrackId, second.id);
    assert.equal(project.selectedClipId, null);
  });
});

describe("clips", () => {
  test("addClip names the clip after its track and emits clip:added", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const added = record("clip:added");

    const clip = project.addClip({ trackId: track.id, start: 0, length: 4 });

    assert.equal(clip.name, "Kick 1");
    assert.equal(clip.trackId, track.id);
    assert.equal(clip.start, 0);
    assert.equal(clip.length, 4);
    assert.equal(clip.end, 4);
    assert.deepEqual(clip.notes, []);
    assert.equal(added.length, 1);
    assert.equal(added[0].clip, clip);

    const second = project.addClip({ trackId: track.id, start: 4, length: 4 });
    assert.equal(second.name, "Kick 2");
    assert.equal(project.clips.length, 2);
  });

  test("removeClip emits clip:removed", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({ trackId: track.id, start: 0, length: 4 });
    const removed = record("clip:removed");

    project.removeClip(clip.id);

    assert.equal(removed.length, 1);
    assert.deepEqual(project.clips, []);
  });

  test("duplicateClip places the copy at the end of the original with fresh note ids", () => {
    const { project } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({
      trackId: track.id,
      start: 0,
      length: 4,
      notes: [note(900, 60, 0, 1), note(901, 64, 1, 1)],
    });

    const copy = project.duplicateClip(clip);

    assert.notEqual(copy.id, clip.id);
    assert.equal(copy.trackId, clip.trackId);
    assert.equal(copy.start, clip.end);
    assert.equal(copy.length, clip.length);
    assert.equal(copy.notes.length, 2);
    assert.deepEqual(copy.notes.map((n) => n.pitch), [60, 64]);
    assert.deepEqual(copy.notes.map((n) => n.start), [0, 1]);
    for (const copied of copy.notes) {
      assert.ok(!clip.notes.some((original) => original.id === copied.id), "note id was reused");
    }
    assert.equal(project.clips.length, 2);
  });

  test("clipChanged and notesChanged announce edits", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({ trackId: track.id, start: 0, length: 4 });
    const changed = record("clip:changed");
    const notes = record("clip:notes");

    project.clipChanged(clip);
    project.notesChanged(clip);

    assert.equal(changed.length, 1);
    assert.equal(notes.length, 1);
  });

  test("endBeats is at least 16 beats and rounds up to whole bars", () => {
    const { project } = setup();
    assert.equal(project.endBeats(), 16);

    const track = project.addTrack({ name: "Kick" });
    project.addClip({ trackId: track.id, start: 0, length: 4 });
    assert.equal(project.endBeats(), 16);

    project.addClip({ trackId: track.id, start: 16, length: 5 });
    assert.equal(project.endBeats(), 24);
  });
});

describe("selection", () => {
  test("select emits once, reports the previous ids and is idempotent", () => {
    const { project, record } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({ trackId: track.id, start: 0, length: 4 });
    const previousTrackId = project.selectedTrackId;
    const previousClipId = project.selectedClipId;
    const selections = record("selection");

    const changed = project.select({ trackId: track.id, clipId: clip.id });

    assert.equal(changed, true);
    assert.equal(selections.length, 1);
    assert.equal(selections[0].trackId, track.id);
    assert.equal(selections[0].clipId, clip.id);
    assert.equal(selections[0].previousTrackId, previousTrackId);
    assert.equal(selections[0].previousClipId, previousClipId);
    assert.equal(project.selectedTrackId, track.id);
    assert.equal(project.selectedClipId, clip.id);

    assert.equal(project.select({ trackId: track.id, clipId: clip.id }), false);
    assert.equal(selections.length, 1);
  });
});

describe("Clip", () => {
  test("noteAt returns the last note covering the beat", () => {
    const { project } = setup();
    const track = project.addTrack({ name: "Kick" });
    const clip = project.addClip({
      trackId: track.id,
      start: 0,
      length: 4,
      notes: [
        note(900, 60, 0, 4),      // covers beat 1
        note(901, 60, 0.5, 2),    // covers beat 1 as well, and comes later
        note(902, 64, 0, 4),      // another pitch
      ],
    });
    const [under, over, other] = clip.notes;

    assert.equal(clip.noteAt(1, 60), over);
    assert.equal(clip.noteAt(0.25, 60), under);
    assert.equal(clip.noteAt(1, 64), other);
    assert.ok(!clip.noteAt(1, 62));
    assert.ok(!clip.noteAt(10, 60));
  });

  test("lastNoteEnd and end", () => {
    const { project } = setup();
    const track = project.addTrack({ name: "Kick" });
    const empty = project.addClip({ trackId: track.id, start: 8, length: 4 });
    assert.equal(empty.end, 12);
    assert.equal(empty.lastNoteEnd(), 0);

    const clip = project.addClip({
      trackId: track.id,
      start: 0,
      length: 4,
      notes: [note(900, 60, 0, 1), note(901, 64, 2, 1.5)],
    });
    assert.equal(clip.lastNoteEnd(), 3.5);
  });
});

describe("Note", () => {
  test("keeps its fields and computes its end", () => {
    const n = note(5, 60, 1, 0.5, 90);
    assert.equal(n.id, 5);
    assert.equal(n.pitch, 60);
    assert.equal(n.start, 1);
    assert.equal(n.duration, 0.5);
    assert.equal(n.velocity, 90);
    assert.equal(n.end, 1.5);
  });

  test("clone copies everything but the id", () => {
    const n = note(5, 60, 1, 0.5, 90);
    const copy = n.clone(7);
    assert.notEqual(copy, n);
    assert.equal(copy.id, 7);
    assert.equal(copy.pitch, 60);
    assert.equal(copy.start, 1);
    assert.equal(copy.duration, 0.5);
    assert.equal(copy.velocity, 90);
    assert.equal(copy.end, 1.5);
    assert.equal(n.id, 5);
  });
});
