import { Module } from "../core/Module.js";
import { CommandRegistry } from "../core/CommandRegistry.js";

/** Tag names whose own key handling takes precedence over shortcuts. */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/**
 * Provides the `commands` service and translates keyboard shortcuts into
 * command runs. Also drops focus from a button after it was clicked, so a
 * following Space does not re-trigger that button.
 */
export class KeyboardModule extends Module {
  /** @type {CommandRegistry|null} the registry provided by this module. */
  #commands = null;
  /** @type {((event: KeyboardEvent) => void)|null} the keydown listener. */
  #onKeyDown = null;
  /** @type {((event: MouseEvent) => void)|null} the click listener. */
  #onClick = null;

  /** @returns {string} the module name. */
  get name() {
    return "KeyboardModule";
  }

  /**
   * Publish the command registry as the `commands` service.
   * @param {object} app the application.
   */
  install(app) {
    this.#commands = new CommandRegistry();
    app.provide("commands", this.#commands);
  }

  /**
   * Listen for shortcuts on the window and for button clicks on the document.
   * @returns {Promise<void>}
   */
  async start() {
    const commands = this.#commands;

    this.#onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (TEXT_ENTRY_TAGS.has(tag)) return;
      const cmd = commands.matchShortcut(e);
      if (!cmd) return;
      e.preventDefault();
      commands.run(cmd.id);
    };
    window.addEventListener("keydown", this.#onKeyDown);

    this.#onClick = (e) => {
      const btn = e.target.closest?.(".btn");
      if (btn) btn.blur();
    };
    document.addEventListener("click", this.#onClick);
  }

  /** Remove both global listeners. */
  dispose() {
    if (this.#onKeyDown) {
      window.removeEventListener("keydown", this.#onKeyDown);
      this.#onKeyDown = null;
    }
    if (this.#onClick) {
      document.removeEventListener("click", this.#onClick);
      this.#onClick = null;
    }
  }
}
