import { BooleanType, NumberType } from "../params/types.js";
import { ParameterDescriptor, ParameterGroup } from "../params/ParameterGroup.js";

/**
 * Start values of a track's channel strip. They mirror the mixer channel the
 * audio engine builds for a new track (`new Tone.Channel(-8)`).
 */
export const CHANNEL_DEFAULTS = { volume: -8, pan: 0, mute: false };

/**
 * Schema of a track's channel strip: the parameters every track owns on top of
 * its devices. Registered under the track prefix, so the leaves end up at
 * `track/<id>/volume`, `track/<id>/pan` and `track/<id>/mute`.
 *
 * The number ranges mirror the `unitTypes.TrackVolume` and `unitTypes.TrackPan`
 * entries of devices.json, so channel parameters are typed exactly like the
 * device parameters next to them.
 * @returns {ParameterGroup}
 */
export function createChannelGroup() {
  const group = new ParameterGroup("channel");
  group.add(
    "volume",
    new ParameterDescriptor({
      name: "volume",
      type: new NumberType({ name: "TrackVolume", min: -60, max: 0, step: 0.01 }),
    }),
  );
  group.add(
    "pan",
    new ParameterDescriptor({
      name: "pan",
      type: new NumberType({ name: "TrackPan", min: -1, max: 1, step: 0.01 }),
    }),
  );
  group.add("mute", new ParameterDescriptor({ name: "mute", type: new BooleanType() }));
  return group;
}

/**
 * One lane of the arrangement: a channel strip plus a chain of devices.
 *
 * A track keeps no channel values of its own — volume, pan and mute live in
 * the parameter matrix under the track prefix, which is what lets the mixer,
 * the audio engine and presets all address them the same way.
 */
export class Track {
  #matrix = null;

  /**
   * @param {object} spec
   * @param {number} spec.id unique id, handed out by `Project.nextId()`
   * @param {string} spec.name display name
   * @param {string} spec.color lane colour, from TRACK_COLORS
   * @param {object[]} [spec.devices] device chain, instrument first
   */
  constructor({ id, name, color, devices = [] }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.devices = devices;
  }

  /** Address prefix of everything this track owns in the parameter matrix. */
  get prefix() {
    return `track/${this.id}`;
  }

  /**
   * Register the channel strip and every device of this track in the matrix.
   * @param {import("../params/ParameterMatrix.js").ParameterMatrix} matrix
   */
  attach(matrix) {
    if (this.#matrix) throw new Error(`Track ${this.id} ("${this.name}") is already attached to a parameter matrix.`);
    this.#matrix = matrix;
    matrix.registerGroup(this.prefix, createChannelGroup(), CHANNEL_DEFAULTS);
    for (const device of this.devices) device.attach(matrix);
  }

  /** Release the channel strip and every device of this track from the matrix. */
  detach() {
    if (!this.#matrix) throw new Error(`Track ${this.id} ("${this.name}") is not attached to a parameter matrix.`);
    for (const device of this.devices) device.detach();
    this.#matrix.releasePrefix(this.prefix);
    this.#matrix = null;
  }

  /**
   * A channel strip parameter of this track.
   * @param {string} name "volume", "pan" or "mute"
   * @returns {import("../params/Parameter.js").Parameter}
   */
  channelParameter(name) {
    if (!this.#matrix) throw new Error(`Track ${this.id} ("${this.name}") is not attached to a parameter matrix.`);
    return this.#matrix.require(`${this.prefix}/${name}`);
  }

  /** Channel volume in dB. */
  get volume() {
    return this.channelParameter("volume").value;
  }

  /** Channel pan, -1 (left) to 1 (right). */
  get pan() {
    return this.channelParameter("pan").value;
  }

  /** Whether the channel is muted. */
  get mute() {
    return this.channelParameter("mute").value;
  }

  /** First instrument in the device chain, or null when the track has none. */
  get instrument() {
    return this.devices.find((device) => device.category === "Instrument") ?? null;
  }

  /** Every effect in the device chain, in chain order. */
  get effects() {
    return this.devices.filter((device) => device.category === "Effect");
  }
}
