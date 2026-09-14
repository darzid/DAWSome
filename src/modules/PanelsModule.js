import { Module } from "../core/Module.js";
import { PanelRegistry } from "../core/PanelRegistry.js";
import { $, el } from "../ui/dom.js";

/** Flex value of the arrangement while a panel is visible. */
const ARRANGEMENT_WITH_PANEL = "0 0 35%";
/** Flex value of the arrangement while no panel is visible. */
const ARRANGEMENT_ALONE = "0 0 80%";

/**
 * Provides the `panels` service and renders the tab strip for it: one button
 * per registered panel, showing exactly the active panel and resizing the
 * arrangement accordingly.
 */
export class PanelsModule extends Module {
  /** @type {PanelRegistry|null} the registry provided by this module. */
  #panels = null;
  /** @type {HTMLElement|null} the `#tabStrip` container. */
  #tabStrip = null;
  /** @type {HTMLElement|null} the `#arrangement` element. */
  #arrangement = null;
  /** @type {Map<string, HTMLButtonElement>} panel id to its tab button. */
  #buttons = new Map();
  /** @type {Array<() => void>} bus unsubscribe functions. */
  #unsubscribes = [];

  /** @returns {string} the module name. */
  get name() {
    return "PanelsModule";
  }

  /**
   * Publish the panel registry as the `panels` service.
   * @param {object} app the application.
   */
  install(app) {
    this.#panels = new PanelRegistry(app.bus);
    app.provide("panels", this.#panels);
  }

  /**
   * Render the tab strip, keep it in sync with the registry and show the
   * first registered panel when nothing is active yet.
   * @param {object} app the application.
   * @returns {Promise<void>}
   */
  async start(app) {
    this.#tabStrip = $("tabStrip");
    this.#arrangement = $("arrangement");

    this.#render();
    this.#unsubscribes.push(app.bus.on("panels:registered", () => this.#render()));
    this.#unsubscribes.push(app.bus.on("panels:active", ({ id }) => this.#applyActive(id)));

    const list = this.#panels.list();
    if (this.#panels.activeId === null && list.length > 0) this.#panels.show(list[0].id);
    this.#applyActive(this.#panels.activeId);
  }

  /** Remove the tab strip content and every subscription this module added. */
  dispose() {
    for (const off of this.#unsubscribes) off();
    this.#unsubscribes = [];
    this.#buttons.clear();
    if (this.#tabStrip) this.#tabStrip.textContent = "";
    this.#tabStrip = null;
    this.#arrangement = null;
  }

  /** Rebuild one tab button per registered panel and reapply the active state. */
  #render() {
    this.#tabStrip.textContent = "";
    this.#buttons.clear();
    for (const panel of this.#panels.list()) {
      const button = el("button", {
        className: "btn",
        text: panel.title,
        dataset: { panel: panel.id },
      });
      button.addEventListener("click", () => this.#panels.toggle(panel.id));
      this.#buttons.set(panel.id, button);
      this.#tabStrip.appendChild(button);
    }
    this.#applyActive(this.#panels.activeId);
  }

  /**
   * Show the active panel, hide the others, highlight its tab button and size
   * the arrangement to leave room for a visible panel.
   * @param {string|null} activeId id of the active panel, or null when hidden.
   */
  #applyActive(activeId) {
    for (const panel of this.#panels.list()) {
      const isActive = panel.id === activeId;
      panel.element.style.display = isActive ? "flex" : "none";
      const button = this.#buttons.get(panel.id);
      if (button) button.classList.toggle("on", isActive);
    }
    this.#arrangement.style.flex = activeId ? ARRANGEMENT_WITH_PANEL : ARRANGEMENT_ALONE;
  }
}
