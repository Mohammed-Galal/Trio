const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const EMPTY_DOM_CONTAINER = [];
const PRIVATE_KEY = "#Xtends";
const CUSTOM_TAGS = /Frag|Switch|Case|Link/;
const EVENT_EXP = /^on[A-Z]/;
const CACHED = new Map();

function Component(jsxRoot, props) {
  if (this.constructor !== Component) return new Component(jsxRoot);
  else if (jsxRoot.constructor.name === "Function") {
    const result = jsxRoot(props);
    jsxRoot = result;
  }

  const SELF = this;
  SELF.component = jsxRoot.components;
  if (jsxRoot.scripts) {
    SELF.observers = { scripts: [], components: new Set() };
    SELF.initScripts = jsxRoot.scripts;
    SELF.scripts = SELF.initScripts.apply(null);
  }
  SELF.DOM = render(this, jsxRoot.dom); // HTMLElement || DOM_FRAG
}

const PROTO = Component.prototype;

PROTO.update = function () {
  if (this.scripts !== undefined) {
    this.scripts = this.initScripts.apply(null);
    this.observers.scripts.forEach((S) => S());
    this.observers.components.forEach((C) => C());
    this.observers.components.clear();
  }
  return this;
};

function render(ctx, shadowHTMLElement) {
  const tag = shadowHTMLElement[0],
    attrs = shadowHTMLElement[1] || {},
    children = shadowHTMLElement[2];

  if (Number.isInteger(tag)) {
    let needToUpdate = false;

    const keys = new Iterator(Object.keys(attrs));
    while (keys.next()) {
      const key = keys.value(),
        value = attrs[key];
      if (Number.isInteger(value)) {
        let currentValue = ctx.scripts[value];
        delete attrs[key];
        Object.defineProperty(attrs, key, {
          get() {
            const newVal = ctx.scripts[value];
            if (newVal !== currentValue) {
              needToUpdate = true;
              currentValue = newVal;
            }
            return currentValue;
          },
        });
      }
    }

    if (children) {
      const Children = new DOM_FRAG();
      let didRendered = false;
      Object.defineProperty(attrs, "Children", {
        get() {
          if (!didRendered) {
            const nodes = new Iterator(children);
            while (nodes.next()) frag.append(render(ctx, nodes.value()));
            didRendered = true;
          }
          return Children;
        },
      });
    }

    const C = new Component(ctx.components[tag], attrs),
      updateCurrentComponent = () => C.update();

    ctx.observers.scripts.push(function () {
      needToUpdate && ctx.observers.components.push(updateCurrentComponent);
      needToUpdate = false;
    });

    return C.DOM;
  } else if (CUSTOM_TAGS.test(tag))
    return handleCustomTag(shadowHTMLElement, ctx);

  const el = document.createElement(tag);

  if (children) {
    const iterator = new Iterator(children);
    while (iterator.next()) {
      const node = iterator.value(),
        DOMType = node.constructor;

      switch (DOMType) {
        // Static Content
        case String:
          el.appendChild(new Text(node));
          break;

        // Dynamic Content
        case Number:
          const frag = new DOM_FRAG();
          frag.append(ctx.scripts[node]);
          el.appendChild(frag.placeholder);
          spreadFrag(frag);
          ctx.observers.scripts.push(function () {
            clear(frag);
            frag.append(ctx.scripts[node]);
            spreadFrag(frag);
          });
          break;

        default:
          const result = render(ctx, node);
          if (result.constructor === DOM_FRAG) {
            el.appendChild(result.placeholder);
            spreadFrag(result);
          } else el.appendChild(result);
      }
    }
  }

  attrs.hasOwnProperty(PRIVATE_KEY) &&
    attrs[PRIVATE_KEY].forEach((OBJ) => Object.assign(attrs, OBJ));

  const keys = Object.keys(attrs).filter((d) => d !== PRIVATE_KEY),
    iterator = new Iterator(keys);

  while (iterator.next()) {
    const attrName = iterator.value(),
      attrValue = attrs[attrName];

    switch (true) {
      case EVENT_EXP.test(attrName):
        const evType = attrName.slice(2).toLowerCase();
        el.addEventListener(evType, function () {
          ctx.scripts[attrValue].apply(el, Array.from(arguments));
        });
        break;

      case attrName === "ref":
        ctx.scripts[attrValue].call(el, el);
        break;

      case attrName === "style":
        Object.assign(el.style, ctx.scripts[attrValue]);
        ctx.observers.scripts.push(function () {
          Object.assign(el.style, ctx.scripts[attrValue]);
        });
        break;

      default:
        el[attrName] = attrValue;
    }
  }

  return el;
}

function handleCustomTag(tag, currRoot) {}

function DOM_FRAG() {
  this.placeholder = new Text();
  this.cache = { scriped: new Map(), descriped: new Map() };
  // Array (Components) || Component || String: Primitive Value
  this.currDOM = null;
}

const FRAG_PROTO = DOM_FRAG.prototype;

// append => replaces current active Node
// whenever this function gets invoked, it removes the current Active DOM, and replaces it with the Content
FRAG_PROTO.append = function (HTMLNode) {
  const SELF = this;

  switch (HTMLNode.constructor) {
    // jsxRoots Array
    case IS_ARRAY(HTMLNode):
      const result = (SELF.currDOM = []),
        iterator = new Iterator(HTMLNode);
      while (iterator.next())
        result[iterator.index] = SELF.resolveComponent(iterator.value());
      break;

    // jsxRoot
    case Object:
      SELF.currDOM = resolveComponent(HTMLNode);
      break;

    default:
      SELF.currDOM =
        EMPTY_STR +
        (Number.isInteger(HTMLNode) ? HTMLNode : HTMLNode || EMPTY_STR);
      break;
  }
};

FRAG_PROTO.resolveComponent = function (_component) {
  let cacheContainer = CACHED,
    key = _component.key;

  if (key === null) {
    const targetCache = Number.isInteger(_component.dom[0])
      ? "scriped"
      : "descriped";
    cacheContainer = this.cache[targetCache];
    key = _component.index;
  }

  return cacheContainer.has(key)
    ? cacheContainer.get(key).update(_component.scripts)
    : cacheContainer.set(key, new Component(_component)).get(key);
};

function spreadFrag(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  if (activeDOM === null) return;
  else if (activeDOM.constructor === String)
    return (placeholder.textContent = activeDOM);
  else if (IS_ARRAY(activeDOM)) {
    const iterator = new Iterator(activeDOM);
    while (iterator.next())
      appendToFrag(parentElement, iterator.value().DOM, placeholder);
  } else appendToFrag(parentElement, activeDOM, placeholder);
}

function appendToFrag(parentElement, DOMNode, placeholder) {
  if (DOMNode.constructor === DOM_FRAG) {
    parentElement.insertBefore(DOMNode.placeholder, placeholder);
    spreadFrag(DOMNode);
  } else parentElement.insertBefore(DOMNode, placeholder);
}

function clear(frag) {
  const placeholder = frag.placeholder,
    parentElement = placeholder.parentElement,
    activeDOM = frag.currDOM;

  if (activeDOM === null) return;
  else if (activeDOM.constructor === String)
    placeholder.textContent = EMPTY_STR;
  else if (IS_ARRAY(activeDOM)) {
    const iterator = new Iterator(activeDOM);
    while (iterator.next()) removeFromFrag(parentElement, iterator.value().DOM);
  } else removeFromFrag(parentElement, activeDOM);
}

function removeFromFrag(parentElement, DOMNode) {
  if (DOMNode.constructor === DOM_FRAG) clear(DOM_FRAG);
  else parentElement.removeChild(DOMNode);
}

function Iterator(arr) {
  this.index = -1;
  this.ref = arr;
  // this.result = [];
}

Iterator.prototype.next = function () {
  if (this.ref.length - this.index === 1) return false;
  this.index++;
  return true;
};

Iterator.prototype.value = function () {
  return this.ref[this.index];
};

// Iterator.prototype.call = function (fn) {
//   this.result[this.index] = fn(this.value());
// };
