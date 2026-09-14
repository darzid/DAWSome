/**
 * Value types for the parameter matrix.
 *
 * A type says what a parameter accepts and how a raw value (a slider string, a
 * preset entry, a value read back from Tone) becomes the value the matrix
 * stores. Types are deliberately permissive: the app has to keep working with
 * preset values that fall outside the declared range or the declared enum
 * (`"square4"` for an oscillator type) and with Tone time strings (`"8n"`)
 * used as the value of a number-typed parameter. Coercion therefore only
 * converts what it recognises and passes everything else through unchanged;
 * clamping is a separate step that only the UI applies to user input.
 */

/**
 * True for a string that `Number()` turns into a finite number.
 * `""` is rejected so an empty text field does not become `0`, and Tone time
 * strings such as `"8n"` or `"4t"` are rejected because they are NaN.
 * @param {*} value
 * @returns {boolean}
 */
function isNumericString(value) {
  return typeof value === "string" && value !== "" && Number.isFinite(Number(value));
}

/**
 * A numeric parameter with an optional range and UI step.
 *
 * `min` and `max` are kept exactly as given, so a type counts as bounded only
 * when both bounds are finite numbers.
 */
export class NumberType {
  /** @type {"number"} */
  kind = "number";

  /**
   * @param {object} [options]
   * @param {string} [options.name="number"] Name of the unit type, e.g. "Decibels".
   * @param {number} [options.min=-Infinity] Lower bound.
   * @param {number} [options.max=Infinity] Upper bound.
   * @param {number|null} [options.step=null] UI step, `null` when unspecified.
   */
  constructor({ name = "number", min = -Infinity, max = Infinity, step = null } = {}) {
    this.name = name;
    this.min = min;
    this.max = max;
    this.step = step;
  }

  /**
   * Numbers pass through, numeric strings become numbers, everything else
   * (Tone time strings such as `"8n"`, `null`, objects) is returned unchanged.
   * @param {*} value
   * @returns {*}
   */
  coerce(value) {
    if (typeof value === "number") return value;
    if (isNumericString(value)) return Number(value);
    return value;
  }

  /**
   * Restrict a number to [min, max]. Non-numbers are returned unchanged.
   * Only the UI clamps; the matrix stores what it is given.
   * @param {*} value
   * @returns {*}
   */
  clamp(value) {
    if (typeof value !== "number") return value;
    return Math.min(Math.max(value, this.min), this.max);
  }

  /** @returns {boolean} True when both bounds are finite and the range can be normalized. */
  get bounded() {
    return Number.isFinite(this.min) && Number.isFinite(this.max);
  }

  /**
   * Position of a value inside the range, normally 0..1. Returns `null` when
   * the type is unbounded or the value is not a number. A value outside the
   * range normalizes outside 0..1, because the matrix never clamps values.
   * @param {*} value
   * @returns {number|null}
   */
  normalize(value) {
    if (!this.bounded || typeof value !== "number") return null;
    return (value - this.min) / (this.max - this.min);
  }

  /**
   * Inverse of {@link NumberType#normalize}.
   * @param {number} normalized Position inside the range, 0..1.
   * @returns {number}
   */
  denormalize(normalized) {
    if (!this.bounded) throw new Error(`Number type "${this.name}" is unbounded and cannot denormalize.`);
    return this.min + normalized * (this.max - this.min);
  }
}

/**
 * A parameter whose value is picked from a list.
 *
 * The list is advisory: presets ship values that are not in it (`"square4"`,
 * `"sine3"`), so `includes()` is a question, never a gate.
 */
export class EnumType {
  /** @type {"enum"} */
  kind = "enum";

  /**
   * @param {object} options
   * @param {string} options.name Name of the enum type, e.g. "OscillatorType".
   * @param {Array<string|number>} options.values Suggested values.
   */
  constructor({ name, values } = {}) {
    if (!Array.isArray(values)) throw new Error(`Enum type "${name}" needs an array of values.`);
    this.name = name;
    this.values = values;
  }

  /**
   * Whether a value is one of the listed values.
   * @param {*} value
   * @returns {boolean}
   */
  includes(value) {
    return this.values.includes(value);
  }

  /**
   * Numeric enums (rolloff: -12, -24, ...) accept the numeric strings a
   * `<select>` produces; every other value is returned unchanged.
   * @param {*} value
   * @returns {*}
   */
  coerce(value) {
    if (this.values.every((candidate) => typeof candidate === "number") && isNumericString(value)) {
      return Number(value);
    }
    return value;
  }
}

/** An on/off parameter, such as a track mute. */
export class BooleanType {
  /** @type {"boolean"} */
  kind = "boolean";

  /** @type {string} */
  name = "boolean";

  /**
   * Accepts the checkbox and attribute spellings of true; anything else is false.
   * @param {*} value
   * @returns {boolean}
   */
  coerce(value) {
    return value === true || value === "true" || value === 1;
  }
}

/** A free-text parameter. */
export class StringType {
  /** @type {"string"} */
  kind = "string";

  /** @type {string} */
  name = "string";

  /**
   * @param {*} value
   * @returns {string}
   */
  coerce(value) {
    return String(value);
  }
}

/**
 * Guess a type from a live value, for parameters that exist on a Tone node but
 * are not described by devices.json.
 *
 * Returns `null` for anything that is not a primitive (arrays, objects,
 * functions, `null`, `undefined`), which marks the value as "not a parameter"
 * so the caller can skip it.
 * @param {*} value
 * @returns {NumberType|StringType|BooleanType|null}
 */
export function inferType(value) {
  if (typeof value === "number") return new NumberType({ name: "inferred" });
  if (typeof value === "string") return new StringType();
  if (typeof value === "boolean") return new BooleanType();
  return null;
}
