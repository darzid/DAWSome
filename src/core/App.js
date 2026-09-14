import { EventBus } from "./EventBus.js";
import { Module } from "./Module.js";

/**
 * Composition root. Holds the shared event bus and a registry of named
 * services, and drives the module lifecycle.
 *
 * Services are plain objects registered by modules (`app.provide("project", project)`)
 * and looked up by other modules (`app.get("project")`). Looking up a service
 * that nobody provided fails loudly so wiring mistakes surface immediately.
 */
export class App {
  bus = new EventBus();
  #services = new Map();
  #modules = [];
  #started = false;

  provide(name, service) {
    if (this.#services.has(name)) throw new Error(`Service "${name}" is already provided.`);
    this.#services.set(name, service);
    return service;
  }

  has(name) {
    return this.#services.has(name);
  }

  get(name) {
    if (!this.#services.has(name)) {
      throw new Error(`Service "${name}" is not registered. Install the module that provides it first.`);
    }
    return this.#services.get(name);
  }

  use(module) {
    if (!(module instanceof Module)) throw new TypeError("app.use() expects a Module instance.");
    if (this.#started) throw new Error(`Cannot install ${module.name}: the app has already started.`);
    module.install(this);
    this.#modules.push(module);
    return this;
  }

  get modules() {
    return [...this.#modules];
  }

  get started() {
    return this.#started;
  }

  async start() {
    if (this.#started) throw new Error("App already started.");
    for (const module of this.#modules) await module.start(this);
    this.#started = true;
    this.bus.emit("app:started", this);
    return this;
  }

  dispose() {
    for (const module of [...this.#modules].reverse()) module.dispose(this);
    this.#modules.length = 0;
    this.#services.clear();
    this.#started = false;
  }
}
