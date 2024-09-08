const PENDING_UPDATES = new Set();

function batchUpdate() {
  // Apply all pending updates at once
  PENDING_UPDATES.forEach((updateFn) => updateFn());
  PENDING_UPDATES.clear();
}

function requestUpdate(updateFn) {
  PENDING_UPDATES.push(updateFn);

  // Schedule a render on the next frame
  requestAnimationFrame(batchUpdate);
}
