import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { publishCamera, consumePanRequest } from '../state/cameraBus';
import { worldToGrid } from '../data/mapData';
import { loadExplored, markExploredRect, saveExplored, exploredVersion } from '../state/exploration';

// How often the explored set is flushed to localStorage while panning.
const SAVE_EVERY_MS = 1500;

const PAN_SECONDS = 0.7;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Screen corners in NDC (top-left, top-right, bottom-right, bottom-left)
const NDC_CORNERS = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

/**
 * Lives inside the Canvas (child of the R3F scene). Two jobs:
 *
 *  1. Every frame, project the camera's four screen corners onto the
 *     ground plane (y = 0) and publish their axis-aligned world bounding
 *     box to the camera bus — that's the minimap's viewport rectangle.
 *  2. Consume panTo() flight requests from the minimap and tween the
 *     MapControls target (+ zoom) there with an ease, so clicking a
 *     waypoint glides the camera across the island.
 */
export default function CameraTracker() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const pan = useRef(null);
  const v1 = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const corners = useRef(NDC_CORNERS.map(() => new THREE.Vector3()));
  const lastSave = useRef(0);
  const lastSavedVersion = useRef(0);
  // Cache of the last marked grid rect so idle frames skip the fog scan
  const lastRect = useRef({ r0: -1, c0: -1, r1: -1, c1: -1 });

  // Boot: restore any previously explored tiles before the first frame
  // paints the fog, so a reload doesn't wipe the player's discovery.
  useEffect(() => {
    loadExplored();
  }, []);

  useFrame((state, delta) => {
    // ── 1. Consume a pending pan request → start a tween ──
    const req = consumePanRequest();
    if (req && controls) {
      const offset = v1.current.copy(camera.position).sub(controls.target);
      pan.current = {
        sx: controls.target.x,
        sz: controls.target.z,
        ex: req.x,
        ez: req.z,
        startZoom: camera.zoom,
        endZoom: req.zoom ?? camera.zoom,
        offset: offset.clone(),
        t: 0,
      };
    }

    // ── 2. Advance the tween (target + position move together, zoom eases) ──
    if (pan.current) {
      pan.current.t = Math.min(1, pan.current.t + delta / PAN_SECONDS);
      const k = easeInOutCubic(pan.current.t);
      const p = pan.current;
      const tx = THREE.MathUtils.lerp(p.sx, p.ex, k);
      const tz = THREE.MathUtils.lerp(p.sz, p.ez, k);
      controls.target.set(tx, 0, tz);
      camera.position.copy(controls.target).add(p.offset);
      camera.zoom = THREE.MathUtils.lerp(p.startZoom, p.endZoom, k);
      camera.updateProjectionMatrix();
      controls.update();
      if (pan.current.t >= 1) pan.current = null;
    }

    // ── 3. Publish the viewport's ground footprint ──
    // For an orthographic camera all view rays are parallel, so each screen
    // corner's ground hit = corner + forward * t (t from the y=0 plane).
    camera.getWorldDirection(forward.current);
    const fy = forward.current.y;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < 4; i++) {
      const c = corners.current[i];
      c.set(NDC_CORNERS[i][0], NDC_CORNERS[i][1], 0.5).unproject(camera);
      const t = fy === 0 ? 0 : -c.y / fy;
      const gx = c.x + forward.current.x * t;
      const gz = c.z + forward.current.z * t;
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gz < minZ) minZ = gz;
      if (gz > maxZ) maxZ = gz;
    }
    publishCamera({
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      w: maxX - minX,
      h: maxZ - minZ,
    });

    // ── 4. Fog of war: the visible footprint is now explored ──
    // Convert the ground bbox corners to grid cells and mark the whole
    // rect. Camera motion (pan/zoom/flights) reveals the map naturally;
    // idle frames (identical rect) skip the scan so `version` doesn't bump.
    const a = worldToGrid(minX, minZ);
    const b = worldToGrid(maxX, maxZ);
    const rect = lastRect.current;
    if (a.row !== rect.r0 || a.col !== rect.c0 || b.row !== rect.r1 || b.col !== rect.c1) {
      rect.r0 = a.row;
      rect.c0 = a.col;
      rect.r1 = b.row;
      rect.c1 = b.col;
      markExploredRect(a.row, a.col, b.row, b.col);
    }
    // Throttled persistence — only while actively exploring (new tiles
    // found since the last save), and only a couple times a second at most.
    const now = state.clock.elapsedTime * 1000;
    if (now - lastSave.current > SAVE_EVERY_MS && exploredVersion() !== lastSavedVersion.current) {
      lastSave.current = now;
      lastSavedVersion.current = exploredVersion();
      saveExplored();
    }
  });

  return null;
}
