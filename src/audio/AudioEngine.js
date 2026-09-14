/* eslint-disable no-unused-vars -- the null engine documents its parameters but ignores them. */

/**
 * The audio engine interface, and at the same time the "null" engine used when
 * no audio back end is available (for example when Tone.js failed to load).
 *
 * Every method is a no-op here, so the rest of the application can call the
 * engine unconditionally: the app stays usable — editing, arranging and saving
 * all work — it simply makes no sound. `ToneAudioEngine` overrides these
 * methods with the real Tone.js implementation.
 *
 * The engine is a pure sink driven by `AudioModule`: it never reads the event
 * bus itself and never touches the DOM.
 */
export class AudioEngine {
  /**
   * Whether this engine can actually produce sound.
   * @returns {boolean} `false` for the null engine.
   */
  get available() {
    return false;
  }

  /**
   * Resume the audio context after a user gesture, as browsers require.
   * @returns {Promise<void>}
   */
  async unlock() {}

  /**
   * Set the transport tempo.
   * @param {number} bpm Beats per minute.
   */
  setBpm(bpm) {}

  /**
   * Enable or disable transport looping over `[0, endBeats)`.
   * @param {boolean} on Whether looping is enabled.
   * @param {number} endBeats Loop end, in beats from the start of the song.
   */
  setLoop(on, endBeats) {}

  /**
   * Create the output channel and device chain of a newly added track.
   * @param {import("../model/Track.js").Track} track
   */
  addTrack(track) {}

  /**
   * Tear down the channel and device chain of a removed track.
   * @param {import("../model/Track.js").Track} track
   */
  removeTrack(track) {}

  /**
   * Rebuild the device chain of an existing track after its devices changed.
   * @param {import("../model/Track.js").Track} track
   */
  rebuildTrack(track) {}

  /**
   * Apply a track channel parameter: "volume" (dB), "pan" or "mute".
   * @param {import("../model/Track.js").Track} track
   * @param {string} name Channel parameter name.
   * @param {number|boolean} value New value.
   */
  setChannel(track, name, value) {}

  /**
   * Apply one device parameter to the live audio node.
   * @param {import("../devices/Device.js").Device} device
   * @param {string} path Slash separated path inside the device options.
   * @param {*} value New value.
   */
  setDeviceParameter(device, path, value) {}

  /**
   * (Re)schedule the playback events of a clip.
   * @param {import("../model/Clip.js").Clip} clip
   */
  rebuildClip(clip) {}

  /**
   * Unschedule a removed clip.
   * @param {import("../model/Clip.js").Clip} clip
   */
  removeClip(clip) {}

  /**
   * Unlock the audio context and start the transport.
   * @returns {Promise<void>}
   */
  async play() {}

  /** Stop the transport and release every sounding voice. */
  stop() {}

  /**
   * Move the transport playhead.
   * @param {number} beat Target position in beats.
   */
  seek(beat) {}

  /**
   * Current transport position.
   * @returns {number} Position in beats; always 0 for the null engine.
   */
  positionBeat() {
    return 0;
  }

  /**
   * Start a note played live on a track (keyboard or pad press).
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  noteOn(trackId, pitch) {}

  /**
   * Release a note played live on a track.
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  noteOff(trackId, pitch) {}

  /**
   * Play a short audition of a pitch on a track.
   * @param {number} trackId
   * @param {number} pitch MIDI note number.
   */
  preview(trackId, pitch) {}

  /** Release every audio resource this engine owns. */
  dispose() {}
}
/* eslint-enable no-unused-vars */
