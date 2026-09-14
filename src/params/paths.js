/**
 * Address arithmetic for the parameter matrix.
 *
 * Every live parameter has one flat, printable address made of segments joined
 * by `/`: `<owner>/<id>/<path...>`, for example `track/2/volume` or
 * `device/3/envelope/attack`. Nested structures — a devices.json parameter
 * tree, a preset body, the object returned by a Tone node's `get()` — are
 * flattened into such addresses on the way in and nested again on the way out.
 */

/** Address segment separator. */
export const SEP = "/";

/**
 * True for `{}`-style objects, which flatten/unflatten treat as branches.
 * Arrays, `null`, functions and class instances are leaves.
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Join address parts, flattening nested arrays and dropping empty and nullish
 * parts, so `joinPath("device/3", ["envelope", "attack"])` is
 * `"device/3/envelope/attack"` and `joinPath("", "volume")` is `"volume"`.
 * @param {...(string|number|Array<string|number>)} parts
 * @returns {string}
 */
export function joinPath(...parts) {
  return parts
    .flat(Infinity)
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(SEP);
}

/**
 * Split an address into its segments. Empty segments are dropped, so
 * `splitPath("")` is `[]` and `joinPath(splitPath(a))` gives `a` back.
 * @param {string} address
 * @returns {string[]}
 */
export function splitPath(address) {
  if (address === null || address === undefined) return [];
  return String(address).split(SEP).filter((segment) => segment !== "");
}

/**
 * Flatten a nested object into `{ "envelope/attack": 0.01 }`.
 *
 * Plain objects are recursed into; arrays, `null`, functions and primitives are
 * leaves. A non-object `nested` yields `{}` when there is no prefix to key it
 * under.
 * @param {*} nested
 * @param {string} [prefix=""] Address prepended to every key.
 * @returns {Object<string, *>}
 */
export function flatten(nested, prefix = "") {
  const flat = {};
  const walk = (value, path) => {
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, joinPath(path, key));
      return;
    }
    if (path === "") return;
    flat[path] = value;
  };
  walk(nested, prefix);
  return flat;
}

/**
 * Build the nested object holding one value, so `nest("envelope/attack", 0.01)`
 * is `{ envelope: { attack: 0.01 } }`.
 * @param {string} path
 * @param {*} value
 * @returns {Object<string, *>}
 */
export function nest(path, value) {
  const segments = splitPath(path);
  if (segments.length === 0) throw new Error(`Cannot nest a value under the empty path "${path}".`);
  const root = {};
  let cursor = root;
  for (const segment of segments.slice(0, -1)) {
    cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
  return root;
}

/**
 * Inverse of {@link flatten}: rebuild the nested object from flat entries.
 * Throws when two entries collide — when one would have to nest inside
 * another's leaf value, or would overwrite the branch another nested into —
 * in whichever order the two entries arrive.
 * @param {Object<string, *>} flat
 * @returns {Object<string, *>}
 */
export function unflatten(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const segments = splitPath(path);
    if (segments.length === 0) throw new Error(`Cannot unflatten the entry with the empty path "${path}".`);
    let cursor = root;
    for (const [index, segment] of segments.slice(0, -1).entries()) {
      const branch = cursor[segment];
      if (branch === undefined) cursor[segment] = {};
      else if (!isPlainObject(branch)) {
        throw new Error(`Path "${path}" conflicts with the value already at "${segments.slice(0, index + 1).join(SEP)}".`);
      }
      cursor = cursor[segment];
    }
    const last = segments[segments.length - 1];
    if (isPlainObject(cursor[last])) {
      throw new Error(`Path "${path}" conflicts with the values already nested under "${path}".`);
    }
    cursor[last] = value;
  }
  return root;
}

/**
 * Whether an address lies under a prefix. The empty prefix matches everything,
 * and a prefix matches the address that equals it as well as its descendants.
 * @param {string} address
 * @param {string} prefix
 * @returns {boolean}
 */
export function hasPrefix(address, prefix) {
  if (prefix === "") return true;
  return address === prefix || String(address).startsWith(prefix + SEP);
}
