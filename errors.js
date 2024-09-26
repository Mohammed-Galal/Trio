const ERR = new Error();
const RULES = {};

RULES.useForce = { name: "useForce Hook Rules", message: "" };

export default function (errName) {
  return Object.assign(ERR, RULES[errName]);
}
