# DAWSome

A browser DAW that runs from a static directory with no build step and no dependencies: an
arrangement of track lanes and clips, a piano-roll clip editor, a device panel over the Tone.js
instruments and effects, a mixer, Standard MIDI File import and a demo song. The app is a set of
plain ES modules plugged into one `App`, with Tone.js 14.8.49 loaded from cdnjs. Every value the app
can change at run time — a track's volume, pan and mute as much as an oscillator type deep inside a
synth — is a typed entry in one **parameter matrix**, addressed by a string such as
`device/3/envelope/attack`: typed from `devices.json`, written by presets and by the UI, and
mirrored back from the audio engine. Adding a feature is one module file and one line in
`src/main.js`; adding an instrument or effect is an entry in a JSON file and no code at all.

## Run

```sh
npm start                 # node tools/serve.mjs — prints the URL it serves on
```

Open the printed URL. The server is dependency-free and reads `PORT` (default `8080`), so
`PORT=3000 npm start` moves it. The page needs network access to load Tone.js from the CDN.

```sh
npm test                  # node --test test/
node tools/smoke.mjs      # headless-Chromium smoke check
```

`package.json` contains scripts only — no dependencies. The tests are `node:test` files;
`tools/smoke.mjs` drives the page with a globally installed Playwright.

## Architecture

```
index.html                 shell markup only
styles/app.css             all CSS
package.json               scripts only, no dependencies
tools/serve.mjs            zero-dependency static server (PORT env, default 8080)
tools/smoke.mjs            headless-Chromium smoke check
src/main.js                composition: new App().use(...13 modules...).start()
src/core/                  EventBus, Module, App, CommandRegistry, PanelRegistry
src/params/                types.js, paths.js, ParameterGroup.js, Parameter.js, ParameterMatrix.js
src/devices/               DeviceSchema.js (DeviceSchema, DeviceSchemaSet.fromJson),
                           PresetBank.js (Preset, PresetBank), Device.js, DeviceCatalog.js,
                           defaultDevices.js (DEMO_DEVICES, DEFAULT_TRACK_DEVICE), DevicesModule.js
src/model/                 Note.js, Clip.js, Track.js (CHANNEL_DEFAULTS, createChannelGroup, Track),
                           Project.js, ProjectModule.js
src/audio/                 AudioEngine.js (null engine = the interface), ToneAudioEngine.js,
                           AudioModule.js
src/util/                  music.js, theme.js
src/ui/                    dom.js, TimelineView.js, ParameterPanel.js
src/midi/                  SmfParser.js
src/modules/               KeyboardModule, PanelsModule, TransportModule (also exports Transport),
                           StatusBarModule, ArrangementModule, ClipEditorModule, DevicePanelModule,
                           MixerModule, MidiImportModule, DemoSongModule
test/                      *.test.mjs
```

`src/core/App.js` is the composition root: it owns the `EventBus`, a map of named services
(`provide(name, service)` / `get(name)` / `has(name)`, where `get` of an unprovided service throws)
and the list of installed modules. `app.dispose()` disposes them in reverse order.

### Module lifecycle

Every feature is a subclass of `src/core/Module.js` with three hooks:

- **`install(app)`** — synchronous, runs the moment the module is passed to `app.use()`.
  Call `app.provide(name, service)`, look services up with `app.get(name)` *only* for modules
  installed earlier, register commands and panels, and subscribe with `app.bus.on(...)`.
- **`async start(app)`** — runs in install order after *all* modules are installed. Load data,
  build DOM, seed state.
- **`dispose(app)`** — runs in reverse install order. Undo what `install` and `start` did;
  `bus.on`, `commands.register` and `panels.register` each return the function that undoes them.

One rule follows from this: `catalog` and `presets` are provided during `DevicesModule.start()`,
not during its `install`, so look them up in `start()` or later — never in `install()`.

### Composition (`src/main.js`)

Modules are installed in dependency order:

```js
await new App()
  .use(new KeyboardModule())    // 1  provides `commands`
  .use(new PanelsModule())      // 2  provides `panels`
  .use(new ProjectModule())     // 3  provides `project` and `parameters`
  .use(new DevicesModule())     // 4  provides `catalog` and `presets` (in start)
  .use(new AudioModule())       // 5  provides `audio`
  .use(new TransportModule())   // 6  provides `transport`
  .use(new StatusBarModule())   // 7  provides `status`
  .use(new ArrangementModule()) // 8
  .use(new ClipEditorModule())  // 9
  .use(new DevicePanelModule()) // 10
  .use(new MixerModule())       // 11
  .use(new MidiImportModule())  // 12
  .use(new DemoSongModule())    // 13
  .start();
```

### Services

| name | type | provided by |
|---|---|---|
| `commands` | `CommandRegistry` | `KeyboardModule.install` |
| `panels` | `PanelRegistry` | `PanelsModule.install` |
| `project` | `Project` | `ProjectModule.install` |
| `parameters` | `ParameterMatrix` (the same object as `project.parameters`) | `ProjectModule.install` |
| `catalog` | `DeviceCatalog` | `DevicesModule.start` |
| `presets` | `PresetBank` | `DevicesModule.start` |
| `audio` | `AudioEngine` | `AudioModule.install` |
| `transport` | `Transport` | `TransportModule.install` |
| `status` | `{ set(text) }` | `StatusBarModule.install` |

### Bus events

All cross-module notification goes through `app.bus` (`on`, `once`, `off`, `emit`; `on` and `once`
return an unsubscribe function, `emit` is synchronous).

| event | payload | emitted by |
|---|---|---|
| `project:bpm` | `{ bpm }` | `Project.setBpm` |
| `project:loop` | `{ loop }` | `Project.setLoop` |
| `track:added` / `track:removed` / `track:changed` | `{ track }` | `Project` |
| `track:devices` | `{ track }` — device chain replaced or preset applied | `Project` |
| `clip:added` / `clip:removed` / `clip:changed` / `clip:notes` | `{ clip }` | `Project` |
| `selection` | `{ trackId, clipId, previousTrackId, previousClipId }` | `Project.select` |
| `parameter:changed` | `{ parameter, value, previous, origin }` | `Project` (forwards the matrix) |
| `transport:playhead` | `{ beat }` — a seek | `Transport` |
| `transport:tick` | `{ beat }` — every frame while playing | `Transport` |
| `transport:state` | `{ playing }` | `Transport` |
| `transport:follow` | `{ follow }` | `Transport` |
| `panels:registered` | the panel `{ id, title, element }` | `PanelRegistry` |
| `panels:active` | `{ id, previous }` — `id` is `null` when no panel is shown | `PanelRegistry` |
| `app:started` | the `app` | `App.start` |

### Commands and panels

Commands are `{ id, title, run, shortcut?, when? }`. A `when` guard that returns false makes
`commands.run(id)` a no-op and suppresses the shortcut. Shortcut syntax is `"Space"`, `"B"`,
`"Escape"`, `"Delete"`, `"Ctrl+D"` — `Ctrl` matches the Control *or* the Command key, and an array
lists alternatives.

| command | shortcut |
|---|---|
| `transport.toggle` | Space |
| `track.add` | |
| `clip.add` | |
| `clip.duplicate` | Ctrl+D |
| `clip.delete` | |
| `editor.toggleDraw` | B |
| `editor.clearSelection` | Escape |
| `editor.selectAll` | Ctrl+A |
| `editor.clearNotes` | |
| `edit.delete` | Delete, Backspace — the selected notes, or the clip when no note is selected |

Panels are `{ id, title, element }`: `clip-editor`, `devices` and `mixer`. At most one is visible,
and showing the active one again hides it. `PanelsModule` renders the tab strip from the registry,
so a registered panel gets its tab for free.

## Parameter matrix

`src/params/ParameterMatrix.js` is the typed, addressable registry of every live parameter.
Addresses are segments joined by `/` (`SEP` in `src/params/paths.js`), shaped
`<owner>/<id>/<path...>`:

- **Track channel** — `track/<trackId>/volume` (`NumberType` `"TrackVolume"`, −60..0, step 0.01,
  default −8), `track/<trackId>/pan` (`"TrackPan"`, −1..1, step 0.01, default 0) and
  `track/<trackId>/mute` (`BooleanType`, default false). `CHANNEL_DEFAULTS` and
  `createChannelGroup()` live in `src/model/Track.js`; a track keeps no channel values of its own.
- **Device** — `device/<deviceId>/<schema path>`, e.g. `device/3/envelope/attack` or
  `device/3/oscillator/type`. The path segments are the nested keys of the device's `parameters`
  in `devices.json`. Parameters that the Tone node reports through `node.get()` but the schema does
  not list are registered anyway, with `inferred: true` and a type guessed from the live value.

### Types

`src/params/types.js` has `NumberType { name, min, max, step; coerce, clamp, bounded, normalize,
denormalize }`, `EnumType { name, values; includes, coerce }`, `BooleanType`, `StringType`, and
`inferType(value)` for live values (it returns `null` for anything that is not a primitive, which
marks the value as "not a parameter"). Types are deliberately permissive: `coerce` converts what it
recognises — numeric strings to numbers, checkbox spellings to booleans — and passes everything else
through, because presets legitimately carry Tone time strings such as `"8n"` where a number is
declared. `EnumType.values` is advisory in the same way: the bank ships `"square4"`, `"sine3"` and
`"fmsquare5"`, which no enum lists.

### Parameters

`Parameter { address, type, label, inferred, value, isSet, normalized }` with
`set(value, origin)`, `setNormalized(n, origin)`, `clamp(v)` and `onChange(fn)`. `set()` coerces,
stores, and notifies only when the value actually changed. **Values are never clamped on `set()`** —
`clamp()` is for UI input alone.

The matrix itself: `register({ address, type, label, inferred, value })`,
`registerGroup(prefix, group, values)` (walks a `ParameterGroup` tree and registers every leaf under
the prefix), `has`, `get`, `require` (throws on an unknown address), `value(address)`,
`set(address, value, origin)`, `release(address)`, `releasePrefix(prefix)`, `list(prefix)`,
`snapshot(prefix)` → a nested object of the set values relative to that prefix,
`apply(prefix, nested, origin)` → `{ applied, unknown }` (paths with no parameter are *reported*,
never created), and `onChange(fn, prefix)` — the prefix is what lets a device panel watch only its
own device. The matrix holds no DOM, no Tone node and no bus; `Project` forwards its changes onto
the bus as `parameter:changed`.

### Origins

Every change carries an origin:

| origin | meaning |
|---|---|
| `"engine"` | mirrored back from Tone — the engine ignores these, which is what stops an echo |
| `"ui"` | a widget moved it |
| `"preset"` | a preset was applied |
| `null` | a programmatic change |

### Flow

`devices.json` → `DeviceSchemaSet.fromJson` (resolving the `unitTypes` / `enumTypes` / `modules` /
`devices` refs) → `DeviceCatalog.create(typeName, { options })` → `Device.attach(matrix)` registers
the typed parameters under `device/<id>/` → `ToneAudioEngine` builds `new Tone[typeName](options)`,
reads `node.get()` and mirrors every value into the matrix (`Device.syncValues`) → `ParameterPanel`
renders widgets from the matrix and calls `parameter.set(v, "ui")` → `AudioModule` routes
`parameter:changed` to `engine.setDeviceParameter(device, path, value)` (`node.set(nested)`) or
`engine.setChannel(track, name, value)`, and the engine reads the value back so the matrix stays
truthful. Presets take the same road: `Project.applyPreset(track, device, preset)` →
`Device.loadPreset` → `track:devices` → the engine rebuilds the node from the preset options → the
values are mirrored again.

## How to add things

### A device — no code

Add an entry to the `devices` section of `devices.json`. `type` is `"Instrument"` or `"Effect"`,
and every parameter is a ref to a unit type, an enum type, a shared module or another device:

```json
"Tremolo": {
  "type": "Effect",
  "parameters": {
    "frequency": "unitTypes/Frequency",
    "depth": "unitTypes/NormalRange",
    "spread": "unitTypes/Degrees",
    "type": "enumTypes/OscillatorType",
    "wet": "unitTypes/NormalRange"
  }
}
```

The key is the Tone class name: `catalog.create("Tremolo", { options })` gives the device, and
`ToneAudioEngine` builds `new Tone.Tremolo(options)` for it. Presets are optional and go in
`preset-bank.json` under `category\Device\Preset`:

```json
"effect\\Tremolo\\Slow": { "frequency": 2, "depth": 0.7, "spread": 180 }
```

### A panel — one module file

```js
// src/modules/NotesPanelModule.js
import { Module } from "../core/Module.js";

export class NotesPanelModule extends Module {
  #off = [];

  install(app) {
    this.element = document.createElement("div");
    this.element.className = "notes-panel";
    // register() returns its own unregister function
    this.#off.push(app.get("panels").register({ id: "notes", title: "Notes", element: this.element }));
    this.#off.push(app.bus.on("selection", ({ clipId }) => this.#render(app, clipId)));
  }

  async start(app) {
    this.#render(app, app.get("project").selectedClipId);
  }

  dispose() {
    for (const off of this.#off.reverse()) off();
    this.#off.length = 0;
  }

  #render(app, clipId) {
    this.element.textContent = app.get("project").clipById(clipId)?.name ?? "No clip selected";
  }
}
```

`PanelsModule` picks the tab up from `panels:registered`; nothing else has to change.

### A command or shortcut

```js
install(app) {
  const commands = app.get("commands");
  const project = app.get("project");
  this.#off.push(commands.register({
    id: "clip.halve",
    title: "Halve clip length",
    shortcut: "Ctrl+H",
    when: () => project.selectedClip !== null,
    run: () => {
      const clip = project.selectedClip;
      clip.length = Math.max(0.25, clip.length / 2);
      project.clipChanged(clip);   // → clip:changed, and every view redraws
    },
  }));
}
```

Buttons call `commands.run("clip.halve")` and `KeyboardModule` matches the shortcut, so the action
is written once.

### A module

Subclass `Module`, then add one line to `src/main.js` in dependency order — after every module
whose services it looks up:

```js
  .use(new MixerModule())       // 11
  .use(new NotesPanelModule())  // needs `panels` (2) and `project` (3)
  .use(new MidiImportModule())  // 12
```

### Another audio engine

`src/audio/AudioEngine.js` is a null engine whose methods do nothing; it is both the interface and
the authoritative list of what an engine has to answer to (`setChannel`, `setDeviceParameter`, and
the transport and note calls beside them). Subclass it:

```js
// src/audio/MyAudioEngine.js
import { AudioEngine } from "./AudioEngine.js";

export class MyAudioEngine extends AudioEngine {
  setChannel(track, name, value) { /* name: "volume" | "pan" | "mute" */ }
  setDeviceParameter(device, path, value) { /* path: "envelope/attack" */ }
}
```

`AudioModule` is the only place that names a concrete engine — construct yours there instead of
`ToneAudioEngine`. The rest of the app knows only the `audio` service and is untouched.

## Behaviour notes

The port preserves the behaviour of the original single-file app, with these exceptions, all
verified against the Tone.js 14.8.49 source:

- **Fixed:** `keyOff` passed a frequency where monophonic synths expect a time
  (`triggerRelease(time)`).
- **Fixed:** `stop()` called `triggerAttackRelease()` with no arguments. It now releases every
  instrument, using `releaseAll` for `PolySynth`.
- **Fixed:** `NoiseSynth` was handed a frequency as its duration — its signature is
  `triggerAttackRelease(duration, time, velocity)`.
- **Removed:** the link to the missing `midi-arranger.css`, the unstyled `.tab-strip`, the unit-less
  `min-height`, and the dead `PresetBrowser` code.
- **Changed:** the preset select in a track header now shows a `Custom` entry when the device's
  options did not come from the bank. Previously the select silently displayed a preset that had not
  been applied.
- The model and the engine support a chain of effects per track (`Track.devices`,
  `Project.addEffect`), but there is no UI for it yet.

## Data files

### `devices.json`

Four sections, and every parameter is a ref of the form `<section>/<name>`:

| section | holds | ref |
|---|---|---|
| `unitTypes` | `{ min, max, step }` number ranges — `Decibels`, `Frequency`, `AdrRange`, `TrackVolume`, … | `unitTypes/Decibels` |
| `enumTypes` | `{ values: [...] }` — `OscillatorType`, `EnvelopeCurve`, `FilterType`, `Rolloff`, `NoiseType`, `OversampleType` | `enumTypes/FilterType` |
| `modules` | reusable parameter groups — `AmplitudeEnvelope`, `ModulationEnvelope`, `FrequencyEnvelope`, `Filter`, `OmniOscillator` | `modules/AmplitudeEnvelope` |
| `devices` | `{ "type": "Instrument" \| "Effect", "parameters": { … } }`, keyed by Tone class name | `devices/MonoSynth` |

A ref to a module or a device nests that whole group under the key, which is where
`device/3/envelope/attack` comes from, and how `DuoSynth` gets its `voice0` and `voice1` (both refs
to `devices/MonoSynth`). `DeviceSchemaSet.fromJson` resolves the refs once. Bounds that are not
finite numbers — `"any"`, `"16777215"` — stay as written in the file; `NumberType` counts a range as
bounded, and therefore normalizable, only when both ends are finite.

### `preset-bank.json`

A flat object whose keys are `category\Device\Preset` — a **backslash**-separated triple, written
`"instrument\\MonoSynth\\Bassy"` in JSON source. `category` is `instrument` or `effect`, `Device` is
the `devices.json` / Tone class name, and `Preset` is the display name. Each value is the nested
parameter object handed to the device, its keys matching the schema paths:

```json
"instrument\\MonoSynth\\Bassy": {
  "volume": 10,
  "oscillator": { "type": "sawtooth" },
  "filter": { "Q": 2, "type": "bandpass", "rolloff": -24 },
  "envelope": { "attack": 0.01, "decay": 0.1, "sustain": 0.2, "release": 0.6 }
}
```

Preset bodies are partial — `"instrument\\MonoSynth\\Default"` is `{}` — and a preset may name a
parameter the device does not have, which `ParameterMatrix.apply` reports in its `unknown` list
instead of creating. The bank also carries presets for devices `devices.json` does not declare
(`BitCrusher`, `Chebyshev`, `Chorus`, `FeedbackDelay`, `PitchShift`, `Tremolo`, `Vibrato`); adding
the schema entry is what puts such a device in the catalog.
