import { Parameter } from "./Parameter.js";
import { flatten, hasPrefix, joinPath, unflatten, SEP } from "./paths.js";

/**
 * Walk a nested object of initial values along a path of segments.
 * @param {*} values
 * @param {string[]} path
 * @returns {*} The value at the path, or `undefined` when the path is absent.
 */
function lookupValue(values, path) {
  let cursor = values;
  for (const segment of path) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/**
 * Strip a prefix from an address, giving the remainder relative to it.
 * @param {string} address
 * @param {string} prefix
 * @returns {string} `""` when the address is the prefix itself.
 */
function relativeAddress(address, prefix) {
  if (prefix === "") return address;
  if (address === prefix) return "";
  return address.slice(prefix.length + SEP.length);
}

/**
 * The registry of every live parameter in the app.
 *
 * Track channel strips and device parameters are registered here, typed from
 * devices.json or inferred from the live Tone node, and everything else talks
 * to parameters through their addresses: presets are applied through the
 * matrix, engine values are mirrored into it, and the UI is generated from it.
 * Listeners can subscribe to the whole matrix or to one address prefix, which
 * is what lets a device panel watch just its own device.
 *
 * The matrix holds no DOM, no Tone node and no event bus; the Project module
 * forwards its changes onto the bus.
 */
export class ParameterMatrix {
  /** @type {Map<string, Parameter>} Registration order is preserved. */
  #parameters = new Map();

  /** @type {Map<string, () => void>} Per parameter unsubscribe from its own change notifications. */
  #subscriptions = new Map();

  /** @type {Set<{ listener: Function, prefix: string }>} */
  #listeners = new Set();

  /**
   * Register one parameter.
   * @param {object} options
   * @param {string} options.address Full address, e.g. `track/1/volume`.
   * @param {object} options.type A type from `types.js`.
   * @param {string} [options.label] Defaults to the last address segment.
   * @param {boolean} [options.inferred=false] True when the type was guessed from a live value.
   * @param {*} [options.value] Initial value; left unset when `undefined`.
   * @returns {Parameter}
   */
  register({ address, type, label, inferred = false, value } = {}) {
    if (this.#parameters.has(address)) throw new Error(`Parameter "${address}" is already registered.`);
    const parameter = new Parameter({ address, type, label, inferred, value });
    this.#parameters.set(parameter.address, parameter);
    this.#subscriptions.set(parameter.address, parameter.onChange((change) => this.#notify(change)));
    return parameter;
  }

  /**
   * Register every leaf of a schema tree under an address prefix, so a group
   * with an `envelope/attack` leaf registered under `device/3` becomes
   * `device/3/envelope/attack`.
   * @param {string} prefix Address prefix, e.g. `device/3` or `track/1`.
   * @param {import("./ParameterGroup.js").ParameterGroup} group
   * @param {object} [values={}] Nested initial values, looked up along each leaf's path.
   * @returns {Parameter[]} The parameters created, in leaf order.
   */
  registerGroup(prefix, group, values = {}) {
    if (!group || typeof group.leaves !== "function") {
      throw new Error(`Cannot register a group at "${prefix}": a ParameterGroup is required.`);
    }
    const registered = [];
    for (const { path, descriptor } of group.leaves()) {
      registered.push(this.register({
        address: joinPath(prefix, path),
        type: descriptor.type,
        label: descriptor.label,
        inferred: false,
        value: lookupValue(values, path),
      }));
    }
    return registered;
  }

  /**
   * @param {string} address
   * @returns {boolean}
   */
  has(address) {
    return this.#parameters.has(address);
  }

  /**
   * @param {string} address
   * @returns {Parameter|undefined}
   */
  get(address) {
    return this.#parameters.get(address);
  }

  /**
   * Like {@link ParameterMatrix#get}, but fails loudly on an unknown address.
   * @param {string} address
   * @returns {Parameter}
   */
  require(address) {
    const parameter = this.#parameters.get(address);
    if (!parameter) throw new Error(`Unknown parameter "${address}".`);
    return parameter;
  }

  /**
   * Current value at an address.
   * @param {string} address
   * @returns {*} `undefined` when the parameter is unset or unknown.
   */
  value(address) {
    return this.#parameters.get(address)?.value;
  }

  /**
   * Set the value at an address.
   * @param {string} address
   * @param {*} value
   * @param {"engine"|"ui"|"preset"|null} [origin=null]
   * @returns {boolean} True when the value changed.
   */
  set(address, value, origin = null) {
    return this.require(address).set(value, origin);
  }

  /**
   * Remove one parameter and stop listening to it.
   * @param {string} address
   * @returns {boolean} True when a parameter was removed.
   */
  release(address) {
    if (!this.#parameters.has(address)) return false;
    const unsubscribe = this.#subscriptions.get(address);
    if (unsubscribe) unsubscribe();
    this.#subscriptions.delete(address);
    this.#parameters.delete(address);
    return true;
  }

  /**
   * Remove every parameter under a prefix, used when a track or device goes away.
   * @param {string} prefix
   * @returns {number} How many parameters were removed.
   */
  releasePrefix(prefix) {
    let released = 0;
    for (const address of [...this.#parameters.keys()]) {
      if (hasPrefix(address, prefix) && this.release(address)) released += 1;
    }
    return released;
  }

  /**
   * Every parameter under a prefix, in registration order.
   * @param {string} [prefix=""] The empty prefix lists the whole matrix.
   * @returns {Parameter[]}
   */
  list(prefix = "") {
    return [...this.#parameters.values()].filter((parameter) => hasPrefix(parameter.address, prefix));
  }

  /**
   * The values under a prefix as a nested object, relative to that prefix, so
   * `snapshot("device/3")` gives `{ envelope: { attack: 0.01 } }`. Parameters
   * that were never set are left out.
   * @param {string} [prefix=""]
   * @returns {Object<string, *>}
   */
  snapshot(prefix = "") {
    const flat = {};
    for (const parameter of this.list(prefix)) {
      if (!parameter.isSet) continue;
      const relative = relativeAddress(parameter.address, prefix);
      if (relative === "") continue;
      flat[relative] = parameter.value;
    }
    return unflatten(flat);
  }

  /**
   * Apply a nested object of values under a prefix — how a preset reaches the
   * matrix. Paths that have no parameter are reported rather than created,
   * because a preset may name parameters the device does not have.
   * @param {string} prefix
   * @param {object} nested Nested values, relative to the prefix.
   * @param {"engine"|"ui"|"preset"|null} [origin=null]
   * @returns {{ applied: string[], unknown: string[] }} Full addresses, written and skipped.
   */
  apply(prefix, nested, origin = null) {
    const applied = [];
    const unknown = [];
    for (const [path, value] of Object.entries(flatten(nested))) {
      const address = joinPath(prefix, path);
      const parameter = this.#parameters.get(address);
      if (!parameter) {
        unknown.push(address);
        continue;
      }
      parameter.set(value, origin);
      applied.push(address);
    }
    return { applied, unknown };
  }

  /**
   * Listen for changes to any parameter under a prefix.
   * @param {(change: { parameter: Parameter, value: *, previous: *, origin: (string|null) }) => void} listener
   * @param {string} [prefix=""] The empty prefix listens to the whole matrix.
   * @returns {() => void} Unsubscribe.
   */
  onChange(listener, prefix = "") {
    if (typeof listener !== "function") throw new TypeError(`Listener for prefix "${prefix}" must be a function.`);
    const entry = { listener, prefix };
    this.#listeners.add(entry);
    return () => this.#listeners.delete(entry);
  }

  /** @returns {number} How many parameters are registered. */
  get size() {
    return this.#parameters.size;
  }

  /**
   * Fan one parameter's change out to the matrix listeners watching it.
   * @param {{ parameter: Parameter, value: *, previous: *, origin: (string|null) }} change
   */
  #notify(change) {
    for (const { listener, prefix } of [...this.#listeners]) {
      if (hasPrefix(change.parameter.address, prefix)) listener(change);
    }
  }
}
