import { inferType } from "../params/types.js";
import { joinPath } from "../params/paths.js";
import { DeviceSchema } from "./DeviceSchema.js";

/** Owner segment of every device parameter address. */
const OWNER = "device";

/**
 * One live device instance: a schema, the options its audio node is built
 * from, and, once attached, its slice of the parameter matrix.
 *
 * A device owns the address prefix `device/<id>`; every parameter of its
 * schema lives underneath it (`device/3/envelope/attack`). The device itself
 * never touches Tone.js or the DOM: the audio engine mirrors node values in
 * through {@link Device#syncValues}, the UI reads and writes them through the
 * matrix.
 */
export class Device {
  #id;
  #schema;
  #options;
  #presetName;
  #prefix;
  #matrix = null;

  /**
   * @param {object} spec
   * @param {number|string} spec.id Unique device id, used in the address prefix.
   * @param {DeviceSchema} spec.schema Schema of the device type.
   * @param {object} [spec.options] Options the audio node is constructed with.
   * @param {string|null} [spec.presetName] Name of the preset the options came from.
   */
  constructor({ id, schema, options = {}, presetName = null }) {
    if (id === undefined || id === null || id === "") {
      throw new Error("A device needs an id.");
    }
    if (!(schema instanceof DeviceSchema)) {
      throw new Error(`Device ${id} needs a DeviceSchema.`);
    }
    if (options === null || typeof options !== "object") {
      throw new Error(`Device ${id} (${schema.name}) options must be an object.`);
    }
    this.#id = id;
    this.#schema = schema;
    this.#options = options;
    this.#presetName = presetName;
    this.#prefix = joinPath(OWNER, String(id));
  }

  /** @returns {number|string} The device id. */
  get id() {
    return this.#id;
  }

  /** @returns {DeviceSchema} The schema of this device type. */
  get schema() {
    return this.#schema;
  }

  /** @returns {string} Device type name, identical to the Tone.js class name. */
  get typeName() {
    return this.#schema.name;
  }

  /** @returns {string} `"Instrument"` or `"Effect"`. */
  get category() {
    return this.#schema.category;
  }

  /** @returns {object} The options the audio node is (re)built from. */
  get options() {
    return this.#options;
  }

  /** @returns {string|null} Name of the loaded preset, or null. */
  get presetName() {
    return this.#presetName;
  }

  /** @returns {string} Address prefix of every parameter of this device. */
  get prefix() {
    return this.#prefix;
  }

  /** @returns {import("../params/ParameterMatrix.js").ParameterMatrix|null} The matrix, or null while detached. */
  get matrix() {
    return this.#matrix;
  }

  /**
   * Registers the schema parameters of this device in the matrix.
   *
   * No initial values are written: parameters stay unset until the engine
   * mirrors the node values in, or the UI or a preset sets them.
   *
   * @param {import("../params/ParameterMatrix.js").ParameterMatrix} matrix The matrix to attach to.
   * @returns {import("../params/Parameter.js").Parameter[]} The registered parameters.
   */
  attach(matrix) {
    if (this.#matrix) {
      throw new Error(`Device ${this.#id} (${this.typeName}) is already attached to a parameter matrix.`);
    }
    if (!matrix) {
      throw new Error(`Device ${this.#id} (${this.typeName}) cannot attach to a missing parameter matrix.`);
    }
    const registered = matrix.registerGroup(this.#prefix, this.#schema.parameters);
    this.#matrix = matrix;
    return registered;
  }

  /**
   * Releases every parameter of this device from the matrix.
   *
   * @returns {number} Number of released parameters; 0 when not attached.
   */
  detach() {
    if (!this.#matrix) return 0;
    const released = this.#matrix.releasePrefix(this.#prefix);
    this.#matrix = null;
    return released;
  }

  /**
   * @returns {import("../params/Parameter.js").Parameter[]} Every parameter of this device; empty while detached.
   */
  parameters() {
    return this.#matrix ? this.#matrix.list(this.#prefix) : [];
  }

  /**
   * Looks one parameter up by its path inside the device.
   *
   * @param {string|string[]} path Schema path, e.g. `"envelope/attack"` or `["envelope", "attack"]`.
   * @returns {import("../params/Parameter.js").Parameter|undefined} The parameter, or undefined.
   */
  parameter(path) {
    const suffix = Array.isArray(path) ? joinPath(...path) : path;
    return this.#matrix?.get(joinPath(this.#prefix, suffix));
  }

  /**
   * Replaces the options with the parameters of a preset.
   *
   * @param {import("./PresetBank.js").Preset} preset Preset for this device type.
   * @returns {void}
   */
  loadPreset(preset) {
    if (preset.device !== this.typeName) {
      throw new Error(
        `Preset "${preset.name}" belongs to device "${preset.device}", not to device ${this.#id} (${this.typeName}).`
      );
    }
    this.setOptions(structuredClone(preset.parameters), preset.name);
  }

  /**
   * Replaces the options the audio node is built from.
   *
   * @param {object} options New options; stored as given.
   * @param {string|null} [presetName] Preset the options came from, if any.
   * @returns {void}
   */
  setOptions(options, presetName = null) {
    if (options === null || typeof options !== "object") {
      throw new Error(`Device ${this.#id} (${this.typeName}) options must be an object.`);
    }
    this.#options = options;
    this.#presetName = presetName;
  }

  /**
   * Mirrors flat engine values into the matrix.
   *
   * Values with no inferable type (arrays, objects, null) are skipped. Values
   * the schema does not declare are registered as inferred parameters, so the
   * matrix also carries what only the audio node knows about.
   *
   * @param {Record<string, unknown>} flat Flat path -> value map, e.g. from `flatten(node.get())`.
   * @param {string|null} origin Change origin, `"engine"` for mirrored values.
   * @returns {number} Number of parameters set or registered; 0 while detached.
   */
  syncValues(flat, origin) {
    if (!this.#matrix) return 0;
    if (flat === null || typeof flat !== "object") {
      throw new Error(`Device ${this.#id} (${this.typeName}) cannot sync values from a non-object.`);
    }
    let touched = 0;
    for (const [path, value] of Object.entries(flat)) {
      const type = inferType(value);
      if (!type) continue;
      const address = joinPath(this.#prefix, path);
      if (this.#matrix.has(address)) {
        this.#matrix.set(address, value, origin);
      } else {
        this.#matrix.register({ address, type, inferred: true, value });
      }
      touched += 1;
    }
    return touched;
  }

  /**
   * @returns {object} Nested snapshot of every set parameter; `{}` while detached.
   */
  snapshot() {
    return this.#matrix ? this.#matrix.snapshot(this.#prefix) : {};
  }
}
