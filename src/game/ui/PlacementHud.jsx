import React, { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { DECORATION_TYPES, BASE_KINDS } from '../data/decorations';

// Base tools, plus shop-bought decorations appended as they're unlocked.
// (Erase always stays last.)
const toTools = (unlocked) => [...BASE_KINDS, ...unlocked.filter((k) => k !== 'erase'), 'erase'];

/**
 * Build palette — bottom-center glass bar. Clicking a tool enters build mode
 * with that decoration; clicking the active tool (or pressing Esc) exits.
 * While active, the 3D ghost preview under the cursor shows green (valid)
 * or red (blocked) and a click plants the decoration.
 */
export default function PlacementHud() {
  const placement = useGameStore((s) => s.placement);
  const unlocked = useGameStore((s) => s.unlockedDecorations);
  const TOOLS = toTools(unlocked);

  // Esc cancels build mode
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && placement.active) {
        useGameStore.getState().stopPlacement();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placement.active]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 14,
        color: '#fff',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'border-color 0.2s',
        border: placement.active ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.8, marginRight: 2, whiteSpace: 'nowrap' }}>
        🛠️ Decorate
      </span>

      {TOOLS.map((tool) => {
        const config = DECORATION_TYPES[tool];
        const isActive = placement.active && placement.tool === tool;
        return (
          <button
            key={tool}
            className={isActive ? 'palette-btn active' : 'palette-btn'}
            onClick={() => useGameStore.getState().togglePlacement(tool)}
            title={`Place a ${config.label} (click a tile to plant, Esc to exit)`}
          >
            <span style={{ fontSize: 18 }}>{config.emoji}</span>
            <span className="palette-btn-label">{config.label}</span>
          </button>
        );
      })}

      {placement.active && (
        <span style={{ fontSize: 12, opacity: 0.75, whiteSpace: 'nowrap' }}>
          {placement.tool === 'erase'
            ? 'Click a decoration to remove it · Esc to exit'
            : 'Click land to plant · Esc to exit'}
        </span>
      )}
    </div>
  );
}
