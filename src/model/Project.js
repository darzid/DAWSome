import { ParameterMatrix } from "../params/ParameterMatrix.js";
import { MIN_SONG_BEATS, TRACK_COLORS, ceilBars } from "../util/music.js";
import { Clip } from "./Clip.js";
import { Track } from "./Track.js";

/**
 * The song: transport settings, tracks, clips, the selection, and the
 * parameter matrix holding every live parameter of the project.
 *
 * The project is the only writer of the model. Every mutation goes through a
 * method here and ends in one bus event, so the audio engine and the views
 * stay in sync without knowing about each other. Parameter values are not
 * stored on the model objects: they live in the matrix, and every change there
 * is forwarded to the bus as `parameter:changed`.
 */
export class Project {
  /** @type {import("../core/EventBus.js").EventBus} */
  bus;
  /** Typed registry of every addressable parameter of this project. */
  parameters = new ParameterMatrix();
  bpm = 140;
  loop = true;
  /** @type {Track[]} */
  tracks = [];
  /** @type {Clip[]} */
  clips = [];
  selectedTrackId = null;
  selectedClipId = null;
  #nextId = 1;

  /**
   * @param {import("../core/EventBus.js").EventBus} bus the application bus
   */
  constructor(bus) {
    if (!bus) throw new Error("Project needs an event bus.");
    this.bus = bus;
    this.parameters.onChange((change) => this.bus.emit("parameter:changed", change));
  }

  /** Next unique id for a track, a clip or a note. */
  nextId() {
    return this.#nextId++;
  }

  /**
   * @param {number} id
   * @returns {Track|null}
   */
  trackById(id) {
    return this.tracks.find((track) => track.id === id) ?? null;
  }

  /**
   * @param {number} id
   * @returns {Clip|null}
   */
  clipById(id) {
    return this.clips.find((clip) => clip.id === id) ?? null;
  }

  /** @returns {Track|null} */
  get selectedTrack() {
    return this.trackById(this.selectedTrackId);
  }

  /** @returns {Clip|null} */
  get selectedClip() {
    return this.clipById(this.selectedClipId);
  }

  /**
   * Every clip on one track, in creation order.
   * @param {number} trackId
   * @returns {Clip[]}
   */
  clipsOf(trackId) {
    return this.clips.filter((clip) => clip.trackId === trackId);
  }

  /**
   * Row index of a track in the arrangement, or -1 when it is unknown.
   * @param {number} trackId
   * @returns {number}
   */
  trackIndex(trackId) {
    return this.tracks.findIndex((track) => track.id === trackId);
  }

  /**
   * Length of the song in beats: the last clip end rounded up to a full bar,
   * and never shorter than MIN_SONG_BEATS.
   * @returns {number}
   */
  endBeats() {
    return Math.max(MIN_SONG_BEATS, ceilBars(this.clips.reduce((max, clip) => Math.max(max, clip.end), 0)));
  }

  /**
   * @param {number} bpm tempo in beats per minute
   * @fires project:bpm
   */
  setBpm(bpm) {
    this.bpm = bpm;
    this.bus.emit("project:bpm", { bpm: this.bpm });
  }

  /**
   * @param {boolean} on whether the transport loops over the song length
   * @fires project:loop
   */
  setLoop(on) {
    this.loop = Boolean(on);
    this.bus.emit("project:loop", { loop: this.loop });
  }

  /**
   * Append a track, register its parameters and select it.
   * @param {object} spec
   * @param {string} spec.name display name
   * @param {object[]} [spec.devices] device chain, instrument first
   * @param {string} [spec.color] lane colour; cycles through TRACK_COLORS by default
   * @returns {Track} the new track
   * @fires track:added
   */
  addTrack({ name, devices = [], color } = {}) {
    const track = new Track({
      id: this.nextId(),
      name,
      color: color ?? TRACK_COLORS[this.tracks.length % TRACK_COLORS.length],
      devices,
    });
    track.attach(this.parameters);
    this.tracks.push(track);
    this.selectedTrackId = track.id;
    this.bus.emit("track:added", { track });
    return track;
  }

  /**
   * Remove a track together with its clips and its parameters.
   * @param {number} id
   * @fires clip:removed once per clip of the track
   * @fires track:removed
   */
  removeTrack(id) {
    const track = this.trackById(id);
    if (!track) throw new Error(`Unknown track ${id}.`);
    for (const clip of this.clipsOf(id)) this.removeClip(clip.id);
    track.detach();
    this.tracks.splice(this.trackIndex(id), 1);
    if (this.selectedTrackId === id) this.selectedTrackId = this.tracks[0]?.id ?? null;
    this.bus.emit("track:removed", { track });
  }

  /**
   * @param {Track} track
   * @param {string} name new display name
   * @fires track:changed
   */
  renameTrack(track, name) {
    track.name = name;
    this.bus.emit("track:changed", { track });
  }

  /**
   * Mute or unmute a track through its channel parameter.
   * @param {Track} track
   * @param {boolean} on
   * @returns {boolean} true when the value changed
   * @fires parameter:changed
   */
  setTrackMute(track, on) {
    return this.parameters.set(`${track.prefix}/mute`, Boolean(on), "ui");
  }

  /**
   * Replace the instrument of a track. The previous instrument, if any, is
   * released from the parameter matrix and dropped from the chain.
   * @param {Track} track
   * @param {object} device the new instrument device
   * @fires track:devices
   */
  setInstrument(track, device) {
    const previous = track.instrument;
    if (previous) {
      previous.detach();
      track.devices.splice(track.devices.indexOf(previous), 1);
    }
    device.attach(this.parameters);
    track.devices.splice(0, 0, device);
    this.bus.emit("track:devices", { track });
  }

  /**
   * Append an effect to a track's device chain.
   * @param {Track} track
   * @param {object} device the effect device
   * @fires track:devices
   */
  addEffect(track, device) {
    device.attach(this.parameters);
    track.devices.push(device);
    this.bus.emit("track:devices", { track });
  }

  /**
   * Load a preset into one device of a track.
   * @param {Track} track the track owning the device
   * @param {object} device the device receiving the preset
   * @param {object} preset the preset to load
   * @fires track:devices
   */
  applyPreset(track, device, preset) {
    device.loadPreset(preset);
    this.bus.emit("track:devices", { track });
  }

  /**
   * Add a clip to a track.
   * @param {object} spec
   * @param {number} spec.trackId owning track
   * @param {string} [spec.name] display name; "<track name> <n>" by default
   * @param {number} spec.start position on the song timeline, in beats
   * @param {number} spec.length length in beats
   * @param {import("./Note.js").Note[]} [spec.notes] notes, relative to `start`
   * @returns {Clip} the new clip
   * @fires clip:added
   */
  addClip({ trackId, name, start, length, notes = [] } = {}) {
    const track = this.trackById(trackId);
    if (!track) throw new Error(`Unknown track ${trackId}.`);
    const clip = new Clip({
      id: this.nextId(),
      trackId,
      name: name ?? `${track.name} ${this.clipsOf(trackId).length + 1}`,
      start,
      length,
      notes,
    });
    this.clips.push(clip);
    this.bus.emit("clip:added", { clip });
    return clip;
  }

  /**
   * Remove a clip from the song.
   * @param {number} id
   * @throws {Error} when no clip has that id
   * @fires clip:removed
   */
  removeClip(id) {
    const clip = this.clipById(id);
    if (!clip) throw new Error(`Unknown clip ${id}.`);
    this.clips.splice(this.clips.indexOf(clip), 1);
    if (this.selectedClipId === id) this.selectedClipId = null;
    this.bus.emit("clip:removed", { clip });
  }

  /**
   * Copy a clip directly after itself, with fresh note ids.
   * @param {Clip} clip
   * @returns {Clip} the copy
   * @fires clip:added
   */
  duplicateClip(clip) {
    return this.addClip({
      trackId: clip.trackId,
      start: clip.end,
      length: clip.length,
      notes: clip.notes.map((note) => note.clone(this.nextId())),
    });
  }

  /**
   * Announce a change to a clip's placement, length or name.
   * @param {Clip} clip
   * @fires clip:changed
   */
  clipChanged(clip) {
    this.bus.emit("clip:changed", { clip });
  }

  /**
   * Announce a change to the notes of a clip.
   * @param {Clip} clip
   * @fires clip:notes
   */
  notesChanged(clip) {
    this.bus.emit("clip:notes", { clip });
  }

  /**
   * Move the selection. Omitted ids keep their current value.
   * @param {object} [spec]
   * @param {number|null} [spec.trackId]
   * @param {number|null} [spec.clipId]
   * @returns {boolean} true when the selection changed
   * @fires selection
   */
  select({ trackId = this.selectedTrackId, clipId = this.selectedClipId } = {}) {
    if (trackId === this.selectedTrackId && clipId === this.selectedClipId) return false;
    const previousTrackId = this.selectedTrackId;
    const previousClipId = this.selectedClipId;
    this.selectedTrackId = trackId;
    this.selectedClipId = clipId;
    this.bus.emit("selection", { trackId, clipId, previousTrackId, previousClipId });
    return true;
  }
}
