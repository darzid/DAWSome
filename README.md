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

