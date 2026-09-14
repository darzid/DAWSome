import { el } from "./dom.js";

/**
 * Generic editor for a list of parameters taken from the parameter matrix.
 *
 * The panel is the one place that turns a parameter's type into a widget, so a
 * module that wants an editor only has to hand over the parameters it cares
 * about — it never builds inputs itself. Edits are written back with the
 * panel's origin (default "ui"); changes arriving from anywhere else through
 * `matrix.onChange` refresh the matching widget, unless the user is currently
 * typing in it.
 */
export class ParameterPanel {
  #container;
  #parameters;
  #matrix;
  #origin;
  #labelFor;
  #widgets = new Map();   // address → widget element
  #unsubscribe = null;

  /**
   * @param {Object} options
   * @param {HTMLElement} options.container element the rows are rendered into
   * @param {Array<Object>} options.parameters parameters to show, in display order
   * @param {Object} options.matrix the ParameterMatrix, subscribed to for external changes
   * @param {string} [options.origin="ui"] origin passed to `Parameter.set`
   * @param {(parameter: Object) => string} [options.labelFor] custom row label
   */
  constructor({ container, parameters, matrix, origin = "ui", labelFor }) {
    if (!container) throw new Error("ParameterPanel needs a container element.");
    if (!Array.isArray(parameters)) throw new Error("ParameterPanel needs a parameters array.");
    if (!matrix || typeof matrix.onChange !== "function") throw new Error("ParameterPanel needs a matrix with onChange().");
    if (labelFor !== undefined && typeof labelFor !== "function") throw new Error("ParameterPanel labelFor must be a function.");
    this.#container = container;
    this.#parameters = [...parameters];
    this.#matrix = matrix;
    this.#origin = origin;
    this.#labelFor = labelFor ?? ParameterPanel.defaultLabel;
    this.#unsubscribe = this.#matrix.onChange((change) => this.#onMatrixChange(change));
  }

  /**
   * Row label used when no `labelFor` is given: the address without its first
   * two segments, e.g. "device/3/envelope/attack" becomes "envelope / attack".
   * @param {Object} parameter
   * @returns {string}
   */
  static defaultLabel(parameter) {
    return parameter.address.split("/").slice(2).join(" / ");
  }

  /** The parameters currently shown, in display order. */
  get parameters() {
    return [...this.#parameters];
  }

  /** Rebuild every row from the current parameter list. */
  render() {
    this.#container.replaceChildren();
    this.#widgets.clear();
    for (const parameter of this.#parameters) {
      const widget = this.#buildWidget(parameter);
      this.#widgets.set(parameter.address, widget);
      this.#showValue(widget, parameter);
      this.#container.appendChild(el("div", { className: "param-row" }, [
        el("label", { text: this.#labelFor(parameter) }),
        widget,
      ]));
    }
  }

  /**
   * Replace the parameter list and re-render.
   * @param {Array<Object>} parameters
   */
  setParameters(parameters) {
    if (!Array.isArray(parameters)) throw new Error("ParameterPanel.setParameters needs an array.");
    this.#parameters = [...parameters];
    this.render();
  }

  /** Unsubscribe from the matrix and empty the container. */
  dispose() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
    this.#widgets.clear();
    this.#container.replaceChildren();
  }

  /**
   * Build the widget for one parameter, wired to write edits back.
   * @param {Object} parameter
   * @returns {HTMLElement}
   */
  #buildWidget(parameter) {
    const dataset = { address: parameter.address };
    const type = parameter.type;
    switch (type.kind) {
      case "number": {
        const attrs = { type: "number", step: typeof type.step === "number" ? String(type.step) : "any" };
        if (Number.isFinite(type.min)) attrs.min = String(type.min);
        if (Number.isFinite(type.max)) attrs.max = String(type.max);
        const input = el("input", { attrs, dataset });
        input.addEventListener("change", () => {
          if (ParameterPanel.#isNumeric(input.value)) parameter.set(parameter.clamp(Number(input.value)), this.#origin);
          else parameter.set(input.value, this.#origin);
        });
        return input;
      }
      case "enum": {
        const select = el("select", { dataset });
        for (const value of type.values) select.appendChild(ParameterPanel.#option(value));
        select.addEventListener("change", () => parameter.set(type.coerce(select.value), this.#origin));
        return select;
      }
      case "boolean": {
        const checkbox = el("input", { attrs: { type: "checkbox" }, dataset });
        checkbox.addEventListener("change", () => parameter.set(checkbox.checked, this.#origin));
        return checkbox;
      }
      case "string": {
        const input = el("input", { attrs: { type: "text" }, dataset });
        input.addEventListener("change", () => parameter.set(input.value, this.#origin));
        return input;
      }
      default:
        throw new Error(`Parameter "${parameter.address}" has unsupported type kind "${type.kind}".`);
    }
  }

  /**
   * Show a parameter's current value in its widget; an unset parameter shows
   * empty. Enum values outside the type's list still show, because enum types
   * are advisory and presets may set values the list does not know about.
   * @param {HTMLElement} widget
   * @param {Object} parameter
   */
  #showValue(widget, parameter) {
    if (widget.tagName === "SELECT") {
      if (!parameter.isSet) {
        widget.value = "";
        return;
      }
      const value = String(parameter.value);
      if (![...widget.options].some((option) => option.value === value)) widget.appendChild(ParameterPanel.#option(parameter.value));
      widget.value = value;
      return;
    }
    if (widget.type === "checkbox") {
      widget.checked = parameter.isSet ? Boolean(parameter.value) : false;
      return;
    }
    widget.value = parameter.isSet ? String(parameter.value) : "";
  }

  /**
   * Refresh the widget for a changed parameter, leaving the focused widget
   * alone so an in-progress edit is not overwritten.
   * @param {{ parameter: Object, value: any, previous: any, origin: string|null }} change
   */
  #onMatrixChange(change) {
    const widget = this.#widgets.get(change.parameter.address);
    if (!widget || widget === document.activeElement) return;
    this.#showValue(widget, change.parameter);
  }

  /**
   * Build one <option> for an enum value.
   * @param {string|number} value
   * @returns {HTMLElement}
   */
  static #option(value) {
    return el("option", { text: String(value), attrs: { value: String(value) } });
  }

  /**
   * Whether a raw input string should be written back as a number.
   * @param {string} raw
   * @returns {boolean}
   */
  static #isNumeric(raw) {
    return raw.trim() !== "" && Number.isFinite(Number(raw));
  }
}
