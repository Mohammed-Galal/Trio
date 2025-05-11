const OBJ_HAS = Object.prototype.hasOwnProperty;
const OBJ_KEYS = Object.keys;
const ASSIGN_OBJ = Object.assign;
const IS_INT = Number.isInteger;
const PROTO = Component.prototype;
const PendingUpdates = new Set();
const ChildrenContainer = new WeakMap();
const CustomAttrs = {};
const EventExp = /^on[A-Z]/;
const EmpyStr = "";

const Effects = {
  layoutEffects: [],
  effects: [],
};
const ERR = {
  C: ["Component is not defined", "Component is not a function"],
  S: ["Script is not defined", "Script is not a function"],
};

let isUpdating = false;

function Component(C) {
  if (this.constructor !== Component) return new Component(C);
  this.scripts = C.scripts;
  this.components = C.components;
  this.observers = [];
  this.cachedComponents = new Map();
}

PROTO.getScript = function (index) {
  return this.scripts[index];
};

PROTO.render = function (JSXNode) {
  const ctx = this;
  if (JSXNode.constructor !== Array) return createJSXNode(JSXNode, ctx);

  // check if Element has key
  return (IS_INT(JSXNode[0]) ? renderComponent : createElement)(JSXNode, ctx);
};

PROTO.retrieveComponent = function (c) {
  if (c && c.constructor !== Object) throw ERR.C[0];

  const ctx = this,
    DOMProps = c.dom[1];

  if (DOMProps && DOMProps.hasOwnProperty("key")) {
    const key = IS_INT(DOMProps.key)
      ? ctx.getScript(DOMProps.key)
      : DOMProps.key;

    if (!ctx.cachedComponents.has(key)) {
      const newCtx = new Component(c),
        registeredComponent = {};
      ctx.cachedComponents.set(key, registeredComponent);
      registeredComponent.observers = newCtx.observers;
      registeredComponent.DOM = createJSXNode(c.dom, newCtx);
    }

    const targetCtx = ctx.cachedComponents.get(key);
    targetCtx.observers.forEach((o) => o());
    return targetCtx.DOM;
  }

  const newCtx = new Component(c);
  return createJSXNode(c.dom, newCtx);
};

function createJSXNode(node, ctx) {
  if (node === undefined) throw ERR.C[0];

  switch (node.constructor) {
    case String:
      return document.createTextNode(node);

    case Array:
      const tag = node[0],
        isComponent = tag.constructor === Number;

      let targerMethod = "renderElement";
      if (isComponent) {
        node[0] = ctx.components[tag];
        targerMethod = "handleChildComponent";
      }

      return ctx[targerMethod](node);

    default:
      const frag = new DocFrag();
      // handle dynamic Content [String - False - Array - Null - Number]
      return frag;
  }
}

function createElement([tag, props, children], ctx) {
  const el = document.createElement(tag),
    registeredEvents = {};

  ctx.observers.push(initProps(props, ctx, changedPropsCallback));

  children &&
    children.forEach((child) => {
      const childNode = createJSXNode(child);
      if (childNode.constructor !== DocFrag) return el.appendChild(childNode);
      // dom frag handler
    });

  return el;

  function changedPropsCallback(newProps, changedProps) {
    changedProps.forEach((k) => applyProp(k, newProps[k]));
  }

  function applyProp(name, value) {
    if (value === undefined) return;

    if (EventExp.test(name)) {
      const isRegistered = registeredEvents.hasOwnProperty(name);
      value.constructor === Function && (registeredEvents[name] = value);
      if (isRegistered) return;
      const evType = name.slice(2).toLowerCase();
      el.addEventListener(evType, (ev) =>
        registeredEvents[name].call(el, ev, name)
      );
    }
    // ========
    else if (CustomAttrs.hasOwnProperty(name)) CustomAttrs[name](el, name, val);
    else if (value.constructor === Object) ASSIGN_OBJ(el[name], value);
    else if (el.hasOwnProperty(name)) el[name] = value;
    else el.setAttribute(name, value);
  }
}

function renderComponent([index, props, children], ctx) {
  const component = ctx.components[index];

  if (component.constructor === Object)
    return createJSXNode(component.dom, new Component(component));

  const childrenAsProp = new ChildrenData();
  if (children) {
    const childrenRef = Symbol("childrenRef"),
      childrenData = { children, ctx };
    childrenAsProp.ref = childrenRef;
    childrenAsProp.use = function (fn) {
      // check if fn is a function, otherwise throw Error
      childrenData.use ||= fn;
    };
    ChildrenContainer.set(childrenRef, childrenData);
  }
  Object.freeze(childrenAsProp);

  const docFrag = new DocFrag(),
    unNamed_2 = new MyLib(component, childrenAsProp, updateComponent),
    initializerFN = props ? initProps(props, ctx, pendUpdate) : pendUpdate;

  // =>>  we pass the props to unNamed_2.call method <<= //
  let currentActiveKey;
  const cachedComponents = new Map();

  initializerFN();
  return docFrag;

  function pendUpdate(props) {
    isUpdating
      ? PendingUpdates.add(() => unNamed_2.call(props))
      : unNamed_2.call(props);
  }

  function updateComponent(resultComponent) {
    unNamed_2.run("layoutEffects");

    switch (resultComponent && resultComponent.constructor) {
      case Object:
        const key = resultComponent.key;
        let newComponent;
        if (currentActiveKey !== key) {
          if (!cachedComponents.has(key)) {
            newComponent = new Component(resultComponent);
            const cache = {
              observers: newComponent.observers,
              DOM: createJSXNode(resultComponent.dom, newComponent),
            };
            cachedComponents.set(k, cache);
          }
          newComponent = cachedComponents.get(key);
          docFrag.replaceChildren(newComponent.DOM);
        }
        newComponent.observers.forEach((fn) => fn());
        currentActiveKey = key;
        break;

      case Array:
        docFrag.clear();
        resultComponent.forEach(iteratorHandler);
        function iteratorHandler(c) {
          docFrag.insertNode(ctx.retrieveComponent(c));
        }
        break;

      case Number:
        resultComponent = EmpyStr + resultComponent;

      default:
        docFrag.replaceChildren(EmpyStr + (resultComponent || EmpyStr));
    }

    unNamed_2.run("effects");
  }
}

function initProps(props, ctx, propChangeCallback) {
  const hasSpreadedProps = props.assign.length > 0,
    inlineProps = props.inline,
    propsContainer = {};

  const propsEntries = OBJ_KEYS(inlineProps),
    dynamicProps = [],
    changedProps = [];

  let targetProps = dynamicProps;

  if (hasSpreadedProps) ctx.observers.push(updateHandler);
  else {
    const dynamicKeys = propsEntries.filter((key) => IS_INT(inlineProps[key]));
    Object.assign(dynamicProps, dynamicKeys);
  }

  return updateHandler;

  function updateHandler() {
    const scripts = ctx.scripts;
    changedProps.length = 0;
    if (hasSpreadedProps) {
      props.assign.forEach((objRef) =>
        ASSIGN_OBJ(propsContainer, scripts[objRef])
      );
      propsEntries.forEach(checkProp);
      targetProps = OBJ_KEYS(propsContainer);
    }
    targetProps.forEach(checkProp);

    propChangeCallback && propChangeCallback(propsContainer, targetProps);
    return propsContainer;
  }

  function checkProp(prop) {
    const isDynamicProp = IS_INT(inlineProps[prop]),
      currentPropValue = isDynamicProp
        ? ctx.getScript(prop)
        : inlineProps[prop];
    if (propsContainer[prop] === currentPropValue) return;
    propsContainer[prop] = currentPropValue;
    changedProps.push(prop);
  }
}

function DocFrag() {
  if (this.constructor !== DocFrag) return new DocFrag();
  this.placeholder = document.createTextNode("");
}

function ChildrenData() {}
