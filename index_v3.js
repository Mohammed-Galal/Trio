/**
 * Error instance for general use.
 * @type {Error}
 */
const ERR = new Error();

/**
 * Main app object that holds utility functions.
 * @type {Object}
 */
const APP = {};

/**
 * Alias for checking if a value is an array.
 * @type {Function}
 */
const IS_ARRAY = Array.isArray;

/**
 * Empty string constant.
 * @type {string}
 */
const EMPTY_STR = "";

/**
 * Key used to mark custom private attributes.
 * @type {string}
 */
const PRIVATE_KEY = "#Xtends";

/**
 * Regular expression to detect event attributes (e.g., onClick).
 * @type {RegExp}
 */
const EVENT_EXP = /^on[A-Z]/;

/**
 * Object to store custom attribute handlers.
 * @type {Object}
 */
const CUSTOM_ATTRS = {};

/**
 * Cache for storing rendered components.
 * @type {Map}
 */
const CACHED = new Map();

/**
 * Error object used in the forceUpdate function for invalid parameters.
 * @type {Object}
 */
const paramErr = { name: "useForce Hook Rules", message: "" };

/**
 * Global reference to the current component's context.
 * @type {Object|null}
 */
let currentCTX = null;

/**
 * @method forceUpdate
 * @description Force update function to trigger component re-rendering.
 * @param {Function} fn - Function to be called for update.
 * @throws {Error} Throws error if fn is not a function.
 * @returns {Function} Returns a function that will force the component to re-render.
 */
APP.forceUpdate = function (fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, paramErr);

  const ctx = currentCTX;

  return function () {
    fn();
    requestUpdate(ctx);
  };
};

/**
 * @method ref
 * @description Custom attribute handler for the "ref" attribute.
 * @param {HTMLElement} el - The target element.
 * @param {Object} ctx - The component context.
 * @param {string} attrValue - The value of the "ref" attribute.
 */
CUSTOM_ATTRS["ref"] = function (el, ctx, attrValue) {
  // Execute the script associated with the ref attribute
  ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, el);
};

/**
 * @method style
 * @description Custom attribute handler for the "style" attribute.
 * @param {HTMLElement} el - The target element.
 * @param {Object} ctx - The component context.
 * @param {string} attrValue - The value of the "style" attribute.
 */
CUSTOM_ATTRS["style"] = function (el, ctx, attrValue) {
  const styleObject = ctx.scripts[attrValue]; // Get style object from scripts
  if (styleObject) {
    // Apply styles
    Object.assign(el.style, styleObject);
    // Add to observers to reapply styles when they change
    ctx.observers.push(() => Object.assign(el.style, styleObject));
  }
};

// Constants for handling switch-case components
const switchEXP = "Switch",
  caseEXP = "Case",
  linkEXP = "Link",
  anchorEXP = "a";

/**
 * @function caseFiltration
 * @description Helper function to filter case expressions in switch-case logic.
 * @param {Array} CN - The case node array.
 * @returns {boolean} Returns true if the node represents a case expression.
 */
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === caseEXP;

/**
 * @function Component
 * @description Component constructor for building components.
 * @param {Object} jsxRoot - The root JSX structure.
 * @param {Object} [props={}] - Optional properties for the component.
 * @constructor
 */
function Component(jsxRoot, props = {}) {
  // Ensure proper instantiation
  if (!(this instanceof Component)) return new Component(jsxRoot, props);
  else if (typeof jsxRoot === "function") {
    currentCTX = this; // Set current component's context
    jsxRoot = jsxRoot(props); // Execute if the jsxRoot is a function
    currentCTX = null; // Reset the context
  }

  if (jsxRoot.scripts) {
    this.initScripts = jsxRoot.scripts; // Store initial scripts
    this.scripts = this.initScripts(); // Initialize component's scripts
    this.observers = []; // Initialize observers for watching changes
    this.pendingUpdates = new Set(); // Track pending updates
  }

  this.component = jsxRoot.components; // Assign components
  this.DOM = render(this, jsxRoot.dom); // Render the component's DOM
}

const PROTO = Component.prototype; // Component's prototype for adding methods

/**
 * @this Component.prototype
 * @method createNode
 * @description Creates a DOM node based on the type of the node passed.
 * @param {*} node - The node to be created.
 * @returns {HTMLElement|Text|DocumentFragment} DOM node based on the type of node passed (String, Number, or JSX).
 */
PROTO.createNode = function (node) {
  switch (node.constructor) {
    // Create text node for strings
    case String:
      return document.createTextNode(node);

    // Handle numbers as text content with observers
    case Number:
      return this.createTextNode(node);

    // Handle JSX-like elements
    default:
      return this.createElementNode(node);
  }
};

/**
 * @this Component.prototype
 * @method createTextNode
 * @description Creates a text node for numbers and sets up observers for dynamic updates.
 * @param {number} node - The number to be converted to text.
 * @returns {DocumentFragment} The document fragment representing the number.
 */
PROTO.createTextNode = function (node) {
  const SELF = this,
    frag = new DOM_FRAG(); // Create a new DOM fragment
  // Resolve the content from scripts
  frag.resolveDynamicContent(this.scripts[node]);

  // Add observer to update fragment when content changes
  this.observers.push(function () {
    // Clear previous fragment
    clearFrag(frag);
    // Re-resolve the content
    frag.resolveDynamicContent(SELF.scripts[node]);
    // Expand fragment in the DOM
    expandFrag(frag);
  });

  return frag;
};

/**
 * @this Component.prototype
 * @method createElementNode
 * @description Creates a DOM element (e.g., <div>, <span>) and appends child nodes.
 * @param {Array} node - The node array [tag, attributes, children].
 * @returns {HTMLElement} The created DOM element.
 */
PROTO.createElementNode = function ([tag, attrs = {}, children = []]) {
  const SELF = this,
    el = document.createElement(tag); // Create the actual DOM element

  // Recursively render and append child nodes
  if (children.length) {
    const childrenNodes = children;
    childrenNodes.forEach(function (child) {
      const childNode = render(SELF, child);
      if (childNode instanceof DOM_FRAG) {
        el.appendChild(childNode.placeholder);
        expandFrag(childNode);
      } else el.appendChild(childNode);
    });

    // Apply attributes to the element
    this.applyAttributes(el, attrs);
    return el;
  }
};

/**
 * @this Component.prototype
 * @method applyAttributes
 * @description Applies attributes (including custom attributes and event listeners) to an element.
 * @param {HTMLElement} el - The target element.
 * @param {Object} attrs - The attributes to apply.
 */
PROTO.applyAttributes = function (el, attrs) {
  const SELF = this;
  if (attrs[PRIVATE_KEY]) {
    // Apply private attributes if present
    attrs[PRIVATE_KEY].forEach((obj) => Object.assign(attrs, obj));
  }

  // Loop over all attributes and apply them
  Object.keys(attrs).forEach(function (attrName) {
    if (attrName === PRIVATE_KEY) return;
    const attrValue = attrs[attrName];
    if (EVENT_EXP.test(attrName)) {
      // Handle event attributes (e.g., onClick)
      el.addEventListener(attrName.slice(2).toLowerCase(), function (e) {
        const result =
          SELF.scripts[attrValue] && SELF.scripts[attrValue].apply(el, [e]);
        if (result === true) requestUpdate(SELF); // Trigger update if the event handler returns true
      });
    } else if (CUSTOM_ATTRS[attrName]) {
      // Handle custom attributes like ref and style
      CUSTOM_ATTRS[attrName](el, SELF, attrValue);
    } else {
      el[attrName] = attrValue; // Apply regular attributes
    }
  });
};

/**
 * @this Component.prototype
 * @method checkCase
 * @description Handles conditional rendering in switch-case components.
 * @param {Array} childNode - The case node array.
 * @returns {Function} Function that returns the rendered children if the test passes.
 */
PROTO.checkCase = function (childNode) {
  const SELF = this,
    conditionRef = childNode[1].test || true; // Check condition reference for switch-case

  let container = null;

  // Return a function that will be called to render the case conditionally
  return function () {
    const testRes =
      Boolean(conditionRef) ||
      (Number.isInteger(conditionRef) && SELF.scripts[conditionRef]);

    // Render children if condition passes and container hasn't been rendered before
    if (container === null) {
      const childNodes = childNode[2] || [];
      container = childNodes.map((node) => render(SELF, node));
    }

    return testRes ? container : null; // Return the rendered children if test passes
  };
};

/**
 * @function requestUpdate
 * @description Requests an update for the given component context.
 * @param {Object} ctx - The component context.
 * @returns {Object} The updated context.
 */
function requestUpdate(ctx) {
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts(); // Reinitialize scripts
    ctx.observers.forEach((observer) => observer()); // Notify all observers
    ctx.pendingUpdates.forEach(requestUpdate); // Process pending updates
    ctx.pendingUpdates.clear(); // Clear pending updates
  }
  return ctx;
}

/**
 * @function render
 * @description Main rendering function for creating components and elements.
 * @param {Object} ctx - The component context.
 * @param {Array} vNode - The virtual node array [tag, attributes, children].
 * @returns {HTMLElement|DocumentFragment} The rendered DOM.
 */
function render(ctx, vNode) {
  const [tag, attrs, children] = vNode;

  // Handle dynamic components (identified by integers)
  if (Number.isInteger(tag)) {
    let C;

    if (attrs) {
      attrs.forEach(handleProp);
      function handleProp(key) {
        const value = attrs[key];
        if (Number.isInteger(value)) {
          attrs[key] = ctx.scripts[value];
          ctx.observers.push(function () {
            const newVal = ctx.scripts[value];
            if (attrs[key] === newVal) return;
            attrs[key] = newVal;
            ctx.pendingUpdates.add(C);
          });
        }
      }
    }

    if (children) {
      const docFrag = new DOM_FRAG();
      let didRendered = false;

      Object.defineProperty(attrs, "Children", {
        get() {
          if (!didRendered) {
            children.forEach(appendChildNode);
            didRendered = true;
          }
          return docFrag;
        },
      });

      function appendChildNode(node) {
        const childNode = render(ctx, node);
        docFrag.append(childNode);
      }
    }

    C = new Component(ctx.components[tag], attrs);
    return C.DOM;
  }
  // Handle switch-case components
  else if (tag === switchEXP) return renderSwitchCase(ctx, children);
  // Handle link elements (convert custom "Link" to <a> tag)
  else if (tag === linkEXP) {
    vNode[0] = anchorEXP;
  }

  // Create DOM node based on the vNode
  return ctx.createNode(vNode);
}

/**
 * @function renderSwitchCase
 * @description Renders switch-case components.
 * @param {Object} ctx - The component context.
 * @param {Array} children - The array of case nodes.
 * @returns {DocumentFragment} The rendered document fragment.
 */
function renderSwitchCase(ctx, children) {
  // Create a fragment to hold the case results
  const frag = new DOM_FRAG();
  // Filter and map cases
  const cases = children.filter(caseFiltration).map(ctx.checkCase, ctx);

  let index = 0;
  // Add observer to update fragment when the case condition changes
  ctx.observers.push(function () {
    // Clear previous content
    clearFrag(frag, true);

    while (cases.length > index) {
      const result = cases[index++](); // Check case condition
      // Append matching case
      if (result) {
        frag.append(result);
        break;
      }
    }
    // Expand the fragment into the DOM
    expandFrag(frag);
    index = 0;
  });

  return frag;
}

/**
 * @function DOM_FRAG
 * @description Constructor for managing dynamic content in document fragments.
 * @constructor
 */
function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR); // Placeholder text node for fragment
  this.cache = { instance: new Map(), ref: new Map() }; // Cache for instances and refs
  this.currDOM = []; // Current DOM elements inside the fragment
}

/**
 * @this DOM_FRAG.prototype
 * @method append
 * @description Appends nodes to the fragment.
 * @param {HTMLElement|Array} HTMLNode - The node or array of nodes to append.
 */
DOM_FRAG.prototype.append = function (HTMLNode) {
  const SELF = this;
  // Handle arrays of nodes
  if (IS_ARRAY(HTMLNode)) HTMLNode.forEach((node) => SELF.append(node));
  // Add single node to currDOM
  else SELF.currDOM.push(HTMLNode);
};

/**
 * @this DOM_FRAG.prototype
 * @method resolveDynamicContent
 * @description Resolves and updates dynamic content inside the fragment.
 * @param {*} content - The content to resolve (array, object, or text).
 */
DOM_FRAG.prototype.resolveDynamicContent = function (content) {
  const SELF = this;

  // Clear previous content
  clearFrag(SELF, true);

  // Resolve each component in array
  if (IS_ARRAY(content))
    content.forEach((comp) => resolveComponent(SELF, comp));
  // Resolve single component object
  else if (typeof content === "object") resolveComponent(SELF, content);
  // Update placeholder with simple text
  else SELF.placeholder.textContent = EMPTY_STR + content;
};

/**
 * @function resolveComponent
 * @description Resolves a component and appends its DOM to the fragment.
 * @param {DOM_FRAG} frag - The fragment to append the component to.
 * @param {Component} component - The component object.
 */
function resolveComponent(frag, component) {
  const key = component.key || component.index; // Determine cache key
  const cacheContainer = component.key
    ? CACHED
    : frag.cache[component.dom[0] ? "instance" : "ref"];

  // Either update or create a new component and append its DOM
  const result = cacheContainer.has(key)
    ? requestUpdate(cacheContainer.get(key))
    : cacheContainer.set(key, new Component(component)).get(key);

  frag.append(result.DOM);
}

/**
 * @function expandFrag
 * @description Expands the fragment by inserting its nodes into the DOM.
 * @param {DOM_FRAG} frag - The fragment to expand.
 */
function expandFrag(frag) {
  const parent = frag.placeholder.parentElement;

  frag.currDOM.forEach(function (childNode) {
    if (childNode instanceof DOM_FRAG) {
      parent.insertBefore(childNode.placeholder, frag.placeholder); // Insert child fragment's placeholder
      expandFrag(childNode); // Recursively expand child fragments
    }
    // Insert child DOM node
    else parent.insertBefore(childNode, frag.placeholder);
  });
}

/**
 * @function clearFrag
 * @description Clears the contents of a fragment from the DOM.
 * @param {DOM_FRAG} frag - The fragment to clear.
 * @param {boolean} [reset=false] - Whether to reset the currDOM array.
 */
function clearFrag(frag, reset) {
  const parent = frag.placeholder.parentElement;
  frag.currDOM.forEach(function (childNode) {
    // Recursively clear child fragments
    if (childNode instanceof DOM_FRAG) clearFrag(childNode);
    // Remove child DOM node
    else parent.removeChild(childNode);
  });

  // Reset currDOM
  reset && (frag.currDOM.length = 0);
}
