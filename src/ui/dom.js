/**
 * Small DOM primitives shared by every view: element lookup, element building,
 * high-DPI canvas sizing and wheel-event normalisation.
 */

/**
 * Look up an element by id and fail loudly when it is missing, so a typo in a
 * template surfaces immediately instead of as a later null dereference.
 *
 * @param {string} id element id, without the leading "#"
 * @param {Document|DocumentFragment|Element} [root=document] subtree to search
 * @returns {Element} the element
 * @throws {Error} when no element with that id exists under root
 */
export const $ = (id, root = document) => {
  const element = typeof root.getElementById === "function"
    ? root.getElementById(id)
    : root.querySelector(`[id="${id}"]`);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
};

/**
 * Build an element in one call.
 *
 * @param {string} tag tag name, e.g. "div"
 * @param {{ className?: string, text?: string, attrs?: Object<string, any>, dataset?: Object<string, any> }} [options]
 *        className sets `class`, text sets `textContent`, attrs are applied with
 *        setAttribute, dataset entries become `data-*` attributes.
 * @param {Node[]} [children=[]] child nodes appended in order
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs = {}, dataset = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value;
  for (const child of children) node.appendChild(child);
  return node;
}

/**
 * Resize a canvas to a CSS size while keeping it crisp on high-DPI screens,
 * and return a 2D context already scaled to CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} width CSS pixels
 * @param {number} height CSS pixels
 * @returns {CanvasRenderingContext2D}
 */
export function sizeCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

/**
 * Normalise a wheel event's deltas to pixels, whatever its deltaMode.
 *
 * @param {WheelEvent} e
 * @returns {{ dx: number, dy: number }} deltas in pixels
 */
export function wheelDeltas(e) {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
  return { dx: e.deltaX * unit, dy: e.deltaY * unit };
}
