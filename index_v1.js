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

function Component(jsxRoot, props) {
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

  const cacheContainer = jsxRoot.cacheContainer;
  cacheContainer && (this.cacheContainer = cacheContainer);

  this.components = jsxRoot.components;
  this.DOM = createElementNode(this, jsxRoot.dom);
}

const PROTO = Component.prototype;

// returns {textNode|nodeElement|DOM_FRAG}
PROTO.createNode = function (node) {
  switch (node.constructor) {
    case String:
      return document.createTextNode(node);

    case Number:
      const SELF = this,
        frag = new DOM_FRAG();
      frag.resolveDynamicContent(SELF.scripts[node]);
      SELF.observers.push(function () {
        clearFrag(frag);
        frag.resolveDynamicContent(SELF.scripts[node]);
        expandFrag(frag);
      });
      return frag;

    default:
      return createElementNode(this, node);
  }
};

PROTO.renderComponent = function (vNode) {
  const SELF = this,
    [tag, attrs, children] = vNode;

  let C;

  attrs.forEach(handleProp);
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

  C = new Component(SELF.components[tag], attrs);
  return C.DOM;
};

function createElementNode(SELF, vNode) {
  const [tag, attrs, children] = vNode;

  Object.assign.apply(attrs, attrs[PRIVATE_KEY]);
  delete attrs[PRIVATE_KEY];

  if (Number.isInteger(vNode[0])) return SELF.renderComponent(vNode);
  else if (tag === switchEXP) return renderSwitchCase(SELF, children);
  else if (tag === linkEXP) {
    vNode[0] = anchorEXP;
  }

  let el;

  if (tag === "Frag") el = document.createDocumentFragment();
  else {
    el = document.createElement(tag);
    applyAttributes(SELF, attrs, el);
  }

  if (children.length) {
    children.forEach(function (child) {
      const childNode = SELF.createNode(child);
      if (childNode instanceof DOM_FRAG) {
        el.appendChild(childNode.placeholder);
        expandFrag(childNode);
      } else el.appendChild(childNode);
    });
  }

  return el;
}

function applyAttributes(ctx, attrs, el) {
  const cacheContainer = ctx.cacheContainer;

  if (attrs.key) {
  }

  Object.keys(attrs).forEach(function (attrName) {
    if (attrName === PRIVATE_KEY) return;
    const attrValue = attrs[attrName];
    if (EVENT_EXP.test(attrName)) {
      const evType = attrName.slice(2).toLowerCase();
      el.addEventListener(evType, function (EV) {
        const result =
          ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, EV);
        if (result === true) requestUpdate(ctx);
      });
    } else if (CUSTOM_ATTRS[attrName])
      CUSTOM_ATTRS[attrName](el, ctx, attrValue);
    else {
      el[attrName] = attrValue;
    }
  });
}

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.doc = document.createDocumentFragment();
  this.cache = new Map();
  this.currDOM = [];
}

DOM_FRAG.prototype.append = function (HTMLNode) {
  const SELF = this;
  if (IS_ARRAY(HTMLNode)) HTMLNode.forEach(SELF.append, SELF);
  else if (HTMLNode instanceof DOM_FRAG) {
    SELF.append(HTMLNode.placeholder);
    expandFrag(HTMLNode);
  } else SELF.doc.appendChild(HTMLNode);
};

DOM_FRAG.prototype.resolveDynamicContent = function (content) {
  const SELF = this;
  clearFrag(SELF);
  if (IS_ARRAY(content)) content.forEach(SELF.resolveDynamicContent, SELF);
  else if (typeof content === "object") {
    content.cacheContainer = SELF.cache;
    const result = new Component(content).DOM;
    SELF.append(result);
  } else SELF.placeholder.textContent = content || EMPTY_STR + content;
};

function expandFrag(frag) {
  const parent = frag.placeholder.parentElement,
    currDOM = frag.currDOM,
    childNodes = frag.doc.childNodes;

  currDOM.length = 0;
  Object.assign(currDOM, childNodes);

  parent.insertBefore(frag.doc, frag.placeholder);
}

function clearFrag(frag) {
  const parent = frag.placeholder.parentElement;
  frag.currDOM.forEach(function (childNode) {
    parent.removeChild(childNode);
  });
}

// if (children) {
//   const DOMFrag = new DOM_FRAG();
//   let didRendered = false;

//   Object.defineProperty(attrs, "Children", {
//     get() {
//       if (!didRendered) {
//         children.forEach(appendChildNode);
//         didRendered = true;
//       }
//       return DOMFrag;
//     },
//   });

//   function appendChildNode(node) {
//     const childNode = SELF.createNode(node);
//     DOMFrag.append(childNode);
//   }
// }

/**
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
 */
