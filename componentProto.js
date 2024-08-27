const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const EMPTY_DOM_CONTAINER = [];
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;

function Component(jsxRoot) {
  this.scripts = jsxRoot.scripts();
  this.observers = { scripts: [], components: new Set() };
  this.DOM = this.render(jsxRoot.dom);
}

const PROTO = Component.prototype;

PROTO.render = function (dom) {
  const SELF = this,
    DOMType = dom && dom.constructor;

  switch (DOMType) {
    // Static Content
    case String:
      return dom;

    // Dynamic Content
    case Number:
      const frag = new DOM_FRAG(),
        scripts = SELF.scripts,
        value = scripts[dom];
      frag.append(value);
      scripts.push(function (newVal) {
        frag.append(newVal);
      });
      return frag;

    // HTMLElement
    case Array:
      const [tag, attrs, children] = dom;

      if (Number.isInteger(tag)) return this.createComponent(dom);

      const el = document.createElement(tag);

      if (children) {
        const iterator = new Iterator(children);
        while (iterator.next()) {
          const node = SELF.render(iterator.value());
          if (node.constructor === DOM_FRAG) {
            el.appendChild(node.placeholder);
            node.setAppearance(true);
          } else el.appendChild(new Text(node));
        }
      }

      if (tag === "Frag") return children || EMPTY_DOM_CONTAINER;
      else if (attrs) {
        attrs[PRIVATE_KEY].forEach((OBJ) => Object.assign(el, OBJ));

        const keys = Object.keys(attrs).filter((d) => d !== PRIVATE_KEY),
          iterator = new Iterator(keys);

        while (iterator.next()) {
          const attrName = iterator.value(),
            attrValue = attrs[attrName];
          if (EVENT_EXP.test(attrName)) {
            const evType = attrName.slice(2).toLowerCase();
            el.addEventListener(evType, SELF.scripts[attrValue]);
          } else if (attrName === "ref") SELF.scripts[attrValue](el);
          else if (attrName === "style") {
            Object.assign(el.style, SELF.scripts[attrValue]);
            SELF.observers.scripts.push(function (newVal) {
              Object.assign(el.style, newVal);
            });
          } else {
            el[attrName] = attrValue;
            SELF.observers.scripts.push(function (newVal) {
              el[attrName] = newVal;
            });
          }
        }
      }

      return el;
  }
};

PROTO.update = function () {};

function DOM_FRAG() {
  this.placeholder = EMPTY_STR;
  this.display = false;
  this.cachedDOM = new Map();
  this.currId = null;
}

const FRAG_PROTO = DOM_FRAG.prototype;

// append => replaces current active Node
FRAG_PROTO.append = function (HTMLNode) {
  const SELF = this;

  switch (HTMLNode.constructor) {
    // jsxRoots Array
    case IS_ARRAY(HTMLNode):
      // SELF.currId = HTMLNode.key;
      break;

    // jsxRoot
    case Object:
      SELF.currId = HTMLNode.key;
      break;

    default:
      SELF.setAppearance(false);
      const validContent = Number.isInteger(HTMLNode)
        ? HTMLNode
        : HTMLNode || EMPTY_STR;
      SELF.placeholder.textContent = new String(validContent);
      break;
  }
};

FRAG_PROTO.setAppearance = function (bool) {
  const SELF = this,
    placeholder = SELF.placeholder,
    parentElement = placeholder.parentElement,
    targetContainer = SELF.cachedDOM[SELF.currId];

  placeholder.textContent = EMPTY_STR;

  if (bool) {
    if (IS_ARRAY(targetContainer))
      targetContainer.forEach((C) =>
        parentElement.insertBefore(new Component(C), placeholder)
      );
    else parentElement.insertBefore(targetContainer, placeholder);
  } else {
    if (IS_ARRAY(targetContainer))
      targetContainer.forEach((C) => parentElement.removeChild(C));
    else parentElement.removeChild(targetContainer);
  }
};
