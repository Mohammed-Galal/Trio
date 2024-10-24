const IS_ARRAY = Array.isArray;
const TRASH = new DocumentFragment();

function DOM_FRAG() {
  this.placeholder = document.createTextNode(EMPTY_STR);
  this.frag = document.createDocumentFragment();
  this.consumed = false;
  this.cache = new Map();
  this.nodes = [];
}

export default DOM_FRAG;

const PROTO = DOM_FRAG.prototype;

PROTO.insertNode = function (HTMLNode) {
  const SELF = this;
  if (IS_ARRAY(HTMLNode))
    for (let i = 0; i < HTMLNode.length; ) SELF.insertNode(HTMLNode[i++]);
  else if (HTMLNode instanceof DOM_FRAG) HTMLNode.appendTo(SELF.frag);
  else SELF.frag.appendChild(HTMLNode);
};

PROTO.appendTo = function (containerNode) {
  containerNode.appendChild(this.frag);
  containerNode.appendChild(this.placeholder);
};

PROTO.clear = function () {
  /** Capturing checkpoint before clear proccess.
   * Object.assign([], domFrag.nodes)
   * domFrag.clear()
   */
  const nodes = this.nodes;
  for (let i = 0; i < nodes.length; ) TRASH.appendChild(nodes[i++]);
  this.consumed = false;
};

PROTO.show = function () {
  const parent = this.placeholder.parentElement,
    currDOM = this.nodes,
    childNodes = this.frag.childNodes;

  Object.assign(currDOM, childNodes);
  currDOM.length = childNodes.length;

  parent.insertBefore(this.frag, this.placeholder);
  this.consumed = true;
};
