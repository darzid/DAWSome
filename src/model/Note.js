import { DEFAULT_VELOCITY } from "../util/music.js";

/**
 * A single note inside a clip.
 *
 * Positions are in beats relative to the clip start; `velocity` is MIDI
 * 0..127 (the audio engine divides by 127). Notes are plain mutable value
 * objects: the clip editor drags them by writing `pitch`, `start` and
 * `duration` directly and afterwards tells the project that the notes of the
 * clip changed.
 */
export class Note {
  /**
   * @param {object} spec
   * @param {number} spec.id unique id, handed out by `Project.nextId()`
   * @param {number} spec.pitch MIDI pitch (0..127)
   * @param {number} spec.start start in beats, relative to the clip start
   * @param {number} spec.duration length in beats
   * @param {number} [spec.velocity] MIDI velocity, defaults to DEFAULT_VELOCITY
   */
  constructor({ id, pitch, start, duration, velocity = DEFAULT_VELOCITY }) {
    this.id = id;
    this.pitch = pitch;
    this.start = start;
    this.duration = duration;
    this.velocity = velocity;
  }

  /** End of the note in beats, relative to the clip start. */
  get end() {
    return this.start + this.duration;
  }

  /**
   * Copy of this note under a new id; every other field is copied verbatim.
   * @param {number} id id for the copy, from `Project.nextId()`
   * @returns {Note}
   */
  clone(id) {
    return new Note({
      id,
      pitch: this.pitch,
      start: this.start,
      duration: this.duration,
      velocity: this.velocity,
    });
  }
}
