const PENDING_UPDATES = new Set();
const CUSTOM_RENDER = {};
const EMPTY_ARR = [];
const LINK_EXP = "Link";
const CASE_EXP = "Case";
const ANCHOR_EXP = "a";
const IS_INT = Number.isInteger;
const IS_ARRAY = Array.isArray;
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === CASE_EXP;

export { PENDING_UPDATES };
export default createElementNode;

function createElementNode(ctx, vNode) {
  vNode[2] ||= EMPTY_ARR;
  const [tag, attrs, children] = vNode;

  if (attrs.key) return resolveCache(ctx, vNode);
  else if (IS_INT(tag)) return createComponent(ctx, vNode);
  else if (CUSTOM_RENDER[tag]) return CUSTOM_RENDER[tag](ctx, vNode);
  else if (tag === LINK_EXP) {
    vNode[0] = ANCHOR_EXP;
  }

  const el = document.createElement(tag);
  for (let i = 0; i < children.length; ) ctx.createNode(children[i++], el);
  ctx.applyAttributes(attrs, el);
  return el;
}

function createComponent(ctx, vNode) {
  const Component = ctx.constructor,
    [tag, attrs, children] = vNode;

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

  return createElementNode(ctx, jsxRoot.dom);
}

function resolveCache(ctx, vNode) {
  const attrs = vNode[1],
    key = attrs.key;

  if (!key) return false;
  delete attrs.key;

  const observerStart = ctx.observers.length - 1;
  const result = createElementNode(ctx, vNode);
  const observerEnd = ctx.observers.length - 1;

  ctx.cacheContainer[key] = {
    update() {},
    dom: result,
  };

  return Element;
}

CUSTOM_RENDER.Frag = function (ctx, vNode) {};

CUSTOM_RENDER.SwitchCase = function (ctx, vNode) {};

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
