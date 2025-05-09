const OBJ_HAS = Object.prototype.hasOwnProperty;
const OBJ_KEYS = Object.keys;
const ASSIGN_OBJ = Object.assign;
const IS_INT = Number.isInteger;
const PROTO = Component.prototype;

const CustomAttrs = {};
const evExp = /^on[A-Z]/;

function Component(C) {
  if (this.constructor !== Component) return new Component(C);
  this.scripts = C.scripts;
  this.components = C.components;
  this.observers = [];
}

PROTO.getScript = function (index) {
  return this.scripts[index];
};

PROTO.renderElement = function (tag, props, children) {
  const el = document.createElement(tag),
    registeredEvents = {},
    ctx = this;

  ctx.observers.push(initProps(props, ctx, applyProp));

  children &&
    children.forEach((child) => {
      const childNode = unNamed(child);
      if (childNode.constructor !== DocFrag) return el.appendChild(childNode);
      // dom frag handler
    });

  return el;

  function applyProp(name, value) {
    if (value === undefined) return;

    if (evExp.test(name)) {
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
};

PROTO.handleChildComponent = function ([index, props, children]) {
  const component = this,
    childComponent = component.components[index];

  if (childComponent.constructor === Object)
    return unNamed(childComponent.dom, new Component(childComponent));

  const observers = component.observers,
    cachedComponents = new Map(),
    unNamed_2 = new MyLib(childComponent, children, updateComponent);
  // =>>  we pass the props to unNamed_2.call method <<= //

  let initializerFunction = unNamed_2.call;
  if (props) {
    initializerFunction = initProps(props, component, unNamed_2.call);
  }

  observers.push(initializerFunction);

  let currentActiveKey;

  return docFrag;

  function updateComponent(resultComponent) {
    /**
     * @IF currentActiveKey is not the same as the result key.
     * 1. retreive component's Element from saved version of the component's key.
     *    OR render the result if it's not saved yet, then save it by it's key.
     * 2. replace currentActiveKey accordingly.
     *
     * @finally
     * 1. run unNamed.layoutEffects => unNamed.run("layoutEffects")
     * 2. run current Component observers
     * 3. run unNamed.Effects => unNamed.run("Effects")
     */
  }
};

function unNamed(node, ctx) {
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

function initProps(props, ctx, propChangeCallback) {
  const hasSpreadedProps = props.assign.length > 0,
    inlineProps = props.inline,
    propsContainer = {};

  const propsEntries = OBJ_KEYS(inlineProps),
    dynamicProps = [],
    changedProps = [];

  let targetProps = dynamicProps;

  if (hasSpreadedProps) ctx.observers.push(updateHandler);
  else if (dynamicProps.length) {
    const dynamicKeys = propsEntries.filter((key) => IS_INT(inlineProps[key]));
    Object.assign(dynamicProps, dynamicKeys);
    ctx.observers.push(updateHandler);
  }

  return updateHandler;

  function updateHandler() {
    const scripts = ctx.scripts;
    props.assign.forEach((objRef) =>
      ASSIGN_OBJ(propsContainer, scripts[objRef])
    );

    if (hasSpreadedProps) {
      propsEntries.forEach(propHandler);
      targetProps = OBJ_KEYS(propsContainer);
    }

    targetProps.forEach(propHandler);
    changedProps.forEach((key) => propChangeCallback(key, propsContainer[key]));
    changedProps.length = 0;
    return propsContainer;
  }

  function propHandler(prop) {
    // review Prop
    // invoke callback function whenever we detect prop change
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

  let currentActiveKey;
  const placeholder = document.createTextNode(""),
    cachedElements = new Map();

  Object.assign(this, { placeholder });
}
