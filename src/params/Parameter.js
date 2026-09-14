import { splitPath } from "./paths.js";

/**
 * One live, addressable value.
 *
 * A parameter owns its current value and notifies its listeners whenever the
 * value actually changes. Every change carries an `origin` so the listeners can
 * tell who moved it: `"engine"` (mirrored back from Tone), `"ui"` (a widget),
 * `"preset"`, or `null` for a programmatic change. The audio engine ignores
 * changes whose origin is `"engine"`, which is what stops mirroring from
 * looping back into the node it came from.
 *
 * Values are never clamped here: presets legitimately carry values outside the
 * declared range, and Tone time strings such as `"8n"` appear as values of
 * number-typed parameters. `clamp()` exists for UI input only.
 */
export class Parameter {
  #address;
  #type;
  #label;
  #inferred;
  #value;
  #listeners = new Set();

  /**
   * @param {object} options
   * @param {string} options.address Full address, e.g. `device/3/envelope/attack`.
   * @param {object} options.type A type from `types.js`.
   * @param {string} [options.label] Defaults to the last address segment.
   * @param {boolean} [options.inferred=false] True when the type was guessed from a live value.
   * @param {*} [options.value] Initial value; left unset when `undefined`.
   */
  constructor({ address, type, label, inferred = false, value } = {}) {
    if (typeof address !== "string" || address === "") throw new Error("A parameter needs a non-empty string address.");
    if (!type) throw new Error(`Parameter "${address}" needs a type.`);
    this.#address = address;
    this.#type = type;
    this.#label = label ?? splitPath(address).at(-1);
    this.#inferred = Boolean(inferred);
    this.#value = value === undefined ? undefined : type.coerce(value);
  }

  /** @returns {string} Full address of this parameter. */
  get address() {
    return this.#address;
  }

  /** @returns {object} The type this parameter coerces through. */
  get type() {
    return this.#type;
  }

  /** @returns {string} Human readable label for the UI. */
  get label() {
    return this.#label;
  }

  /** @returns {boolean} True when the type was guessed from a live value rather than declared. */
  get inferred() {
    return this.#inferred;
  }

  /** @returns {*} The current value, `undefined` while unset. */
  get value() {
    return this.#value;
  }

  /** @returns {boolean} Whether this parameter has a value at all. */
  get isSet() {
    return this.#value !== undefined;
  }

  /**
   * Coerce and store a value, notifying listeners when it differs from the
   * current one.
   * @param {*} value
   * @param {"engine"|"ui"|"preset"|null} [origin=null] Who is changing it.
   * @returns {boolean} True when the value changed.
   */
  set(value, origin = null) {
    const next = this.#type.coerce(value);
    const previous = this.#value;
    if (Object.is(next, previous)) return false;
    this.#value = next;
    const change = { parameter: this, value: next, previous, origin };
    for (const listener of [...this.#listeners]) listener(change);
    return true;
  }

  /**
   * Restrict a candidate value to the type's range, for UI input. Types without
   * a range return the value unchanged.
   * @param {*} value
   * @returns {*}
   */
  clamp(value) {
    return this.#type.clamp ? this.#type.clamp(value) : value;
  }

  /** @returns {number|null} The current value as 0..1, or `null` when the type cannot normalize. */
  get normalized() {
    return this.#type.normalize ? this.#type.normalize(this.#value) : null;
  }

  /**
   * Set the value from a normalized 0..1 position.
   * @param {number} normalized
   * @param {"engine"|"ui"|"preset"|null} [origin=null]
   * @returns {boolean} True when the value changed.
   */
  setNormalized(normalized, origin = null) {
    if (typeof this.#type.denormalize !== "function") {
      throw new Error(`Parameter "${this.#address}" has type "${this.#type.name}", which cannot denormalize.`);
    }
    return this.set(this.#type.denormalize(normalized), origin);
  }

  /**
   * Listen for changes to this parameter.
   * @param {(change: { parameter: Parameter, value: *, previous: *, origin: (string|null) }) => void} listener
   * @returns {() => void} Unsubscribe.
   */
  onChange(listener) {
    if (typeof listener !== "function") throw new TypeError(`Listener for parameter "${this.#address}" must be a function.`);
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * @returns {{ address: string, value: *, type: string, kind: string }} Serializable form.
   */
  toJSON() {
    return { address: this.#address, value: this.#value, type: this.#type.name, kind: this.#type.kind };
  }
}
