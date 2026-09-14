/**
 * Application entry point.
 *
 * Everything the DAW does lives in a module: `main.js` only composes them.
 * Adding a feature means writing one more module and adding a `use()` line.
 */
import { App } from "./core/App.js";

import { KeyboardModule } from "./modules/KeyboardModule.js";
import { PanelsModule } from "./modules/PanelsModule.js";
import { ProjectModule } from "./model/ProjectModule.js";
import { DevicesModule } from "./devices/DevicesModule.js";
import { AudioModule } from "./audio/AudioModule.js";
import { TransportModule } from "./modules/TransportModule.js";
import { StatusBarModule } from "./modules/StatusBarModule.js";
import { ArrangementModule } from "./modules/ArrangementModule.js";
import { ClipEditorModule } from "./modules/ClipEditorModule.js";
import { DevicePanelModule } from "./modules/DevicePanelModule.js";
import { MixerModule } from "./modules/MixerModule.js";
import { MidiImportModule } from "./modules/MidiImportModule.js";
import { DemoSongModule } from "./modules/DemoSongModule.js";

const app = new App();

// The list below is dependency order, not preference, and must not be
// reordered casually. `install()` runs in this order, and a module may only
// look up a service that a module installed *earlier* has already provided:
//   KeyboardModule  -> "commands"
//   PanelsModule    -> "panels"
//   ProjectModule   -> "project", "parameters"
//   DevicesModule   -> "catalog", "presets"  (in start(), not install())
//   AudioModule     -> "audio"
//   TransportModule -> "transport"
//   StatusBarModule -> "status"
// Because "catalog" and "presets" only appear during DevicesModule.start(),
// they must be looked up in start() or later, never in install().
// The remaining modules provide no service and consume the ones above, so
// they come last; DemoSongModule is last of all, seeding the project once
// every module that reacts to project events is subscribed.
app
  .use(new KeyboardModule())
  .use(new PanelsModule())
  .use(new ProjectModule())
  .use(new DevicesModule())
  .use(new AudioModule())
  .use(new TransportModule())
  .use(new StatusBarModule())
  .use(new ArrangementModule())
  .use(new ClipEditorModule())
  .use(new DevicePanelModule())
  .use(new MixerModule())
  .use(new MidiImportModule())
  .use(new DemoSongModule());

// Exposed for debugging from the console: `dawsome.get("parameters")`.
globalThis.dawsome = app;

try {
  await app.start();
} catch (err) {
  console.error("DAWSome failed to start", err);
}
