import { Module } from "../core/Module.js";
import { $ } from "../ui/dom.js";
import { parseMidiFile } from "../midi/SmfParser.js";
import { Note } from "../model/Note.js";
import { DEFAULT_TRACK_DEVICE } from "../devices/defaultDevices.js";
import { BEATS_PER_BAR, ceilBars, clamp, snapFloor } from "../util/music.js";

/**
 * Import of Standard MIDI Files.
 *
 * The "Import MIDI" button opens the hidden file input; every track of the
 * parsed file becomes one project track holding one clip at the playhead.
 */
export class MidiImportModule extends Module {
  /** @type {HTMLElement|null} */
  #importBtn = null;
  /** @type {HTMLInputElement|null} */
  #midiFile = null;
  #project = null;
  #transport = null;
  #status = null;
  #catalog = null;
  /** @type {(() => void)|null} */
  #onImportClick = null;
  /** @type {(() => void)|null} */
  #onFileChange = null;

  /**
   * Resolve services and wire the button and the file input.
   * @param {import("../core/App.js").App} app
   */
  async start(app) {
    this.#project = app.get("project");
    this.#transport = app.get("transport");
    this.#status = app.get("status");
    this.#catalog = app.get("catalog");
    this.#importBtn = $("importBtn");
    this.#midiFile = $("midiFile");
    this.#onImportClick = () => this.#midiFile.click();
    this.#onFileChange = () => this.#readSelectedFile();
    this.#importBtn.addEventListener("click", this.#onImportClick);
    this.#midiFile.addEventListener("change", this.#onFileChange);
  }

  /**
   * Turn a parsed Standard MIDI File into tracks and clips at the playhead.
   * @param {{ bpm: number|null, tracks: Array<{ name: string, channel: number, notes: Array<{ pitch: number, start: number, duration: number, velocity: number }> }> }} parsed
   * @param {string} fileName File name without extension, used to name tracks.
   * @returns {number} The number of imported tracks.
   */
  importMidi(parsed, fileName) {
    if (parsed.bpm) this.#project.setBpm(clamp(Math.round(parsed.bpm), 20, 300));
    const startBeat = snapFloor(this.#transport.playheadBeat, BEATS_PER_BAR);
    let first = null;
    for (const t of parsed.tracks) {
      const track = this.#project.addTrack({
        name: t.name || `${fileName} ch${t.channel + 1}`,
        devices: [this.#catalog.create(DEFAULT_TRACK_DEVICE.typeName, {
          options: structuredClone(DEFAULT_TRACK_DEVICE.options),
        })],
      });
      const lastEnd = t.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
      const notes = t.notes.map((n) => new Note({ id: this.#project.nextId(), ...n }));
      const clip = this.#project.addClip({
        trackId: track.id,
        start: startBeat,
        length: Math.max(BEATS_PER_BAR, ceilBars(lastEnd)),
        notes,
      });
      first = first ?? clip;
    }
    if (first) this.#project.select({ trackId: first.trackId, clipId: first.id });
    return parsed.tracks.length;
  }

  /** Remove the button and file input listeners. */
  dispose() {
    if (this.#importBtn && this.#onImportClick) this.#importBtn.removeEventListener("click", this.#onImportClick);
    if (this.#midiFile && this.#onFileChange) this.#midiFile.removeEventListener("change", this.#onFileChange);
    this.#onImportClick = null;
    this.#onFileChange = null;
  }

  /**
   * Read, parse and import the file the user picked, reporting the outcome on
   * the status bar. The input is cleared straight away so the same file can be
   * picked again.
   */
  async #readSelectedFile() {
    const file = this.#midiFile.files[0];
    this.#midiFile.value = "";
    if (!file) return;
    try {
      const count = this.importMidi(parseMidiFile(await file.arrayBuffer()), file.name.replace(/\.midi?$/i, ""));
      this.#status.set(count
        ? `Imported ${count} track${count === 1 ? "" : "s"} from ${file.name} at the playhead.`
        : `${file.name} contains no notes.`);
    } catch (err) {
      this.#status.set(`Could not import ${file.name}: ${err.message}`);
    }
  }
}
