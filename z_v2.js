const ERR = new Error();
const APP = {}; // Main app object that holds utility functions
const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const PRIVATE_KEY = "#Xtends"; // Used to mark custom private attributes
const EVENT_EXP = /^on[A-Z]/; // Regular expression to detect event attributes
const CUSTOM_ATTRS = {}; // Object to store custom attribute handlers
const CACHED = new Map(); // Cache for storing rendered components

// Error handling object for forceUpdate function
const paramErr = { name: "useForce Hook Rules", message: "" };

// Global reference to the current component's context
let currentCTX = null;

// Force update for triggering re-renders
APP.forceUpdate = function (fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, paramErr); // Ensure fn is a function

  // Capture current component's context
  const ctx = currentCTX;

  // Return a function that will force re-rendering the component
  return function () {
    fn();
    // Trigger the component's update cycle
    requestUpdate(ctx);
  };
};

// export default APP;

// Custom attribute handling logic for "ref" and "style"
CUSTOM_ATTRS["ref"] = function (el, ctx, attrValue) {
  // Execute the script associated with the ref attribute
  ctx.scripts[attrValue] && ctx.scripts[attrValue].call(el, el);
};

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

// Helper function to filter case expressions for switch-case logic
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === caseEXP;

// Main Component constructor for building components
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

// Method to create a DOM node based on the type of node passed (String, Number, or JSX)
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

// Method to handle creation of text nodes (used for numbers)
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

// Method to handle creation of DOM elements (e.g., <div>, <span>)
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

// Method to apply attributes (including custom attributes and event listeners) to an element
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

// Method for conditional rendering in switch-case components
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

// Update function to trigger re-rendering and call observers
function requestUpdate(ctx) {
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts(); // Reinitialize scripts
    ctx.observers.forEach((observer) => observer()); // Notify all observers
    ctx.pendingUpdates.forEach(requestUpdate); // Process pending updates
    ctx.pendingUpdates.clear(); // Clear pending updates
  }
  return ctx;
}

// Main rendering function for creating components and elements
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

// DOM Fragment constructor to manage dynamic content
function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR); // Placeholder text node for fragment
  this.cache = { instance: new Map(), ref: new Map() }; // Cache for instances and refs
  this.currDOM = []; // Current DOM elements inside the fragment
}

// Method to append nodes to the fragment
DOM_FRAG.prototype.append = function (HTMLNode) {
  const SELF = this;
  // Handle arrays of nodes
  if (IS_ARRAY(HTMLNode)) HTMLNode.forEach((node) => SELF.append(node));
  // Add single node to currDOM
  else SELF.currDOM.push(HTMLNode);
};

// Method to resolve and update the content inside the fragment
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

// Resolve a component and append its DOM to the fragment
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

// Expand fragment by inserting its nodes into the DOM
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

// Clear the contents of a fragment from the DOM
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
