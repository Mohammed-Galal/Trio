const IS_ARRAY = Array.isArray;
const EMPTY_STR = "";
const TRASH = new DocumentFragment();

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.frag = document.createDocumentFragment();
  this.nodes = [];
  this.cache = new Map();
}

export default DOM_FRAG;

const PROTO = DOM_FRAG.prototype;

PROTO.appendTo = function (containerNode) {
  // if (IS_ARRAY(HTMLNode))
  //   for (let i = 0; i < HTMLNode.length; ) SELF.insertNode(HTMLNode[i++]);
  // else if (HTMLNode instanceof DOM_FRAG) HTMLNode.appendTo(SELF.frag);
  // else SELF.frag.appendChild(HTMLNode);

  containerNode.appendChild(this.frag);
  containerNode.appendChild(this.placeholder);
};

PROTO.insertNode = function (HTMLNode) {
  const Nodes = this.nodes;
  Nodes[Nodes.length] = HTMLNode;
};

PROTO.clear = function () {
  const Nodes = this.nodes;
  for (let i = 0; i < Nodes.length; ) TRASH.appendChild(Nodes[i++]);
  Nodes.length = 0;
};
