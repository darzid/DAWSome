/**
 * The built-in device options of the original application.
 *
 * These are the three entries of the `DEVICES` array in index.html, copied
 * verbatim so the demo song and new tracks sound exactly as before.
 *
 * Each entry is `{ typeName, options }` where `typeName` is the Tone.js class
 * name and `options` the object the audio node is constructed from.
 *
 * The entries are shared module state: callers must clone the options before
 * handing them to a device, e.g.
 * `catalog.create(entry.typeName, { options: structuredClone(entry.options) })`.
 *
 * @type {{ kick: { typeName: string, options: object }, bass: { typeName: string, options: object }, closedHat: { typeName: string, options: object } }}
 */
export const DEMO_DEVICES = {
  /** `DEVICES[0]` in index.html: the demo song's kick track. */
  kick: {
    typeName: "MembraneSynth",
    options: {
      "detune": -1000,
      "pitchDecay": 0.05,
      "octaves": 8,
      "volume": 0,
      "envelope": {
        "attack": 0.001,
        "attackCurve": "linear",
        "decay": 0.,
        "sustain": 0.2,
        "release": 0.1
      }
    }
  },

  /** `DEVICES[1]` in index.html: the demo song's bass track, and every new track. */
  bass: {
    typeName: "MonoSynth",
    options: {
      "volume": 0,
      "portamento": 0,
      "oscillator": {
        "type": "sawtooth"
      },
      "filter": {
        "Q": 0.3,
        "detune": -1000,
        "frequency": 0,
        "gain": 0,
        "rolloff": -48,
        "type": "bandpass"
      },
      "envelope": {
        "attack": 0.01,
        "decay": 0.4,
        "sustain": 0.01,
        "release": 0.01
      },
      "filterEnvelope": {
        "attack": 0.1,
        "decay": 1.3,
        "sustain": 1,
        "release": 0.7,
        "releaseCurve": "linear",
        "baseFrequency": 20,
        "octaves": 5
      }
    }
  },

  /** `DEVICES[2]` in index.html: the demo song's closed hat track. */
  closedHat: {
    typeName: "MetalSynth",
    options: {
      volume: -10,
      portamento: 100,
      modulationIndex: 1,
      octaves: 0,
      envelope: {
        attack: 0.01,
        decay: 0.05,
        sustain: 0.1,
        release: 1.4
      }
    }
  }
};

/**
 * The device a freshly added track gets, and the device MIDI import gives to
 * every imported channel: `DEVICES[1]` in index.html.
 *
 * Callers must `structuredClone(DEFAULT_TRACK_DEVICE.options)` before passing
 * the options to `catalog.create`.
 *
 * @type {{ typeName: string, options: object }}
 */
export const DEFAULT_TRACK_DEVICE = DEMO_DEVICES.bass;
