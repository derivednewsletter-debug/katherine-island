/**
 * Camera bus — a tiny module-level bridge between the R3F scene and the
 * DOM minimap (no React, no zustand; the persisted game store must never
 * learn about the camera).
 *
 * The CameraTracker inside the Canvas publishes the ground footprint of
 * the viewport every frame; the Minimap component polls it on its own rAF
 * loop. panTo() queues a flight request that the tracker consumes on its
 * next frame and tweens to — so clicking the minimap flies the camera
 * there with a smooth ease.
 */

/** The viewport's ground footprint in world units: center (x, z) + size. */
const state = { x: 0, z: 0, w: 1, h: 1 };

let pendingPan = null;

export function getCameraState() {
  return state;
}

export function publishCamera(next) {
  Object.assign(state, next);
}

/** Ask the camera to fly to a world position (optional target zoom). */
export function panTo(x, z, zoom) {
  pendingPan = { x, z, zoom: zoom ?? null };
}

/** The CameraTracker calls this once per frame; returns the pending request
 *  or null. Consuming clears it so a stale request can't re-fire. */
export function consumePanRequest() {
  const p = pendingPan;
  pendingPan = null;
  return p;
}
