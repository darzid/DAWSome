  // ===== Constants =====
  const Constants = {
    PITCH_COUNT: 128,
    TOP_PITCH: 127,
    BEATS_PER_BAR: 4,                 // fixed 4/4
    NOTE_NAMES: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    BLACK_KEYS: new Set([1, 3, 6, 8, 10]),
    DEFAULT_VELOCITY: 0.75,
    ACCENT_VELOCITY: 1.0,
    MIN_FREE_DURATION: 1 / 16,
    EPS: 1e-6,
    DRAG_THRESHOLD: 4,
    TAP_SLOP: 8,
    ZOOM_BUTTON_FACTOR: 1.25,
    MIN_SONG_BEATS: 8,
    SONG_TAIL_BEATS: 16,              // empty space kept after the last clip

    TONE_LOOKAHEAD: 0.15,
    TONE_STARTAHEAD: "+0.5",
    TONE_PARAM_SCHEDULEAHEAD: "+0.05",
    TONE_NOTE_TRIGGERAHEAD: 0.05,
    
    FIXED_GRIDS: { "1bar": 4, "1/2": 2, "1/4": 1, "1/8": 0.5, "1/16": 0.25, "1/32": 0.125 },
    ADAPTIVE_MIN_PX: { widest: 96, wide: 48, medium: 24, narrow: 12, narrowest: 6 },
    ADAPTIVE_STEPS: [4, 2, 1, 0.5, 0.25, 0.125, 0.0625],
    STEP_LABELS: new Map([[4, "1 Bar"], [2, "1/2"], [1, "1/4"], [0.5, "1/8"], [0.25, "1/16"], [0.125, "1/32"], [0.0625, "1/64"]]),
    TRACK_COLORS: ["#f2b544", "#5fc9d8", "#e07a7a", "#9bd76e", "#c58cf0", "#f08c4a", "#7ea6f0", "#e6d35a"],

    DEFAULT_INSTRUMENT: {
      name: "MonoSynth",
      type: "Instrument",
      parameters: {
        "volume": 0,
        "portamento": 0,
        "oscillator": {
          "type": "sawtooth"
        }
      }
    },
    COLORS: {
      void: "#141414", rowWhite: "#262626", rowBlack: "#1e1e1e", octaveLine: "#3a3a3a",
      laneA: "#222222", laneB: "#1f1f1f", laneLine: "#2e2e2e",
      lineSub: "#2e2e2e", lineBeat: "#3d3d3d", lineBar: "#5a5a5a",
      regionShade: "rgba(0, 0, 0, 0.4)", regionEdge: "#707070",
      note: "#f2b544", noteBorder: "#7a5312", noteSelected: "#fff1c9",
      accentNote: "#f244b5", accentNoteSelected: "#ffc9f1",
      slideNoteBorder: "#0000ff",
      playhead: "#ececec", ruler: "#262626", rulerRegion: "#333333", rulerTick: "#5c5c5c", rulerText: "#c0c0c0",
      keyWhite: "#d8d8d8", keyBlack: "#1a1a1a", keyBorder: "#a9a9a9", keyActive: "#f2b544",
      keyTextDark: "#333333", keyTextLight: "#b0b0b0",
      clipText: "#1a1a1a", clipNote: "rgba(0, 0, 0, 0.55)", clipRepeatNote: "rgba(0,0,0, 0.35)", clipSelected: "#ffffff", message: "#777777",
    }
  }