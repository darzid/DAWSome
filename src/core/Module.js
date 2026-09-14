/**
 * Base class for every pluggable unit of the application.
 *
 * Lifecycle (driven by App):
 *   1. install(app)  – synchronous. Provide services, register commands,
 *                      panels and event subscriptions. Must not depend on
 *                      services provided by modules installed later.
 *   2. start(app)    – asynchronous, runs in install order after *all* modules
 *                      are installed. Load data, build DOM, seed state.
 *   3. dispose(app)  – reverse install order. Release listeners and resources.
 *
 * Adding a feature means writing one subclass and passing it to `app.use()`.
 */
export class Module {
  /** Human readable name used in diagnostics. */
  get name() {
    return this.constructor.name;
  }

  // eslint-disable-next-line no-unused-vars
  install(app) {}

  // eslint-disable-next-line no-unused-vars
  async start(app) {}

  // eslint-disable-next-line no-unused-vars
  dispose(app) {}
}
