import DOM_FRAG from "./fragment";
import renderElementNode, { appMethods } from "./createElement";
import getError from "./errors";

const APP = new (function APP() {})();
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const CUSTOM_ATTRS = {};

let currentCTX = null;

APP.render = function (jsxRoot) {
  if (currentCTX) getError("main");
  const ctx = new Component(jsxRoot);
  return renderElementNode(ctx, jsxRoot.dom);
};

APP.useForce = function forceUpdate(fn) {
  if (typeof fn !== "function") throw getError("useForce");
  const ctx = currentCTX;
  return function () {
    fn();
    appMethods.update(ctx);
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

      const resultElement = renderElementNode(SELF, node);

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
