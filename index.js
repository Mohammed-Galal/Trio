import DOM_FRAG from "./fragment";
import createElementNode, { PENDING_UPDATES } from "./createElement";
import getError from "./errors";

const APP = new (function APP() {})();
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const CUSTOM_ATTRS = {};

let isUpdating = false,
  currentCTX = null;

APP.render = function (jsxRoot) {
  if (currentCTX) getError("main");
  const ctx = new Component(jsxRoot);
  return createElementNode(ctx, jsxRoot.dom);
};

APP.useForce = function forceUpdate(fn) {
  if (typeof fn !== "function") throw getError("useForce");
  const ctx = currentCTX;
  return function () {
    fn();
    requestUpdate(ctx);
  };
};

export default APP;

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
      // frag.resolveDynamicContent(SELF.scripts[node]);
      // el.appendChild(frag.frag);
      // SELF.observers.push(function () {
      //   hideFrag(frag, true);
      //   frag.resolveDynamicContent(SELF.scripts[node]);
      //   expandFrag(frag);
      // });
      break;

    default:
      const attrs = node[1];

      Object.assign.apply(attrs, attrs[PRIVATE_KEY]);
      delete attrs[PRIVATE_KEY];

      const resultElement = createElementNode(SELF, node);

      resultElement instanceof DOM_FRAG
        ? resultElement.appendTo(el)
        : el.appendChild(resultElement);
  }
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

function requestUpdate(ctx) {
  PENDING_UPDATES.delete(ctx);
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts();
    ctx.observers.forEach((observer) => observer());
    isUpdating || batchUpdates();
  }
  return ctx;
}

function batchUpdates() {
  isUpdating = true;
  PENDING_UPDATES.forEach(requestUpdate);
  PENDING_UPDATES.clear();
  isUpdating = false;
}
