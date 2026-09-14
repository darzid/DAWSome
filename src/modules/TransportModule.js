import { Module } from "../core/Module.js";
import { $ } from "../ui/dom.js";
import { BEATS_PER_BAR, clamp } from "../util/music.js";

/** Lowest BPM the transport accepts. */
const MIN_BPM = 20;
/** Highest BPM the transport accepts. */
const MAX_BPM = 300;

/**
 * Playback clock of the application: owns the playhead position, the playing
 * flag and the "follow the playhead" preference, and drives the audio engine.
 *
 * Emits `transport:playhead`, `transport:tick`, `transport:state` and
 * `transport:follow` on the application bus.
 */
export class Transport {
  /** @type {object} the project being played. */
  #project;
  /** @type {object} the `audio` service (AudioEngine). */
  #audio;
  /** @type {object} the application event bus. */
  #bus;

  /** @type {number} current playhead position in beats. */
  playheadBeat = 0;
  /** @type {boolean} whether the transport is rolling. */
  playing = false;
  /** @type {boolean} whether views scroll along with the playhead. */
  follow = true;

  /**
   * @param {object} deps
   * @param {object} deps.project the project to play.
   * @param {object} deps.audio the `audio` service (AudioEngine).
   * @param {object} deps.bus the application event bus.
   */
  constructor({ project, audio, bus }) {
    this.#project = project;
    this.#audio = audio;
    this.#bus = bus;
  }

  /**
   * Move the playhead to a beat, seek the audio engine and announce it.
   * @param {number} beat position in beats.
   */
  setPlayhead(beat) {
    this.playheadBeat = beat;
    this.#audio.seek(beat);
    this.#bus.emit("transport:playhead", { beat });
  }

  /**
   * Start playback and run a frame loop that publishes the playhead position.
   * A failing audio engine is reported and leaves the transport stopped.
   * @returns {Promise<void>}
   */
  async play() {
    try {
      await this.#audio.play();
    } catch (err) {
      console.error("Playback could not start:", err);
      return;
    }
    this.playing = true;
    this.#bus.emit("transport:state", { playing: this.playing });
    const tick = () => {
      if (!this.playing) return;
      this.playheadBeat = this.#audio.positionBeat();
      this.#bus.emit("transport:tick", { beat: this.playheadBeat });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Stop playback and rewind the playhead to the start of the song. */
  stop() {
    this.#audio.stop();
    this.playing = false;
    this.#bus.emit("transport:state", { playing: this.playing });
    this.setPlayhead(0);
  }

  /**
   * Stop when rolling, start otherwise.
   * @returns {Promise<void>}
   */
  async toggle() {
    if (this.playing) this.stop();
    else await this.play();
  }

  /**
   * Turn "scroll with the playhead" on or off.
   * @param {boolean} on the desired state.
   */
  setFollow(on) {
    this.follow = Boolean(on);
    this.#bus.emit("transport:follow", { follow: this.follow });
  }
}

/**
 * Provides the `transport` service, registers the `transport.toggle` command
 * and wires the transport controls of the toolbar: play button, position
 * readout, BPM input, loop button and follow button.
 */
export class TransportModule extends Module {
  /** @type {Transport|null} the transport provided by this module. */
  #transport = null;
  /** @type {(() => void)|null} unregisters the `transport.toggle` command. */
  #unregisterCommand = null;
  /** @type {Array<() => void>} bus unsubscribe functions. */
  #unsubscribes = [];
  /** @type {Array<{ target: EventTarget, type: string, handler: EventListener }>} DOM listeners. */
  #listeners = [];

  /** @returns {string} the module name. */
  get name() {
    return "TransportModule";
  }

  /**
   * Create the transport, publish it as a service and register its command.
   * @param {object} app the application.
   */
  install(app) {
    this.#transport = new Transport({
      project: app.get("project"),
      audio: app.get("audio"),
      bus: app.bus,
    });
    app.provide("transport", this.#transport);
    this.#unregisterCommand = app.get("commands").register({
      id: "transport.toggle",
      title: "Play / Stop",
      shortcut: "Space",
      run: () => this.#transport.toggle(),
    });
  }

  /**
   * Bind the toolbar transport controls to the transport and the project.
   * @param {object} app the application.
   * @returns {Promise<void>}
   */
  async start(app) {
    const transport = this.#transport;
    const project = app.get("project");
    const audio = app.get("audio");

    const playBtn = $("playBtn");
    const posReadout = $("posReadout");
    const bpmInput = $("bpmInput");
    const loopBtn = $("loopBtn");
    const followBtn = $("followBtn");

    this.#bind(playBtn, "click", () => transport.toggle());
    this.#subscribe(app.bus.on("transport:state", ({ playing }) => {
      playBtn.textContent = playing ? "■" : "▶";
      playBtn.classList.toggle("on", playing);
    }));

    const writePosition = (beat) => {
      posReadout.textContent = `${Math.floor(beat / BEATS_PER_BAR) + 1}.${Math.floor(beat % BEATS_PER_BAR) + 1}.${Math.floor((beat % 1) * 4) + 1}`;
    };
    this.#subscribe(app.bus.on("transport:playhead", ({ beat }) => writePosition(beat)));
    this.#subscribe(app.bus.on("transport:tick", ({ beat }) => writePosition(beat)));
    writePosition(transport.playheadBeat);

    this.#bind(bpmInput, "input", () => {
      const v = Number(bpmInput.value);
      if (v >= MIN_BPM && v <= MAX_BPM) project.setBpm(v);
    });
    this.#bind(bpmInput, "change", () => {
      const bpm = clamp(Number(bpmInput.value) || project.bpm, MIN_BPM, MAX_BPM);
      project.setBpm(bpm);
      bpmInput.value = bpm;
    });
    this.#subscribe(app.bus.on("project:bpm", ({ bpm }) => {
      if (bpmInput !== document.activeElement) bpmInput.value = bpm;
    }));
    bpmInput.value = project.bpm;

    this.#bind(loopBtn, "click", () => project.setLoop(!project.loop));
    this.#subscribe(app.bus.on("project:loop", ({ loop }) => loopBtn.classList.toggle("on", loop)));
    loopBtn.classList.toggle("on", project.loop);

    this.#bind(followBtn, "click", () => transport.setFollow(!transport.follow));
    this.#subscribe(app.bus.on("transport:follow", ({ follow }) => followBtn.classList.toggle("on", follow)));
    followBtn.classList.toggle("on", transport.follow);

    if (!audio.available) playBtn.disabled = true;
  }

  /** Remove every listener, subscription and command this module added. */
  dispose() {
    for (const off of this.#unsubscribes) off();
    this.#unsubscribes = [];
    for (const { target, type, handler } of this.#listeners) target.removeEventListener(type, handler);
    this.#listeners = [];
    if (this.#unregisterCommand) {
      this.#unregisterCommand();
      this.#unregisterCommand = null;
    }
  }

  /**
   * Add a DOM listener and remember it for {@link TransportModule#dispose}.
   * @param {EventTarget} target the element to listen on.
   * @param {string} type the event type.
   * @param {EventListener} handler the listener.
   */
  #bind(target, type, handler) {
    target.addEventListener(type, handler);
    this.#listeners.push({ target, type, handler });
  }

  /**
   * Remember a bus unsubscribe function for {@link TransportModule#dispose}.
   * @param {() => void} off the unsubscribe function returned by `bus.on`.
   */
  #subscribe(off) {
    this.#unsubscribes.push(off);
  }
}
