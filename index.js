/** Component Update Cases
 * 1- it updates by its parent ONLY after updating prop(s);
 * 2- self update, by a function gets passed to the functional Comonent
 * 3- when context-state updates, it runs all subscriped component
 */

const emptyStr = "",
  Func = new Function(),
  rootError = "invalid root scheme",
  rootScheme = {
    components: Array,
    scripts: Function,
    dom: Array,
  };

/** const severData = {
  somekey: {
    state: { ...data },
    componentsObservers: new Set(), // subscriper
    ...reducers
  },
};
*/

function Component(C, Props, Children) {
  const Self = this;
  Object.freeze(C);

  /** => Validation */
  if (!typeCheck(Self, Component)) throw new TypeError(emptyStr);
  else if (typeCheck(C, Function)) C = C(Self.wrapper, Children);
  else if (!typeCheck(C, rootScheme)) throw new TypeError(rootError);

  // key: [Int | Str]
  const key = C.dom[1].key;
  /** ==> check if root element has a key => return Component */
  if (key) {
    // this is for cached dumb-jsx-root
    const scripts = C.scripts.call(null),
      keyVal = typeCheck(key, Number) ? scripts[key] : key,
      cachedVer = __Cache.lookFor(keyVal, Self);
    // cachedVer === false if it's not found in cached, then it caches Self
    // cachedVer === true if it's found in cached, and return cached-Component
    if (cachedVer !== false) return cachedVer;
  }

  /** => Define deps. */
  const CObsever = (Self.componentsObserver = new Set()),
    getProp = function (key) {
      return Props[key];
    };

  let observer,
    Element,
    index = 0;

  Self.observe = function (index, setter) {
    setter(observer[index]);
    observer[index] = setter;
  };

  Self.render = function () {
    observer ||= C.scripts.call(getProp);
    Element ||= Self.createElement(C.dom);
    return Element;
  };

  Self.init = function init() {
    /** run scripts observer */
    const currScripts = C.scripts.call(getProp);
    index = 0;
    while (index < observer.length) observer[index](currScripts[index++]);

    /** run components observer */
    CObsever.forEach((fn) => fn(C.components));
    CObsever.clear();
  };

  Object.freeze(Self);
}

const Proto = Component.prototype;

Proto.navigate = function (dom) {
  const Self = this,
    Constructor = dom.constructor;

  switch (Constructor) {
    case Number:
      const frag = new Fragment();
      Self.observe(dom, function (V) {
        frag.update(V);
      });
      return frag; // Fragment

    case Fragment:
      return dom;

    case String:
      return new Text(dom);

    case Array:
      const tag = dom[0],
        targetMethod = typeCheck(tag, Number)
          ? "createComponent"
          : "createElement";
      return Self[targetMethod](dom);

    default:
      throw new ReferenceError(emptyStr);
  }
};

Proto.createComponent = function ([CIndex, Props, Children]) {
  const Self = this,
    Frag = new Fragment();

  Self.componentsObserver.add(init);

  let didUpdateInitialized = false,
    index = 0;

  /** eval Props */
  if (Props) {
    const keys = Object.keys(Props);
    while (index < keys.length) {
      const prop = keys[index];
      if (typeCheck(Props[prop], Number)) {
        Self.observe(index, function (newVal) {
          if (newVal === Props[prop]) return;
          Props[prop] = newVal;
          didUpdateInitialized &&
            // push child component update to parent observer
            Self.componentsObserver(Frag.updateCurrentComponent);
        });
      }
      index++;
    }
  }

  index = 0;
  /** render Children */
  if (Children) {
    const childrenFrag = new Fragment();
    while (index < Children.length) {
      const item = Children[index++];
      childrenFrag.append(Self.navigate(item));
    }
    Children = childrenFrag;
  }

  return Frag;

  function init(components) {
    const C = components[CIndex],
      result = new Component(C, Props, Children);
    Frag.append(result.render());
    // result.init is subject to patchEnabled
    Frag.spreadBehind();
    result.init();
    Frag.updateCurrentComponent = result.init;
    didUpdateInitialized = true;
  }
};

Proto.createElement = function ([tag, attrs, children]) {
  const self = this,
    el = document.createElement(tag),
    useConnectionHandler =
      attrs.useConnection &&
      function (fn) {
        const connectionState = el.parentElement !== null;
        if (currDisplayState === connectionState) return;
        currDisplayState = connectionState;
        fn.call(el, connectionState, el);
      };

  let currDisplayState = false,
    index = 0;

  /** attrs */
  if (attrs) {
    const keys = Object.keys(attrs);
    while (index < keys.length) {
      const item = keys[index++],
        val = attrs[item];
      if (typeCheck(val, Number)) {
        let observeHandler;
        if (/^on[A-Z]/.test(item)) {
          const evType = item.toLowerCase().slice(0, 2);
          el.addEventListener(evType, function (E) {
            /** check if it's not yet initialized */
            attrs[item].call(el, E);
          });

          observeHandler = function (evHandler) {
            attrs[item] = evHandler;
          };
        } else
          observeHandler = function (newVal) {
            el[item] = newVal;
          };

        /** check if custom Attr => [useConnection] */
        // gets called on connecting or disconnecting from DOM
        self.observe(val, useConnectionHandler || observeHandler);
      } else if (item !== "useConnection") el[item] = val;
    }
  }

  index = 0;
  /** children */
  if (children) {
    while (index < children.length) {
      const item = children[index++],
        childNode = self.navigate(item);
      // if Requiring Children
      if (typeCheck(childNode, Fragment)) {
        el.appendChild(childNode.placeholder);
        childNode.spreadBehind();
      } else el.appendChild(childNode);
    }
  }

  return el;
};

Object.freeze(Proto);

function Fragment() {
  const placeholder = new Text();
  this.placeholder = placeholder;
  this.childNodes = [];

  Object.defineProperty(this, "parent", {
    get() {
      return placeholder.parentElement;
    },
  });
}

Fragment.prototype.append = function (childNode) {
  this.childNodes.push(childNode);
};

Fragment.prototype.clear = function () {
  const placeholder = this.placeholder,
    parentElement = this.parent,
    childNodes = this.childNodes;

  let index = 0;
  while (index < childNodes.length) {
    const childNode = childNodes[index++];
    if (typeCheck(childNode, Fragment)) {
      childNode.clear();
      parentElement.removeChild(childNode.placeholder);
    } else parentElement.removeChild(childNode);
  }

  placeholder.textContent = emptyStr;
  childNodes.length = 0;
};

Fragment.prototype.update = function (newVal, isJSXRoot) {
  const self = this,
    childNodes = self.childNodes;

  self.clear();
  if (newVal === false) return;

  switch (isJSXRoot ? Object : newVal.constructor) {
    case Array:
      let index = 0;
      while (index < newVal.length) self.update(newVal[index++], true);
      break;

    case Object:
      // what if child node is Fragment ???
      if (typeCheck(newVal, Function))
        throw newVal.toString() + "invalid jsx root";
      const C = new Component(newVal);
      childNodes.push(C.render());
      C.init();
      break;

    default:
      self.placeholder.textContent = emptyStr + newVal;
  }

  self.spreadBehind();
};

Fragment.prototype.spreadBehind = function () {
  const placeholder = this.placeholder,
    parentElement = this.parent,
    childNodes = this.childNodes;

  let index = 0;
  while (index < childNodes.length) {
    const childNode = childNodes[index++];
    if (typeCheck(childNode, Fragment)) {
      parentElement.insertBefore(childNode.placeholder);
      childNode.spreadBehind();
    } else parentElement.insertBefore(childNode, placeholder);
  }
};
