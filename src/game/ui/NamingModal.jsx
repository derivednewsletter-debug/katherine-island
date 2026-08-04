import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PET_SPECIES } from '../data/species';
import SvgIcon from './SvgIcon';

const SPECIES_ICON_MAP = { rabbit: 'egg', cat: 'cat', duck: 'duck' };

/**
 * Hatch-time naming modal. When an egg hatches, the store sets
 * `namingPetId`; this overlay asks the player to name the new pet.
 * Submits with the typed name (or the species default if left blank);
 * Esc also confirms (you can't abandon a fresh pet).
 */
export default function NamingModal() {
  const namingPetId = useGameStore((s) => s.namingPetId);
  const renamingPetId = useGameStore((s) => s.renamingPetId);
  const editingId = renamingPetId ?? namingPetId;
  const species = useGameStore((s) => s.pets.find((p) => p.id === editingId)?.species ?? null);
  const currentName = useGameStore((s) =>
    editingId === 'starter' ? s.starterName : s.pets.find((p) => p.id === editingId)?.name ?? ''
  );
  const [value, setValue] = useState('');

  const sp = species ? PET_SPECIES[species] : null;
  const isRename = Boolean(renamingPetId);
  const displayLabel = sp?.label ?? 'My pet';
  const open = Boolean(editingId && (sp || isRename));

  // Reset the input each time a new modal opens
  useEffect(() => {
    if (open) setValue(isRename ? currentName : '');
  }, [editingId, open, isRename, currentName]);

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
    const st = useGameStore.getState();
    if (isRename) st.renamePet(value);
    else st.namePet(value.trim() || sp.label);
  };

  if (!open) return null;

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
        <div style={{ fontSize: 40, lineHeight: 1 }}>
          <SvgIcon name={SPECIES_ICON_MAP[sp?.id] || 'egg'} size={40} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          {isRename ? 'Rename your pet' : 'Your egg hatched!'}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {isRename ? 'Give your companion a name that feels like home.' : `A ${sp.label.toLowerCase()} popped out. What's its name?`}
        </div>
        <input
          autoFocus
          value={value}
          maxLength={18}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isRename ? currentName : displayLabel}
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
          {isRename ? 'Save name' : `Name ${value.trim() ? `“${value.trim()}”` : `the ${displayLabel.toLowerCase()}`} `}<SvgIcon name="star" size={16} />
        </button>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          Enter or Esc to confirm{!isRename && ` · leave blank for ${displayLabel}`}
        </div>
      </div>
    </div>
  );
}
