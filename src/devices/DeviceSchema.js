import { EnumType, NumberType } from "../params/types.js";
import { ParameterDescriptor, ParameterGroup } from "../params/ParameterGroup.js";

/** Section names of devices.json, also used as reference prefixes. */
const UNIT_TYPES = "unitTypes";
const ENUM_TYPES = "enumTypes";
const MODULES = "modules";
const DEVICES = "devices";

/** Separator between the section and the target name of a reference. */
const REF_SEP = "/";

/** Bound value meaning "unbounded" in a unit type. */
const ANY_BOUND = "any";

/** The two device categories used by devices.json (`type`). */
const CATEGORIES = ["Instrument", "Effect"];

/**
 * Narrows a JSON value to a plain object, failing loudly otherwise.
 *
 * @param {unknown} value Value taken from the parsed JSON.
 * @param {string} describe What the value is, used in the error message.
 * @returns {Record<string, unknown>} The value, typed as an object.
 */
function asObject(value, describe) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${describe} must be a JSON object.`);
  }
  return value;
}

/**
 * Reads one numeric field of a unit type.
 *
 * Accepts numbers and numeric strings (devices.json writes `"16777215"`), and
 * the literal `"any"` where an unbounded value is allowed.
 *
 * @param {unknown} value Raw JSON value.
 * @param {string} unitTypeName Unit type the value belongs to.
 * @param {string} field Field name (`"min"`, `"max"` or `"step"`).
 * @param {number|null} whenAny Value to use for `"any"`, or null when `"any"` is not allowed.
 * @returns {number} The parsed number.
 */
function parseUnitNumber(value, unitTypeName, field, whenAny) {
  if (value === ANY_BOUND) {
    if (whenAny === null) {
      throw new Error(`Unit type "${unitTypeName}" cannot use "${ANY_BOUND}" for "${field}".`);
    }
    return whenAny;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Unit type "${unitTypeName}" has an invalid "${field}": ${JSON.stringify(value)}.`);
}

/**
 * The typed parameter schema of one device (one entry of the `devices`
 * section of devices.json).
 *
 * The parameters form a {@link ParameterGroup} tree: leaves are
 * {@link ParameterDescriptor}s carrying a NumberType or EnumType, nested
 * groups are the referenced modules and devices (`DuoSynth.voice0` is the
 * parameter group of `MonoSynth`).
 */
export class DeviceSchema {
  #name;
  #category;
  #parameters;

  /**
   * @param {object} spec
   * @param {string} spec.name Device name, e.g. `"MonoSynth"`.
   * @param {string} spec.category `"Instrument"` or `"Effect"` (devices.json `type`).
   * @param {ParameterGroup} spec.parameters Resolved parameter tree.
   */
  constructor({ name, category, parameters }) {
    if (typeof name !== "string" || name === "") {
      throw new Error("A device schema needs a non-empty name.");
    }
    if (!CATEGORIES.includes(category)) {
      throw new Error(
        `Device "${name}" has an unknown category ${JSON.stringify(category)}; expected ${CATEGORIES.join(" or ")}.`
      );
    }
    if (!(parameters instanceof ParameterGroup)) {
      throw new Error(`Device "${name}" needs a ParameterGroup of parameters.`);
    }
    this.#name = name;
    this.#category = category;
    this.#parameters = parameters;
  }

  /** @returns {string} Device name, identical to the Tone.js class name. */
  get name() {
    return this.#name;
  }

  /** @returns {string} `"Instrument"` or `"Effect"`. */
  get category() {
    return this.#category;
  }

  /** @returns {ParameterGroup} Root of the device's parameter tree. */
  get parameters() {
    return this.#parameters;
  }
}

/**
 * Everything devices.json declares: unit types, enum types, reusable modules
 * and the devices themselves, with every parameter reference resolved.
 */
export class DeviceSchemaSet {
  #unitTypes;
  #enumTypes;
  #modules;
  #devices;

  /**
   * @param {object} [spec]
   * @param {Map<string, NumberType>|Iterable<[string, NumberType]>} [spec.unitTypes] Unit types by name.
   * @param {Map<string, EnumType>|Iterable<[string, EnumType]>} [spec.enumTypes] Enum types by name.
   * @param {Map<string, ParameterGroup>|Iterable<[string, ParameterGroup]>} [spec.modules] Module groups by name.
   * @param {Map<string, DeviceSchema>|Iterable<[string, DeviceSchema]>} [spec.devices] Device schemas by name, in JSON order.
   */
  constructor({ unitTypes, enumTypes, modules, devices } = {}) {
    this.#unitTypes = new Map(unitTypes ?? []);
    this.#enumTypes = new Map(enumTypes ?? []);
    this.#modules = new Map(modules ?? []);
    this.#devices = new Map(devices ?? []);
  }

  /**
   * Parses the devices.json document into a schema set.
   *
   * Unit types become NumberTypes (`"any"` bounds become -Infinity / +Infinity, numeric
   * strings are converted), enum types become EnumTypes, and every parameter
   * reference (`unitTypes/X`, `enumTypes/X`, `modules/X`, `devices/X`) is
   * resolved. Module and device groups are resolved once and shared; a
   * reference cycle fails loudly instead of recursing forever.
   *
   * @param {object} json Parsed devices.json.
   * @returns {DeviceSchemaSet} The resolved schema set.
   */
  static fromJson(json) {
    const root = asObject(json, "devices.json");

    const unitTypes = new Map();
    for (const [name, def] of Object.entries(asObject(root.unitTypes ?? {}, 'devices.json "unitTypes"'))) {
      const spec = asObject(def, `Unit type "${name}"`);
      unitTypes.set(
        name,
        new NumberType({
          name,
          min: parseUnitNumber(spec.min, name, "min", -Infinity),
          max: parseUnitNumber(spec.max, name, "max", Infinity),
          step: parseUnitNumber(spec.step, name, "step", null),
        })
      );
    }

    const enumTypes = new Map();
    for (const [name, def] of Object.entries(asObject(root.enumTypes ?? {}, 'devices.json "enumTypes"'))) {
      const spec = asObject(def, `Enum type "${name}"`);
      if (!Array.isArray(spec.values)) {
        throw new Error(`Enum type "${name}" needs a "values" array.`);
      }
      enumTypes.set(name, new EnumType({ name, values: [...spec.values] }));
    }

    const moduleDefs = asObject(root.modules ?? {}, 'devices.json "modules"');
    const deviceDefs = asObject(root.devices ?? {}, 'devices.json "devices"');

    /** Resolved groups by reference (`"modules/Filter"`), so each is built once. */
    const groups = new Map();
    /** References currently being resolved, for cycle detection. */
    const visiting = [];

    /**
     * Resolves one parameter reference into a group child.
     *
     * @param {unknown} ref Reference string from the JSON.
     * @param {string} owner Reference of the module or device declaring it.
     * @param {string} paramName Parameter name the reference is bound to.
     * @returns {ParameterDescriptor|ParameterGroup} Leaf descriptor or nested group.
     */
    function resolveRef(ref, owner, paramName) {
      if (typeof ref !== "string") {
        throw new Error(
          `Parameter "${paramName}" in "${owner}" must reference a type by name, got ${JSON.stringify(ref)}.`
        );
      }
      const sep = ref.indexOf(REF_SEP);
      const kind = sep === -1 ? "" : ref.slice(0, sep);
      const target = sep === -1 ? "" : ref.slice(sep + 1);
      switch (kind) {
        case UNIT_TYPES: {
          const type = unitTypes.get(target);
          if (!type) {
            throw new Error(`Parameter reference "${ref}" in "${owner}" names an unknown unit type "${target}".`);
          }
          return new ParameterDescriptor({ name: paramName, type });
        }
        case ENUM_TYPES: {
          const type = enumTypes.get(target);
          if (!type) {
            throw new Error(`Parameter reference "${ref}" in "${owner}" names an unknown enum type "${target}".`);
          }
          return new ParameterDescriptor({ name: paramName, type });
        }
        case MODULES:
        case DEVICES:
          return resolveGroup(kind, target, owner);
        default:
          throw new Error(`Unknown parameter reference "${ref}" in "${owner}".`);
      }
    }

    /**
     * Builds the parameter group of one module or device.
     *
     * @param {string} groupName Name given to the group.
     * @param {unknown} parameters The `parameters` object of the definition.
     * @param {string} owner Reference of the definition, used in errors.
     * @returns {ParameterGroup} The group with all children resolved.
     */
    function buildGroup(groupName, parameters, owner) {
      const group = new ParameterGroup(groupName);
      for (const [paramName, ref] of Object.entries(asObject(parameters, `Parameters of "${owner}"`))) {
        group.add(paramName, resolveRef(ref, owner, paramName));
      }
      return group;
    }

    /**
     * Resolves (and memoises) the parameter group of a module or device.
     *
     * @param {string} kind `"modules"` or `"devices"`.
     * @param {string} name Name of the referenced module or device.
     * @param {string} referencedBy Reference of the definition that asked for it.
     * @returns {ParameterGroup} The shared group instance.
     */
    function resolveGroup(kind, name, referencedBy) {
      const ref = `${kind}${REF_SEP}${name}`;
      const cached = groups.get(ref);
      if (cached) return cached;

      const cycleStart = visiting.indexOf(ref);
      if (cycleStart !== -1) {
        throw new Error(`Parameter reference cycle: ${[...visiting.slice(cycleStart), ref].join(" -> ")}.`);
      }

      const defs = kind === MODULES ? moduleDefs : deviceDefs;
      if (!Object.hasOwn(defs, name)) {
        const what = kind === MODULES ? "module" : "device";
        throw new Error(`Parameter reference "${ref}" in "${referencedBy}" names an unknown ${what} "${name}".`);
      }

      visiting.push(ref);
      try {
        const def = asObject(defs[name], `Definition of "${ref}"`);
        const group = buildGroup(name, def.parameters ?? {}, ref);
        groups.set(ref, group);
        return group;
      } finally {
        visiting.pop();
      }
    }

    const modules = new Map();
    for (const name of Object.keys(moduleDefs)) {
      modules.set(name, resolveGroup(MODULES, name, `${MODULES}${REF_SEP}${name}`));
    }

    const devices = new Map();
    for (const name of Object.keys(deviceDefs)) {
      const def = asObject(deviceDefs[name], `Definition of "${DEVICES}${REF_SEP}${name}"`);
      devices.set(
        name,
        new DeviceSchema({
          name,
          category: def.type,
          parameters: resolveGroup(DEVICES, name, `${DEVICES}${REF_SEP}${name}`),
        })
      );
    }

    return new DeviceSchemaSet({ unitTypes, enumTypes, modules, devices });
  }

  /**
   * @param {string} name Device name.
   * @returns {DeviceSchema} The schema of that device.
   */
  get(name) {
    const schema = this.#devices.get(name);
    if (!schema) throw new Error(`Unknown device "${name}".`);
    return schema;
  }

  /**
   * @param {string} name Device name.
   * @returns {boolean} True when the device is declared.
   */
  has(name) {
    return this.#devices.has(name);
  }

  /**
   * @param {string} [category] `"Instrument"` or `"Effect"`; omit for all devices.
   * @returns {DeviceSchema[]} Matching schemas in devices.json order.
   */
  list(category) {
    const all = [...this.#devices.values()];
    if (category === undefined || category === null) return all;
    if (!CATEGORIES.includes(category)) {
      throw new Error(`Unknown device category ${JSON.stringify(category)}; expected ${CATEGORIES.join(" or ")}.`);
    }
    return all.filter((schema) => schema.category === category);
  }

  /**
   * @param {string} name Unit type name, e.g. `"NormalRange"`.
   * @returns {NumberType} The numeric type.
   */
  unitType(name) {
    const type = this.#unitTypes.get(name);
    if (!type) throw new Error(`Unknown unit type "${name}".`);
    return type;
  }

  /**
   * @param {string} name Enum type name, e.g. `"OscillatorType"`.
   * @returns {EnumType} The enum type.
   */
  enumType(name) {
    const type = this.#enumTypes.get(name);
    if (!type) throw new Error(`Unknown enum type "${name}".`);
    return type;
  }

  /**
   * @param {string} name Module name, e.g. `"AmplitudeEnvelope"`.
   * @returns {ParameterGroup} The shared parameter group of that module.
   */
  module(name) {
    const group = this.#modules.get(name);
    if (!group) throw new Error(`Unknown module "${name}".`);
    return group;
  }
}
