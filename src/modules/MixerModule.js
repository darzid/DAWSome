import { Module } from "../core/Module.js";
import { $, el } from "../ui/dom.js";
import { ParameterPanel } from "../ui/ParameterPanel.js";

/**
 * Mixer panel: one strip per track, built from the track parameters held by
 * the parameter matrix.
 *
 * A strip lists whatever the matrix holds under the track's address prefix, so
 * a new track parameter shows up in the mixer without a change to this module.
 */
export class MixerModule extends Module {
  /** @type {HTMLElement|null} */
  #container = null;
  /** @type {(() => void)|null} */
  #unregisterPanel = null;
  #project = null;
  #parameters = null;
  /** @type {Array<() => void>} */
  #unsubscribes = [];
  /** @type {ParameterPanel[]} */
  #parameterPanels = [];

  /**
   * Register the "mixer" panel with the panel registry.
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    this.#container = $("mixerPanel");
    this.#unregisterPanel = app.get("panels").register({
      id: "mixer",
      title: "Mixer",
      element: this.#container,
    });
  }

  /**
   * Resolve services, subscribe to the track and selection events and draw the
   * strips once.
   * @param {import("../core/App.js").App} app
   */
  async start(app) {
    this.#project = app.get("project");
    this.#parameters = app.get("parameters");
    const render = () => this.render();
    for (const event of ["track:added", "track:removed", "track:changed", "app:started"]) {
      this.#unsubscribes.push(app.bus.on(event, render));
    }
    this.#unsubscribes.push(app.bus.on("selection", (selection) => this.#highlight(selection?.trackId)));
    this.render();
  }

  /**
   * Rebuild every strip. The widgets come from the parameter matrix; no
   * parameter is named here.
   */
  render() {
    this.#disposeParameterPanels();
    this.#container.replaceChildren();
    for (const track of this.#project.tracks) {
      const body = el("div", {});
      const selected = track.id === this.#project.selectedTrackId;
      this.#container.append(el("div", {
        className: selected ? "mixer-strip selected" : "mixer-strip",
        dataset: { id: track.id },
      }, [
        el("h3", { text: track.name }),
        body,
      ]));
      const panel = new ParameterPanel({
        container: body,
        parameters: this.#parameters.list(track.prefix),
        matrix: this.#parameters,
      });
      panel.render();
      this.#parameterPanels.push(panel);
    }
  }

  /** Unsubscribe, drop the generated widgets and unregister the panel. */
  dispose() {
    for (const unsubscribe of this.#unsubscribes) unsubscribe();
    this.#unsubscribes = [];
    this.#disposeParameterPanels();
    this.#container?.replaceChildren();
    this.#unregisterPanel?.();
    this.#unregisterPanel = null;
  }

  /**
   * Mark the strip of the selected track without rebuilding the panel.
   * @param {number|string|null|undefined} trackId
   */
  #highlight(trackId) {
    const id = String(trackId);
    for (const strip of this.#container.querySelectorAll(".mixer-strip")) {
      strip.classList.toggle("selected", strip.dataset.id === id);
    }
  }

  /** Dispose the parameter panels built by the previous render. */
  #disposeParameterPanels() {
    for (const panel of this.#parameterPanels) panel.dispose();
    this.#parameterPanels = [];
  }
}
