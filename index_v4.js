const ERR = new Error();
const APP = {};
const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const CUSTOM_ATTRS = {};
const CACHED = new Map();
const paramErr = { name: "useForce Hook Rules", message: "" };

const switchEXP = "Switch",
  caseEXP = "Case",
  linkEXP = "Link",
  anchorEXP = "a",
  caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === caseEXP;

let currentCTX = null;

CUSTOM_ATTRS["ref"] = function (el, ctx, attrValue) {
  ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, el);
};

CUSTOM_ATTRS["style"] = function (el, ctx, attrValue) {
  const styleObject = ctx.scripts[attrValue];
  if (styleObject) {
    Object.assign(el.style, styleObject);

    ctx.observers.push(() => Object.assign(el.style, styleObject));
  }
};

window.forceUpdate = function (fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, paramErr);
  const ctx = currentCTX;
  return function () {
    fn();
    requestUpdate(ctx);
  };
};

function requestUpdate(ctx) {
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts();
    ctx.observers.forEach((observer) => observer());
    ctx.pendingUpdates.forEach(requestUpdate);
    ctx.pendingUpdates.clear();
  }
  return ctx;
}

function Component(jsxRoot, props = {}) {
  if (!(this instanceof Component)) return new Component(jsxRoot, props);
  else if (typeof jsxRoot === "function") {
    currentCTX = this;
    jsxRoot = jsxRoot(props);
    currentCTX = null;
  }

  if (jsxRoot.scripts) {
    this.initScripts = jsxRoot.scripts;
    this.scripts = this.initScripts();
    this.observers = [];
    this.pendingUpdates = new Set();
  }

  this.components = jsxRoot.components;
  this.DOM = this.createElementNode(jsxRoot.dom);
}

const PROTO = Component.prototype;

PROTO.createNode = function (node) {
  switch (node.constructor) {
    case String:
      return document.createTextNode(node);

    case Number:
      const SELF = this,
        frag = new DOM_FRAG();
      frag.resolveDynamicContent(this.scripts[node]);
      this.observers.push(function () {
        clearFrag(frag);
        frag.resolveDynamicContent(SELF.scripts[node]);
        expandFrag(frag);
      });
      return frag;

    default:
      return this.createElementNode(node);
  }
};

PROTO.renderComponent = function (vNode) {
  const SELF = this,
    [tag, attrs, children] = vNode;

  let C;

  if (attrs) {
    // attrs.forEach(handleProp);
    function handleProp(key) {
      const value = attrs[key];
      if (Number.isInteger(value)) {
        attrs[key] = SELF.scripts[value];
        SELF.observers.push(function () {
          const newVal = SELF.scripts[value];
          if (attrs[key] === newVal) return;
          attrs[key] = newVal;
          SELF.pendingUpdates.add(C);
        });
      }
    }
  }

  if (children) {
    const DOMFrag = new DOM_FRAG();
    let didRendered = false;

    Object.defineProperty(attrs, "Children", {
      get() {
        if (!didRendered) {
          children.forEach(appendChildNode);
          didRendered = true;
        }
        return DOMFrag;
      },
    });

    function appendChildNode(node) {
      const childNode = SELF.createNode(node);
      DOMFrag.append(childNode);
    }
  }

  C = new Component(SELF.components[tag], attrs);
  return C.DOM;
};

PROTO.createElementNode = function (vNode) {
  const SELF = this,
    [tag, attrs, children] = vNode;

  if (Number.isInteger(vNode[0])) return this.renderComponent(vNode);
  else if (tag === switchEXP) return renderSwitchCase(SELF, children);
  else if (tag === linkEXP) {
    vNode[0] = anchorEXP;
  }

  const el = document.createElement(tag);

  if (children.length) {
    children.forEach(function (child) {
      const childNode = SELF.createNode(child, el);
      if (childNode instanceof DOM_FRAG) {
        el.appendChild(childNode.placeholder);
        expandFrag(childNode);
      } else el.appendChild(childNode);
    });
  }

  this.applyAttributes(el, attrs);
  return el;
};

PROTO.applyAttributes = function (el, attrs) {
  const SELF = this;
  if (attrs[PRIVATE_KEY]) {
    attrs[PRIVATE_KEY].forEach((obj) => Object.assign(attrs, obj));
  }

  Object.keys(attrs).forEach(function (attrName) {
    if (attrName === PRIVATE_KEY) return;
    const attrValue = attrs[attrName];
    if (EVENT_EXP.test(attrName)) {
      el.addEventListener(attrName.slice(2).toLowerCase(), function (e) {
        const result =
          SELF.scripts[attrValue] && SELF.scripts[attrValue].apply(el, [e]);
        if (result === true) requestUpdate(SELF);
      });
    } else if (CUSTOM_ATTRS[attrName]) {
      CUSTOM_ATTRS[attrName](el, SELF, attrValue);
    } else {
      el[attrName] = attrValue;
    }
  });
};

PROTO.checkCase = function (childNode) {
  const SELF = this,
    conditionRef = childNode[1].test || true;

  let container = null;

  return function () {
    const testRes = Number.isInteger(conditionRef)
      ? SELF.scripts[conditionRef]
      : Boolean(conditionRef);

    if (container === null) {
      const childNodes = childNode[2] || [];
      container = childNodes.map(SELF.createNode, SELF);
    }

    return testRes ? container : null;
  };
};

function renderSwitchCase(ctx, children) {
  const frag = new DOM_FRAG();
  const cases = children.filter(caseFiltration).map(ctx.checkCase, ctx);

  let index = 0;
  ctx.observers.push(updateContent);

  // set frag.currDOM
  return frag;

  function updateContent() {
    clearFrag(frag);
    while (cases.length > index) {
      const result = cases[index++]();
      if (result) {
        frag.currDOM = result;
        break;
      }
    }
    expandFrag(frag);
    index = 0;
  }
}

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.cache = { instance: new Map(), ref: new Map() };
  this.currDOM = [];
}

DOM_FRAG.prototype.append = function (HTMLNode) {
  const SELF = this;

  if (IS_ARRAY(HTMLNode)) HTMLNode.forEach(SELF.append, SELF);
  else SELF.currDOM.push(HTMLNode);
};

DOM_FRAG.prototype.resolveDynamicContent = function (content) {
  const SELF = this;

  clearFrag(SELF, true);

  if (IS_ARRAY(content))
    content.forEach((comp) => resolveComponent(SELF, comp));
  else if (typeof content === "object") resolveComponent(SELF, content);
  else SELF.placeholder.textContent = EMPTY_STR + content;
};

function resolveComponent(frag, component) {
  const key = component.key || component.index;
  const cacheContainer = component.key
    ? CACHED
    : frag.cache[component.dom[0] ? "instance" : "ref"];

  const result = cacheContainer.has(key)
    ? requestUpdate(cacheContainer.get(key))
    : cacheContainer.set(key, new Component(component)).get(key);

  frag.append(result.DOM);
}

function expandFrag(frag) {
  const parent = frag.placeholder.parentElement;

  frag.currDOM.forEach(function (childNode) {
    if (childNode instanceof DOM_FRAG) {
      parent.insertBefore(childNode.placeholder, frag.placeholder);
      expandFrag(childNode);
    } else parent.insertBefore(childNode, frag.placeholder);
  });
}

function clearFrag(frag, reset) {
  const parent = frag.placeholder.parentElement;
  frag.currDOM.forEach(function (childNode) {
    if (childNode instanceof DOM_FRAG) clearFrag(childNode);
    else parent.removeChild(childNode);
  });

  reset && (frag.currDOM.length = 0);
}
