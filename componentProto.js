const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const EMPTY_DOM_CONTAINER = [];
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;
const CACHED = new Map();

function Component(jsxRoot) {
  if (this.constructor !== Component) return new Component(jsxRoot);
  this.observers = { scripts: [], components: new Set() };
  this.scripts = null;
  this.update(jsxRoot.scripts);
  this.DOM = this.render(jsxRoot.dom);
}

const PROTO = Component.prototype;

PROTO.render = function (dom) {
  if (dom === undefined) throw new Error();

  // return => HTMLElement || String || scriptExp: DOM_FRAG || Frag: Array
  const SELF = this,
    DOMType = dom.constructor;

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
      SELF.observers.scripts[dom] = function (newVal) {
        frag.append(newVal);
      };
      return frag;

    // HTMLElement
    case Array:
      const [tag, attrs, children] = dom;

      if (Number.isInteger(tag)) return this.createComponent(dom);
      // else if (tag === "Frag") {
      //   const DOMChildren = [];

      //   if (children) {
      //     const iterator = new Iterator(children);
      //     while (iterator.next())
      //       DOMChildren.push(SELF.render(iterator.value()));
      //   }

      //   return DOMChildren;
      // }

      const el = document.createElement(tag);

      if (children) {
        const iterator = new Iterator(children);
        while (iterator.next()) {
          const node = SELF.render(iterator.value());
          if (node.constructor === DOM_FRAG) {
            el.appendChild(node.placeholder);
            node.show();
          } else el.appendChild(new Text(node));
        }
      }

      if (attrs) {
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

PROTO.update = function ($scripts) {
  if ($scripts === null) return;

  const SELF = this,
    scripts = $scripts(),
    scriptsObserver = SELF.observers.scripts;

  SELF.scripts = scripts;

  let index = 0;
  while (scriptsObserver.length > index)
    scriptsObserver[index](scripts[index++]);
};

function DOM_FRAG() {
  this.placeholder = new Text();
  this.display = false;
  this.currDOM;
}

const FRAG_PROTO = DOM_FRAG.prototype;

// append => replaces current active Node
// whenever this function gets invoked, it removes the current Active DOM, and replaces it with the Content
FRAG_PROTO.append = function (HTMLNode) {
  const SELF = this;

  switch (HTMLNode.constructor) {
    // jsxRoots Array
    case IS_ARRAY(HTMLNode):
      const iterator = new Iterator(HTMLNode);
      // iterator.call => invokes the provided function with the current iterator item as parameter
      while (iterator.next()) iterator.call(resolveComponent);
      this.currDOM = iterator.ref;
      SELF.show();
      break;

    // jsxRoot
    case Object:
      this.currDOM = resolveComponent(HTMLNode);
      break;

    default:
      SELF.hide();
      const validContent = Number.isInteger(HTMLNode)
        ? HTMLNode
        : HTMLNode || EMPTY_STR;
      SELF.placeholder.textContent = EMPTY_STR + validContent;
      break;
  }
};

FRAG_PROTO.show = function () {};
FRAG_PROTO.hide = function () {};

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

function resolveComponent(_component) {
  const key = _component.key;
  if (key !== null)
    return CACHED.has(key)
      ? CACHED.get(key).update(_component.scripts)
      : CACHED.set(key, new Component(_component)).get(key);
  else return new Component(_component);
}

function Iterator(arr) {
  this.ref = arr;
  this.index = -1;
}

Iterator.prototype.next = function () {
  if (this.ref.length - this.index === 1) return false;
  this.index++;
  return true;
};

Iterator.prototype.value = function () {
  return this.ref[this.index];
};

Iterator.prototype.call = function (fn) {
  fn(this.value());
};
