import { AudioEngine } from "./AudioEngine.js";
import { flatten, nest } from "../params/paths.js";
import { EPS } from "../util/music.js";

/**
 * The Tone.js implementation of {@link AudioEngine}.
 *
 * It owns everything that makes sound: one `Tone.Channel` per track, one audio
 * node per device wired into that channel, and one `Tone.Part` per clip. It is
 * driven exclusively by `AudioModule` — it never subscribes to the event bus
 * and never touches the DOM.
 *
 * Values that Tone.js normalises on its way in (for example the string `"8n"`
 * becoming a number of seconds) are mirrored back into the parameter matrix
 * with the origin {@link ToneAudioEngine.ORIGIN}, which the module ignores so
 * the mirroring cannot echo back into the engine.
 */
export class ToneAudioEngine extends AudioEngine {
  /** Change origin used for every value this engine mirrors into the matrix. */
  static ORIGIN = "engine";

  /** @type {object} The `Tone` namespace. */
  #Tone;

  /** @type {object} The Tone transport. */
  #transport;

  /** @type {number} Transport ticks per quarter note. */
  #PPQ;

  /** @type {Map<number, { channel: object, nodes: Map<number, object>, instrument: object|null }>} By track id. */
  #chains = new Map();

  /** @type {Map<number, object>} clip id → `Tone.Part`. */
  #parts = new Map();

  /** @type {Map<number, { node: object, trackId: number }>} device id → live node and its track. */
  #nodeByDevice = new Map();

  /**
   * @param {object} Tone The Tone.js namespace (usually `globalThis.Tone`).
   */
  constructor(Tone) {
    super();
    if (!Tone) throw new Error("ToneAudioEngine requires the Tone namespace.");
    this.#Tone = Tone;
    this.#transport = Tone.getTransport();
    this.#PPQ = this.#transport.PPQ;
  }

  /**
   * @returns {boolean} Always `true`: this engine produces sound.
   */
  get available() {
    return true;
  }

  /**
   * Convert beats to a Tone time in transport ticks.
   * @param {number} beats
   * @returns {object} A `Tone.Ticks` time.
   */
  #toTicks(beats) {
    return this.#Tone.Ticks(Math.round(beats * this.#PPQ));
  }

  /**
   * Convert a MIDI note number to a frequency in hertz.
   * @param {number} pitch
   * @returns {number}
   */
  #hz(pitch) {
    return this.#Tone.Frequency(pitch, "midi").toFrequency();
  }

  /**
   * Instantiate the Tone node of a device and mirror its effective options
   * into the parameter matrix.
   * @param {import("../devices/Device.js").Device} device
   * @returns {object} The new Tone node.
   */
  #createNode(device) {
    const Ctor = this.#Tone[device.typeName];
    if (typeof Ctor !== "function") throw new Error(`Unknown Tone device type "${device.typeName}".`);
    const node = new Ctor(device.options);
    this.#syncDevice(device, node);
    return node;
  }

  /**
   * Read the node's effective options back into the device parameters.
   * @param {import("../devices/Device.js").Device} device
   * @param {object} node
   */
  #syncDevice(device, node) {
    let flat;
    try {
      flat = flatten(node.get());
    } catch (err) {
      console.warn(`Could not read the options of device ${device.id} (${device.typeName}).`, err);
      return;
    }
    device.syncValues(flat, ToneAudioEngine.ORIGIN);
  }

  /**
   * Rebuild the nodes of one chain from its track's devices and wire them up:
   * instrument → effects (in order) → channel.
   * @param {import("../model/Track.js").Track} track
   * @param {{ channel: object, nodes: Map<number, object>, instrument: object|null }} chain
   */
  #buildChain(track, chain) {
    for (const [deviceId, node] of chain.nodes) {
      node.dispose();
      this.#nodeByDevice.delete(deviceId);
    }
    chain.nodes.clear();
    chain.instrument = null;

    const effects = [];
    for (const device of track.devices) {
      const node = this.#createNode(device);
      chain.nodes.set(device.id, node);
      this.#nodeByDevice.set(device.id, { node, trackId: track.id });
      if (chain.instrument === null && device.category === "Instrument") chain.instrument = node;
      else effects.push(node);
    }
    if (chain.instrument) chain.instrument.chain(...effects, chain.channel);
  }

  /**
   * Create the channel and device chain of a track.
   * @param {import("../model/Track.js").Track} track
   */
  addTrack(track) {
    const channel = new this.#Tone.Channel({
      volume: track.volume,
      pan: track.pan,
      mute: track.mute,
    }).toDestination();
    const chain = { channel, nodes: new Map(), instrument: null };
    this.#chains.set(track.id, chain);
    this.#buildChain(track, chain);
  }

  /**
   * Dispose the channel and device chain of a track. No-op for unknown tracks.
   * @param {import("../model/Track.js").Track} track
   */
  removeTrack(track) {
    const chain = this.#chains.get(track.id);
    if (!chain) return;
    for (const [deviceId, node] of chain.nodes) {
      node.dispose();
      this.#nodeByDevice.delete(deviceId);
    }
    chain.nodes.clear();
    chain.instrument = null;
    chain.channel.dispose();
    this.#chains.delete(track.id);
  }

  /**
   * Rebuild the device chain of a track after its devices changed. Parts look
   * their instrument up at event time, so scheduled clips need no rebuild.
   * @param {import("../model/Track.js").Track} track
   * @throws {Error} If no audio chain exists for the track.
   */
  rebuildTrack(track) {
    const chain = this.#chains.get(track.id);
    if (!chain) throw new Error(`No audio chain for track ${track.id}`);
    this.#buildChain(track, chain);
  }

  /**
   * Apply a track channel parameter. No-op for unknown tracks.
   * @param {import("../model/Track.js").Track} track
   * @param {string} name "volume" (dB), "pan" or "mute".
   * @param {number|boolean} value
   */
  setChannel(track, name, value) {
    const chain = this.#chains.get(track.id);
    if (!chain) return;
    if (name === "volume" || name === "pan") chain.channel[name].value = value;
    else if (name === "mute") chain.channel.mute = Boolean(value);
    else throw new Error(`Unknown channel parameter "${name}" on track ${track.id}`);
  }

  /**
   * Apply one device parameter to the live node, then mirror back the value
   * Tone actually stored, so the matrix stays truthful when Tone converts it
   * (for example `"8n"` → seconds). No-op for devices without a live node.
   * @param {import("../devices/Device.js").Device} device
   * @param {string} path Slash separated path inside the device options.
   * @param {*} value
   */
  setDeviceParameter(device, path, value) {
    const entry = this.#nodeByDevice.get(device.id);
    if (!entry) return;
    try {
      entry.node.set(nest(path, value));
    } catch (err) {
      console.warn(`Could not set "${path}" on device ${device.id} (${device.typeName}).`, err);
      return;
    }
    const actual = flatten(entry.node.get())[path];
    if (actual !== undefined) device.parameter(path)?.set(actual, ToneAudioEngine.ORIGIN);
  }

  /**
   * (Re)schedule a clip as a `Tone.Part` on the transport.
   * @param {import("../model/Clip.js").Clip} clip
   * @throws {Error} If no audio chain exists for the clip's track.
   */
  rebuildClip(clip) {
    const old = this.#parts.get(clip.id);
    if (old) {
      old.dispose();
      this.#parts.delete(clip.id);
    }
    const chain = this.#chains.get(clip.trackId);
    if (!chain) throw new Error(`No audio chain for track ${clip.trackId}`);

    const events = clip.notes
      .filter((n) => n.start < clip.length - EPS)
      .map((n) => ({
        time: this.#toTicks(clip.start + n.start),
        hz: this.#hz(n.pitch),
        dur: this.#toTicks(Math.min(n.duration, clip.length - n.start)),
        vel: n.velocity / 127,
      }));

    const part = new this.#Tone.Part(
      (time, ev) => this.#trigger(this.#chains.get(clip.trackId)?.instrument, ev.hz, ev.dur, time, ev.vel),
      events,
    );
    part.start(0);
    this.#parts.set(clip.id, part);
  }

  /**
   * Unschedule a clip. No-op for unknown clips.
   * @param {import("../model/Clip.js").Clip} clip
   */
  removeClip(clip) {
    const part = this.#parts.get(clip.id);
    if (!part) return;
    part.dispose();
    this.#parts.delete(clip.id);
  }

  /**
   * Resume the audio context after a user gesture.
   * @returns {Promise<void>}
   */
  async unlock() {
    await this.#Tone.start();
  }

  /**
   * Unlock the audio context and start the transport.
   * @returns {Promise<void>}
   */
  async play() {
    await this.#Tone.start();
    this.#transport.start();
  }

  /** Stop the transport and release every sounding voice of every track. */
  stop() {
    this.#transport.stop();
    for (const chain of this.#chains.values()) this.#releaseAll(chain.instrument, this.#Tone.now());
  }

  /**
   * Move the transport playhead.
   * @param {number} beat Target position in beats.
   */
  seek(beat) {
    this.#transport.ticks = Math.round(beat * this.#PPQ);
  }

  /**
   * Current transport position.
   * @returns {number} Position in beats.
   */
  positionBeat() {
    return this.#transport.getTicksAtTime(this.#Tone.immediate()) / this.#PPQ;
  }

  /**
   * Set the transport tempo.
   * @param {number} bpm Beats per minute.
   */
  setBpm(bpm) {
    this.#transport.bpm.value = bpm;
  }

  /**
   * Enable or disable transport looping over `[0, endBeats)`.
   * @param {boolean} on
   * @param {number} endBeats Loop end in beats.
   */
  setLoop(on, endBeats) {
    this.#transport.loop = on;
    this.#transport.loopStart = 0;
    this.#transport.loopEnd = this.#toTicks(endBeats);
  }

  /**
   * Start a note played live on a track.
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  noteOn(trackId, pitch) {
    this.#trigger(this.#chains.get(trackId)?.instrument, this.#hz(pitch), 0.15, this.#Tone.now(), 0.8);
  }

  /**
   * Release a note played live on a track.
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  noteOff(trackId, pitch) {
    this.#release(this.#chains.get(trackId)?.instrument, this.#hz(pitch), this.#Tone.now());
  }

  /**
   * Play a short audition of a pitch on a track.
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  preview(trackId, pitch) {
    this.#trigger(this.#chains.get(trackId)?.instrument, this.#hz(pitch), 0.15, this.#Tone.now(), 0.8);
  }

  /**
   * Trigger one note on an instrument node. `Tone.NoiseSynth` has no pitch and
   * takes the duration as its first argument.
   * @param {object|null|undefined} node
   * @param {number} hz Frequency in hertz.
   * @param {object|number} dur Note duration.
   * @param {number|object} time When to play.
   * @param {number} vel Velocity, 0…1.
   */
  #trigger(node, hz, dur, time, vel) {
    if (!node) return;
    if (node instanceof this.#Tone.NoiseSynth) node.triggerAttackRelease(dur, time, vel);
    else node.triggerAttackRelease(hz, dur, time, vel);
  }

  /**
   * Release one note. Only `PolySynth` takes the note to release; monophonic
   * instruments take the time alone.
   * @param {object|null|undefined} node
   * @param {number} hz Frequency in hertz.
   * @param {number} time When to release.
   */
  #release(node, hz, time) {
    if (!node) return;
    if (typeof node.releaseAll === "function") node.triggerRelease(hz, time);
    else if (typeof node.triggerRelease === "function") node.triggerRelease(time);
  }

  /**
   * Release everything an instrument node is playing.
   * @param {object|null|undefined} node
   * @param {number} time When to release.
   */
  #releaseAll(node, time) {
    if (!node) return;
    if (typeof node.releaseAll === "function") node.releaseAll(time);
    else if (typeof node.triggerRelease === "function") node.triggerRelease(time);
  }

  /** Dispose every part, node and channel this engine owns. */
  dispose() {
    for (const part of this.#parts.values()) part.dispose();
    this.#parts.clear();
    for (const chain of this.#chains.values()) {
      for (const node of chain.nodes.values()) node.dispose();
      chain.nodes.clear();
      chain.instrument = null;
      chain.channel.dispose();
    }
    this.#chains.clear();
    this.#nodeByDevice.clear();
  }
}
