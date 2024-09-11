const ERR = new Error();
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

const paramErr = {};
paramErr.name = "useForce Hook Rules";
paramErr.message = "";
APP.forceUpdate = function (fn) {
  // validate param & check for active Context
  if (fn === undefined || fn.constructor === "Function" || currentCTX === null)
    throw Object.assign(ERR, paramErr);

  const ctx = currentCTX;

  return () => {
    fn();
    requestUpdate(ctx);
  };
};

function requestUpdate(ctx) {
  if (ctx.scripts !== undefined) {
    ctx.scripts = ctx.initScripts.apply(null);
    ctx.observers.forEach((S) => S());
    ctx.pendingUpdates.forEach(requestUpdate);
    ctx.pendingUpdates.clear();
  }
  return ctx;
}

function render(ctx, shadowHTMLElement) {
  let tag = shadowHTMLElement[0],
    attrs = shadowHTMLElement[1],
    children = shadowHTMLElement[2];

  switch (true) {
    case Number.isInteger(tag):
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
        const Children = new DocumentFragment();
        let didRendered = false;

        Object.defineProperty(attrs, "Children", {
          get() {
            if (!didRendered) {
              const nodes = new Iterator(children);
              while (nodes.next()) {
                const childNode = render(ctx, nodes.value());

                if (childNode.constructor === DOM_FRAG) {
                  Children.appendChild(childNode.placeholder);
                  expandFrag(childNode);
                } else Children.appendChild(childNode);
              }
              didRendered = true;
            }

            return Children;
          },
        });
      }

      C = new Component(ctx.components[tag], attrs);
      return C.DOM;

    case tag === "Switch":
      const frag = new DOM_FRAG();
      return frag;

    case tag === "Link":
      tag = "a";
    // handle rest of code

    default:
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
              el.appendChild(frag.placeholder);
              frag.resolveContent(ctx.scripts[node]);
              expandFrag(frag);
              ctx.observers.push(function () {
                clearFrag(frag);
                frag.resolveContent(ctx.scripts[node]);
                expandFrag(frag);
              });
              break;

            default:
              const childNode = render(ctx, node);
              if (childNode.constructor === DOM_FRAG) {
                el.appendChild(childNode.placeholder);
                expandFrag(childNode);
              } else el.appendChild(childNode);
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
}

// ===================
function Iterator(arr) {
  this.index = -1;
  this.ref = arr;
}

Iterator.prototype.next = function () {
  if (this.ref.length - this.index === 1) return false;
  this.index++;
  return true;
};

Iterator.prototype.value = function () {
  return this.ref[this.index];
};
// ===================
const INST = "instance",
  REF = "ref";

function DOM_FRAG() {
  this.placeholder = new Text();
  this.cache = { instance: new Map(), ref: new Map() };
  // Array (HTMLElements || DOM_Frag)
  this.currDOM = [];
}

const FRAG_PROTO = DOM_FRAG.prototype;

FRAG_PROTO.append = function (HTMLNode) {
  this.currDOM.push(HTMLNode);
};

FRAG_PROTO.resolveContent = function (content) {
  const SELF = this;
  clearFrag(SELF);

  switch (content.constructor) {
    // jsxRoots Array
    case IS_ARRAY(content):
      const iterator = new Iterator(content);
      while (iterator.next()) resolveComponent(SELF, iterator.value());
      break;

    // jsxRoot
    case Object:
      resolveComponent(SELF, content);
      break;

    default:
      Number.isInteger(content) || (content ||= EMPTY_STR);
      SELF.placeholder.textContent = EMPTY_STR + content;
  }
};

function resolveComponent(frag, component) {
  let cacheContainer = CACHED,
    key = component.key;

  if (key === null) {
    const cacheType = Number.isInteger(component.dom[0]) ? INST : REF;
    cacheContainer = frag.cache[cacheType];
    key = component.index;
  }

  const result = cacheContainer.has(key)
    ? requestUpdate(cacheContainer.get(key))
    : cacheContainer.set(key, new Component(component)).get(key);

  frag.append(result.DOM);
}

function expandFrag(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  const iterator = new Iterator(activeDOM);
  while (iterator.next()) {
    const childNode = iterator.value();

    if (childNode.constructor === DOM_FRAG) {
      parentElement.insertBefore(childNode.placeholder, placeholder);
      expandFrag(childNode);
    } else parentElement.insertBefore(childNode, placeholder);
  }
}

function clearFrag(frag) {
  const parentElement = frag.placeholder.parentElement,
    childNodes = new Iterator(frag.currDOM);

  frag.placeholder.textContent = EMPTY_STR;
  while (childNodes.next()) {
    const childNode = childNodes.value();
    if (childNode.constructor === DOM_FRAG) clearFrag(childNode);
    else parentElement.removeChild(childNode);
  }

  childNodes.length = 0;
}
