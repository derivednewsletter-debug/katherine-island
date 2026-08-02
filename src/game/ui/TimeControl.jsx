import React, { useEffect, useState } from 'react';
import { useGameStore, timeOfDay } from '../state/gameStore';
import { clearRemoteSave } from '../state/saveSync';

const SPEEDS = [1, 2, 4];

/**
 * Time-control HUD: shows the shared game clock (day + time-of-day icon)
 * and lets the player pause or speed up the game world. Because day-night
 * and every future system tick off the same store clock, these controls
 * affect the whole game at once.
 */
export default function TimeControl() {
  const time = useGameStore((s) => s.time);
  const timeScale = useGameStore((s) => s.timeScale);
  const paused = useGameStore((s) => s.paused);
  const togglePause = useGameStore((s) => s.togglePause);
  const setTimeScale = useGameStore((s) => s.setTimeScale);
  const skipToNight = useGameStore((s) => s.skipToNight);
  const resetGame = useGameStore((s) => s.resetGame);

  // Two-step reset: first click arms it, second click wipes the save.
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3000); // auto-disarm
    return () => clearTimeout(t);
  }, [confirmReset]);

  // Space toggles pause (ignore when typing / a button has focus)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  const { day, phase, isDay } = timeOfDay(time);
  const icon = isDay ? '☀️' : '🌙';
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(timeScale) + 1) % SPEEDS.length];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Day + progress of the current day-night cycle */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.55)',
          borderRadius: 12,
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 13,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          <span>{icon}</span>
          <span>Day {day}</span>
        </div>
        {/* Day-cycle progress bar */}
        <div
          style={{
            width: 110,
            height: 4,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${phase * 100}%`,
              height: '100%',
              borderRadius: 999,
              background: isDay ? '#ffd166' : '#9db4ff',
              transition: 'width 0.3s linear',
            }}
          />
        </div>
      </div>

      {/* Pause / play */}
      <button
        onClick={togglePause}
        style={buttonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        {paused ? '▶ Play' : '⏸ Pause'}
      </button>

      {/* Speed toggle: 1x → 2x → 4x */}
      <button
        onClick={() => setTimeScale(nextSpeed)}
        style={buttonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        {timeScale}x
      </button>

      {/* Dramatic jump straight to dusk ("night falls") */}
      <button
        onClick={skipToNight}
        style={buttonStyle}
        title="Skip ahead to nightfall"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        🌙 Night
      </button>

      {/* Wipe the save (two clicks to avoid accidents) */}
      <button
        onClick={() => {
          if (confirmReset) {
            resetGame();
            clearRemoteSave(); // wipe the cloud save too
            setConfirmReset(false);
          } else {
            setConfirmReset(true);
          }
        }}
        style={{
          ...buttonStyle,
          background: confirmReset ? 'rgba(214, 69, 65, 0.7)' : 'rgba(0, 0, 0, 0.55)',
        }}
        title="Wipe the save and start fresh"
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = confirmReset
            ? 'rgba(214, 69, 65, 0.85)'
            : 'rgba(0, 0, 0, 0.75)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = confirmReset
            ? 'rgba(214, 69, 65, 0.7)'
            : 'rgba(0, 0, 0, 0.55)')
        }
      >
        {confirmReset ? '⚠️ Sure?' : '🔄 Reset'}
      </button>
    </div>
  );
}

const buttonStyle = {
  padding: '8px 14px',
  background: 'rgba(0, 0, 0, 0.55)',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  transition: 'background 0.2s',
};
