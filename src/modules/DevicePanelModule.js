import { Module } from "../core/Module.js";
import { $, el } from "../ui/dom.js";
import { ParameterPanel } from "../ui/ParameterPanel.js";

/**
 * Device panel: shows the device chain of the selected track.
 *
 * The panel knows nothing about any particular device or parameter. It asks
 * every device of the selected track for its parameters and hands them to a
 * {@link ParameterPanel}, so a new device type appears here without a change
 * to this module.
 */
export class DevicePanelModule extends Module {
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
   * Register the "devices" panel with the panel registry.
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    this.#container = $("devicesPanel");
    this.#unregisterPanel = app.get("panels").register({
      id: "devices",
      title: "Devices",
      element: this.#container,
    });
  }

  /**
   * Resolve services, subscribe to everything that changes what is shown and
   * draw the panel once.
   * @param {import("../core/App.js").App} app
   */
  async start(app) {
    this.#project = app.get("project");
    this.#parameters = app.get("parameters");
    const render = () => this.render();
    for (const event of ["selection", "track:devices", "track:removed", "app:started"]) {
      this.#unsubscribes.push(app.bus.on(event, render));
    }
    this.render();
  }

  /**
   * Rebuild the panel from the selected track's device chain. Every widget is
   * generated from the parameter matrix; no parameter is named here.
   */
  render() {
    this.#disposeParameterPanels();
    this.#container.replaceChildren();
    const track = this.#project.selectedTrack;
    if (!track) {
      this.#container.append(el("div", { className: "muted", text: "No track selected" }));
      return;
    }
    for (const device of track.devices) {
      const body = el("div", {});
      this.#container.append(el("div", { className: "device-card" }, [
        el("h3", { text: `${device.typeName} · ${device.presetName ?? "Custom"}` }),
        body,
      ]));
      const panel = new ParameterPanel({
        container: body,
        parameters: device.parameters(),
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

  /** Dispose the parameter panels built by the previous render. */
  #disposeParameterPanels() {
    for (const panel of this.#parameterPanels) panel.dispose();
    this.#parameterPanels = [];
  }
}
