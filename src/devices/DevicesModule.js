import { Module } from "../core/Module.js";
import { DeviceCatalog } from "./DeviceCatalog.js";
import { PresetBank } from "./PresetBank.js";

/** Where the preset bank lives, relative to the page. */
const PRESETS_URL = "preset-bank.json";

/**
 * Loads the device schema and the preset bank and publishes them as the
 * `catalog` and `presets` services.
 *
 * Both are loaded in `start()`, so consumers must look them up in their own
 * `start()` (or later), never in `install()`.
 */
export class DevicesModule extends Module {
  #catalog = null;
  #presets = null;

  /** @returns {DeviceCatalog|null} The loaded catalog, or null before start. */
  get catalog() {
    return this.#catalog;
  }

  /** @returns {PresetBank|null} The loaded preset bank, or null before start. */
  get presets() {
    return this.#presets;
  }

  /**
   * Loads devices.json and preset-bank.json and provides both services.
   *
   * @param {import("../core/App.js").App} app The application.
   * @returns {Promise<void>}
   */
  async start(app) {
    const catalog = await DeviceCatalog.load();

    const response = await fetch(PRESETS_URL);
    if (!response.ok) {
      throw new Error(`Failed to load presets from "${PRESETS_URL}": HTTP ${response.status}.`);
    }
    const presets = PresetBank.fromJson(await response.json());

    this.#catalog = catalog;
    this.#presets = presets;
    app.provide("catalog", catalog);
    app.provide("presets", presets);
  }

  /**
   * Drops the loaded data; the App removes the services itself.
   *
   * @returns {void}
   */
  dispose() {
    this.#catalog = null;
    this.#presets = null;
  }
}
