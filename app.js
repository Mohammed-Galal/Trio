const fallbackFn = function () {};

function App() {
  this.PENDING_UPDATES = new Set(); // updates Queue
  this.isUpdating = false;
}

App.prototype.requestUpdate = function (ctx) {
  this.PENDING_UPDATES.add(ctx);
};

App.prototype.update = function (ctx) {
  this.PENDING_UPDATES.delete(ctx);
  if (ctx.scripts) {
    ctx.scripts = ctx.initScripts();
    ctx.observers.forEach((observer) => observer());
    this.isUpdating || this.batchUpdates();
    (this.updateCallback || fallbackFn)();
  }
  return ctx;
};

App.prototype.batchUpdates = function () {
  this.isUpdating = true;
  this.PENDING_UPDATES.forEach(this.requestUpdate, this);
  this.PENDING_UPDATES.clear();
  this.isUpdating = false;
};

export default App;
