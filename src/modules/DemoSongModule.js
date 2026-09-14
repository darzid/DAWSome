import { Module } from "../core/Module.js";
import { Note } from "../model/Note.js";
import { DEMO_DEVICES } from "../devices/defaultDevices.js";
import { BEATS_PER_BAR, DEFAULT_VELOCITY } from "../util/music.js";

/** Length of every demo clip in beats. */
const DEMO_CLIP_LENGTH = BEATS_PER_BAR / 4;
/** Number of copies made after the first clip of each demo track. */
const DEMO_CLIP_COPIES = 15;

/** Notes of the kick pattern as `[pitch, start, duration]`. */
const KICK_PATTERN = [
  [36, 0, 0.25],
];
/** Notes of the bass pattern as `[pitch, start, duration]`. */
const BASS_PATTERN = [
  [29, 0.25, 0.2],
  [32, 0.5, 0.25],
  [30, 0.75, 0.2],
];
/** Notes of the closed hi-hat pattern as `[pitch, start, duration]`. */
const CLOSED_HAT_PATTERN = [
  [42, 0.0, 0.125],
  [42, 0.25, 0.125],
  [42, 0.5, 0.125],
  [42, 0.75, 0.125],
];

/**
 * Seeds the project with the demo song: a kick, a bass and a closed hi-hat
 * track, each with one bar-quarter clip repeated sixteen times. It only
 * creates model objects; drawing and playback are other modules' work.
 */
export class DemoSongModule extends Module {
  /** @returns {string} the module name. */
  get name() {
    return "DemoSongModule";
  }

  /**
   * Build the demo tracks and clips and select the first kick clip.
   * @param {object} app the application.
   * @returns {Promise<void>}
   */
  async start(app) {
    const project = app.get("project");
    const catalog = app.get("catalog");

    const mk = (list) => list.map(([pitch, start, duration]) => new Note({
      id: project.nextId(),
      pitch,
      start,
      duration,
      velocity: DEFAULT_VELOCITY,
    }));
    const device = (entry) => catalog.create(entry.typeName, { options: structuredClone(entry.options) });

    const kick = project.addTrack({ name: "Kick", devices: [device(DEMO_DEVICES.kick)] });
    const bass = project.addTrack({ name: "Bass", devices: [device(DEMO_DEVICES.bass)] });
    const closedHat = project.addTrack({ name: "ClosedHat", devices: [device(DEMO_DEVICES.closedHat)] });

    this.#fillTrack(project, kick, mk(KICK_PATTERN));
    this.#fillTrack(project, bass, mk(BASS_PATTERN));
    this.#fillTrack(project, closedHat, mk(CLOSED_HAT_PATTERN));

    project.select({ trackId: kick.id, clipId: project.clips[0].id });
  }

  /**
   * Add the pattern clip at the start of a track and duplicate it, each copy
   * landing at the end of the previous one.
   * @param {object} project the project to add to.
   * @param {object} track the track to fill.
   * @param {Array<object>} notes the notes of the first clip.
   * @returns {object} the last clip created.
   */
  #fillTrack(project, track, notes) {
    let last = project.addClip({ trackId: track.id, start: 0, length: DEMO_CLIP_LENGTH, notes });
    for (let copy = 1; copy <= DEMO_CLIP_COPIES; copy++) last = project.duplicateClip(last);
    return last;
  }
}
