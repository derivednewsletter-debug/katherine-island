import React from 'react';
import { useGameStore, moodFromNeeds, MOODS, growthInfo, timeOfDay } from '../state/gameStore';

const BARS = [
  { key: 'hunger', label: 'Hunger', emoji: '🍗', color: '#ff9f43' },
  { key: 'energy', label: 'Energy', emoji: '⚡', color: '#ffd166' },
  { key: 'happiness', label: 'Happiness', emoji: '💛', color: '#ff6b9d' },
];

/**
 * Creature needs HUD — three animated bars (hunger/energy/happiness) plus
 * the current mood emoji, in the same glass style as the other HUD chips.
 */
export default function NeedsHud() {
  // Subscribe to rounded values so the panel only re-renders when a
  // displayed number actually changes (the bars' CSS transition smooths
  // the gaps). Mood is a string selector — also re-renders only on change.
  const hunger = useGameStore((s) => Math.round(s.needs.hunger));
  const energy = useGameStore((s) => Math.round(s.needs.energy));
  const happiness = useGameStore((s) => Math.round(s.needs.happiness));
  const mood = useGameStore((s) =>
    moodFromNeeds(s.needs, !timeOfDay(s.time, s.dayCycleSeconds).isDay)
  );
  const sleeping = useGameStore((s) => s.sleeping);
  const needs = { hunger, energy, happiness };

  // While asleep the mood header shows the sleeping face instead of mood.
  const moodEmoji = sleeping ? '💤' : MOODS[mood].emoji;
  const moodLabel = sleeping ? 'Sleeping' : MOODS[mood].label;

  // Growth stage + progress toward the next evolution. carePoints is floored
  // so the panel only re-renders when the displayed number changes (it's a
  // float that trickles up every tick while the pet is well-cared-for).
  const stage = useGameStore((s) => s.stage);
  const carePoints = useGameStore((s) => Math.floor(s.carePoints));
  const growth = growthInfo(stage, carePoints);

  // Berries available for feeding (rounded so the button only re-renders
  // when the displayed count changes).
  const berries = useGameStore((s) => s.inventory.berry);
  const holding = useGameStore((s) => s.holding);
  const feed = () => useGameStore.getState().feedPet();

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 14px',
        background: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 12,
        color: '#fff',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontSize: 12,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        minWidth: 150,
      }}
    >
      {/* Mood header — sleeping face while the pet sleeps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span className={sleeping ? 'sleep-emoji' : undefined} style={{ fontSize: 16 }}>
          {moodEmoji}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{moodLabel}</span>
      </div>

      {BARS.map((bar) => {
        const value = needs[bar.key];
        const low = value < 25;
        return (
          <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, textAlign: 'center' }}>{bar.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ opacity: 0.8 }}>{bar.label}</span>
                <span style={{ fontWeight: 700, opacity: low ? 1 : 0.9 }}>{Math.round(value)}</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className={low ? 'need-bar-low' : undefined}
                  style={{
                    width: `${value}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: low ? '#ff6b6b' : bar.color,
                    transition: 'width 0.2s linear, background 0.3s',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Growth stage + progress toward the next evolution */}
      {growth && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            paddingTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span style={{ width: 14, textAlign: 'center', fontSize: 14 }}>{growth.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 11 }}>{growth.label}</span>
              {growth.isMax ? (
                <span style={{ opacity: 0.75, fontSize: 11 }}>Fully grown ✨</span>
              ) : (
                <span style={{ opacity: 0.8, fontSize: 11 }}>
                  {growth.current}/{growth.required} to {growth.nextLabel}
                </span>
              )}
            </div>
            {!growth.isMax && (
              <div
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (growth.current / growth.required) * 100)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: '#7ee8fa',
                    transition: 'width 0.3s linear',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feed the pet a berry (fast path; holding the berry chip works too) */}
      <button
        onClick={feed}
        disabled={berries < 1}
        style={{
          marginTop: 6,
          padding: '5px 10px',
          borderRadius: 999,
          border: `1px solid ${berries >= 1 ? 'rgba(255,93,126,0.6)' : 'rgba(255,255,255,0.2)'}`,
          background: berries >= 1 ? 'rgba(255,93,126,0.22)' : 'rgba(255,255,255,0.08)',
          color: berries >= 1 ? '#ffd6de' : 'rgba(255,255,255,0.45)',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          cursor: berries >= 1 ? 'pointer' : 'not-allowed',
          pointerEvents: 'auto',
          transition: 'background 0.2s, transform 0.15s',
        }}
        onMouseEnter={(e) => berries >= 1 && (e.currentTarget.style.background = 'rgba(255,93,126,0.35)')}
        onMouseLeave={(e) => berries >= 1 && (e.currentTarget.style.background = 'rgba(255,93,126,0.22)')}
      >
        {holding === 'berry' ? '🍓 Feeding…' : `🍓 Feed berry (${berries})`}
      </button>
    </div>
  );
}
