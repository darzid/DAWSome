/**
 * Registry of the switchable panels shown under the arrangement
 * (clip editor, devices, mixer, ...). A module registers a panel with
 * `{ id, title, element }`; the PanelsModule renders the tab strip and
 * shows or hides the elements. At most one panel is visible at a time and
 * toggling the active panel hides it.
 */
export class PanelRegistry {
  #bus;
  #panels = new Map();
  #activeId = null;

  constructor(bus) {
    this.#bus = bus;
  }

  register({ id, title, element }) {
    if (!id || typeof id !== "string") throw new TypeError("A panel needs a string id.");
    if (this.#panels.has(id)) throw new Error(`Panel "${id}" is already registered.`);
    if (!element) throw new TypeError(`Panel "${id}" needs a root element.`);
    const panel = { id, title: title ?? id, element };
    this.#panels.set(id, panel);
    this.#bus.emit("panels:registered", panel);
    return () => {
      this.#panels.delete(id);
      if (this.#activeId === id) this.hide();
    };
  }

  list() {
    return [...this.#panels.values()];
  }

  get(id) {
    const panel = this.#panels.get(id);
    if (!panel) throw new Error(`Unknown panel "${id}".`);
    return panel;
  }

  get activeId() {
    return this.#activeId;
  }

  get active() {
    return this.#activeId ? this.#panels.get(this.#activeId) ?? null : null;
  }

  show(id) {
    this.get(id);
    if (this.#activeId === id) return;
    const previous = this.#activeId;
    this.#activeId = id;
    this.#bus.emit("panels:active", { id, previous });
  }

  hide() {
    if (this.#activeId === null) return;
    const previous = this.#activeId;
    this.#activeId = null;
    this.#bus.emit("panels:active", { id: null, previous });
  }

  toggle(id) {
    if (this.#activeId === id) this.hide();
    else this.show(id);
  }
}
