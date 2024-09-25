import App from "./app";
import ERRS from "./errors";

const appMethods = new App();

let TRASH = new DocumentFragment(),
  currentCTX = null;

appMethods.updateCallback = () => (TRASH = new DocumentFragment());

const ERR = new Error(),
  EMPTY_ARR = [],
  EMPTY_STR = "",
  PRIVATE_KEY = "#Xtends",
  SWITCH_EXP = "Switch",
  CASE_EXP = "Case",
  LINK_EXP = "Link",
  ANCHOR_EXP = "a",
  EVENT_EXP = /^on[A-Z]/;

const IS_INT = Number.isInteger;
const IS_ARRAY = Array.isArray;
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === CASE_EXP;

function forceUpdate(fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, errOpts);
  const ctx = currentCTX;
  return function () {
    fn();
    appMethods.update(ctx);
  };
}

const CUSTOM_RENDER = {},
  CUSTOM_ATTRS = {
    ref(el, ctx, attrValue) {
      ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, el);
    },
    style(el, ctx, attrValue) {
      const styleObject = ctx.scripts[attrValue];
      if (styleObject) {
        Object.assign(el.style, styleObject);

        ctx.observers.push(() => Object.assign(el.style, styleObject));
      }
    },
  };

CUSTOM_RENDER.Component = function (ctx, vNode) {
  const [tag, attrs, children] = vNode;

  const jsxRoot = ctx.components[tag],
    C = new Component(jsxRoot);

  Object.keys(attrs).forEach(handleProp);
  function handleProp(key) {
    const value = attrs[key];
    if (IS_INT(value)) {
      attrs[key] = ctx.scripts[value];
      ctx.observers.push(function () {
        const newVal = ctx.scripts[value];
        if (attrs[key] === newVal) return;
        attrs[key] = newVal;
        PENDING_UPDATES.add(C);
      });
    }
  }

  return renderElementNode(ctx, jsxRoot.dom);
};
CUSTOM_RENDER.SwitchCase = function (ctx, vNode) {};
CUSTOM_RENDER.Frag = function (ctx, vNode) {};

function renderElementNode(ctx, vNode) {
  IS_INT(vNode[0]) && (vNode[0] = "Component");
  vNode[2] ||= EMPTY_ARR;

  const [tag, attrs, children] = vNode;

  if (CUSTOM_RENDER[tag]) return CUSTOM_RENDER[tag](ctx, vNode);
  else if (tag === LINK_EXP) {
    vNode[0] = ANCHOR_EXP;
  }

  const el = document.createElement(tag);
  for (let i = 0; i < children.length; ) ctx.createNode(children[i++], el);
  ctx.applyAttributes(attrs, el);
  return el;
}

function resolveCache(ctx, vNode) {
  const attrs = vNode[1],
    key = attrs.key;

  if (!key) return false;
  delete attrs.key;

  const observerStart = ctx.observers.length - 1;
  const result = renderElementNode(ctx, vNode);
  const observerEnd = ctx.observers.length - 1;

  ctx.cacheContainer[key] = {
    update() {},
    dom: result,
  };

  return Element;
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

PROTO.createNode = function (node, el) {
  const SELF = this,
    nodeType = node.constructor;

  switch (nodeType) {
    case String:
      el.appendChild(document.createTextNode(node));
      break;

    case Number:
      const frag = new DOM_FRAG();
      frag.resolveDynamicContent(SELF.scripts[node]);
      el.appendChild(frag.frag);
      SELF.observers.push(function () {
        hideFrag(frag, true);
        frag.resolveDynamicContent(SELF.scripts[node]);
        expandFrag(frag);
      });
      break;

    default:
      const attrs = node[1];

      Object.assign.apply(attrs, attrs[PRIVATE_KEY]);
      delete attrs[PRIVATE_KEY];

      const targetMethod = node[1].key ? resolveCache : renderElementNode,
        resultElement = targetMethod(SELF, node);

      resultElement instanceof DOM_FRAG
        ? resultElement.appendTo(el)
        : el.appendChild(resultElement);
  }
};

PROTO.applyAttributes = function (attrs, el) {
  const ctx = this;
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
};

PROTO.resolveDynamicContent = function (content) {
  // const SELF = this;
  // hideFrag(SELF);
  // if (IS_ARRAY(content)) content.forEach(SELF.resolveDynamicContent, SELF);
  // else if (typeof content === "object") {
  //   const ctx = new Component(content);
  //   ctx.cacheContainer = SELF.cache;
  //   SELF.append(createElementNode(ctx, content.dom));
  // } else SELF.placeholder.textContent = content || EMPTY_STR + content;
};

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.frag = document.createDocumentFragment();
  this.cache = new Map();
  this.nodes = [];
}

DOM_FRAG.prototype.insertNode = function (HTMLNode) {
  const SELF = this;
  if (IS_ARRAY(HTMLNode))
    for (let i = 0; i < HTMLNode.length; ) SELF.insertNode(HTMLNode[i++]);
  else if (HTMLNode instanceof DOM_FRAG) HTMLNode.appendTo(SELF.frag);
  else SELF.frag.appendChild(HTMLNode);
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
