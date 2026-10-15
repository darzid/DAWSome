// Unit tests for the device package (src/devices) against the real data files.
//
// Covers DeviceSchemaSet (every device in devices.json resolves, unit/enum type
// lookup, module and device references, categories), PresetBank (every key in
// preset-bank.json parses, per-device listing order, lookup errors), the
// DeviceCatalog (instrument/effect listing, id allocation, creation from a
// preset) and Device (attaching to a parameter matrix, syncing unknown values
// as inferred parameters, detaching again).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DeviceSchemaSet } from "../src/devices/DeviceSchema.js";
import { PresetBank } from "../src/devices/PresetBank.js";
import { DeviceCatalog } from "../src/devices/DeviceCatalog.js";
import { DEMO_DEVICES, DEFAULT_TRACK_DEVICE } from "../src/devices/defaultDevices.js";
import { ParameterMatrix } from "../src/params/ParameterMatrix.js";

const readJson = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));

const devicesJson = readJson("devices.json");
const presetJson = readJson("preset-bank.json");

const schemas = () => DeviceSchemaSet.fromJson(devicesJson);
const bank = () => PresetBank.fromJson(presetJson);

describe("DeviceSchemaSet", () => {
  test("resolves every device in devices.json, in file order", () => {
    const set = schemas();
    const names = Object.keys(devicesJson.devices);
    assert.equal(set.list().length, names.length);
    assert.deepEqual(set.list().map((schema) => schema.name), names);
  });

  test("splits the catalogue into 10 instruments and 13 effects", () => {
    const set = schemas();
    assert.equal(set.list("Instrument").length, 10);
    assert.equal(set.list("Effect").length, 13);
    assert.equal(set.get("MonoSynth").category, "Instrument");
    assert.equal(set.get("Reverb").category, "Effect");
  });

  test("has and get", () => {
    const set = schemas();
    assert.equal(set.has("MonoSynth"), true);
    assert.equal(set.has("NotADevice"), false);
    assert.equal(set.get("MonoSynth").name, "MonoSynth");
    assert.throws(() => set.get("NotADevice"));
  });

  test("every leaf of every device carries a value type", () => {
    const set = schemas();
    for (const schema of set.list()) {
      const leaves = [...schema.parameters.leaves()];
      assert.ok(leaves.length > 0, `${schema.name} has no parameters`);
      for (const leaf of leaves) {
        assert.ok(leaf.descriptor.type, `${schema.name}/${leaf.path.join("/")} has no type`);
        assert.ok(
          ["number", "enum", "boolean", "string"].includes(leaf.descriptor.type.kind),
          `${schema.name}/${leaf.path.join("/")} has kind ${leaf.descriptor.type.kind}`,
        );
      }
    }
  });

  test("module references expand into child groups", () => {
    const set = schemas();
    const synth = set.get("Synth");
    const paths = [...synth.parameters.leaves()].map((leaf) => leaf.path.join("/"));
    assert.ok(paths.includes("volume"));
    assert.ok(paths.includes("envelope/attack"));
    assert.ok(paths.includes("envelope/releaseCurve"));
    assert.ok(paths.includes("oscillator/type"));
  });

  test("a device reference (DuoSynth.voice0 -> MonoSynth) expands too", () => {
    const set = schemas();
    const duo = set.get("DuoSynth");
    const voice0 = duo.parameters.get("voice0");
    assert.ok(voice0, "DuoSynth has no voice0 child");
    assert.equal(voice0.has("envelope"), true);
    assert.equal(voice0.has("filter"), true);
    assert.equal(voice0.has("oscillator"), true);

    const paths = [...duo.parameters.leaves()].map((leaf) => leaf.path);
    assert.ok(paths.some((path) => path.join("/") === "voice0/envelope/attack"));
    assert.ok(paths.some((path) => path.join("/") === "voice1/oscillator/type"));
    assert.deepEqual(
      duo.parameters.resolve(["voice0", "envelope", "attack"]),
      voice0.resolve(["envelope", "attack"]),
    );
  });

  test("unit types translate the JSON bounds", () => {
    const set = schemas();
    const output = set.unitType("OutputRange");
    assert.equal(output.min, -Infinity);
    assert.equal(output.max, Infinity);
    assert.equal(output.bounded, false);

    const positive = set.unitType("Positive");
    assert.equal(positive.min, 0);
    assert.equal(positive.max, 16777215);
    assert.equal(positive.step, 0.01);

    const decibels = set.unitType("Decibels");
    assert.equal(decibels.min, -40);
    assert.equal(decibels.max, 0);
    assert.equal(decibels.bounded, true);
  });

  test("enum types keep their values and coerce numeric strings", () => {
    const set = schemas();
    const rolloff = set.enumType("Rolloff");
    assert.deepEqual(rolloff.values, [-12, -24, -48, -96]);
    assert.equal(rolloff.includes(-24), true);
    assert.equal(rolloff.coerce("-24"), -24);

    const filterType = set.enumType("FilterType");
    assert.equal(filterType.includes("bandpass"), true);
    assert.equal(filterType.includes("nope"), false);
  });
});

describe("PresetBank", () => {
  test("parses every key in preset-bank.json", () => {
    const presets = bank();
    const keys = Object.keys(presetJson);
    const devices = presets.devices();
    assert.equal(devices.length, 25);

    const total = devices.reduce((sum, device) => sum + presets.forDevice(device).length, 0);
    assert.equal(total, keys.length);
  });

  test("a preset knows its key, device, name, category and parameters", () => {
    const presets = bank();
    const preset = presets.get("MonoSynth", "Bah");
    assert.equal(preset.device, "MonoSynth");
    assert.equal(preset.name, "Bah");
    assert.equal(preset.category, "Instrument");
    assert.equal(preset.key, "instrument\\MonoSynth\\Bah");
    assert.ok(preset.key in presetJson, "preset key is not a key of preset-bank.json");
    assert.equal(preset.parameters.volume, 10);
    assert.equal(preset.parameters.filter.Q, 2);
    assert.deepEqual(preset.parameters, presetJson[preset.key]);
  });

  test("effect presets are categorised as effects", () => {
    const presets = bank();
    const preset = presets.get("AutoPanner", "Square");
    assert.equal(preset.category, "Effect");
    assert.equal(preset.key, "effect\\AutoPanner\\Square");
    assert.equal(preset.parameters.frequency, "8n");
  });

  test("forDevice and names follow file order", () => {
    const presets = bank();
    const expected = [
      "Default", "AlienChorus", "DelicateWindPart", "DropPulse",
      "Lectric", "Marimba", "Steelpan", "SuperSaw", "TreeTrunk",
    ];
    assert.deepEqual(presets.names("Synth"), expected);
    assert.deepEqual(presets.forDevice("Synth").map((preset) => preset.name), expected);
    assert.equal(presets.forDevice("Synth")[0].name, "Default");
  });

  test("has and unknown lookups", () => {
    const presets = bank();
    assert.equal(presets.has("MonoSynth", "Bah"), true);
    assert.equal(presets.has("MonoSynth", "NotAPreset"), false);
    assert.equal(presets.has("NotADevice", "Bah"), false);
    assert.throws(() => presets.get("MonoSynth", "NotAPreset"));
    assert.throws(() => presets.get("NotADevice", "Bah"));
  });
});

describe("DeviceCatalog", () => {
  test("lists instruments and effects", () => {
    const catalog = new DeviceCatalog(schemas());
    assert.equal(catalog.instruments().length, 10);
    assert.equal(catalog.effects().length, 13);
  });

  test("ids start at 1 and increment per catalog", () => {
    const catalog = new DeviceCatalog(schemas());
    const first = catalog.create("Synth");
    const second = catalog.create("Reverb");
    assert.equal(first.id, 1);
    assert.equal(second.id, 2);
    assert.equal(first.prefix, "device/1");
    assert.equal(second.prefix, "device/2");
    assert.equal(first.typeName, "Synth");
    assert.equal(first.category, "Instrument");
    assert.equal(second.category, "Effect");

    const other = new DeviceCatalog(schemas());
    assert.equal(other.create("Synth").id, 1);
  });

  test("create accepts options and a preset name, and rejects unknown types", () => {
    const catalog = new DeviceCatalog(schemas());
    const device = catalog.create("MonoSynth", { options: { volume: -6 }, presetName: "Bah" });
    assert.equal(device.typeName, "MonoSynth");
    assert.deepEqual(device.options, { volume: -6 });
    assert.equal(device.presetName, "Bah");
    assert.throws(() => catalog.create("NotADevice"));
  });

  test("createFromPreset takes the device type and name from the preset", () => {
    const catalog = new DeviceCatalog(schemas());
    const preset = bank().get("MonoSynth", "Bah");
    const device = catalog.createFromPreset(preset);
    assert.equal(device.typeName, "MonoSynth");
    assert.equal(device.presetName, "Bah");
  });
});

describe("Device", () => {
  test("attach registers the whole schema under device/<id>", () => {
    const set = schemas();
    const catalog = new DeviceCatalog(set);
    const matrix = new ParameterMatrix();
    const device = catalog.create("Synth");

    device.attach(matrix);

    const leafCount = [...set.get("Synth").parameters.leaves()].length;
    assert.equal(matrix.size, leafCount);
    assert.equal(device.parameters().length, leafCount);
    assert.equal(matrix.has(`${device.prefix}/envelope/attack`), true);
    assert.equal(matrix.has(`${device.prefix}/oscillator/type`), true);
    assert.equal(matrix.has(`${device.prefix}/volume`), true);
    assert.equal(device.parameter("envelope/attack").address, `${device.prefix}/envelope/attack`);
  });

  test("options given at creation seed the matrix", () => {
    const catalog = new DeviceCatalog(schemas());
    const matrix = new ParameterMatrix();
    const device = catalog.create("Synth", { options: { volume: -6, envelope: { attack: 0.02 } } });

    device.attach(matrix);

    assert.equal(matrix.value(`${device.prefix}/volume`), -6);
    assert.equal(matrix.value(`${device.prefix}/envelope/attack`), 0.02);
    assert.deepEqual(device.snapshot(), { volume: -6, envelope: { attack: 0.02 } });
  });

  test("syncValues sets known paths and registers unknown ones as inferred", () => {
    const catalog = new DeviceCatalog(schemas());
    const matrix = new ParameterMatrix();
    const device = catalog.create("MonoSynth");
    device.attach(matrix);
    const registered = matrix.size;

    const count = device.syncValues({
      "volume": -3,
      "filterEnvelope/baseFrequency": 20,   // not part of the MonoSynth schema
      "filterEnvelope/octaves": 5,          // not part of the MonoSynth schema
    }, "preset");

    assert.equal(count, 3);
    assert.equal(matrix.size, registered + 2);
    assert.equal(matrix.value(`${device.prefix}/volume`), -3);
    assert.equal(matrix.value(`${device.prefix}/filterEnvelope/baseFrequency`), 20);
    assert.equal(matrix.require(`${device.prefix}/filterEnvelope/baseFrequency`).inferred, true);
    assert.equal(matrix.require(`${device.prefix}/volume`).inferred, false);
  });

  test("loadPreset applies the preset parameters", () => {
    const catalog = new DeviceCatalog(schemas());
    const matrix = new ParameterMatrix();
    const device = catalog.create("MonoSynth");
    device.attach(matrix);

    device.loadPreset(bank().get("MonoSynth", "Bah"));

    assert.equal(device.presetName, "Bah");
    assert.equal(matrix.value(`${device.prefix}/envelope/attack`), 0.01);
    assert.equal(matrix.value(`${device.prefix}/filter/Q`), 2);
    assert.equal(matrix.value(`${device.prefix}/filter/rolloff`), -24);
    assert.equal(matrix.value(`${device.prefix}/oscillator/type`), "sawtooth");
    assert.equal(device.snapshot().filter.Q, 2);
  });

  test("detach releases every parameter the device registered", () => {
    const catalog = new DeviceCatalog(schemas());
    const matrix = new ParameterMatrix();
    const other = catalog.create("Synth");
    const device = catalog.create("Synth");
    other.attach(matrix);
    device.attach(matrix);
    device.syncValues({ "mystery/thing": 3 });
    const otherSize = other.parameters().length;

    device.detach();

    assert.equal(matrix.has(`${device.prefix}/envelope/attack`), false);
    assert.equal(matrix.has(`${device.prefix}/mystery/thing`), false);
    assert.equal(matrix.list(device.prefix).length, 0);
    assert.equal(matrix.size, otherSize);
    assert.equal(matrix.has(`${other.prefix}/envelope/attack`), true);
  });
});

describe("defaultDevices", () => {
  test("the demo devices name real device types", () => {
    const set = schemas();
    assert.deepEqual(Object.keys(DEMO_DEVICES), ["kick", "bass", "closedHat"]);
    assert.equal(DEMO_DEVICES.kick.typeName, "MembraneSynth");
    assert.equal(DEMO_DEVICES.bass.typeName, "MonoSynth");
    assert.equal(DEMO_DEVICES.closedHat.typeName, "MetalSynth");
    for (const demo of Object.values(DEMO_DEVICES)) {
      assert.equal(set.has(demo.typeName), true, `${demo.typeName} is not in devices.json`);
      assert.equal(typeof demo.options, "object");
      assert.notEqual(demo.options, null);
    }
  });

  test("the default track device is the demo bass", () => {
    assert.equal(DEFAULT_TRACK_DEVICE, DEMO_DEVICES.bass);
    assert.equal(DEFAULT_TRACK_DEVICE.typeName, "MonoSynth");
  });
});
