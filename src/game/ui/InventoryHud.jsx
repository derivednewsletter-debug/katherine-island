import React from 'react';
import { useGameStore } from '../state/gameStore';
import { RESOURCES } from '../data/resources';

const ORDER = ['berry', 'shell', 'stone'];

/**
 * Inventory HUD — reads the shared store and shows a glass chip per
 * resource. Each count pops when it changes.
 */
export default function InventoryHud() {
  // Subscribe to just the inventory slice of the global store
  const inventory = useGameStore((s) => s.inventory);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {ORDER.map((resource) => {
        const config = RESOURCES[resource];
        return (
          <div
            key={resource}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: 'rgba(0, 0, 0, 0.55)',
              borderRadius: 999,
              color: '#fff',
              fontFamily: '"Segoe UI", system-ui, sans-serif',
              fontSize: 14,
              backdropFilter: 'blur(8px)',
              border: `1px solid ${config.color}55`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: 17 }}>{config.emoji}</span>
            {/* key={count} re-triggers the pop animation on change */}
            <span key={inventory[resource]} className="hud-count-pop">
              {inventory[resource]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
