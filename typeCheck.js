const registered = {},
  options = {
    enumerable: true,
    configurable: false,
    writable: false,
  },
  preDefinedTypes = [
    String,
    Date,
    Function,
    Array,
    Number,
    Boolean,
    Symbol,
    URL,
    Object,
    Set,
    Map,
    // JSON,
  ];

Object.freeze(preDefinedTypes);

preDefinedTypes.forEach(function (CONST) {
  define(CONST.name, CONST);
});

// export default { define, check };

function typeCheck(target, type) {
  const typeConstructor = type.constructor;
  if (!type) return false;
  else if (typeConstructor === Function) return target.constructor === type;

  let result = true;

  switch (typeConstructor) {
    case String: {
      // search by Constructor Name
      const wordBound = /\w+/g;
      let item;
      while ((item = wordBound.exec(type)) !== null) {
        const desiredType = item[0].toUpperCase();
        result = typeCheck(target, registered[desiredType]);
        if (!result) break;
      }
      break;
    }

    case Array: {
      let index = 0;
      while (type[index]) {
        result = typeCheck(target[index], type[index]);
        index++;
        if (!result) break;
      }
      break;
    }

    case Object:
      const keys = Object.keys(type);
      let index = 0;
      while (keys[index]) {
        const key = keys[index++];
        result = typeCheck(target[key], type[key]);
        if (!result) break;
      }
      break;

    default:
      throw "";
  }

  return result;
}

function define(Name, Constructor) {
  /** Args Validaion */
  const areValidatedArgs = typeCheck(arguments, [String, Function]);
  if (!areValidatedArgs) throw new TypeError("invalid arguments");

  /** Args Reposition */
  Name = Name.toUpperCase();

  if (registered[Name])
    throw ReferenceError("Constructor has already been defined");

  options.value = Constructor;
  Object.defineProperty(registered, Name, options);
}
