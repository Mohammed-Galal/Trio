const EMPTY_STR = "";
const TRASH = new DocumentFragment();

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.frag = document.createDocumentFragment();
  /** nodes can only store [HTMLElement, DOM_Frag] */
  this.nodes = [];
}

export default DOM_FRAG;

const PROTO = DOM_FRAG.prototype;

PROTO.appendTo = function (containerNode) {
  this.containNodes();
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

PROTO.containNodes = function () {
  const nodes = this.nodes,
    frag = this.frag;

  let index = 0;
  while (index < nodes.length) {
    const N = nodes[index++];
    N instanceof DOM_FRAG ? N.appendTo(frag) : frag.appendChild(N);
  }
};
