const TRASH = new DocumentFragment();
const CUSTOM_ATTRS = {};
const PENDING_UPDATES = new Set(); // updates Queue

const EMPTY_STR = "",
  PRIVATE_KEY = "#Xtends",
  SWITCH_EXP = "Switch",
  CASE_EXP = "Case",
  LINK_EXP = "Link",
  ANCHOR_EXP = "a",
  EVENT_EXP = /^on[A-Z]/;

const IS_INT = Number.isInteger;
const IS_ARRAY = Array.isArray;
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === CASE_EXP;

const ERR = new Error(),
  errOpts = { name: "useForce Hook Rules", message: "" };

let isUpdating = false,
  currentCTX = null;

CUSTOM_ATTRS.ref = function (el, ctx, attrValue) {
  ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, el);
};

CUSTOM_ATTRS.style = function (el, ctx, attrValue) {
  const styleObject = ctx.scripts[attrValue];
  if (styleObject) {
    Object.assign(el.style, styleObject);

    ctx.observers.push(() => Object.assign(el.style, styleObject));
  }
};

function forceUpdate(fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, errOpts);
  const ctx = currentCTX;
  return function () {
    fn();
    requestUpdate(ctx);
  };
}

function requestUpdate(ctx) {
  PENDING_UPDATES.delete(ctx);
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts();
    ctx.observers.forEach((observer) => observer());
    batchUpdates();
  }
  return ctx;
}

function batchUpdates() {
  if (isUpdating) return;
  isUpdating = true;
  PENDING_UPDATES.forEach(requestUpdate);
  PENDING_UPDATES.clear();
  TRASH.replaceChildren();
  isUpdating = false;
}

function Component(jsxRoot, props) {
  if (!(this instanceof Component)) return new Component(jsxRoot, props);
  else if (typeof jsxRoot === "function") {
    currentCTX = this;
    jsxRoot = jsxRoot(props);
    currentCTX = null;
  }

  this.components = jsxRoot.components;

  if (jsxRoot.scripts) {
    this.initScripts = jsxRoot.scripts;
    this.scripts = this.initScripts();
    this.observers = [];
  }
}

const PROTO = Component.prototype;

DOM_FRAG.prototype.resolveDynamicContent = function (content) {
  const SELF = this;
  hideFrag(SELF);
  if (IS_ARRAY(content)) content.forEach(SELF.resolveDynamicContent, SELF);
  else if (typeof content === "object") {
    const ctx = new Component(content);
    ctx.cacheContainer = SELF.cache;
    SELF.append(createElementNode(ctx, content.dom));
  } else SELF.placeholder.textContent = content || EMPTY_STR + content;
};

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
        hideFrag(frag, true);
        frag.resolveDynamicContent(SELF.scripts[node]);
        expandFrag(frag);
      });
      return frag;

    default:
      const attrs = node[1];

      Object.assign.apply(attrs, attrs[PRIVATE_KEY]);
      delete attrs[PRIVATE_KEY];

      const key = attrs.key;

      if (key) {
        delete attrs.key;

        const observerStart = this.observers.length - 1;
        const result = createElementNode(this, node);
        const observerEnd = this.observers.length - 1;

        this.cacheContainer[key] = {
          update() {},
          dom: result,
        };
      } else return createElementNode(this, node);
  }
};

function createElementNode(SELF, vNode) {
  const [tag, attrs, children] = vNode;

  if (Number.isInteger(vNode[0])) return SELF.renderComponent(vNode);
  else if (tag === SWITCH_EXP) return renderSwitchCase(SELF, children);
  else if (tag === "Frag") return renderFrag();
  else if (tag === LINK_EXP) {
    vNode[0] = ANCHOR_EXP;
  }

  const el = document.createElement(tag);

  if (children.length) {
    children.forEach(function (child) {
      const childNode = SELF.createNode(child);
      if (childNode instanceof DOM_FRAG) {
        el.appendChild(childNode.placeholder);
        expandFrag(childNode);
      } else el.appendChild(childNode);
    });
  }

  applyAttributes(SELF, attrs, el);
  return el;
}

function renderComponent(SELF, vNode) {
  const [tag, attrs, children] = vNode;

  const jsxRoot = SELF.components[tag],
    C = new Component(jsxRoot);

  Object.keys(attrs).forEach(handleProp);
  function handleProp(key) {
    const value = attrs[key];
    if (IS_INT(value)) {
      attrs[key] = SELF.scripts[value];
      SELF.observers.push(function () {
        const newVal = SELF.scripts[value];
        if (attrs[key] === newVal) return;
        attrs[key] = newVal;
        PENDING_UPDATES.add(C);
      });
    }
  }

  return createElementNode(C, jsxRoot.dom);
}

function applyAttributes(ctx, attrs, el) {
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
  this.frag = document.createDocumentFragment();
  this.cache = new Map();
  this.nodes = [];
}

DOM_FRAG.prototype.insertNode = function (HTMLNode) {
  const SELF = this;
  if (IS_ARRAY(HTMLNode)) return HTMLNode.forEach(SELF.append, SELF);
  HTMLNode instanceof DOM_FRAG
    ? HTMLNode.appendTo(SELF.frag)
    : SELF.frag.appendChild(HTMLNode);
};

DOM_FRAG.prototype.appendTo = function (containerNode) {
  containerNode.appendChild(this.frag);
  containerNode.appendChild(this.placeholder);
};

DOM_FRAG.prototype.hide = function (clear) {
  const nodes = this.nodes,
    targetFrag = clear ? TRASH : frag.frag;
  for (let i = 0; i < nodes.length; ) targetFrag.appendChild(nodes[i++]);
};

DOM_FRAG.prototype.show = function () {
  const parent = this.placeholder.parentElement,
    currDOM = this.nodes,
    childNodes = this.frag.childNodes;

  Object.assign(currDOM, childNodes);
  currDOM.length = childNodes.length;

  parent.insertBefore(this.frag, this.placeholder);
};

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
