import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PET_SPECIES } from '../data/species';

/**
 * Hatch-time naming modal. When an egg hatches, the store sets
 * `namingPetId`; this overlay asks the player to name the new pet.
 * Submits with the typed name (or the species default if left blank);
 * Esc also confirms (you can't abandon a fresh pet).
 */
export default function NamingModal() {
  const namingPetId = useGameStore((s) => s.namingPetId);
  const species = useGameStore((s) =>
    s.pets.find((p) => p.id === s.namingPetId)?.species ?? null
  );
  const [value, setValue] = useState('');

  const sp = species ? PET_SPECIES[species] : null;
  const open = Boolean(namingPetId && sp);

  // Reset the input each time a new pet hatches
  useEffect(() => {
    if (open) setValue('');
  }, [namingPetId, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') confirm(); // adopt with what's typed (or default)
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const confirm = () => {
    useGameStore.getState().namePet(value.trim() || sp.label);
  };

  if (!open || !sp) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 20, 40, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 30,
      }}
    >
      <div
        className="naming-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '24px 28px',
          background: 'rgba(20, 28, 52, 0.92)',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          width: 320,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>{sp.emoji}</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          Your egg hatched!
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          A {sp.label.toLowerCase()} popped out. What's its name?
        </div>
        <input
          autoFocus
          value={value}
          maxLength={18}
          onChange={(e) => setValue(e.target.value)}
          placeholder={sp.label}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'inherit',
            outline: 'none',
            textAlign: 'center',
          }}
        />
        <button
          onClick={confirm}
          style={{
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: '#ffd166',
            color: '#4a3800',
            fontSize: 14,
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'background 0.2s, transform 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#ffe08a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffd166')}
        >
          Name {value.trim() ? `“${value.trim()}”` : `the ${sp.label.toLowerCase()}`} 🎉
        </button>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          Enter or Esc to confirm · leave blank for {sp.label}
        </div>
      </div>
    </div>
  );
}
