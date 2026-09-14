import { Device } from "./Device.js";
import { DeviceSchemaSet } from "./DeviceSchema.js";

/** Where the device schema lives, relative to the page. */
const DEVICES_URL = "devices.json";

/**
 * The devices the application can create: the parsed devices.json plus the
 * factory that turns a device name into a live {@link Device} with a unique id.
 */
export class DeviceCatalog {
  #schemas;
  #nextId = 1;

  /**
   * @param {DeviceSchemaSet} schemaSet The parsed device schemas.
   */
  constructor(schemaSet) {
    if (!(schemaSet instanceof DeviceSchemaSet)) {
      throw new Error("DeviceCatalog needs a DeviceSchemaSet.");
    }
    this.#schemas = schemaSet;
  }

  /** @returns {DeviceSchemaSet} The parsed device schemas. */
  get schemas() {
    return this.#schemas;
  }

  /**
   * Fetches and parses devices.json.
   *
   * @param {string} [url] Where to load the schema from.
   * @param {typeof globalThis.fetch} [fetchImpl] Fetch implementation, for tests.
   * @returns {Promise<DeviceCatalog>} The loaded catalog.
   */
  static async load(url = DEVICES_URL, fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== "function") {
      throw new Error(`Cannot load devices from "${url}": no fetch implementation available.`);
    }
    // The global fetch must keep its own receiver; a passed-in stub must not.
    const request = fetchImpl === globalThis.fetch ? fetchImpl.bind(globalThis) : fetchImpl;
    const response = await request(url);
    if (!response.ok) {
      throw new Error(`Failed to load devices from "${url}": HTTP ${response.status}.`);
    }
    return new DeviceCatalog(DeviceSchemaSet.fromJson(await response.json()));
  }

  /** @returns {string[]} Names of every instrument, in devices.json order. */
  instruments() {
    return this.#schemas.list("Instrument").map((schema) => schema.name);
  }

  /** @returns {string[]} Names of every effect, in devices.json order. */
  effects() {
    return this.#schemas.list("Effect").map((schema) => schema.name);
  }

  /**
   * @param {string} name Device name.
   * @returns {boolean} True when the catalog knows that device.
   */
  has(name) {
    return this.#schemas.has(name);
  }

  /**
   * @param {string} name Device name.
   * @returns {import("./DeviceSchema.js").DeviceSchema} The schema of that device.
   */
  schema(name) {
    return this.#schemas.get(name);
  }

  /**
   * Creates a device instance with the next free id.
   *
   * @param {string} typeName Device name, e.g. `"MonoSynth"`.
   * @param {object} [spec]
   * @param {object} [spec.options] Options the audio node is built from; stored as given.
   * @param {string|null} [spec.presetName] Preset the options came from, if any.
   * @returns {Device} The new device.
   */
  create(typeName, { options = {}, presetName = null } = {}) {
    const schema = this.schema(typeName);
    return new Device({ id: this.#nextId++, schema, options, presetName });
  }

  /**
   * Creates a device for a preset, with a private copy of its parameters.
   *
   * @param {import("./PresetBank.js").Preset} preset The preset to instantiate.
   * @returns {Device} The new device.
   */
  createFromPreset(preset) {
    return this.create(preset.device, {
      options: structuredClone(preset.parameters),
      presetName: preset.name,
    });
  }
}
