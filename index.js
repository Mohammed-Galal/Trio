const APP = new (function TRIO() {})();
const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const PRIVATE_KEY = "#Xtends";
const CUSTOM_TAGS = /Frag|Switch|Case|Link/;
const EVENT_EXP = /^on[A-Z]/;
const CUSTOM_ATTRS = {};
const CACHED = new Map();

let currentCTX = null;

export default APP;

CUSTOM_ATTRS["key"] = function (el, ctx, attrValue) {};

CUSTOM_ATTRS["ref"] = function (el, ctx, attrValue) {
  ctx.scripts[attrValue].call(el, el);
};

CUSTOM_ATTRS["style"] = function (el, ctx, attrValue) {
  Object.assign(el.style, ctx.scripts[attrValue]);
  ctx.observers.push(function () {
    Object.assign(el.style, ctx.scripts[attrValue]);
  });
};

function Component(jsxRoot, props) {
  if (this.constructor !== Component) return new Component(jsxRoot);
  else if (jsxRoot.constructor.name === "Function") {
    currentCTX = this;
    const result = jsxRoot(props);
    currentCTX = null;
    jsxRoot = result;
  }

  const SELF = this;
  if (jsxRoot.scripts) {
    SELF.initScripts = jsxRoot.scripts;
    SELF.scripts = SELF.initScripts.apply(null);
    // scripts Observer
    SELF.observers = [];
    // components Observer
    SELF.pendingUpdates = new Set();
  }
  SELF.component = jsxRoot.components;
  SELF.DOM = render(this, jsxRoot.dom); // HTMLElement || DOM_FRAG
}

APP.forceUpdate = function (fn) {
  // !validate params
  // !check for active Context

  const ctx = currentCTX;

  return () => {
    fn();
    requestUpdate(ctx);
  };
};

function DOM_FRAG() {
  this.placeholder = new Text();
  this.cache = { "instance": new Map(), ref: new Map() };
  // Array (Components) || Component || String: Primitive Value
  this.currDOM = null;
}

const FRAG_PROTO = DOM_FRAG.prototype;

// append => replaces current active Node
// whenever this function gets invoked, it removes the current Active DOM, and replaces it with the Content
FRAG_PROTO.append = function (HTMLNode) {
  const SELF = this;

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
      SELF.currDOM =
        EMPTY_STR +
        (Number.isInteger(HTMLNode) ? HTMLNode : HTMLNode || EMPTY_STR);
      break;
  }
};

FRAG_PROTO.resolveComponent = function (_component) {
  let cacheContainer = CACHED,
    key = _component.key;

  if (key === null) {
    const targetCache = Number.isInteger(_component.dom[0])
      ? "instance"
      : "ref";
    cacheContainer = this.cache[targetCache];
    key = _component.index;
  }

  return cacheContainer.has(key)
    ? requestUpdate(cacheContainer.get(key))
    : cacheContainer.set(key, new Component(_component)).get(key);
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
  } else appendToFrag(parentElement, activeDOM, placeholder);
}

function appendToFrag(parentElement, DOMNode, placeholder) {
  if (DOMNode.constructor === DOM_FRAG) {
    parentElement.insertBefore(DOMNode.placeholder, placeholder);
    spreadFrag(DOMNode);
  } else parentElement.insertBefore(DOMNode, placeholder);
}

function clearFrag(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  if (activeDOM === null) return;
  else if (activeDOM.constructor === String)
    placeholder.textContent = EMPTY_STR;
  else if (IS_ARRAY(activeDOM)) {
    const iterator = new Iterator(activeDOM);
    while (iterator.next()) removeFromFrag(parentElement, iterator.value().DOM);
  } else removeFromFrag(parentElement, activeDOM);
}

function removeFromFrag(parentElement, DOMNode) {
  if (DOMNode.constructor === DOM_FRAG) clearFrag(DOM_FRAG);
  else parentElement.removeChild(DOMNode);
}

function Iterator(arr) {
  this.index = -1;
  this.ref = arr;
  // this.result = [];
}

Iterator.prototype.next = function () {
  if (this.ref.length - this.index === 1) return false;
  this.index++;
  return true;
};

Iterator.prototype.value = function () {
  return this.ref[this.index];
};

// Iterator.prototype.call = function (fn) {
//   this.result[this.index] = fn(this.value());
// };

function requestUpdate(ctx) {
  if (ctx.scripts !== undefined) {
    ctx.scripts = ctx.initScripts.apply(null);
    ctx.observers.forEach((S) => S());
    ctx.pendingUpdates.forEach(requestUpdate);
    ctx.pendingUpdates.clear();
  }
  return ctx;
}

function handleCustomTag(tag, ctx) {}

function render(ctx, shadowHTMLElement) {
  const tag = shadowHTMLElement[0],
    attrs = shadowHTMLElement[1],
    children = shadowHTMLElement[2];

  if (Number.isInteger(tag)) {
    let C;
    if (attrs) {
      const keys = new Iterator(Object.keys(attrs));
      while (keys.next()) {
        const key = keys.value(),
          value = attrs[key];
        if (Number.isInteger(value)) {
          attrs[key] = ctx.scripts[value];
          ctx.observers.push(function () {
            const newVal = ctx.scripts[value];
            if (attrs[key] !== newVal) {
              attrs[key] = newVal;
              ctx.pendingUpdates.add(C);
            }
          });
        }
      }
    }

    if (children) {
      const Children = new DOM_FRAG();
      let didRendered = false;
      Object.defineProperty(attrs, "Children", {
        get() {
          if (!didRendered) {
            const nodes = new Iterator(children);
            while (nodes.next()) frag.append(render(ctx, nodes.value()));
            didRendered = true;
          }
          return Children;
        },
      });
    }

    C = new Component(ctx.components[tag], attrs);
    return C.DOM;
  } else if (CUSTOM_TAGS.test(tag))
    return handleCustomTag(shadowHTMLElement, ctx);

  const el = document.createElement(tag);

  if (children) {
    const iterator = new Iterator(children);
    while (iterator.next()) {
      const node = iterator.value(),
        DOMType = node.constructor;

      switch (DOMType) {
        case String:
          el.appendChild(new Text(node));
          break;

        case Number:
          const frag = new DOM_FRAG();
          frag.append(ctx.scripts[node]);
          el.appendChild(frag.placeholder);
          spreadFrag(frag);
          ctx.observers.push(function () {
            clearFrag(frag);
            frag.append(ctx.scripts[node]);
            spreadFrag(frag);
          });
          break;

        default:
          const result = render(ctx, node);
          if (result.constructor === DOM_FRAG) {
            el.appendChild(result.placeholder);
            spreadFrag(result);
          } else el.appendChild(result);
      }
    }
  }

  if (attrs) {
    attrs[PRIVATE_KEY].forEach((OBJ) => Object.assign(attrs, OBJ));

    const keys = Object.keys(attrs).filter((d) => d !== PRIVATE_KEY),
      iterator = new Iterator(keys);

    while (iterator.next()) {
      const attrName = iterator.value(),
        attrValue = attrs[attrName];
      if (EVENT_EXP.test(attrName)) {
        const evType = attrName.slice(2).toLowerCase();
        el.addEventListener(evType, function () {
          const evHandler = ctx.scripts[attrValue],
            result = evHandler.apply(el, Array.from(arguments));
          result === true && requestUpdate(ctx);
        });
      } else if (CUSTOM_ATTRS[attrName] !== undefined)
        CUSTOM_ATTRS[attrName](el, ctx, attrValue);
      else el[attrName] = attrValue;
    }
  }

  return el;
}
