function Component(jsxRoot) {
  this.placeholder = new Text();
  this.observers = { scripts: [], components: new Set() };
  this.render(jsxRoot.dom);
}

const Proto = Component.prototype;
const PRIVATE_KEY = "#Xtends";
const EVENT_EXP = /^on[A-Z]/;

Proto.render = function (dom) {
  const SELF = this,
    DOMType = dom && dom.constructor;

  switch (DOMType) {
    case String:
      return new Text(dom);

    case Number:
      // script => TEXT | JSXRoot | JSXArray | Nullish
      const frag = new DOMFrag();
      return frag;

    case Array:
      const [tag, attrs, children] = dom;

      if (Number.isInteger(tag)) return this.createComponent(dom);

      const el = document.createElement(tag);

      if (attrs) {
        // attrs[PRIVATE_KEY].forEach()

        const keys = Object.keys(attrs).filter((d) => d !== PRIVATE_KEY),
          iterator = new Iterator(keys);

        while (iterator.next()) {
          const key = iterator.value(),
            value = attrs[key];

          if (EVENT_EXP.test(key)) {
            const evType = key.slice(2).toLowerCase();
            el.addEventListener(evType, SELF.scripts[value]);
          } else if (key === "style")
            Object.assign(el.style, SELF.scripts[value]);
          else el[key] = value;
        }
      }

      if (children) {
        const iterator = new Iterator(children);
        while (iterator.next()) {
          const node = SELF.render(iterator.value());
          if (node.constructor === DOMFrag) {
            el.appendChild(node.placeholder);
            SELF.observers.scripts.push(node.show);
          } else el.appendChild(node);
        }
      }

      return el;
  }
};

Proto.update = function () {};
