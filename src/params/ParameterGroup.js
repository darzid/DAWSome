/**
 * The shape of a set of parameters, before any of them is live.
 *
 * A schema (devices.json, a track channel strip) is described as a tree of
 * `ParameterGroup`s whose leaves are `ParameterDescriptor`s. The tree carries
 * no values and no addresses: `ParameterMatrix.registerGroup(prefix, group)`
 * walks the leaves and turns each one into a live `Parameter` addressed by the
 * prefix plus the leaf's path through the tree.
 */

/** One leaf of a schema tree: the name, type and label of a single parameter. */
export class ParameterDescriptor {
  /**
   * @param {object} options
   * @param {string} options.name Key of this parameter inside its group, e.g. "attack".
   * @param {object} options.type A type from `types.js`.
   * @param {string} [options.label=name] Human readable label for the UI.
   */
  constructor({ name, type, label = name } = {}) {
    if (!type) throw new Error(`Parameter descriptor "${name}" needs a type.`);
    this.name = name;
    this.type = type;
    this.label = label;
  }
}

/** A named branch of a schema tree, holding descriptors and nested groups. */
export class ParameterGroup {
  /**
   * @param {string} [name=""] Key of this group inside its parent, e.g. "envelope".
   *   Descriptive only: a leaf is addressed by the keys it was added under.
   */
  constructor(name = "") {
    this.name = name;
    /** @type {Map<string, ParameterGroup|ParameterDescriptor>} */
    this.children = new Map();
  }

  /**
   * Add a child under a key. The key, not the child's own name, is the path
   * segment used when the group is registered.
   * @param {string} name
   * @param {ParameterGroup|ParameterDescriptor} child
   * @returns {ParameterGroup|ParameterDescriptor} The child, for chaining.
   */
  add(name, child) {
    if (typeof name !== "string" || name === "") throw new Error(`Group "${this.name}" needs a non-empty name for its child.`);
    if (child === null || child === undefined) throw new Error(`Group "${this.name}" got no child for "${name}".`);
    if (this.children.has(name)) throw new Error(`Group "${this.name}" already has a child named "${name}".`);
    this.children.set(name, child);
    return child;
  }

  /**
   * @param {string} name
   * @returns {ParameterGroup|ParameterDescriptor|undefined}
   */
  get(name) {
    return this.children.get(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.children.has(name);
  }

  /**
   * Walk the tree depth first, in insertion order, yielding every descriptor
   * together with its path from this group.
   * @param {string[]} [prefix=[]] Path segments prepended to every yielded path.
   * @yields {{ path: string[], descriptor: ParameterDescriptor }}
   */
  *leaves(prefix = []) {
    for (const [name, child] of this.children) {
      const path = [...prefix, name];
      if (child instanceof ParameterGroup) yield* child.leaves(path);
      else yield { path, descriptor: child };
    }
  }

  /**
   * Follow a path of segments through the tree.
   * @param {string[]} path Segments, e.g. `["envelope", "attack"]`. Empty returns this group.
   * @returns {ParameterGroup|ParameterDescriptor|undefined} `undefined` when the path does not exist.
   */
  resolve(path) {
    let current = this;
    for (const segment of path) {
      if (!(current instanceof ParameterGroup)) return undefined;
      current = current.children.get(segment);
      if (current === undefined) return undefined;
    }
    return current;
  }
}
