const ERR = new Error();
const APP = {}; // Main app object that holds utility functions
const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const PRIVATE_KEY = "#Xtends"; // Used to mark custom private attributes
const EVENT_EXP = /^on[A-Z]/; // Regular expression to detect event attributes
const CUSTOM_ATTRS = {}; // Object to store custom attribute handlers
const CACHED = new Map(); // Cache for storing rendered components

let currentCTX = null; // Global reference to the current component's context

// Error handling object for forceUpdate function
const paramErr = { name: "useForce Hook Rules", message: "" };

// Force update for triggering re-renders
APP.forceUpdate = function (fn) {
  if (typeof fn !== "function") throw Object.assign(ERR, paramErr); // Ensure fn is a function

  const ctx = currentCTX; // Capture current component's context

  // Return a function that will force re-rendering the component
  return () => {
    fn();
    requestUpdate(ctx); // Trigger the component's update cycle
  };
};

export default APP;

// Custom attribute handling logic for "ref" and "style"
CUSTOM_ATTRS["ref"] = function (el, ctx, attrValue) {
  ctx.scripts[attrValue]?.call(el, el); // Execute the script associated with the ref attribute
};

CUSTOM_ATTRS["style"] = function (el, ctx, attrValue) {
  const styleObject = ctx.scripts[attrValue]; // Get style object from scripts
  if (styleObject) {
    Object.assign(el.style, styleObject); // Apply styles
    // Add to observers to reapply styles when they change
    ctx.observers.push(() => Object.assign(el.style, styleObject));
  }
};

// Constants for handling switch-case components
const switchEXP = "Switch",
  caseEXP = "Case",
  linkEXP = "Link",
  anchorEXP = "a";

// Helper function to exclude the PRIVATE_KEY when processing attributes
const excludePrivateKey = (key) => key !== PRIVATE_KEY;
// Helper function to filter case expressions for switch-case logic
const caseFiltration = (CN) => IS_ARRAY(CN) && CN[0] === caseEXP;

// Main Component constructor for building components
function Component(jsxRoot, props = {}) {
  if (!(this instanceof Component)) return new Component(jsxRoot, props); // Ensure proper instantiation

  currentCTX = this; // Set current component's context
  jsxRoot = typeof jsxRoot === "function" ? jsxRoot(props) : jsxRoot; // Execute if the jsxRoot is a function
  currentCTX = null; // Reset the context

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
    case String:
      return document.createTextNode(node); // Create text node for strings

    case Number:
      return this.createTextNode(node); // Handle numbers as text content with observers

    default:
      return this.createElementNode(node); // Handle JSX-like elements
  }
};

// Method to handle creation of text nodes (used for numbers)
PROTO.createTextNode = function (node) {
  const frag = new DOM_FRAG(); // Create a new DOM fragment
  frag.resolveContent(this.scripts[node]); // Resolve the content from scripts
  // Add observer to update fragment when content changes
  this.observers.push(() => {
    clearFrag(frag); // Clear previous fragment
    frag.resolveContent(this.scripts[node]); // Re-resolve the content
    expandFrag(frag); // Expand fragment in the DOM
  });
  return frag;
};

// Method to handle creation of DOM elements (e.g., <div>, <span>)
PROTO.createElementNode = function ([tag, attrs = {}, children = []]) {
  const el = document.createElement(tag); // Create the actual DOM element

  // Recursively render and append child nodes
  if (children.length) {
    const childrenNodes = children.map((child) => render(this, child));
    childrenNodes.forEach((childNode) =>
      el.appendChild(
        childNode instanceof DOM_FRAG ? childNode.placeholder : childNode
      )
    );
    childrenNodes.forEach(expandFrag); // Expand fragments if present
  }

  this.applyAttributes(el, attrs); // Apply attributes to the element

  return el;
};

// Method to apply attributes (including custom attributes and event listeners) to an element
PROTO.applyAttributes = function (el, attrs) {
  const { scripts } = this;
  if (attrs[PRIVATE_KEY]) {
    attrs[PRIVATE_KEY].forEach((obj) => Object.assign(attrs, obj)); // Apply private attributes if present
  }

  // Loop over all attributes and apply them
  Object.keys(attrs)
    .filter(excludePrivateKey) // Exclude private keys
    .forEach((attrName) => {
      const attrValue = attrs[attrName];
      if (EVENT_EXP.test(attrName)) {
        // Handle event attributes (e.g., onClick)
        el.addEventListener(attrName.slice(2).toLowerCase(), (e) => {
          const result = scripts[attrValue]?.apply(el, [e]);
          if (result === true) requestUpdate(this); // Trigger update if the event handler returns true
        });
      } else if (CUSTOM_ATTRS[attrName]) {
        // Handle custom attributes like ref and style
        CUSTOM_ATTRS[attrName](el, this, attrValue);
      } else {
        el[attrName] = attrValue; // Apply regular attributes
      }
    });
};

// Method for conditional rendering in switch-case components
PROTO.checkCase = function (childNode) {
  const conditionRef = childNode[1]?.test || true; // Check condition reference for switch-case
  let container = [];

  // Return a function that will be called to render the case conditionally
  return () => {
    const testRes =
      Boolean(conditionRef) ||
      (Number.isInteger(conditionRef) && this.scripts[conditionRef]);

    // Render children if condition passes and container hasn't been rendered before
    if (!container.length) {
      const childNodes = childNode[2] || [];
      container = childNodes.map((node) => render(this, node));
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
}

// Main rendering function for creating components and elements
function render(ctx, vNode) {
  const [tag, attrs, children] = vNode || [];

  // Handle dynamic components (identified by integers)
  if (Number.isInteger(tag)) {
    return new Component(ctx.components[tag], attrs).DOM;
  }

  // Handle switch-case components
  if (tag === switchEXP) {
    return renderSwitchCase(ctx, children);
  }

  // Handle link elements (convert custom "Link" to <a> tag)
  if (tag === linkEXP) {
    vNode[0] = anchorEXP;
  }

  return ctx.createNode(vNode); // Create DOM node based on the vNode
}

// Function to handle switch-case components
function renderSwitchCase(ctx, children) {
  const frag = new DOM_FRAG(); // Create a fragment to hold the case results
  const cases = children.filter(caseFiltration).map(ctx.checkCase, ctx); // Filter and map cases

  let index = 0;
  // Add observer to update fragment when the case condition changes
  ctx.observers.push(() => {
    clearFrag(frag); // Clear previous content
    while (cases.length > index) {
      const result = cases[index++](); // Check case condition
      if (result) {
        frag.append(result); // Append matching case
        break;
      }
    }
    expandFrag(frag); // Expand the fragment into the DOM
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
  if (IS_ARRAY(HTMLNode)) {
    HTMLNode.forEach((node) => this.append(node)); // Handle arrays of nodes
  } else {
    this.currDOM.push(HTMLNode); // Add single node to currDOM
  }
};

// Method to resolve and update the content inside the fragment
DOM_FRAG.prototype.resolveContent = function (content) {
  clearFrag(this); // Clear previous content

  if (IS_ARRAY(content)) {
    content.forEach((comp) => resolveComponent(this, comp)); // Resolve each component in array
  } else if (typeof content === "object") {
    resolveComponent(this, content); // Resolve single component object
  } else {
    this.placeholder.textContent = EMPTY_STR + content; // Update placeholder with simple text
  }
};

// Resolve a component and append its DOM to the fragment
function resolveComponent(frag, component) {
  const key = component.key ?? component.index; // Determine cache key
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

  frag.currDOM.forEach((childNode) => {
    if (childNode instanceof DOM_FRAG) {
      parent.insertBefore(childNode.placeholder, frag.placeholder); // Insert child fragment's placeholder
      expandFrag(childNode); // Recursively expand child fragments
    } else {
      parent.insertBefore(childNode, frag.placeholder); // Insert child DOM node
    }
  });
}

// Clear the contents of a fragment from the DOM
function clearFrag(frag) {
  const parent = frag.placeholder.parentElement;
  frag.currDOM.forEach((childNode) => {
    if (childNode instanceof DOM_FRAG) {
      clearFrag(childNode); // Recursively clear child fragments
    } else {
      parent.removeChild(childNode); // Remove child DOM node
    }
  });
  frag.currDOM.length = 0; // Reset currDOM
}
