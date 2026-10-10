// Unit tests for the parameter matrix package (src/params).
//
// Covers the value types (coercion, clamping, normalisation), the path helpers
// (flatten / nest / unflatten / hasPrefix), the descriptor tree (ParameterGroup),
// a single live Parameter (change notification, normalised access) and the
// ParameterMatrix itself (registration, listing, snapshot/apply, subscriptions
// and release). Pure logic only - nothing here touches the DOM or Tone.js.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { NumberType, EnumType, BooleanType, StringType, inferType } from "../src/params/types.js";
import { SEP, joinPath, splitPath, flatten, nest, unflatten, hasPrefix } from "../src/params/paths.js";
import { ParameterDescriptor, ParameterGroup } from "../src/params/ParameterGroup.js";
import { Parameter } from "../src/params/Parameter.js";
import { ParameterMatrix } from "../src/params/ParameterMatrix.js";

const decibels = () => new NumberType({ name: "Decibels", min: -60, max: 0, step: 0.01 });
const adr = () => new NumberType({ name: "AdrRange", min: 0, max: 2, step: 0.001 });

describe("NumberType", () => {
  test("describes itself", () => {
    const type = decibels();
    assert.equal(type.kind, "number");
    assert.equal(type.name, "Decibels");
    assert.equal(type.min, -60);
    assert.equal(type.max, 0);
    assert.equal(type.step, 0.01);
  });

  test("defaults are unbounded", () => {
    const type = new NumberType({});
    assert.equal(type.name, "number");
    assert.equal(type.min, -Infinity);
    assert.equal(type.max, Infinity);
    assert.equal(type.step, null);
  });

  test("coerce keeps numbers, converts numeric strings and leaves the rest alone", () => {
    const type = decibels();
    assert.equal(type.coerce(-12), -12);
    assert.equal(type.coerce("-12"), -12);
    assert.equal(type.coerce("0.5"), 0.5);
    assert.equal(type.coerce("8n"), "8n"); // Tone.js note values stay strings
    assert.equal(type.coerce(true), true);
  });

  test("clamp bounds numbers and passes anything else through", () => {
    const type = decibels();
    assert.equal(type.clamp(-12), -12);
    assert.equal(type.clamp(10), 0);
    assert.equal(type.clamp(-100), -60);
    assert.equal(type.clamp("8n"), "8n");
  });

  test("bounded reports whether both ends are finite", () => {
    assert.equal(decibels().bounded, true);
    assert.equal(new NumberType({}).bounded, false);
    assert.equal(new NumberType({ min: 0 }).bounded, false);
  });

  test("normalize / denormalize round trip inside the bounds", () => {
    const type = decibels();
    assert.equal(type.normalize(-60), 0);
    assert.equal(type.normalize(-30), 0.5);
    assert.equal(type.normalize(0), 1);
    assert.equal(type.denormalize(0.5), -30);
    for (const value of [-60, -45, -30, -15, 0]) {
      assert.equal(type.denormalize(type.normalize(value)), value);
    }
  });

  test("normalize returns null when it cannot be computed", () => {
    assert.equal(new NumberType({}).normalize(5), null);
    assert.equal(decibels().normalize("8n"), null);
  });
});

describe("EnumType", () => {
  test("numeric enums coerce numeric strings", () => {
    const rolloff = new EnumType({ name: "Rolloff", values: [-12, -24] });
    assert.equal(rolloff.kind, "enum");
    assert.deepEqual(rolloff.values, [-12, -24]);
    assert.equal(rolloff.coerce("-24"), -24);
    assert.equal(rolloff.coerce(-12), -12);
    assert.equal(rolloff.includes(-24), true);
    assert.equal(rolloff.includes(-48), false);
  });

  test("string enums leave numeric strings alone", () => {
    const filter = new EnumType({ name: "FilterType", values: ["lowpass", "highpass"] });
    assert.equal(filter.coerce("-24"), "-24");
    assert.equal(filter.coerce("lowpass"), "lowpass");
    assert.equal(filter.includes("lowpass"), true);
    assert.equal(filter.includes("bandpass"), false);
  });
});

describe("BooleanType and StringType", () => {
  test("boolean coercion accepts true, \"true\" and 1 only", () => {
    const type = new BooleanType({});
    assert.equal(type.kind, "boolean");
    assert.equal(type.coerce(true), true);
    assert.equal(type.coerce("true"), true);
    assert.equal(type.coerce(1), true);
    assert.equal(type.coerce(false), false);
    assert.equal(type.coerce("false"), false);
    assert.equal(type.coerce(0), false);
    assert.equal(type.coerce("yes"), false);
    assert.equal(type.coerce(null), false);
  });

  test("string coercion stringifies", () => {
    const type = new StringType({});
    assert.equal(type.kind, "string");
    assert.equal(type.coerce("sine"), "sine");
    assert.equal(type.coerce(5), "5");
    assert.equal(type.coerce(true), "true");
  });
});

describe("inferType", () => {
  test("maps primitives to a type and everything else to null", () => {
    assert.equal(inferType(0.5).kind, "number");
    assert.ok(inferType(0.5) instanceof NumberType);
    assert.equal(inferType("sine").kind, "string");
    assert.ok(inferType("sine") instanceof StringType);
    assert.equal(inferType(true).kind, "boolean");
    assert.ok(inferType(true) instanceof BooleanType);

    assert.equal(inferType([1, 2]), null);
    assert.equal(inferType({}), null);
    assert.equal(inferType(null), null);
    assert.equal(inferType(undefined), null);
    assert.equal(inferType(() => {}), null);
  });
});

describe("paths", () => {
  test("join and split are inverses", () => {
    assert.equal(SEP, "/");
    assert.equal(joinPath("device", "1", "envelope", "attack"), "device/1/envelope/attack");
    assert.deepEqual(splitPath("device/1/envelope/attack"), ["device", "1", "envelope", "attack"]);
    assert.deepEqual(splitPath(joinPath("a", "b")), ["a", "b"]);
  });

  test("flatten treats arrays as leaves", () => {
    const nested = { volume: -8, envelope: { attack: 0.01, decay: 0.4 }, curve: [0, 1] };
    assert.deepEqual(flatten(nested), {
      "volume": -8,
      "envelope/attack": 0.01,
      "envelope/decay": 0.4,
      "curve": [0, 1],
    });
  });

  test("flatten honours a prefix", () => {
    assert.deepEqual(flatten({ envelope: { attack: 0.01 } }, "device/1"), {
      "device/1/envelope/attack": 0.01,
    });
  });

  test("nest builds a single branch", () => {
    assert.deepEqual(nest("envelope/attack", 0.01), { envelope: { attack: 0.01 } });
    assert.deepEqual(nest("volume", -8), { volume: -8 });
  });

  test("unflatten rebuilds the tree", () => {
    assert.deepEqual(unflatten({ "envelope/attack": 0.01, "envelope/decay": 0.4, "volume": -8 }), {
      envelope: { attack: 0.01, decay: 0.4 },
      volume: -8,
    });
  });

  test("flatten / unflatten round trip with arrays as leaves", () => {
    const nested = {
      volume: -8,
      oscillator: { type: "sawtooth", partials: [1, 0.5] },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.01 },
    };
    assert.deepEqual(unflatten(flatten(nested)), nested);
  });

  test("hasPrefix matches on whole segments", () => {
    assert.equal(hasPrefix("device/1/envelope/attack", "device"), true);
    assert.equal(hasPrefix("device/1/envelope/attack", "device/1"), true);
    assert.equal(hasPrefix("device/1/envelope/attack", "device/1/envelope"), true);
    assert.equal(hasPrefix("device/10/volume", "device/1"), false);
    assert.equal(hasPrefix("track/1/volume", "device/1"), false);
    assert.equal(hasPrefix("device/1/volume", ""), true);
  });
});

describe("ParameterGroup", () => {
  const buildSynth = () => {
    const group = new ParameterGroup("Synth");
    const envelope = new ParameterGroup("envelope");
    const volume = new ParameterDescriptor({ name: "volume", type: decibels(), label: "Volume" });
    const attack = new ParameterDescriptor({ name: "attack", type: adr(), label: "Attack" });
    const decay = new ParameterDescriptor({ name: "decay", type: adr(), label: "Decay" });
    envelope.add("attack", attack);
    envelope.add("decay", decay);
    group.add("volume", volume);
    group.add("envelope", envelope);
    return { group, envelope, volume, attack, decay };
  };

  test("descriptors keep their name, type and label", () => {
    const type = decibels();
    const descriptor = new ParameterDescriptor({ name: "volume", type, label: "Volume" });
    assert.equal(descriptor.name, "volume");
    assert.equal(descriptor.type, type);
    assert.equal(descriptor.label, "Volume");
  });

  test("adds, gets and reports children", () => {
    const { group, envelope, volume } = buildSynth();
    assert.equal(group.name, "Synth");
    assert.equal(group.get("volume"), volume);
    assert.equal(group.get("envelope"), envelope);
    assert.equal(group.has("volume"), true);
    assert.equal(group.has("nope"), false);
  });

  test("adding the same name twice throws", () => {
    const { group } = buildSynth();
    assert.throws(() => group.add("volume", new ParameterDescriptor({
      name: "volume", type: decibels(), label: "Volume",
    })));
  });

  test("leaves are yielded depth first in insertion order", () => {
    const { group, attack, decay } = buildSynth();
    const leaves = [...group.leaves()];
    assert.deepEqual(leaves.map((leaf) => leaf.path), [
      ["volume"],
      ["envelope", "attack"],
      ["envelope", "decay"],
    ]);
    assert.equal(leaves[1].descriptor, attack);
    assert.equal(leaves[2].descriptor, decay);
  });

  test("resolve walks a path array", () => {
    const { group, envelope, attack } = buildSynth();
    assert.equal(group.resolve(["envelope"]), envelope);
    assert.equal(group.resolve(["envelope", "attack"]), attack);
  });
});

describe("Parameter", () => {
  const build = (overrides = {}) => new Parameter({
    address: "device/1/volume",
    type: decibels(),
    label: "Volume",
    ...overrides,
  });

  test("starts unset and reports its identity", () => {
    const parameter = build();
    assert.equal(parameter.address, "device/1/volume");
    assert.equal(parameter.label, "Volume");
    assert.equal(parameter.inferred, false);
    assert.equal(parameter.isSet, false);
  });

  test("an initial value counts as set", () => {
    const parameter = build({ value: -12, inferred: true });
    assert.equal(parameter.value, -12);
    assert.equal(parameter.isSet, true);
    assert.equal(parameter.inferred, true);
  });

  test("set reports whether the value changed", () => {
    const parameter = build();
    assert.equal(parameter.set(-12), true);
    assert.equal(parameter.value, -12);
    assert.equal(parameter.isSet, true);
    assert.equal(parameter.set(-12), false);
    assert.equal(parameter.set(-6), true);
  });

  test("listeners receive value, previous value and origin", () => {
    const parameter = build();
    const seen = [];
    parameter.onChange((change) => seen.push(change));

    parameter.set(-12, "ui");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].parameter, parameter);
    assert.equal(seen[0].value, -12);
    assert.equal(seen[0].origin, "ui");

    parameter.set(-6, "audio");
    assert.equal(seen.length, 2);
    assert.equal(seen[1].previous, -12);
    assert.equal(seen[1].value, -6);
    assert.equal(seen[1].origin, "audio");

    parameter.set(-6, "audio"); // unchanged - no notification
    assert.equal(seen.length, 2);
  });

  test("onChange returns an unsubscribe function", () => {
    const parameter = build();
    let calls = 0;
    const off = parameter.onChange(() => { calls += 1; });
    parameter.set(-12);
    off();
    parameter.set(-24);
    assert.equal(calls, 1);
  });

  test("clamp delegates to the type", () => {
    const parameter = build();
    assert.equal(parameter.clamp(10), 0);
    assert.equal(parameter.clamp(-100), -60);
    assert.equal(parameter.clamp(-30), -30);
  });

  test("normalized access reads and writes through the type", () => {
    const parameter = build();
    parameter.set(-30);
    assert.equal(parameter.normalized, 0.5);

    const seen = [];
    parameter.onChange((change) => seen.push(change));
    parameter.setNormalized(0.25, "ui");
    assert.equal(parameter.value, -45);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].origin, "ui");
  });

  test("toJSON produces a plain object", () => {
    const parameter = build();
    parameter.set(-12);
    const json = parameter.toJSON();
    assert.equal(typeof json, "object");
    assert.notEqual(json, null);
  });
});

describe("ParameterMatrix", () => {
  const build = () => {
    const matrix = new ParameterMatrix();
    matrix.register({ address: "device/1/volume", type: decibels(), label: "Volume", value: -8 });
    matrix.register({ address: "device/1/envelope/attack", type: adr(), label: "Attack", value: 0.01 });
    matrix.register({ address: "device/2/volume", type: decibels(), label: "Volume" });
    return matrix;
  };

  test("register returns the parameter and rejects duplicates", () => {
    const matrix = new ParameterMatrix();
    const parameter = matrix.register({ address: "device/1/volume", type: decibels(), label: "Volume" });
    assert.equal(parameter.address, "device/1/volume");
    assert.equal(matrix.size, 1);
    assert.throws(() => matrix.register({ address: "device/1/volume", type: decibels() }));
    assert.equal(matrix.size, 1);
  });

  test("has, get and require", () => {
    const matrix = build();
    assert.equal(matrix.has("device/1/volume"), true);
    assert.equal(matrix.has("device/9/volume"), false);
    assert.equal(matrix.get("device/1/volume").address, "device/1/volume");
    assert.ok(!matrix.get("device/9/volume"));
    assert.equal(matrix.require("device/1/volume").address, "device/1/volume");
    assert.throws(() => matrix.require("device/9/volume"));
  });

  test("value and set", () => {
    const matrix = build();
    assert.equal(matrix.value("device/1/volume"), -8);
    assert.equal(matrix.set("device/1/volume", -12), true);
    assert.equal(matrix.value("device/1/volume"), -12);
    assert.equal(matrix.set("device/1/volume", -12), false);
    assert.throws(() => matrix.set("device/9/volume", 0));
  });

  test("list keeps registration order and filters by prefix", () => {
    const matrix = build();
    assert.deepEqual(matrix.list().map((p) => p.address), [
      "device/1/volume",
      "device/1/envelope/attack",
      "device/2/volume",
    ]);
    assert.deepEqual(matrix.list("device/1").map((p) => p.address), [
      "device/1/volume",
      "device/1/envelope/attack",
    ]);
    assert.deepEqual(matrix.list("device/9"), []);
  });

  test("snapshot nests the values that are set, relative to the prefix", () => {
    const matrix = build();
    assert.deepEqual(matrix.snapshot("device/1"), {
      volume: -8,
      envelope: { attack: 0.01 },
    });
    // device/2/volume was registered without a value, so it is absent.
    assert.deepEqual(matrix.snapshot("device/2"), {});
  });

  test("apply splits known from unknown paths", () => {
    const matrix = build();
    const result = matrix.apply("device/1", {
      volume: -20,
      envelope: { attack: 0.5 },
      mystery: { thing: 3 },
    }, "preset");

    assert.equal(matrix.value("device/1/volume"), -20);
    assert.equal(matrix.value("device/1/envelope/attack"), 0.5);
    assert.equal(result.applied.length, 2);
    assert.equal(result.unknown.length, 1);
    // Entries may be reported as full addresses or as paths relative to the prefix.
    assert.ok(result.applied.some((path) => path.endsWith("volume")));
    assert.ok(result.applied.some((path) => path.endsWith("envelope/attack")));
    assert.ok(result.unknown.every((path) => path.endsWith("mystery/thing")));
    assert.equal(matrix.has("device/1/mystery/thing"), false);
  });

  test("onChange can be scoped to a prefix and unsubscribed", () => {
    const matrix = build();
    const scoped = [];
    const all = [];
    const offScoped = matrix.onChange((change) => scoped.push(change), "device/1");
    matrix.onChange((change) => all.push(change));

    matrix.set("device/1/volume", -20, "ui");
    matrix.set("device/2/volume", -3, "ui");

    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].parameter.address, "device/1/volume");
    assert.equal(scoped[0].value, -20);
    assert.equal(scoped[0].previous, -8);
    assert.equal(scoped[0].origin, "ui");
    assert.equal(all.length, 2);

    offScoped();
    matrix.set("device/1/volume", -30, "ui");
    assert.equal(scoped.length, 1);
    assert.equal(all.length, 3);
  });

  test("release removes one parameter and stops its notifications", () => {
    const matrix = build();
    const parameter = matrix.require("device/1/volume");
    const seen = [];
    matrix.onChange((change) => seen.push(change));

    assert.equal(matrix.release("device/1/volume"), true);
    assert.equal(matrix.release("device/1/volume"), false);
    assert.equal(matrix.has("device/1/volume"), false);
    assert.throws(() => matrix.set("device/1/volume", -1));

    parameter.set(-40); // released parameter: the matrix must not hear it any more
    assert.equal(seen.length, 0);
  });

  test("releasePrefix reports how many were released", () => {
    const matrix = build();
    assert.equal(matrix.size, 3);
    assert.equal(matrix.releasePrefix("device/1"), 2);
    assert.equal(matrix.size, 1);
    assert.deepEqual(matrix.list().map((p) => p.address), ["device/2/volume"]);
    assert.equal(matrix.releasePrefix("device/1"), 0);
  });

  test("registerGroup registers every leaf and seeds the given values", () => {
    const matrix = new ParameterMatrix();
    const group = new ParameterGroup("Synth");
    const envelope = new ParameterGroup("envelope");
    envelope.add("attack", new ParameterDescriptor({ name: "attack", type: adr(), label: "Attack" }));
    envelope.add("decay", new ParameterDescriptor({ name: "decay", type: adr(), label: "Decay" }));
    group.add("volume", new ParameterDescriptor({ name: "volume", type: decibels(), label: "Volume" }));
    group.add("envelope", envelope);

    const registered = matrix.registerGroup("device/7", group, { envelope: { attack: 0.3 } });

    assert.deepEqual(registered.map((p) => p.address), [
      "device/7/volume",
      "device/7/envelope/attack",
      "device/7/envelope/decay",
    ]);
    assert.equal(matrix.size, 3);
    assert.equal(matrix.value("device/7/envelope/attack"), 0.3);
    assert.equal(matrix.require("device/7/envelope/decay").isSet, false);
    assert.deepEqual(matrix.snapshot("device/7"), { envelope: { attack: 0.3 } });
  });
});
