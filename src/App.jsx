import React, { useEffect, useState } from 'react';
import GameScene from './game/components/GameScene';
import InventoryHud from './game/ui/InventoryHud';
import NeedsHud from './game/ui/NeedsHud';
import TimeControl from './game/ui/TimeControl';
import { startGameClock } from './game/state/gameClock';
import { startNeedsSystem } from './game/state/needs';
import { startOcean, stopOcean, isOceanPlaying } from './game/audio/ocean';

/**
 * Root App component.
 * Full-screen game canvas with a subtle UI overlay for tile info
 * and an ocean ambience toggle.
 */
export default function App() {
  const [soundOn, setSoundOn] = useState(false);

  // Boot the shared game-clock loop and the needs drainer once
  // (both idempotent / StrictMode-safe)
  useEffect(() => {
    startGameClock();
    startNeedsSystem();
  }, []);

  const toggleSound = () => {
    if (isOceanPlaying()) {
      stopOcean();
      setSoundOn(false);
    } else {
      startOcean();
      setSoundOn(true);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GameScene />

      {/* Inventory HUD (top-center) */}
      <InventoryHud />

      {/* Creature needs (top-right) */}
      <NeedsHud />

      {/* Game clock / pause / speed (bottom-left) */}
      <TimeControl />

      {/* UI Overlay — non-intrusive, positioned above the canvas */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        padding: '12px 20px',
        background: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 12,
        color: '#fff',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontSize: 14,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
          🌴 Katherine's Island
        </div>
        <div style={{ opacity: 0.75, fontSize: 12 }}>
          Click tiles to gather &nbsp;|&nbsp; Click the pet to pet it &nbsp;|&nbsp; Pan: right-click &nbsp;|&nbsp; Zoom: scroll
        </div>
      </div>

      {/* Ocean ambience toggle (bottom-right) */}
      <button
        onClick={toggleSound}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.55)',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 13,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        {soundOn ? '🔇 Mute ocean' : '🌊 Ocean waves'}
      </button>
    </div>
  );
}
