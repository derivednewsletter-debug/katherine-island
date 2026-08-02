import React from 'react';
import { useGameStore, moodFromNeeds, MOODS } from '../state/gameStore';

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
  const mood = useGameStore((s) => moodFromNeeds(s.needs));
  const needs = { hunger, energy, happiness };

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
      {/* Mood header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 16 }}>{MOODS[mood].emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{MOODS[mood].label}</span>
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
    </div>
  );
}
