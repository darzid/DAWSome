/**
 * A block of notes placed on a track's lane in the arrangement.
 *
 * `start` and `length` are in beats on the song timeline; the notes inside
 * carry positions relative to `start`. A clip plays only the part of a note
 * that falls inside its length — that trimming lives in the audio engine, the
 * model keeps the notes untouched.
 */
export class Clip {
  /**
   * @param {object} spec
   * @param {number} spec.id unique id, handed out by `Project.nextId()`
   * @param {number} spec.trackId id of the owning track
   * @param {string} spec.name display name, e.g. "Bass 2"
   * @param {number} spec.start position on the song timeline, in beats
   * @param {number} spec.length length in beats
   * @param {import("./Note.js").Note[]} [spec.notes] notes, relative to `start`
   */
  constructor({ id, trackId, name, start, length, notes = [] }) {
    this.id = id;
    this.trackId = trackId;
    this.name = name;
    this.start = start;
    this.length = length;
    this.notes = notes;
  }

  /** End of the clip on the song timeline, in beats. */
  get end() {
    return this.start + this.length;
  }

  /**
   * End of the last note, in beats relative to the clip start; 0 when the clip
   * is empty. Notes may reach past the clip length.
   * @returns {number}
   */
  lastNoteEnd() {
    return this.notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
  }

  /**
   * The note covering a point in the clip, or null. Scans from the last note
   * to the first so the most recently added note wins where notes overlap.
   * @param {number} beat position in beats, relative to the clip start
   * @param {number} pitch MIDI pitch
   * @returns {import("./Note.js").Note|null}
   */
  noteAt(beat, pitch) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.pitch === pitch && beat >= note.start && beat < note.start + note.duration) return note;
    }
    return null;
  }
}
