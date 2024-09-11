const ERR = new Error();
const APP = new (function APP() {})();
const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const CUSTOM_ATTRS = {};
const CACHED = new Map();

let currentCTX = null;

const paramErr = {};
paramErr.name = "useForce Hook Rules";
paramErr.message = "";
APP.forceUpdate = function (fn) {
  // validate param & check for active Context
  if (typeof fn !== "function") throw Object.assign(ERR, paramErr);

  const ctx = currentCTX;

  return () => {
    fn();
    requestUpdate(ctx);
  };
};

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

const switchEXP = "Switch",
  caseEXP = "Case",
  linkEXP = "Link",
  anchorEXP = "a";

const excludePrivateKey = (d) => d !== PRIVATE_KEY,
  caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === caseEXP;

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

const PROTO = Component.prototype;

PROTO.createNode = function (node) {
  const SELF = this,
    nodeType = node.constructor;

  switch (nodeType) {
    case String:
      return new Text(node);

    case Number:
      const frag = new DOM_FRAG();
      frag.resolveContent(SELF.scripts[node]);
      SELF.observers.push(function () {
        clearFrag(frag);
        frag.resolveContent(SELF.scripts[node]);
        expandFrag(frag);
      });
      return frag;

    default:
      const [tag, attrs, children] = node,
        el = document.createElement(tag);

      if (children) {
        const iterator = new Iterator(children);
        while (iterator.next()) {
          const childNode = render(SELF, iterator.value());
          if (childNode.constructor === DOM_FRAG) {
            el.appendChild(childNode.placeholder);
            expandFrag(childNode);
          } else el.appendChild(childNode);
        }
      }

      if (attrs) {
        attrs[PRIVATE_KEY].forEach((OBJ) => Object.assign(attrs, OBJ));

        const keys = Object.keys(attrs).filter(excludePrivateKey),
          iterator = new Iterator(keys);

        while (iterator.next()) {
          const attrName = iterator.value(),
            attrValue = attrs[attrName];
          if (EVENT_EXP.test(attrName)) {
            const evType = attrName.slice(2).toLowerCase();
            el.addEventListener(evType, function () {
              const evHandler = SELF.scripts[attrValue],
                result = evHandler.apply(el, Array.from(arguments));
              result === true && requestUpdate(SELF);
            });
          } else if (CUSTOM_ATTRS[attrName] !== undefined)
            CUSTOM_ATTRS[attrName](el, SELF, attrValue);
          else el[attrName] = attrValue;
        }
      }

      return el;
  }
};

PROTO.checkCase = function (childNode) {
  const ctx = this,
    conditionRef = childNode[1] ? childNode[1].test : true,
    container = [];

  let didRendered = false;

  return function () {
    const testRes =
      !!conditionRef ||
      (Number.isInteger(conditionRef) && ctx.scripts[conditionRef]);

    if (!didRendered) {
      const childNodes = childNode[2];
      if (childNodes) {
        const _iterator = new Iterator(childNodes);
        while (_iterator.next())
          container[container.length] = render(ctx, _iterator.value());
      }
      didRendered = true;
    }

    return testRes && container;
  };
};

// ===================
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
  const tag = shadowHTMLElement[0],
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

    case tag === switchEXP:
      const frag = new DOM_FRAG(),
        cases = children.filter(caseFiltration).map(ctx.checkCase, ctx);

      let index = 0;
      ctx.observers.push(function () {
        clearFrag(frag);

        while (cases.length > index) {
          const result = cases[index++];
          if (result === false) continue;
          frag.append(result);
          break;
        }

        expandFrag(frag);
        index = 0;
      });

      return frag;

    case tag === linkEXP:
      shadowHTMLElement[0] = anchorEXP;
    // handle rest of code

    default:
      return ctx.createNode(shadowHTMLElement);
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
  const SELF = this;
  if (IS_ARRAY(HTMLNode)) {
    const iterator = new Iterator(HTMLNode);
    while (iterator.next()) SELF.append(iterator.value());
  } else SELF.currDOM.push(HTMLNode);
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
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    childNodes = new Iterator(frag.currDOM);

  placeholder.textContent = EMPTY_STR;
  while (childNodes.next()) {
    const childNode = childNodes.value();
    if (childNode.constructor === DOM_FRAG) clearFrag(childNode);
    else parentElement.removeChild(childNode);
  }

  childNodes.length = 0;
}
