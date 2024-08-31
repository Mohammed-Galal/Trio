const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const EMPTY_DOM_CONTAINER = [];
const PRIVATE_KEY = "#Xtends";
const CUSTOM_TAGS = /Frag|Switch|Case|Link/;
const EVENT_EXP = /^on[A-Z]/;
const CACHED = new Map();

function Component(jsxRoot) {
  if (this.constructor !== Component) return new Component(jsxRoot);
  this.observers = { scripts: [], components: new Set() };
  this.scripts = null;
  this.component = jsxRoot.components;
  this.update(jsxRoot.scripts);
  // HTMLElement || DOM_FRAG
  this.DOM = this.render(jsxRoot.dom);
}

const PROTO = Component.prototype;

PROTO.render = function (dom) {
  if (dom === undefined) throw new Error();

  // return => HTMLElement || String || scriptExp: DOM_FRAG || Frag: Array
  const SELF = this,
    DOMType = dom.constructor;

  switch (DOMType) {
    // Static Content
    case String:
      return new Text(dom);

    // Dynamic Content
    case Number:
      const frag = new DOM_FRAG();
      frag.append(SELF.scripts[dom]);
      SELF.observers.scripts[dom] = function (newVal) {
        hideFrag(frag);
        frag.append(newVal);
        spreadFrag(frag);
      };
      return frag;

    // HTMLElement
    case Array:
      const [tag, attrs, children] = dom;

      if (Number.isInteger(tag)) return new Component(SELF.component[tag]).DOM;
      else if (CUSTOM_TAGS.test(tag)) return handleCustomTag(SELF, dom);

      const el = document.createElement(tag);

      if (children) {
        const iterator = new Iterator(children);
        while (iterator.next()) {
          const node = SELF.render(iterator.value());
          if (node.constructor === DOM_FRAG) {
            el.appendChild(node.placeholder);
            spreadFrag(node);
          } else el.appendChild(node);
        }
      }

      if (attrs) {
        attrs[PRIVATE_KEY].forEach((OBJ) => Object.assign(el, OBJ));

        const keys = Object.keys(attrs).filter((d) => d !== PRIVATE_KEY),
          iterator = new Iterator(keys);

        while (iterator.next()) {
          const attrName = iterator.value(),
            attrValue = attrs[attrName];
          if (EVENT_EXP.test(attrName)) {
            const evType = attrName.slice(2).toLowerCase();
            el.addEventListener(evType, SELF.scripts[attrValue]);
          } else if (attrName === "ref") SELF.scripts[attrValue](el);
          else if (attrName === "style") {
            Object.assign(el.style, SELF.scripts[attrValue]);
            SELF.observers.scripts.push(function (newVal) {
              Object.assign(el.style, newVal);
            });
          } else {
            el[attrName] = attrValue;
            SELF.observers.scripts.push(function (newVal) {
              el[attrName] = newVal;
            });
          }
        }
      }

      return el;
  }
};

PROTO.update = function ($scripts) {
  if ($scripts === null) return;

  const SELF = this,
    scripts = $scripts(),
    scriptsObserver = SELF.observers.scripts;

  SELF.scripts = scripts;

  let index = 0;
  while (scriptsObserver.length > index)
    scriptsObserver[index](scripts[index++]);

  return this;
};

function DOM_FRAG() {
  this.placeholder = new Text();
  this.cache = { scriped: new Map(), descriped: new Map() };
  // Array (Components) || Component || String: Primitive Value
  this.currDOM = null;
}

const FRAG_PROTO = DOM_FRAG.prototype;

// append => replaces current active Node
// whenever this function gets invoked, it removes the current Active DOM, and replaces it with the Content
FRAG_PROTO.append = function (HTMLNode) {
  const SELF = this;
  SELF.currDOM = null;

  switch (HTMLNode.constructor) {
    // jsxRoots Array
    case IS_ARRAY(HTMLNode):
      const result = (SELF.currDOM = []),
        iterator = new Iterator(HTMLNode);
      while (iterator.next())
        result[iterator.index] = SELF.resolveComponent(iterator.value());
      break;

    // jsxRoot
    case Object:
      SELF.currDOM = resolveComponent(HTMLNode);
      break;

    default:
      SELF.currDOM = Number.isInteger(HTMLNode)
        ? HTMLNode
        : HTMLNode || EMPTY_STR;
      break;
  }
};

FRAG_PROTO.resolveComponent = function (_component) {
  const key = _component.key;
  if (key === null) {
    const targetCache = Number.isInteger(_component.dom[0])
        ? "scriped"
        : "descriped",
      cache = this.cache[targetCache],
      index = _component.index;
    return cache.has(index)
      ? cache.get(index).update(_component.scripts)
      : cache.set(index, new Component(_component));
  }

  return CACHED.has(key)
    ? CACHED.get(key).update(_component.scripts)
    : CACHED.set(key, new Component(_component)).get(key);
};

function spreadFrag(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  if (activeDOM === null) return;
  else if (activeDOM.constructor === String)
    return (placeholder.textContent = activeDOM);
  else if (IS_ARRAY(activeDOM)) {
    const iterator = new Iterator(activeDOM);
    while (iterator.next())
      appendToFrag(parentElement, iterator.value().DOM, placeholder);
  } else appendToFrag(parentElement, activeDOM.DOM, placeholder);
}

function appendToFrag(parentElement, DOMNode, placeholder) {
  if (DOMNode.constructor === DOM_FRAG) {
    parentElement.insertBefore(DOMNode.placeholder, placeholder);
    spreadFrag(DOMNode);
  } else parentElement.insertBefore(DOMNode, placeholder);
}

function hideFrag(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  placeholder.textContent = EMPTY_STR;

  if (activeDOM === null) return;

  (function reCall(C) {
    if (C.constructor === Array) C.forEach(reCall, null);
    else if (C.DOM.constructor === DOM_FRAG) hideFrag(C.DOM);
    else parentElement.removeChild(C.DOM);
  })(activeDOM);
}

function Iterator(arr) {
  this.index = -1;
  this.ref = arr;
  this.result = [];
}

Iterator.prototype.next = function () {
  if (this.ref.length - this.index === 1) return false;
  this.index++;
  return true;
};

Iterator.prototype.value = function () {
  return this.ref[this.index];
};

Iterator.prototype.call = function (fn) {
  this.result[this.index] = fn(this.value());
};
