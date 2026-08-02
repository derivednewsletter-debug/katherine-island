import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GRID_SIZE } from '../data/mapData';
import { exploredVersion, fillExploredData } from '../state/exploration';

/**
 * How high the fog sheet floats above the island. Terrain peaks sit around
 * y≈1.6 and props/critters a bit above that, so a sheet at y=2.2 dims the
 * ground and everything standing on it while staying a low, misty layer.
 */
const FOG_Y = 2.2;
const FOG_OPACITY = 0.66;

/**
 * Fog-of-war: a single full-island plane whose shader samples a 160×160
 * DataTexture of explored/not-explored per tile. Explored tiles render
 * fully transparent; unexplored tiles are dimmed by a soft dark-blue mist.
 *
 * The DataTexture is rebuilt ONLY when the exploration version bumps (the
 * camera moved into new tiles), so idle frames cost nothing. The mesh
 * disables raycasting so it never swallows clicks meant for the ground.
 */
export default function FogOfWar() {
  const lastVersion = useRef(-1);

  // One DataTexture for the whole map (row-major, one byte per tile).
  const texture = useMemo(() => {
    const data = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const tex = new THREE.DataTexture(
      data,
      GRID_SIZE,
      GRID_SIZE,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uExplored: { value: texture },
          uOpacity: { value: FOG_OPACITY },
          uColor: { value: new THREE.Color('#0b1c33') },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uExplored;
          uniform float uOpacity;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            // 255 = explored (clear), 0 = unexplored (dimmed)
            float explored = texture2D(uExplored, vUv).r;
            float alpha = uOpacity * (1.0 - explored);
            if (alpha < 0.003) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    [texture]
  );

  // Dispose GPU resources on unmount (matches Pet.jsx's convention).
  // Declared AFTER both useMemos — referencing `material` before its
  // declaration would hit the temporal dead zone and crash the mount.
  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [texture, material]);

  useFrame(() => {
    const v = exploredVersion();
    if (v === lastVersion.current) return;
    lastVersion.current = v;
    fillExploredData(texture.image.data);
    texture.needsUpdate = true;
  });

  return (
    <mesh
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, FOG_Y, 0]}
      raycast={() => null}
      renderOrder={5}
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
    </mesh>
  );
}
