import { Module } from "../core/Module.js";
import { splitPath } from "../params/paths.js";
import { AudioEngine } from "./AudioEngine.js";
import { ToneAudioEngine } from "./ToneAudioEngine.js";

/**
 * Wires the project model to the audio engine.
 *
 * It provides the `audio` service — a {@link ToneAudioEngine} when Tone.js is
 * on the page, otherwise the silent {@link AudioEngine} — and translates bus
 * events into engine calls. This module is the only place where the two sides
 * meet: the engine never reads the bus, and this module never touches the DOM.
 *
 * Installed fifth, after the modules providing `project` and the devices.
 */
export class AudioModule extends Module {
  /** @type {AudioEngine|null} */
  #engine = null;

  /** @type {import("../model/Project.js").Project|null} */
  #project = null;

  /** @type {Array<() => void>} Bus unsubscribe functions, called on dispose. */
  #subscriptions = [];

  /**
   * Provide the `audio` service and subscribe to the model events that the
   * engine has to follow.
   * @param {import("../core/App.js").App} app
   */
  install(app) {
    const engine = typeof globalThis.Tone !== "undefined" ? new ToneAudioEngine(globalThis.Tone) : new AudioEngine();
    this.#engine = engine;
    app.provide("audio", engine);
    this.#project = app.get("project");

    const bus = app.bus;
    this.#subscriptions = [
      bus.on("track:added", ({ track }) => {
        engine.addTrack(track);
        this.#syncLoop();
      }),
      bus.on("track:removed", ({ track }) => {
        engine.removeTrack(track);
        this.#syncLoop();
      }),
      bus.on("track:devices", ({ track }) => engine.rebuildTrack(track)),
      bus.on("clip:added", ({ clip }) => {
        engine.rebuildClip(clip);
        this.#syncLoop();
      }),
      bus.on("clip:changed", ({ clip }) => {
        engine.rebuildClip(clip);
        this.#syncLoop();
      }),
      bus.on("clip:notes", ({ clip }) => {
        engine.rebuildClip(clip);
        this.#syncLoop();
      }),
      bus.on("clip:removed", ({ clip }) => {
        engine.removeClip(clip);
        this.#syncLoop();
      }),
      bus.on("project:bpm", ({ bpm }) => engine.setBpm(bpm)),
      bus.on("project:loop", () => this.#syncLoop()),
      bus.on("parameter:changed", ({ parameter, value, origin }) => this.#applyParameter(parameter, value, origin)),
    ];
  }

  /**
   * Push a matrix parameter change into the engine. Changes the engine itself
   * mirrored back are ignored, so a value Tone converted cannot echo.
   * @param {{ address: string }} parameter
   * @param {*} value
   * @param {string|null} origin
   */
  #applyParameter(parameter, value, origin) {
    if (origin === ToneAudioEngine.ORIGIN) return;
    const [owner, id, ...path] = splitPath(parameter.address);
    if (owner === "track") {
      const track = this.#project.trackById(Number(id));
      if (track) this.#engine.setChannel(track, path[0], value);
    } else if (owner === "device") {
      const device = this.#findDevice(Number(id));
      if (device) this.#engine.setDeviceParameter(device, path.join("/"), value);
    }
  }

  /**
   * Find a device by id across every track of the project.
   * @param {number} id
   * @returns {import("../devices/Device.js").Device|null}
   */
  #findDevice(id) {
    for (const track of this.#project.tracks) {
      for (const device of track.devices) {
        if (device.id === id) return device;
      }
    }
    return null;
  }

  /** Mirror the project's loop flag and song length onto the transport. */
  #syncLoop() {
    this.#engine.setLoop(this.#project.loop, this.#project.endBeats());
  }

  /** Push the project's tempo and loop onto the transport once everything is installed. */
  async start() {
    this.#engine.setBpm(this.#project.bpm);
    this.#syncLoop();
  }

  /** Unsubscribe from the bus and dispose the engine. */
  dispose() {
    for (const unsubscribe of this.#subscriptions) unsubscribe();
    this.#subscriptions = [];
    this.#engine?.dispose();
  }
}
