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
  E: ["Entry must have a key and JSX Component", "Entry key must be a String", "Entry component must be a JSX Component"],
  M: ["MyLib must have a component, childrenAsProp, updateComponent"],
  D: ["DocFrag must be a new instance"],
  F: ["Fragment must be a new instance"],
  L: ["Layout Effects must be a function"],
  E: ["Effects must be a function"],
  R: ["Children Data must be a function"],
  P: ["Prop Change Callback must be a function"],
  C: ["Component must be a new instance"],
  I: ["Component must have a scripts property"],
  O: ["Component must have a components property"],
  V: ["Component must have a cachedComponents property"],
  U: ["Component must have a updateComponent property"],
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

function createJSXNode(node, ctx) {
  if (node === undefined) throw ERR.C[0];
  switch (node.constructor) {
    case Array:
      const tag = node[0],
        isComponent = tag.constructor === Number;
      let targetMethod = createElement;
      if (isComponent) {
        node[0] = ctx.components[tag];
        targetMethod = renderComponent;
      }
      return targetMethod(node, ctx);

    case Number:
      const frag = new DocFrag();
      frag.placeholder.textContent = EmpyStr + node;
      return frag;

    default:
      return document.createTextNode(EmpyStr + (node || EmpyStr));
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
      if (value.constructor !== Function) return;
      registeredEvents[name] = value;
      if (registeredEvents.hasOwnProperty(name)) return;
      const evType = name.slice(2).toLowerCase();
      el.addEventListener(evType, (ev) =>
        registeredEvents[name].call(el, ev, name)
      );
    }
    else if (CustomAttrs.hasOwnProperty(name)) CustomAttrs[name](el, name, val);
    else if (value.constructor === Object) ASSIGN_OBJ(el[name], value);
    else if (el.hasOwnProperty(name)) el[name] = value;
    else el.setAttribute(name, value);
  }
}

function renderComponent([index, props, children], ctx) {
  const component = ctx.components[index],
    _constructor = component.constructor,
    docFrag = new DocFrag();

  if (_constructor === Object) return docFrag.render(component);
  else if (_constructor !== Function) throw new Error(ERR.C[1]);

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

  const unNamed_2 = new MyLib(component, childrenAsProp, docFrag.render),
    initializerFN = props ? initProps(props, ctx, pendUpdate) : pendUpdate;

  // =>>  we pass the props to unNamed_2.call method
  // =>>  unNamed_2.call() => run LayouEffects => updateComponent => Effects

  initializerFN();
  return docFrag;

  function pendUpdate(props) {
    isUpdating
      ? PendingUpdates.add(() => unNamed_2.call(props))
      : unNamed_2.call(props);
  }
}

// initProps: [Object, Component, Callback Function]
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

/***********************************************************/
function ChildrenData() { }

function DocFrag() {
  if (this.constructor !== DocFrag) return new DocFrag();
  this.placeholder = document.createTextNode(EmpyStr);
  this.frag = document.createDocumentFragment();
  this.snapshot = [];
  this.cache = new Map();
}

DocFrag.prototype.appendTo = function (parent) {
  if (parent.constructor === DocFrag) return parent.appendTo(parent);
  const self = this;
  parent.appendChild(self.placeholder);
  Object.assign(self.frag.childNodes, self.snapshot);
  parent.insertBefore(self.frag, self.placeholder);
  self.snapshot.length = 0;
}

DocFrag.prototype.insertNode = function (node) {
  const self = this;
  if (node.constructor === Array) node.forEach(self.insertNode, self);
  else if (node.constructor !== DocFrag) self.appendTo(node);
  else self.frag.appendChild(node);
};

DocFrag.prototype.clear = function () {
  const self = this;
  self.placeholder.textContent = "";
  self.snapshot.forEach(node => node.remove());
  self.snapshot.length = 0;
};

DocFrag.prototype.replaceChildren = function (node) {
  const self = this;
  self.clear();
  self.insertNode(node);
};


// JSXRoot :Array? [Object, Number, false, null, undefined, String + otherDataType?]
DocFrag.prototype.render = function (JSXRoot) {
  const container = this;

  switch (JSXRoot.constructor) {
    // Array may contains various Data Types
    case Array:
      JSXRoot.forEach(container.render);
      break;

    // handle JSX Components
    case Object:
      const cache = container.cache,
        key = JSXRoot.key;

      if (cache.has(key)) {
        const cachedComponent = cache.get(key);
        cachedComponent.observers.forEach(fn => fn());
      } else {
        const ctx = new Component(JSXRoot);
        cache.set(key, {
          DOM: createJSXNode(JSXRoot.dom, ctx),
          observers: ctx.observers,
        });
      }

      container.frag.appendChild(cache.get(key).DOM);
      break;

    // Entry: [key, component]
    case Entry: {
      const cache = container.cache,
        key = JSXRoot.key;

      if (cache.has(key)) {
        const cachedComponent = cache.get(key);
        cachedComponent.observers.forEach(fn => fn());
      } else {
        const ctx = new Component(JSXRoot.value);
        cache.set(key, {
          DOM: createJSXNode(JSXRoot.dom, ctx),
          observers: ctx.observers,
        });
      }

      container.frag.appendChild(cache.get(key).DOM);
      break;
    }

    // handle Integers
    case Number:
      container.placeholder.textContent = EmpyStr + JSXRoot;
      break;

    // other Data Types (e.g Boolean, Symbol, Function, Null, undefined, ...etc)
    default:
      container.placeholder.textContent = EmpyStr + (JSXRoot || EmpyStr);
  }
};

// Entry: [key, component]
function Entry(key, component) {
  if (this.constructor !== Entry) return new Entry(key, component);
  else if (key === undefined || component === undefined) throw new Error("Entry must have a key and JSX Component");
  else if (key.constructor !== String) throw new Error("Entry key must be a String");
  else if (component.constructor !== Object) throw new Error("Entry component must be a JSX Component");

  this.key = key;
  this.value = component;
}

// MyLib: [Object, ChildrenData, Function]
function MyLib(component, childrenAsProp, updateComponent) {
  this.component = component;
  this.childrenAsProp = childrenAsProp;
  this.updateComponent = updateComponent;
}

MyLib.prototype.call = function (props) {
  this.component.renderEntry(props);
}

MyLib.prototype.handleChildComponent = function (node) {
  const self = this;
  const children = node[2];
  if (children) {
    const childrenRef = Symbol("childrenRef"),
      childrenData = { children, ctx };
    self.childrenAsProp.ref = childrenRef;
    self.childrenAsProp.use = function (fn) {
      if (typeof fn !== "function") throw new Error("Children Data must be a function");
      childrenData.use = fn;
    };
    ChildrenContainer.set(childrenRef, childrenData);
  }
}
