  let presetBankJson = {
  "effect\\AutoFilter\\Evolve": {
    "frequency": 1,
    "type": "sine",
    "depth": 1,
    "baseFrequency": 200,
    "octaves": 2.6,
    "filter": {
      "type": "lowpass",
      "rolloff": -12,
      "Q": 1
    }
  },
  "effect\\AutoFilter\\RoboLips": {
    "frequency": 5,
    "type": "square4",
    "depth": 0.4,
    "baseFrequency": 150,
    "octaves": 3.1,
    "filter": {
      "type": "lowpass",
      "rolloff": -24,
      "Q": 4
    }
  },
  "effect\\AutoPanner\\Square": {
    "frequency": "8n",
    "type": "square6",
    "depth": 0.8
  },
  "effect\\AutoPanner\\Uneven": {
    "frequency": 0.6,
    "type": "sine3",
    "depth": 1
  },
  "effect\\AutoWah\\Talker": {
    "baseFrequency": 140,
    "octaves": 4,
    "sensitivity": 0,
    "Q": 7,
    "gain": 5,
    "rolloff": -48,
    "follower": {
      "attack": 0.5,
      "release": 0.1
    }
  },
  "effect\\AutoWah\\Yes": {
    "baseFrequency": 250,
    "octaves": 3.1,
    "sensitivity": 0,
    "Q": 2,
    "gain": 5,
    "rolloff": -24,
    "follower": {
      "attack": 0.3,
      "release": 0.1
    }
  },
  "effect\\BitCrusher\\8bit": {
    "bits": 8
  },
  "effect\\BitCrusher\\Destroy": {
    "bits": 1
  },
  "effect\\Chebyshev\\CoinOperated": {
    "order": 108
  },
  "effect\\Chebyshev\\Hornsy": {
    "order": 50
  },
  "effect\\Chebyshev\\Peaker": {
    "order": 11
  },
  "effect\\Chorus\\Ether": {
    "frequency": 0.3,
    "delayTime": 8,
    "type": "triangle",
    "depth": 0.8,
    "feedback": 0.4,
    "spread": 180
  },
  "effect\\Chorus\\Harmony": {
    "frequency": 12,
    "delayTime": 3.5,
    "type": "sine2",
    "depth": 0.8,
    "feedback": 0.1,
    "spread": 180
  },
  "effect\\Chorus\\Rattler": {
    "frequency": "16n",
    "delayTime": 15,
    "type": "square",
    "depth": 0.2,
    "feedback": 0.3,
    "spread": 80
  },
  "effect\\Chorus\\Thirds": {
    "frequency": 4,
    "delayTime": 16,
    "type": "triangle",
    "depth": 1,
    "feedback": 0.1,
    "spread": 80
  },
  "effect\\Chorus\\TinCan": {
    "frequency": 0.2,
    "delayTime": 20,
    "type": "sine",
    "depth": 1,
    "feedback": 0.45,
    "spread": 180
  },
  "effect\\Compressor\\Default": {
  },
  "effect\\Distortion\\Default": {
  },
  "effect\\Distortion\\Clean": {
    "distortion": 0.08
  },
  "effect\\Distortion\\Fried": {
    "distortion": -0.08
  },
  "effect\\Distortion\\Growl": {
    "distortion": 1.4
  },
  "effect\\Distortion\\Saturate": {
    "distortion": 0.08,
    "wet": 0.3
  },
  "effect\\Distortion\\Thick": {
    "distortion": 0.6
  },
  "effect\\FeedbackDelay\\Counterpoints": {
    "delayTime": "8t",
    "feedback": 0.2
  },
  "effect\\FeedbackDelay\\DecayDelay": {
    "delayTime": "8n",
    "feedback": 0.4
  },
  "effect\\FeedbackDelay\\Minimalist": {
    "delayTime": "4n",
    "feedback": 0.7
  },
  "effect\\Freeverb\\Bigplate": {
    "roomSize": 0.9,
    "dampening": 2000
  },
  "effect\\Freeverb\\Cave": {
    "roomSize": 0.95,
    "dampening": 1200
  },
  "effect\\Freeverb\\Glassroom": {
    "roomSize": 0.7,
    "dampening": 4300
  },
  "effect\\JCReverb\\BounceHall": {
    "roomSize": 0.8
  },
  "effect\\JCReverb\\NotNormal": {
    "roomSize": 0.5
  },
  "effect\\Phaser\\Bubbles": {
    "frequency": 0.5,
    "octaves": 3.3,
    "Q": 8,
    "baseFrequency": 250
  },
  "effect\\Phaser\\Jetsons": {
    "frequency": 12,
    "octaves": 3.3,
    "Q": 8,
    "baseFrequency": 250
  },
  "effect\\Phaser\\Landing": {
    "frequency": 4,
    "octaves": 0.4,
    "Q": 20,
    "baseFrequency": 800
  },
  "effect\\Phaser\\Testing": {
    "frequency": 10,
    "octaves": 0.2,
    "Q": 2,
    "baseFrequency": 700
  },
  "effect\\PingPongDelay\\RhythmicDelay": {
    "delayTime": "8n",
    "feedback": 0.6
  },
  "effect\\PingPongDelay\\SlowSteady": {
    "delayTime": "4n",
    "feedback": 0.2
  },
  "effect\\PingPongDelay\\ThickStereo": {
    "delayTime": "16t",
    "feedback": 0.3
  },
  "effect\\PitchShift\\Chimes": {
    "pitch": 2,
    "windowSize": 0.04,
    "delayTime": 0.03,
    "feedback": 0.5
  },
  "effect\\PitchShift\\DownTheWell": {
    "pitch": -5,
    "windowSize": 0.05,
    "delayTime": 0.3,
    "feedback": 0.2
  },
  "effect\\PitchShift\\Fifths": {
    "pitch": 7,
    "windowSize": 0.1,
    "delayTime": 0,
    "feedback": 0,
    "wet": 0.5
  },
  "effect\\Tremolo\\Classic": {
    "frequency": 10,
    "type": "sine",
    "depth": 0.5,
    "spread": 180
  },
  "effect\\Tremolo\\Tremble": {
    "frequency": 5,
    "type": "triangle",
    "depth": 0.6,
    "spread": 0
  },
  "effect\\Vibrato\\Phonograph": {
    "frequency": 2.3,
    "depth": 0.4,
    "type": "triangle"
  },
  "effect\\Vibrato\\Singer": {
    "frequency": 5,
    "depth": 0.2,
    "type": "sine"
  },
  "instrument\\AMSynth\\Default": {
    
  },
  "instrument\\AMSynth\\Harmonics": {
    "harmonicity": 3.999,
    "oscillator": {
      "type": "square"
    },
    "envelope": {
      "attack": 0.03,
      "decay": 0.3,
      "sustain": 0.7,
      "release": 0.8
    },
    "modulation": {
      "volume": 12,
      "type": "square6"
    },
    "modulationEnvelope": {
      "attack": 2,
      "decay": 3,
      "sustain": 0.8,
      "release": 0.1
    }
  },
  "instrument\\AMSynth\\Tiny": {
    "harmonicity": 2,
    "oscillator": {
      "type": "amsine2",
      "modulationType": "sine",
      "harmonicity": 1.01
    },
    "envelope": {
      "attack": 0.006,
      "decay": 4,
      "sustain": 0.04,
      "release": 1.2
    },
    "modulation": {
      "volume": 13,
      "type": "amsine2",
      "modulationType": "sine",
      "harmonicity": 12
    },
    "modulationEnvelope": {
      "attack": 0.006,
      "decay": 0.2,
      "sustain": 0.2,
      "release": 0.4
    }
  },
  "instrument\\DuoSynth\\Default": {
  },
  "instrument\\FMSynth\\Default": {
  },
  "instrument\\FMSynth\\ElectricCello": {
    "harmonicity": 3.01,
    "modulationIndex": 14,
    "oscillator": {
      "type": "triangle"
    },
    "envelope": {
      "attack": 0.2,
      "decay": 0.3,
      "sustain": 0.1,
      "release": 1.2
    },
    "modulation": {
      "type": "square"
    },
    "modulationEnvelope": {
      "attack": 0.01,
      "decay": 0.5,
      "sustain": 0.2,
      "release": 0.1
    }
  },
  "instrument\\FMSynth\\Kalimba": {
    "harmonicity": 8,
    "modulationIndex": 2,
    "oscillator": {
      "type": "sine"
    },
    "envelope": {
      "attack": 0.001,
      "decay": 2,
      "sustain": 0.1,
      "release": 2
    },
    "modulation": {
      "type": "square"
    },
    "modulationEnvelope": {
      "attack": 0.002,
      "decay": 0.2,
      "sustain": 0,
      "release": 0.2
    }
  },
  "instrument\\FMSynth\\ThinSaws": {
    "harmonicity": 0.5,
    "modulationIndex": 1.2,
    "oscillator": {
      "type": "fmsawtooth",
      "modulationType": "sine",
      "modulationIndex": 20,
      "harmonicity": 3
    },
    "envelope": {
      "attack": 0.05,
      "decay": 0.3,
      "sustain": 0.1,
      "release": 1.2
    },
    "modulation": {
      "volume": 0,
      "type": "triangle"
    },
    "modulationEnvelope": {
      "attack": 0.35,
      "decay": 0.1,
      "sustain": 1,
      "release": 0.01
    }
  },
  "instrument\\MembraneSynth\\Default": {},
  "instrument\\MembraneSynth\\PsyKick": {
    "detune": -1000,
    "pitchDecay": 0.05,
    "octaves": 8,
    "volume": 0,
    "envelope": {
      "attack": 0.001,
      "attackCurve": "linear",
      "decay": 0.1,
      "sustain": 0.2,
      "release": 0.1
    }
  },
  "instrument\\MetalSynth\\Default": {},
  "instrument\\MetalSynth\\ClosedHat": {
    "volume": -10,
    "portamento": 100,
    "modulationIndex": 1,
    "octaves": 0,
    "envelope": {
      "attack": 0.01,
      "decay": 0.05,
      "sustain": 0.1,
      "release": 1.4
    }
  },
  "instrument\\MonoSynth\\Default": {},
  "instrument\\MonoSynth\\Bah": {
    "volume": 10,
    "oscillator": {
      "type": "sawtooth"
    },
    "filter": {
      "Q": 2,
      "type": "bandpass",
      "rolloff": -24
    },
    "envelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0.2,
      "release": 0.6
    },
    "filterEnvelope": {
      "attack": 0.02,
      "decay": 0.4,
      "sustain": 1,
      "release": 0.7,
      "releaseCurve": "linear",
      "baseFrequency": 20,
      "octaves": 5
    }
  },
  "instrument\\MonoSynth\\BassGuitar": {
    "oscillator": {
      "type": "fmsquare5",
      "modulationType": "triangle",
      "modulationIndex": 2,
      "harmonicity": 0.501
    },
    "filter": {
      "Q": 1,
      "type": "lowpass",
      "rolloff": -24
    },
    "envelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0.4,
      "release": 2
    },
    "filterEnvelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0.8,
      "release": 1.5,
      "baseFrequency": 50,
      "octaves": 4.4
    }
  },
  "instrument\\MonoSynth\\Bassy": {
    "portamento": 0.08,
    "oscillator": {
      "partials": [
        2,
        1,
        3,
        2,
        0.4
      ]
    },
    "filter": {
      "Q": 4,
      "type": "lowpass",
      "rolloff": -48
    },
    "envelope": {
      "attack": 0.04,
      "decay": 0.06,
      "sustain": 0.4,
      "release": 1
    },
    "filterEnvelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0.6,
      "release": 1.5,
      "baseFrequency": 50,
      "octaves": 3.4
    }
  },
  "instrument\\MonoSynth\\BrassCircuit": {
    "portamento": 0.01,
    "oscillator": {
      "type": "sawtooth"
    },
    "filter": {
      "Q": 2,
      "type": "lowpass",
      "rolloff": -24
    },
    "envelope": {
      "attack": 0.1,
      "decay": 0.1,
      "sustain": 0.6,
      "release": 0.5
    },
    "filterEnvelope": {
      "attack": 0.05,
      "decay": 0.8,
      "sustain": 0.4,
      "release": 1.5,
      "baseFrequency": 2000,
      "octaves": 1.5
    }
  },
  "instrument\\MonoSynth\\CoolGuy": {
    "oscillator": {
      "type": "pwm",
      "modulationFrequency": 1
    },
    "filter": {
      "Q": 6,
      "rolloff": -24
    },
    "envelope": {
      "attack": 0.025,
      "decay": 0.3,
      "sustain": 0.9,
      "release": 2
    },
    "filterEnvelope": {
      "attack": 0.245,
      "decay": 0.131,
      "sustain": 0.5,
      "release": 2,
      "baseFrequency": 20,
      "octaves": 7.2,
      "exponent": 2
    }
  },
  "instrument\\MonoSynth\\Pianoetta": {
    "oscillator": {
      "type": "square"
    },
    "filter": {
      "Q": 2,
      "type": "lowpass",
      "rolloff": -12
    },
    "envelope": {
      "attack": 0.005,
      "decay": 3,
      "sustain": 0,
      "release": 0.45
    },
    "filterEnvelope": {
      "attack": 0.001,
      "decay": 0.32,
      "sustain": 0.9,
      "release": 3,
      "baseFrequency": 700,
      "octaves": 2.3
    }
  },
  "instrument\\MonoSynth\\Pizz": {
    "oscillator": {
      "type": "sawtooth"
    },
    "filter": {
      "Q": 3,
      "type": "highpass",
      "rolloff": -12
    },
    "envelope": {
      "attack": 0.01,
      "decay": 0.3,
      "sustain": 0,
      "release": 0.9
    },
    "filterEnvelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0,
      "release": 0.1,
      "baseFrequency": 800,
      "octaves": -1.2
    }
  },
  "instrument\\MonoSynth\\PsyBass": {
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
  },
  "instrument\\NoiseSynth\\Gravel": {
    "noise": {
      "type": "pink",
      "playbackRate": 0.1
    },
    "envelope": {
      "attack": 0.5,
      "decay": 2,
      "sustain": 0.5,
      "release": 3
    }
  },
  "instrument\\NoiseSynth\\Slap": {
    "noise": {
      "type": "white",
      "playbackRate": 5
    },
    "envelope": {
      "attack": 0.001,
      "decay": 0.3,
      "sustain": 0,
      "release": 0.3
    }
  },
  "instrument\\NoiseSynth\\Swoosh": {
    "noise": {
      "type": "white",
      "playbackRate": 0.6
    },
    "envelope": {
      "attackCurve": "exponential",
      "attack": 0.3,
      "decay": 0.2,
      "sustain": 0,
      "release": 0.2
    }
  },
  "instrument\\NoiseSynth\\Train": {
    "noise": {
      "type": "pink",
      "playbackRate": 0.2
    },
    "envelope": {
      "attackCurve": "ripple",
      "releaseCurve": "ripple",
      "attack": 1,
      "decay": 0.3,
      "sustain": 1,
      "release": 1
    }
  },
  "instrument\\PluckSynth\\Default": {},
  "instrument\\PolySynth\\Default": {},
  "instrument\\Synth\\Default": {},
  "instrument\\Synth\\AlienChorus": {
    "oscillator": {
      "type": "fatsine4",
      "spread": 60,
      "count": 10
    },
    "envelope": {
      "attack": 0.4,
      "decay": 0.01,
      "sustain": 1,
      "attackCurve": "sine",
      "releaseCurve": "sine",
      "release": 0.4
    }
  },
  "instrument\\Synth\\DelicateWindPart": {
    "portamento": 0.0,
    "oscillator": {
      "type": "square4"
    },
    "envelope": {
      "attack": 2,
      "decay": 1,
      "sustain": 0.2,
      "release": 2
    }
  },
  "instrument\\Synth\\DropPulse": {
    "oscillator": {
      "type": "pulse",
      "width": 0.8
    },
    "envelope": {
      "attack": 0.01,
      "decay": 0.05,
      "sustain": 0.2,
      "releaseCurve": "bounce",
      "release": 0.4
    }
  },
  "instrument\\Synth\\Lectric": {
    "portamento": 0.2,
    "oscillator": {
      "type": "sawtooth"
    },
    "envelope": {
      "attack": 0.03,
      "decay": 0.1,
      "sustain": 0.2,
      "release": 0.02
    }
  },
  "instrument\\Synth\\Marimba": {
    "oscillator": {
      "partials": [
        1,
        0,
        2,
        0,
        3
      ]
    },
    "envelope": {
      "attack": 0.001,
      "decay": 1.2,
      "sustain": 0,
      "release": 1.2
    }
  },
  "instrument\\Synth\\Steelpan": {
    "oscillator": {
      "type": "fatcustom",
      "partials": [
        0.2,
        1,
        0,
        0.5,
        0.1
      ],
      "spread": 40,
      "count": 3
    },
    "envelope": {
      "attack": 0.001,
      "decay": 1.6,
      "sustain": 0,
      "release": 1.6
    }
  },
  "instrument\\Synth\\SuperSaw": {
    "oscillator": {
      "type": "fatsawtooth",
      "count": 3,
      "spread": 30
    },
    "envelope": {
      "attack": 0.01,
      "decay": 0.1,
      "sustain": 0.5,
      "release": 0.4,
      "attackCurve": "exponential"
    }
  },
  "instrument\\Synth\\TreeTrunk": {
    "oscillator": {
      "type": "sine"
    },
    "envelope": {
      "attack": 0.001,
      "decay": 0.1,
      "sustain": 0.1,
      "release": 1.2
    }
  }
}
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
    "Q": { "min": -20, "max": 20, "step": 0.01 },
    "FilterDetune": { "min": -2400, "max": 2400, "step": 0.1, unit: "ct" },
    "FilterGain": { "min": -60, "max": 60, "step": 0.01, unit: "db" },
    "Knee": { "min": 0, "max": 40, "step": 0.1 },
    "Ratio": { "min": 1, "max": 20, "step": 0.01 },
    "AttackNoise": { "min": 0.1, "max": 20, "step": 0.01 },
    "MaxPolyphony": { "min": 1, "max": 20, "step": 1 },
    "PitchDecay": { "min": 0, "max": "12000", "step": 0.01, unit: "sec" },
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
    "OversampleType": {
      "values": ["none","2x","4x"]
    },
    "NoiseType": {
      "values": ["pink","white","brown"]
    }
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
        "type": "enumTypes/OscillatorType"
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
        "harmonicity": "unitTypes/NormalRange",
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
        "harmonicity": "unitTypes/NormalRange",
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
        "harmonicity": "unitTypes/NormalRange",
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
        "harmonicity": "unitTypes/NormalRange",
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
      "parameters": {
        "volume": "unitTypes/Decibels",
        "noise": "enumTypes/NoiseType",
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