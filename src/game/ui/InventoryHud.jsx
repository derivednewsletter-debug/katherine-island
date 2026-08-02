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
  const holding = useGameStore((s) => s.holding);

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
        const isBerry = resource === 'berry';
        const isHeld = holding === resource;
        const empty = isBerry && inventory.berry < 1;
        const chipStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: isHeld ? 'rgba(255, 93, 126, 0.35)' : 'rgba(0, 0, 0, 0.55)',
          borderRadius: 999,
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 14,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${isHeld ? config.color : config.color + '55'}`,
          boxShadow: isHeld ? '0 0 0 3px rgba(255,93,126,0.35)' : '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
          opacity: empty ? 0.5 : 1,
        };
        const content = (
          <>
            <span style={{ fontSize: 17 }}>{config.emoji}</span>
            {/* key={count} re-triggers the pop animation on change */}
            <span key={inventory[resource]} className="hud-count-pop">
              {inventory[resource]}
            </span>
          </>
        );
        // Only the berry chip is interactive (hold-to-feed); shell/stone stay
        // plain divs so they don't become stray keyboard tab stops.
        return isBerry ? (
          <button
            key={resource}
            onClick={() => useGameStore.getState().toggleHolding('berry')}
            disabled={empty}
            title={isHeld ? 'Click the pet to feed it! 🍓' : 'Hold a berry to feed the pet'}
            style={{
              ...chipStyle,
              pointerEvents: 'auto',
              cursor: empty ? 'not-allowed' : 'pointer',
              transform: isHeld ? 'translateY(1px)' : undefined,
            }}
          >
            {content}
          </button>
        ) : (
          <div key={resource} style={chipStyle}>
            {content}
          </div>
        );
      })}
      {/* Feeding hint when holding a berry — centered under the chips */}
      {holding && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            padding: '4px 10px',
            background: 'rgba(255, 93, 126, 0.25)',
            borderRadius: 999,
            color: '#ffd6de',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}
        >
          🍓 Click the pet to feed it!
        </div>
      )}
    </div>
  );
}
