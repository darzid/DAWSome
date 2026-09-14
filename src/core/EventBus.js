/**
 * Minimal synchronous publish/subscribe bus.
 *
 * Every cross-module notification in the app travels through one bus instance
 * owned by the App, so a new feature only needs to subscribe to the events it
 * cares about and never has to reach into another module.
 */
export class EventBus {
  #listeners = new Map();

  /**
   * Subscribe to an event. Returns a function that removes the subscription.
   * @param {string} event
   * @param {(payload: any, event: string) => void} listener
   */
  on(event, listener) {
    if (typeof listener !== "function") throw new TypeError(`Listener for "${event}" must be a function.`);
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Subscribe to the next occurrence of an event only. */
  once(event, listener) {
    const off = this.on(event, (payload, name) => {
      off();
      listener(payload, name);
    });
    return off;
  }

  off(event, listener) {
    const set = this.#listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.#listeners.delete(event);
  }

  /** Emit synchronously. Listeners added or removed during emit do not affect this emit. */
  emit(event, payload) {
    const set = this.#listeners.get(event);
    if (!set) return 0;
    const listeners = [...set];
    for (const listener of listeners) listener(payload, event);
    return listeners.length;
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.size ?? 0;
  }
}
