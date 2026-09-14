import { Module } from "../core/Module.js";
import { $ } from "../ui/dom.js";

/** Hint shown on touch devices. */
const HINT_COARSE = "Arrangement: tap clip to edit, drag to move, drag edge to resize, pinch to zoom. Editor: tap adds, tap note deletes, drag moves. Rulers: tap to locate, drag ↕ zoom ↔ scroll.";
/** Hint shown on devices with a fine pointer. */
const HINT_FINE = "Arrangement: double-click lane = new clip · drag clip = move · right edge = resize · right-click = delete · Ctrl+D duplicate. Editor: click adds · click note deletes (Draw) · Ctrl+wheel zoom · Shift+wheel scroll · Space play · B draw/select";
/** Hint shown when the audio engine is unavailable. */
const HINT_NO_AUDIO = "Tone.js could not be loaded (network). Editing works; playback is disabled.";

/**
 * Provides the `status` service and writes its text into the `#hint` bar.
 * Text set before the bar is bound is kept and written once it is.
 */
export class StatusBarModule extends Module {
  /** @type {string} the most recent status text. */
  #text = "";
  /** @type {HTMLElement|null} the `#hint` element, once bound. */
  #hint = null;

  /** @returns {string} the module name. */
  get name() {
    return "StatusBarModule";
  }

  /**
   * Publish the status service.
   * @param {object} app the application.
   */
  install(app) {
    app.provide("status", { set: (text) => this.set(text) });
  }

  /**
   * Store the status text and display it when the status bar is bound.
   * @param {string} text the text to display.
   */
  set(text) {
    this.#text = text;
    if (this.#hint) this.#hint.textContent = text;
  }

  /**
   * Bind the status bar, flush any text set during install and show the
   * initial hint for this pointer type and audio availability.
   * @param {object} app the application.
   * @returns {Promise<void>}
   */
  async start(app) {
    this.#hint = $("hint");
    if (this.#text) this.#hint.textContent = this.#text;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.set(coarse ? HINT_COARSE : HINT_FINE);
    if (!app.get("audio").available) this.set(HINT_NO_AUDIO);
  }

  /** Release the status bar; the text stays for a later start. */
  dispose() {
    this.#hint = null;
  }
}
