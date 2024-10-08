import DOM_FRAG from "./fragment";

const IS_INT = Number.isInteger;
const IS_ARRAY = Array.isArray;
const defineProp = Object.defineProperty;
const PENDING_UPDATES = new Set();
const CUSTOM_RENDER = {};
const LINK_EXP = "Link";
const ANCHOR_EXP = "a";
const CASE_EXP = "Case";
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === CASE_EXP;

export { PENDING_UPDATES };
export default renderElementNode;

function renderElementNode(ctx, vNode) {
  const [tag, attrs, children] = vNode;

  if (attrs.key) return resolveCache(ctx, vNode);
  else if (IS_INT(tag)) return renderComponent(ctx, vNode);
  else if (CUSTOM_RENDER[tag]) return CUSTOM_RENDER[tag](ctx, vNode);
  else if (tag === LINK_EXP) {
    vNode[0] = ANCHOR_EXP;
  }

  const el = document.createElement(tag);

  for (let i = 0; i < children.length; ) {
    const childNode = ctx.createChildNode(children[i++]);
    childNode.constructor.name === "DOM_FRAG"
      ? childNode.appendTo(el)
      : el.appendChild(childNode);
  }

  ctx.applyAttributes(attrs, el);
  return el;
}

function renderComponent(ctx, vNode) {
  const Component_Construct = ctx.constructor,
    [tag, attrs, children] = vNode,
    jsxRoot = ctx.components[tag];

  if (jsxRoot === ctx.props.children) return ctx.Children;

  const keys = Object.keys(attrs),
    props = {};

  let C,
    index = 0;

  while (index < keys.length) handleProp(keys[index++]);

  C = new Component_Construct(jsxRoot, props);

  if (children.length) {
    const childrenContainer = new DOM_FRAG();
    index = 0;
    while (index < children.length)
      childrenContainer.insertNode(ctx.createChildNode(children[index++]));
    defineProp(C, "Children", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: childrenContainer,
    });
  }

  return renderElementNode(C, jsxRoot.dom);

  function handleProp(key) {
    const value = attrs[key];
    if (IS_INT(value)) {
      props[key] = ctx.scripts[value];
      ctx.observers.push(function () {
        const newVal = ctx.scripts[value];
        if (props[key] === newVal) return;
        props[key] = newVal;
        PENDING_UPDATES.add(C);
      });
    } else props[key] = value;
  }
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

CUSTOM_RENDER.Frag = function (ctx, vNode) {};

CUSTOM_RENDER.Switch = function (ctx, vNode) {};

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
