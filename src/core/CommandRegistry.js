/**
 * Named, keyboard-bindable actions.
 *
 * A command is `{ id, title, run, shortcut?, when? }`. Toolbar buttons and the
 * keyboard module both go through `run(id)`, so a feature exposes an action
 * once and gets a shortcut, a button and a menu entry from the same definition.
 *
 * Shortcut syntax: "Space", "B", "Escape", "Delete", "Ctrl+D". "Ctrl" matches
 * either the Control or the Command key. An array lists alternatives.
 */
export class CommandRegistry {
  #commands = new Map();

  register(command) {
    const { id, run } = command;
    if (typeof id !== "string" || !id) throw new TypeError("A command needs a string id.");
    if (typeof run !== "function") throw new TypeError(`Command "${id}" needs a run() function.`);
    if (this.#commands.has(id)) throw new Error(`Command "${id}" is already registered.`);
    const shortcuts = command.shortcut == null ? [] : [command.shortcut].flat().map(parseShortcut);
    const entry = { title: id, when: null, ...command, shortcuts };
    this.#commands.set(id, entry);
    return () => this.#commands.delete(id);
  }

  has(id) {
    return this.#commands.has(id);
  }

  get(id) {
    const command = this.#commands.get(id);
    if (!command) throw new Error(`Unknown command "${id}".`);
    return command;
  }

  list() {
    return [...this.#commands.values()];
  }

  /** Returns true when the command ran, false when its `when` guard declined. */
  run(id, ...args) {
    const command = this.get(id);
    if (command.when && !command.when()) return false;
    command.run(...args);
    return true;
  }

  /** Find the first enabled command whose shortcut matches a keyboard event. */
  matchShortcut(event) {
    for (const command of this.#commands.values()) {
      if (!command.shortcuts.some((s) => shortcutMatches(s, event))) continue;
      if (command.when && !command.when()) continue;
      return command;
    }
    return null;
  }
}

const MODIFIER_TOKENS = new Set(["ctrl", "cmd", "meta", "control", "command"]);

export function parseShortcut(text) {
  const tokens = String(text).split("+").map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) throw new Error(`Empty shortcut "${text}".`);
  const key = tokens.pop();
  const modifiers = tokens.map((t) => t.toLowerCase());
  const unknown = modifiers.find((m) => !MODIFIER_TOKENS.has(m));
  if (unknown) throw new Error(`Unsupported modifier "${unknown}" in shortcut "${text}".`);
  return { key, mod: modifiers.length > 0 };
}

export function shortcutMatches(shortcut, event) {
  const hasMod = Boolean(event.ctrlKey || event.metaKey);
  if (hasMod !== shortcut.mod) return false;
  if (shortcut.key === "Space") return event.code === "Space";
  if (shortcut.key.length === 1) return typeof event.key === "string" && event.key.toLowerCase() === shortcut.key.toLowerCase();
  return event.key === shortcut.key;
}
