/**
 * 组合树投影：在普通 DOM、Shadow DOM 与后续的 iframe 之间使用同一套「页面祖先」语义。
 *
 * Shadow DOM 的改变只在**边界**上：元素仍属于当前 document，动作 / 记录的声明不需要复制。
 * 但 `closest()`、`contains()`、`querySelectorAll()` 都停在 shadow root —— 如果框架不补这一层，
 * 一个放在 shadow 里的按钮会看不到宿主上的 `v-scope`，命中测试也会把宿主误当成遮罩。
 *
 * 这里只处理「组合树」关系，不创建 registry，也不把 closed shadow root 强行打开：
 * 读不到的边界就如实停在那里，要求宿主显式暴露。
 */

/** 跨 shadow 边界的父节点：ShadowRoot → host，普通 parentNode 优先。 */
export function composedParent(node: Node): Node | null {
  if (node.parentNode) return node.parentNode;
  const root = typeof node.getRootNode === "function" ? node.getRootNode() : null;
  return root && "host" in root ? (root as ShadowRoot).host : null;
}

/** 跨 shadow 边界的最近元素祖先（跳过 ShadowRoot / Document）。 */
export function composedElementParent(element: Element): Element | null {
  let node = composedParent(element);
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = composedParent(node);
  return node as Element | null;
}

/** 带组合树祖先遍历的 `closest()`。 */
export function closestComposed(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    if (current.matches(selector)) return current;
    current = composedElementParent(current);
  }
  return null;
}

/** `ancestor.contains(node)` 的组合树版本（包含自身）。 */
export function containsComposed(ancestor: Node, node: Node | null | undefined): boolean {
  let current: Node | null = node ?? null;
  while (current) {
    if (current === ancestor) return true;
    current = composedParent(current);
  }
  return false;
}

/** 视口坐标矩形；不依赖某个 realm 的 DOMRect 实例。 */
export interface ViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FrameViewportBox extends ViewportRect {
  scaleX: number;
  scaleY: number;
}

function parsePx(value: string | undefined): number {
  const number = Number.parseFloat(value ?? "");
  return Number.isFinite(number) ? number : 0;
}

/** iframe 内容区在父视口中的盒模型；同时带 CSS transform 的缩放。 */
export function frameViewportBox(frame: Element): FrameViewportBox {
  const rect = frame.getBoundingClientRect();
  const view = frame.ownerDocument.defaultView;
  const style = view?.getComputedStyle(frame);
  const borderLeft = style ? parsePx(style.borderLeftWidth) : frame.clientLeft;
  const borderTop = style ? parsePx(style.borderTopWidth) : frame.clientTop;
  const borderRight = style ? parsePx(style.borderRightWidth) : Math.max(0, frame.clientLeft);
  const borderBottom = style ? parsePx(style.borderBottomWidth) : Math.max(0, frame.clientTop);
  const padLeft = style ? parsePx(style.paddingLeft) : 0;
  const padTop = style ? parsePx(style.paddingTop) : 0;
  const padRight = style ? parsePx(style.paddingRight) : 0;
  const padBottom = style ? parsePx(style.paddingBottom) : 0;
  const htmlFrame = frame as HTMLElement;
  const scaleX = htmlFrame.offsetWidth > 0 && rect.width > 0 ? rect.width / htmlFrame.offsetWidth : 1;
  const scaleY = htmlFrame.offsetHeight > 0 && rect.height > 0 ? rect.height / htmlFrame.offsetHeight : 1;
  const left = rect.left + (borderLeft + padLeft) * scaleX;
  const top = rect.top + (borderTop + padTop) * scaleY;
  const layoutWidth = htmlFrame.offsetWidth > 0 ? htmlFrame.offsetWidth : rect.width / (scaleX || 1);
  const layoutHeight = htmlFrame.offsetHeight > 0 ? htmlFrame.offsetHeight : rect.height / (scaleY || 1);
  const width = Math.max(0, layoutWidth - borderLeft - borderRight - padLeft - padRight) * scaleX;
  const height = Math.max(0, layoutHeight - borderTop - borderBottom - padTop - padBottom) * scaleY;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    scaleX,
    scaleY,
  };
}

/** 元素在自己文档里的矩形，逐层换算到目标 Document 的视口。 */
export function projectRectToDocument(element: Element, target: Document): ViewportRect {
  const raw = element.getBoundingClientRect();
  let rect: ViewportRect = {
    left: raw.left,
    top: raw.top,
    right: raw.right,
    bottom: raw.bottom,
    width: raw.width,
    height: raw.height,
  };

  let doc = element.ownerDocument;
  while (doc !== target) {
    const frame = doc.defaultView?.frameElement ?? null;
    if (!frame) break;
    const box = frameViewportBox(frame);
    const left = box.left + rect.left * box.scaleX;
    const top = box.top + rect.top * box.scaleY;
    const width = rect.width * box.scaleX;
    const height = rect.height * box.scaleY;
    rect = { left, top, right: left + width, bottom: top + height, width, height };
    doc = frame.ownerDocument;
  }
  return rect;
}

/** 元素在自己文档里的矩形，逐层换算到顶层页面视口。 */
export function projectRectToTop(element: Element): ViewportRect {
  return projectRectToDocument(element, topDocumentOf(element));
}

/** 元素自己文档里的一个点，换算到顶层页面视口。 */
export function projectPointToDocument(
  element: Element,
  x: number,
  y: number,
  target: Document,
): { x: number; y: number } {
  let point = { x, y };
  let doc = element.ownerDocument;
  while (doc !== target) {
    const frame = doc.defaultView?.frameElement ?? null;
    if (!frame) break;
    const box = frameViewportBox(frame);
    point = { x: box.left + point.x * box.scaleX, y: box.top + point.y * box.scaleY };
    doc = frame.ownerDocument;
  }
  return point;
}

export function projectPointToTop(element: Element, x: number, y: number): { x: number; y: number } {
  return projectPointToDocument(element, x, y, topDocumentOf(element));
}

/** 顶层视口坐标 → iframe 内容坐标；点在内容区外返回 null。 */
export function pointInFrame(frame: Element, x: number, y: number): { x: number; y: number } | null {
  const box = frameViewportBox(frame);
  if (x < box.left || y < box.top || x > box.left + box.width || y > box.top + box.height) return null;
  return { x: (x - box.left) / box.scaleX, y: (y - box.top) / box.scaleY };
}

/** 逐层向上穿过 iframe 文档边界。Shadow DOM 的边界由 `composedParent` 处理。 */
function projectedParent(node: Node): Node | null {
  const parent = composedParent(node);
  if (parent) return parent;
  if (node.nodeType === 9) {
    const win = (node as Document).defaultView;
    return win?.frameElement ?? null;
  }
  return null;
}

/** 跨 shadow 与同源 iframe 的包含关系，只用于几何 / 层叠判定。 */
export function containsProjected(ancestor: Node, node: Node | null | undefined): boolean {
  let current: Node | null = node ?? null;
  while (current) {
    if (current === ancestor) return true;
    current = projectedParent(current);
  }
  return false;
}

/** 一组 iframe，从最外层到最内层。 */
export function frameChainOf(element: Element): HTMLElement[] {
  const frames: HTMLElement[] = [];
  let frame = element.ownerDocument.defaultView?.frameElement ?? null;
  while (frame) {
    frames.unshift(frame as HTMLElement);
    frame = frame.ownerDocument.defaultView?.frameElement ?? null;
  }
  return frames;
}

/** 元素所属页面链的最顶层 Document。 */
export function topDocumentOf(element: Element): Document {
  const frames = frameChainOf(element);
  const outer = frames[0];
  return outer?.ownerDocument ?? element.ownerDocument;
}

/**
 * 收集 root 下所有匹配元素，并递归进入可访问的 shadow root。
 *
 * 顺序保持「先当前根，再按 DOM 顺序进入各宿主」；同一页面多个 shadow root 的阅读顺序
 * 因此稳定可复现。closed shadow root 不在结果里，这是浏览器边界而不是扫描遗漏。
 */
export function queryAllComposed(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) {
        if (child.nodeType === 11) visit(child);
        continue;
      }
      const element = child as Element;
      if (element.matches(selector)) out.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
      visit(element);
    }
  };
  visit(root);
  return out;
}

/**
 * 从顶层 document 做命中测试，并逐层进入打开的 shadow root。
 *
 * `document.elementFromPoint()` 在 shadow 外只会返回宿主；如果不继续下钻，
 * 一个完全可见的 shadow 按钮会被判成「被宿主盖住」。closed shadow root 返回宿主是正确结果。
 */
export function elementFromPointComposed(doc: Document, x: number, y: number): Element | null {
  if (typeof doc.elementFromPoint !== "function") return null;
  let hit = doc.elementFromPoint(x, y);
  while (hit?.shadowRoot && typeof hit.shadowRoot.elementFromPoint === "function") {
    const inner = hit.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === hit) break;
    hit = inner;
  }
  if (hit && (hit.tagName === "IFRAME" || hit.tagName === "FRAME")) {
    let innerDoc: Document | null = null;
    try {
      innerDoc = (hit as HTMLIFrameElement).contentDocument;
    } catch {
      innerDoc = null;
    }
    const innerPoint = innerDoc ? pointInFrame(hit, x, y) : null;
    if (innerDoc && innerPoint) {
      const inner = elementFromPointComposed(innerDoc, innerPoint.x, innerPoint.y);
      if (inner) return inner;
    }
  }
  return hit;
}

