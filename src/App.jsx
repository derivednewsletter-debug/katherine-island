import React, { useEffect, useState } from 'react';
import GameScene from './game/components/GameScene';
import InventoryHud from './game/ui/InventoryHud';
import NeedsHud from './game/ui/NeedsHud';
import TimeControl from './game/ui/TimeControl';
import PlacementHud from './game/ui/PlacementHud';
import ShopHud from './game/ui/ShopHud';
import QuestBoard from './game/ui/QuestBoard';
import Minimap from './game/ui/Minimap';
import NamingModal from './game/ui/NamingModal';
import ToastHud from './game/ui/ToastHud';
import { startGameClock } from './game/state/gameClock';
import { startNeedsSystem } from './game/state/needs';
import { startOcean, stopOcean, isOceanPlaying } from './game/audio/ocean';
import { startMusic, stopMusic, isMusicPlaying, setSoundEnabled } from './game/audio/sfx';
import { startSaveSync, syncSaveFromCloud } from './game/state/saveSync';

/**
 * Root App component.
 * Full-screen game canvas with a subtle UI overlay for tile info
 * and an ocean ambience toggle.
 */
export default function App() {
  const [soundOn, setSoundOn] = useState(false);

  // Boot the shared game-clock loop and the needs drainer once
  // (both idempotent / StrictMode-safe). Save sync: FIRST pull the cloud
  // save (newer-of-local-vs-remote wins) and only THEN start pushing, so
  // a stale local save can never clobber a newer remote one during the
  // boot race.
  useEffect(() => {
    startGameClock();
    startNeedsSystem();
    let stopSync = null;
    let cancelled = false;
    syncSaveFromCloud().then(() => {
      if (!cancelled) stopSync = startSaveSync();
    });
    return () => {
      cancelled = true;
      if (stopSync) stopSync();
    };
  }, []);

  // One master sound switch: ocean ambience + music bed + sfx. The click is
  // also the user gesture browsers need to unlock the shared AudioContext.
  const toggleSound = () => {
    if (isOceanPlaying()) {
      stopOcean();
      stopMusic();
      setSoundEnabled(false);
      setSoundOn(false);
    } else {
      setSoundEnabled(true);
      startOcean();
      startMusic();
      setSoundOn(true);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GameScene />

      {/* Cinematic overlay: soft color grade + vignette + film grain.
          Pure CSS, pointer-events none, so clicks reach the canvas.
          The island pops against the sky; the corners fall gently dark. */}
      <div className="grade-overlay">
        <div className="grade-overlay grade-color" />
        <div className="grade-overlay grade-vignette" />
        <div className="grade-overlay grade-grain" />
      </div>

      {/* Inventory HUD (top-center) */}
      <InventoryHud />

      {/* Creature needs (top-right) */}
      <NeedsHud />

      {/* Game clock / pause / speed (bottom-left) */}
      <TimeControl />

      {/* Build palette (bottom-center) */}
      <PlacementHud />

      {/* Shop (bottom-right): button + panel, also opened by the 3D kiosk */}
      <ShopHud />

      {/* Quest board (top-left, under the title) */}
      <QuestBoard />

      {/* Minimap (bottom-left, above the time controls) */}
      <Minimap />

      {/* Hatch-time naming overlay (appears when an egg hatches) */}
      <NamingModal />

      {/* Transient toast (crop harvests, "not ready" hints) */}
      <ToastHud />

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
          Click land to gather &nbsp;|&nbsp; Click the pet to pet it (hold 🍓 to feed) &nbsp;|&nbsp; Pick a decoration below to build &nbsp;|&nbsp; Pan: right-click &nbsp;|&nbsp; Zoom: scroll
        </div>
      </div>

      {/* Master sound toggle (bottom-right): ocean + music + sfx */}
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
        {soundOn ? '🔇 Mute sound' : '🔊 Sound on'}
      </button>
    </div>
  );
}
