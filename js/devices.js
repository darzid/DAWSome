let devicesJson = {
  "unitTypes": {
    "NormalRange": { "min": 0, "max": 1, "step": 0.01 },
    "Positive": { "min": 0, "max": "16777215", "step": 0.01 },
    "AudioRange": { "min": -1, "max": 1, "step": 0.01 },
    "Decibels": { "min": -40, "max": 0, "step": 0.01, unit: "db" },
    "Cents": { "min": -1200, "max": 1200, "step": 0.01, unit: "ct" },
    "Frequency": { "min": 0, "max": 22500, "step": 0.01, unit: "hz" },
    "Time": { "min": 0, "max": "16777215", "step": 0.01, unit: "sec" },
    "TransportTime": { "min": 0, "max": "16777215", "step": 0.01, unit: "sec" },
    "Ticks": { "min": 0, "max": "16777215", "step": 0.01, unit: "ticks" },
    "Degrees": { "min": 0, "max": 360, "step": 0.01, unit: "deg" },
    "Radians": { "min": 0, "max": 6.28318530717959, "step": 0.01, unit: "rad" },
    "Gain": { "min": 0, "max": 1, "step": 0.01 },
    "Volume": { "min": -60, "max": 0, "step": 0.01, unit: "db" },
    "Pan": { "min": -1, "max": 1, "step": 0.01 },
    "ModulationRange": { "min": -1000, "max": 1000, "step": 0.01 },
    "TrackVolume": { "min": -60, "max": 0, "step": 0.01, unit: "db" },
    "TrackPan": { "min": -1, "max": 1, "step": 0.01 },
    "Amplitude": { "min": 0, "max": 1, "step": 0.01 },
    "Octaves": { "min": 0, "max": 8, "step": 1 },
    "Resonance": { "min": 0, "max": 7000, "step": 0.01 },
    "OutputRange": { "min": "any", "max": "any", "step": 0.01 },
    "AdrRange": { "min": 0, "max": 2, "step": 0.001, unit: "sec" },
    "Detune": { "min": -1200, "max": 1200, "step": 0.01, unit: "ct" },
    "Phase": { "min": 0, "max": 360, "step": 0.01 },
    "PartialCount": { "min": 0, "max": 32, "step": 1 },
    "Harmonicity": { "min": 0, "max": 128, "step": 0.1 },
    "Spread": { "min": 0, "max": 360, "step": 1 },
    "OscillatorCount": { "min": 0, "max": 20, "step": 1 },
    "OscillatorWidth": { "min": 0, "max": 20, "step": 1 },
    "Q": { "min": -20, "max": 20, "step": 0.01 },
    "FilterDetune": { "min": -2400, "max": 2400, "step": 0.1, unit: "ct" },
    "FilterGain": { "min": -60, "max": 60, "step": 0.01, unit: "db" },
    "Knee": { "min": 0, "max": 40, "step": 0.1 },
    "Ratio": { "min": 1, "max": 20, "step": 0.01 },
    "AttackNoise": { "min": 0.1, "max": 20, "step": 0.01 },
    "MaxPolyphony": { "min": 1, "max": 20, "step": 1 },
    "PitchDecay": { "min": 0, "max": "2", "step": 0.001, unit: "sec" },
    "TB303Cutoff": { "min": 100, "max": 8000, "step": 1, unit: "hz" },
    "TB303Resonance": { "min": 1, "max": 20, "step": 0.01 },
    "TB303Decay": { "min": 0.1, "max": 1.2, "step": 0.01, unit: "sec" },
    "TB303Drive": { "min": 0.1, "max": 1.2, "step": 0.01, unit: "db" }
  },
  
  "enumTypes": {
    "OscillatorType": {
      "values": [
        "sine","square","triangle","sawtooth","pulse","pwm",
        "fatsine","fatsquare","fattriangle","fatsawtooth",
        "amsine","amsquare","amtriangle","amsawtooth",
        "fmsine","fmsquare","fmtriangle","fmsawtooth"
      ]
    },
    "EnvelopeCurve": {
      "values": [
        "linear","exponential","sine",
        "cosine","bounce","ripple","step"
      ]
    },
    "Rolloff": {
      "values": [-12,-24,-48,-96]
    },
    "FilterType": {
      "values": [
        "lowpass","highpass","bandpass",
        "lowshelf","highshelf","peaking",
        "notch","allpass"
      ]
    },
    "OneShotCurve": {
      "values": [
        "linear","exponential"
      ]
    },
    "OversampleType": {
      "values": ["none","2x","4x"]
    },
    "NoiseType": {
      "values": ["pink","white","brown"]
    },
    "TB303Waveform": {
      "values": [
        "sawtooth", "square"
      ]
    },
  },

  "modules": {
    "AmplitudeEnvelope": {
      "parameters": {
        "attack": "unitTypes/AdrRange",
        "attackCurve": "enumTypes/EnvelopeCurve",
        "decay": "unitTypes/AdrRange",
        "decayCurve": "enumTypes/EnvelopeCurve",
        "sustain": "unitTypes/NormalRange",
        "release": "unitTypes/AdrRange",
        "releaseCurve": "enumTypes/EnvelopeCurve"
      }
    },

    "Noise": {
      "parameters": {
        "type": "enumTypes/NoiseType"
      }
    },
    
    "ModulationEnvelope": {
      "parameters": {
        "attack": "unitTypes/AdrRange",
        "attackCurve": "enumTypes/EnvelopeCurve",
        "decay": "unitTypes/AdrRange",
        "decayCurve": "enumTypes/EnvelopeCurve",
        "sustain": "unitTypes/NormalRange",
        "release": "unitTypes/AdrRange",
        "releaseCurve": "enumTypes/EnvelopeCurve"
      }
    },

    "FrequencyEnvelope": {
      "parameters": {
        "attack": "unitTypes/AdrRange",
        "attackCurve": "enumTypes/EnvelopeCurve",
        "decay": "unitTypes/AdrRange",
        "decayCurve": "enumTypes/EnvelopeCurve",
        "sustain": "unitTypes/NormalRange",
        "release": "unitTypes/AdrRange",
        "releaseCurve": "enumTypes/EnvelopeCurve",
        "baseFrequency": "unitTypes/Frequency",
        "octaves": "unitTypes/Octaves",
      }
    },

    "Filter": {
      "parameters": {
        "Q": "unitTypes/Q",
        "detune": "unitTypes/Cents",
        "frequency": "unitTypes/Frequency",
        "gain": "unitTypes/FilterGain",
        "rolloff": "enumTypes/Rolloff",
        "type": "enumTypes/FilterType"
      }
    },

    "OmniOscillator": {
      "parameters": {
        "detune": "unitTypes/Cents",
        "frequency": "unitTypes/Frequency",
        "partialCount": "unitTypes/PartialCount",
        "phase": "unitTypes/Degrees",
        "type": "enumTypes/OscillatorType",
        "harmonicity": "unitTypes/Harmonicity",
        "modulationType": "enumTypes/OscillatorType",
        "modulationIndex": "unitTypes/NormalRange",
        "spread": "unitTypes/Spread",
        "count": "unitTypes/OscillatorCount",
        "width": "unitTypes/NormalRange",
        "volume": "unitTypes/Decibels",
        "partials": "array",
      }
    }
  },

  "devices": {
    "AMSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "harmonicity": "unitTypes/Harmonicity",
        "envelope": "modules/AmplitudeEnvelope",
        "modulation": "modules/OmniOscillator",
        "modulationEnvelope": "modules/ModulationEnvelope",
        "oscillator": "modules/OmniOscillator"
      }
    },

    "DuoSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "harmonicity": "unitTypes/Harmonicity",
        "vibratoAmount": "unitTypes/NormalRange",
        "vibratoRate": "unitTypes/Frequency",
        "voice0": "devices/MonoSynth",
        "voice1": "devices/MonoSynth"
      }
    },

    "FMSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "harmonicity": "unitTypes/Harmonicity",
        "modulationIndex": "unitTypes/NormalRange",
        "envelope": "modules/AmplitudeEnvelope",
        "modulation": "modules/OmniOscillator",
        "modulationEnvelope": "modules/ModulationEnvelope",
        "oscillator": "modules/OmniOscillator"
      }
    },

    "MembraneSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "pitchDecay": "unitTypes/PitchDecay",
        "octaves": "unitTypes/Octaves",
        "envelope": "modules/AmplitudeEnvelope",
        "oscillator": "modules/OmniOscillator"
      }
    },

    "MetalSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "harmonicity": "unitTypes/Harmonicity",
        "modulationIndex": "unitTypes/NormalRange",
        "octaves": "unitTypes/Octaves",
        "resonance": "unitTypes/Resonance",
        "envelope": "modules/AmplitudeEnvelope"
      }
    },

    "MonoSynth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "envelope": "modules/AmplitudeEnvelope",
        "filter": "modules/Filter",
        "filterEnvelope": "modules/FrequencyEnvelope",
        "oscillator": "modules/OmniOscillator"
      }
    },

    "NoiseSynth": {
      "type": "Instrument",
      "noPitch": "true",
      "parameters": {
        "volume": "unitTypes/Decibels",
        "noise": "modules/Noise",
        "envelope": "modules/AmplitudeEnvelope"
      }
    },

    "PluckSynth": {
      "type": "Instrument",
      "parameters": {
        "volume": "unitTypes/Decibels",
        "attackNoise": "unitTypes/AttackNoise",
        "resonance": "unitTypes/Octaves",
        "release": "unitTypes/Octaves",
        "dampening": "unitTypes/Frequency"
      }
    },

    "PolySynth": {
      "type": "Instrument",
      "parameters": {
        "volume": "unitTypes/Decibels",
        "maxPolyphony": "unitTypes/MaxPolyphony"
      }
    },

    "Sampler": {
      "type": "Instrument",
      "parameters": {
        "attack": "unitTypes/AdrRange",
        "release": "unitTypes/AdrRange",
        "curve": "enumTypes/OneShotCurve",
        "volume": "unitTypes/Decibels"
      },
      "lists": {
        "samples": {
          "columns": ["note","name"],
          "itemMethods": {
            "▶️": "playSample"
          },
          "listMethods": {
            "add": {
              "displayName": "Add",
              "functionName": "addSample"
            },
          }
        }
      }
    },
    
    "Synth": {
      "type": "Instrument",
      "parameters": {
        "detune": "unitTypes/Cents",
        "portamento": "unitTypes/Time",
        "volume": "unitTypes/Decibels",
        "envelope": "modules/AmplitudeEnvelope",
        "oscillator": "modules/OmniOscillator"
      }
    },

    "DAWSome.TB303": {
      "type": "Instrument",
      "parameters": {
        "cutoff": "unitTypes/TB303Cutoff",
        "resonance": "unitTypes/TB303Resonance",
        "envelopeModulation": "unitTypes/NormalRange",
        "decay": "unitTypes/TB303Decay",
        "accent": "unitTypes/NormalRange",
        "drive": "unitTypes/TB303Drive",
        "waveform": "enumTypes/TB303Waveform",
        "volume": "unitTypes/Decibels",
      }
    },
    
    "DAWSome.TR909Snare": {
      "type": "Instrument",
      "parameters": {
        "filter": "modules/Filter",
        "volume": "unitTypes/Decibels"
      }
    },
    
    "AutoFilter": {
      "type": "Effect",
      "parameters": {
        "type": "enumTypes/OscillatorType",
        "frequency": "unitTypes/Time",
        "depth": "unitTypes/NormalRange",
        "baseFrequency": "unitTypes/Frequency",
        "octaves": "unitTypes/NormalRange",
        "filter": "modules/Filter"
      }
    },

    "AutoPanner": {
      "type": "Effect",
      "parameters": {
        "depth": "unitTypes/NormalRange",
        "frequency": "unitTypes/Time",
        "type": "enumTypes/OscillatorType",
        "wet": "unitTypes/NormalRange"
      }
    },

    "AutoWah": {
      "type": "Effect",
      "parameters": {
        "Q": "unitTypes/Positive",
        "baseFrequency": "unitTypes/Frequency",
        "gain": "unitTypes/Decibels",
        "octaves": "unitTypes/NormalRange",
        "sensitivity": "unitTypes/Decibels",
        "follower": "unitTypes/Time",
        "wet": "unitTypes/NormalRange"
      }
    },

    "Compressor": {
      "type": "Effect",
      "parameters": {
        "threshold": "unitTypes/Decibels",
        "knee": "unitTypes/Knee",
        "ratio": "unitTypes/Ratio",
        "attack": "unitTypes/NormalRange",
        "release": "unitTypes/NormalRange"
      }
    },

    "Distortion": {
      "type": "Effect",
      "parameters": {
        "distortion": "unitTypes/NormalRange",
        "oversample": "enumTypes/OversampleType",
        "wet": "unitTypes/NormalRange"
      }
    },

    "Filter": {
      "type": "Effect",
      "parameters": {
        "Q": "unitTypes/Q",
        "detune": "unitTypes/FilterDetune",
        "frequency": "unitTypes/Frequency",
        "gain": "unitTypes/FilterGain",
        "rolloff": "enumTypes/Rolloff",
        "type": "enumTypes/FilterType"
      }
    },

    "Freeverb": {
      "type": "Effect",
      "parameters": {
        "roomSize": "unitTypes/NormalRange",
        "wet": "unitTypes/NormalRange"
      }
    },

    "JCReverb": {
      "type": "Effect",
      "parameters": {
        "roomSize": "unitTypes/NormalRange",
        "wet": "unitTypes/NormalRange"
      }
    },

    "LFO": {
      "type": "Effect",
      "parameters": {
        "type": "enumTypes/OscillatorType",
        "min": "unitTypes/ModulationRange",
        "max": "unitTypes/ModulationRange",
        "phase": "unitTypes/Degrees",
        "frequency": "unitTypes/Frequency",
        "amplitude": "unitTypes/NormalRange"
      }
    },

    "Phaser": {
      "type": "Effect",
      "parameters": {
        "frequency": "unitTypes/Frequency",
        "Q": "unitTypes/Positive",
        "baseFrequency": "unitTypes/Frequency",
        "octaves": "unitTypes/NormalRange",
        "wet": "unitTypes/NormalRange"
      }
    },

    "PingPongDelay": {
      "type": "Effect",
      "parameters": {
        "delayTime": "unitTypes/Time",
        "feedback": "unitTypes/NormalRange",
        "wet": "unitTypes/NormalRange"
      }
    },

    "Reverb": {
      "type": "Effect",
      "parameters": {
        "decay": "unitTypes/Time",
        "preDelay": "unitTypes/Time",
        "wet": "unitTypes/NormalRange"
      }
    },

    "StereoWidener": {
      "type": "Effect",
      "parameters": {
        "width": "unitTypes/NormalRange",
        "wet": "unitTypes/NormalRange"
      }
    }
  }
}