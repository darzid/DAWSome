/** Separator between the three parts of a preset key in preset-bank.json. */
const KEY_SEP = "\\";

/** Category token (lowercase, as written in the key) to device category. */
const CATEGORY_BY_TOKEN = new Map([
  ["instrument", "Instrument"],
  ["effect", "Effect"],
]);

/**
 * One entry of preset-bank.json: a named set of device parameters.
 *
 * The parameters are the nested object exactly as stored in the bank; they are
 * neither validated against a device schema nor clamped, because the bank uses
 * values outside the declared enums (e.g. the oscillator type `"square4"`).
 */
export class Preset {
  #category;
  #device;
  #name;
  #parameters;

  /**
   * @param {object} spec
   * @param {string} spec.category `"Instrument"` or `"Effect"`.
   * @param {string} spec.device Device name the preset belongs to, e.g. `"MonoSynth"`.
   * @param {string} spec.name Preset name, e.g. `"BassGuitar"`.
   * @param {object} spec.parameters Nested parameter values, stored as given.
   */
  constructor({ category, device, name, parameters }) {
    if (![...CATEGORY_BY_TOKEN.values()].includes(category)) {
      throw new Error(`Preset ${JSON.stringify(name)} has an unknown category ${JSON.stringify(category)}.`);
    }
    if (typeof device !== "string" || device === "") {
      throw new Error(`Preset ${JSON.stringify(name)} needs a non-empty device name.`);
    }
    if (typeof name !== "string" || name === "") {
      throw new Error(`Preset of device "${device}" needs a non-empty name.`);
    }
    if (parameters === null || typeof parameters !== "object") {
      throw new Error(`Preset "${device}/${name}" needs an object of parameters.`);
    }
    this.#category = category;
    this.#device = device;
    this.#name = name;
    this.#parameters = parameters;
  }

  /** @returns {string} `"Instrument"` or `"Effect"`. */
  get category() {
    return this.#category;
  }

  /** @returns {string} Name of the device this preset is for. */
  get device() {
    return this.#device;
  }

  /** @returns {string} Preset name. */
  get name() {
    return this.#name;
  }

  /** @returns {object} The nested parameter values, as stored in the bank. */
  get parameters() {
    return this.#parameters;
  }

  /** @returns {string} The preset-bank.json key, e.g. `instrument\MonoSynth\Bassy`. */
  get key() {
    return `${this.#category.toLowerCase()}${KEY_SEP}${this.#device}${KEY_SEP}${this.#name}`;
  }
}

/**
 * The parsed preset-bank.json: every preset, grouped by device name and kept
 * in bank order.
 */
export class PresetBank {
  /** @type {Map<string, Map<string, Preset>>} device name -> preset name -> preset */
  #byDevice = new Map();

  /**
   * Parses the preset-bank.json document.
   *
   * Keys are `<category>\<device>\<preset>`; an unparsable key fails loudly
   * instead of being skipped.
   *
   * @param {Record<string, object>} json Parsed preset-bank.json.
   * @returns {PresetBank} The filled bank.
   */
  static fromJson(json) {
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("preset-bank.json must contain an object of preset keys.");
    }
    const bank = new PresetBank();
    for (const [key, parameters] of Object.entries(json)) {
      const parts = key.split(KEY_SEP);
      if (parts.length !== 3) {
        throw new Error(`Preset key "${key}" must have the form <category>${KEY_SEP}<device>${KEY_SEP}<name>.`);
      }
      const [token, device, name] = parts;
      const category = CATEGORY_BY_TOKEN.get(token);
      if (!category) {
        throw new Error(`Preset key "${key}" has an unknown category "${token}".`);
      }
      if (device === "" || name === "") {
        throw new Error(`Preset key "${key}" must name both a device and a preset.`);
      }
      bank.add(new Preset({ category, device, name, parameters }));
    }
    return bank;
  }

  /**
   * Adds one preset to the bank.
   *
   * @param {Preset} preset The preset to add.
   * @returns {Preset} The added preset.
   */
  add(preset) {
    if (!(preset instanceof Preset)) throw new Error("PresetBank.add() expects a Preset.");
    let presets = this.#byDevice.get(preset.device);
    if (!presets) {
      presets = new Map();
      this.#byDevice.set(preset.device, presets);
    }
    if (presets.has(preset.name)) {
      throw new Error(`Duplicate preset "${preset.name}" for device "${preset.device}".`);
    }
    presets.set(preset.name, preset);
    return preset;
  }

  /**
   * @param {string} device Device name.
   * @returns {Preset[]} Presets of that device in bank order; empty when it has none.
   */
  forDevice(device) {
    const presets = this.#byDevice.get(device);
    return presets ? [...presets.values()] : [];
  }

  /**
   * @param {string} device Device name.
   * @returns {string[]} Preset names of that device in bank order.
   */
  names(device) {
    return this.forDevice(device).map((preset) => preset.name);
  }

  /**
   * @param {string} device Device name.
   * @param {string} name Preset name.
   * @returns {Preset} The preset.
   */
  get(device, name) {
    const preset = this.#byDevice.get(device)?.get(name);
    if (!preset) throw new Error(`Unknown preset "${name}" for device "${device}".`);
    return preset;
  }

  /**
   * @param {string} device Device name.
   * @param {string} name Preset name.
   * @returns {boolean} True when the bank holds that preset.
   */
  has(device, name) {
    return this.#byDevice.get(device)?.has(name) ?? false;
  }

  /** @returns {string[]} Names of every device with at least one preset, in bank order. */
  devices() {
    return [...this.#byDevice.keys()];
  }
}
