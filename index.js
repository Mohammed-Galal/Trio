import DOM_FRAG from "./fragment";
import renderElementNode, { PENDING_UPDATES } from "./createElement";
import getError from "./errors";

const VELOX = new (function Velox() {})();
const isInt = Number.isInteger;
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const EMPTY_ARR = [];
const CUSTOM_ATTRS = {};

let isUpdating = false,
  currentCTX = null;

VELOX.render = function (jsxRoot) {
  if (currentCTX) getError("main");
  const ctx = new Component(jsxRoot);
  return renderElementNode(ctx, jsxRoot.dom);
};

VELOX.useForce = function forceUpdate(fn) {
  if (typeof fn !== "function") throw getError("useForce");
  const ctx = currentCTX;
  return function () {
    fn();
    requestUpdate(ctx);
  };
};

export default VELOX;

function Component(jsxRoot, props) {
  if (!(this instanceof Component)) return new Component(jsxRoot, props);
  else if (typeof jsxRoot === "function") {
    currentCTX = this;
    jsxRoot = jsxRoot(props);
    currentCTX = null;
  }
  this.components = jsxRoot.components;
  this.props = props;
  if (jsxRoot.scripts) {
    this.initScripts = jsxRoot.scripts;
    this.scripts = this.initScripts();
    this.observers = [];
  }
}

const PROTO = Component.prototype;

PROTO.createChildNode = function (node, el) {
  const SELF = this,
    nodeType = node.constructor;

  switch (nodeType) {
    case String:
      return document.createTextNode(node);

    case Number:
      const frag = new DOM_FRAG();
      // frag.resolveDynamicContent(SELF.scripts[node]);
      // el.appendChild(frag.frag);
      // SELF.observers.push(function () {
      //   hideFrag(frag, true);
      //   frag.resolveDynamicContent(SELF.scripts[node]);
      //   expandFrag(frag);
      // });
      return frag;

    default:
      node[2] ||= EMPTY_ARR;

      // const attrs = node[1];
      // Object.assign.apply(attrs, attrs[PRIVATE_KEY]);
      // delete attrs[PRIVATE_KEY];

      return renderElementNode(SELF, node);
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
  Object.keys(attrs).forEach(applyAttr);
  function applyAttr(attrName) {
    const attrValue = attrs[attrName];

    if (EVENT_EXP.test(attrName)) {
      const evType = attrName.slice(2).toLowerCase();
      el.addEventListener(evType, function (EV) {
        ctx.scripts[attrValue].call(el, EV) === true && requestUpdate(ctx);
      });
    } else if (CUSTOM_ATTRS[attrName])
      CUSTOM_ATTRS[attrName](el, ctx, attrValue);
    else if (isInt(attrValue)) {
      let currVal = null;
      ctx.observers.push(setCurrVal);
      function setCurrVal() {
        if (currVal === ctx.scripts[attrValue]) return;
        currVal = ctx.scripts[attrValue];
        el[attrName] = currVal;
      }
    } else el[attrName] = attrValue;
  }
};

CUSTOM_ATTRS.ref = function (el, ctx, attrValue) {
  ctx.scripts[attrValue].call(el, el);
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
