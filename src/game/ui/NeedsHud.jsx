import React from 'react';
import { useGameStore, moodFromNeeds, MOODS, growthInfo, timeOfDay, FEED_BY_RESOURCE } from '../state/gameStore';
import { PET_SPECIES } from '../data/species';
import { RESOURCES } from '../data/resources';
import SvgIcon from './SvgIcon';

// Map need keys to icon names
const NEED_ICONS = { hunger: 'farm', energy: 'time', happiness: 'heart', hygiene: 'waterDrop' };
const ICON_MAP = { berry: 'berry', shell: 'shell', stone: 'stone', flower: 'flower', fruit: 'fruit', herb: 'herb', wood: 'wood' };
// Map mood states to icon names
const MOOD_ICONS = { happy: 'happy', content: 'neutral', hungry: 'hungry', tired: 'tired', sad: 'sad', sick: 'sick' };

const BARS = [
  { key: 'hunger', label: 'Hunger', color: '#ff9f43' },
  { key: 'energy', label: 'Energy', color: '#ffd166' },
  { key: 'happiness', label: 'Happiness', color: '#ff6b9d' },
  { key: 'hygiene', label: 'Hygiene', color: '#a3c4ff' },
];

/**
 * Creature needs HUD — three animated bars (hunger/energy/happiness) plus
 * the current mood emoji, in the same glass style as the other HUD chips.
 *
 * Multi-pet aware: the top row lists every pet (the starter + each hatched
 * pet); the panel shows whichever is selected, and the feed button feeds
 * that pet. Clicking a pet in-world also selects it.
 */
export default function NeedsHud() {
  const selectedPetId = useGameStore((s) => s.selectedPetId);
  const isStarter = selectedPetId === 'starter';

  // Single selector for the selected pet object — eliminates 8+ redundant .find() calls
  const selectedPet = useGameStore((s) => {
    if (isStarter) return null;
    return s.pets.find((p) => p.id === s.selectedPetId) ?? null;
  });
  const selectedPetExists = isStarter || Boolean(selectedPet);
  const memorialChip = useGameStore((s) => s.memorials.find((m) => m.petId === s.selectedPetId) ?? s.memorials[s.memorials.length - 1]);

  // Derived values from the single pet lookup (or starter state)
  const hunger = Math.round(isStarter ? useGameStore.getState().needs.hunger : (selectedPet?.needs?.hunger ?? 100));
  const energy = Math.round(isStarter ? useGameStore.getState().needs.energy : (selectedPet?.needs?.energy ?? 100));
  const happiness = Math.round(isStarter ? useGameStore.getState().needs.happiness : (selectedPet?.needs?.happiness ?? 100));
  const hygiene = Math.round(isStarter ? useGameStore.getState().needs.hygiene : (selectedPet?.needs?.hygiene ?? 100));
  const sick = isStarter ? useGameStore.getState().sick : (selectedPet?.sick ?? false);
  const deceased = isStarter ? false : (selectedPet?.deceased ?? false);
  const sleeping = isStarter ? useGameStore.getState().sleeping : (selectedPet?.sleeping ?? false);
  const stage = isStarter ? useGameStore.getState().stage : (selectedPet?.stage ?? null);
  const carePoints = isStarter ? Math.floor(useGameStore.getState().carePoints) : Math.floor(selectedPet?.carePoints ?? 0);

  // Subscribe to frequently-changing values that can't be read from getState
  const runawayCount = useGameStore((s) => s.pets.reduce((count, p) => count + (p.ranAway ? 1 : 0), 0));
  const firstRunawayId = useGameStore((s) => s.pets.find((p) => p.ranAway)?.id ?? null);
  const memorials = useGameStore((s) => s.memorials);
  const openRename = useGameStore((s) => s.openRename);
  const followingPetId = useGameStore((s) => s.followingPetId);
  const toyCount = useGameStore((s) => s.inventory.toy ?? 0);
  const soapCount = useGameStore((s) => s.inventory.soap ?? 0);
  const selectPet = useGameStore((s) => s.selectPet);

  // Starter needs for mood calculation — subscribe to full object only for starter
  const starterNeeds = useGameStore((s) => isStarter ? s.needs : null);
  const starterSleeping = useGameStore((s) => isStarter ? s.sleeping : null);

  const isNight = !timeOfDay(useGameStore.getState().time, useGameStore.getState().dayCycleSeconds).isDay;

  const mood = isStarter
    ? moodFromNeeds(starterNeeds, isNight)
    : moodFromNeeds(selectedPet?.needs ?? { hunger: 100, energy: 100, happiness: 100 }, isNight);

  const needs = { hunger, energy, happiness, hygiene };

  // Pet name + species
  const petName = isStarter ? useGameStore.getState().starterName : (selectedPet?.name ?? 'Pet');
  const petSpecies = isStarter ? null : selectedPet?.species;

  // Pet roster for selector chips
  const roster = useGameStore((s) => {
    const isNightR = !timeOfDay(s.time, s.dayCycleSeconds).isDay;
    const starterMood = s.sleeping
      ? 'sleep'
      : s.sick
        ? 'sick'
        : MOOD_ICONS[moodFromNeeds(s.needs, isNightR)] || 'happy';
    const starter = { id: 'starter', icon: 'egg', name: s.starterName ?? 'My pet', moodIcon: starterMood };
    const pets = s.pets.map((p) => {
      const m = p.sleeping
        ? 'sleep'
        : p.ranAway
          ? 'question'
          : p.sick
            ? 'sick'
            : MOOD_ICONS[moodFromNeeds(p.needs, isNightR)] || 'happy';
      return { id: p.id, icon: 'egg', name: p.name, moodIcon: m };
    });
    return JSON.stringify([starter, ...pets]);
  });
  const chips = JSON.parse(roster || '[]');

  // While asleep the mood header shows the sleeping icon instead of mood;
  // a sick pet shows a red pill instead of the mood label.
  const moodIcon = selectedPet?.ranAway ? 'question' : sleeping ? 'sleep' : sick ? 'sick' : MOOD_ICONS[mood];
  const moodLabel = !selectedPetExists ? 'Choose a pet' : selectedPet?.ranAway ? 'Runaway — find me!' : sleeping ? 'Sleeping' : sick ? 'Sick — use a medkit!' : MOODS[mood].label;

  // Growth stage + progress
  const growth = stage ? growthInfo(stage, carePoints, petSpecies) : null;

  // Feedable treats
  const holding = useGameStore((s) => s.holding);
  const berries = useGameStore((s) => s.inventory.berry);
  const heldFeedable = holding && FEED_BY_RESOURCE[holding] ? holding : null;
  const feedResource = heldFeedable ?? (berries >= 1 ? 'berry' : null);
  const feedIconName = feedResource ? (ICON_MAP[feedResource] || 'berry') : 'berry';
  const feed = () => useGameStore.getState().feedPet(selectedPetId);

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
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        minWidth: 150,
        maxWidth: 210,
        ...(sick
          ? { border: '1px solid rgba(255,80,80,0.7)', boxShadow: '0 0 12px rgba(255,60,60,0.45)' }
          : {}),
      }}
    >
       {runawayCount > 0 && (
         <button
           onClick={() => firstRunawayId && selectPet(firstRunawayId)}
           title="Find and rescue your runaway pet"
           style={{
             display: 'flex',
             alignItems: 'center',
             gap: 6,
             padding: '6px 10px',
             borderRadius: 8,
             border: '1px solid rgba(255,107,107,0.6)',
             background: 'rgba(255,107,107,0.2)',
             color: '#ffb3b3',
             fontSize: 12,
             fontWeight: 800,
             fontFamily: 'inherit',
             cursor: 'pointer',
             pointerEvents: 'auto',
             marginBottom: 2,
             animation: 'pulse 1.6s infinite',
           }}
         >
           🐾 Find {runawayCount} runaway pet{runawayCount > 1 ? 's' : ''}
         </button>
       )}
       <div
         style={{
           display: 'flex',
           gap: 4,
           flexWrap: 'wrap',
           paddingBottom: 6,
           borderBottom: '1px solid rgba(255,255,255,0.15)',
         }}
       >
         {chips.map((chip) => {
           const active = chip.id === selectedPetId;
           return (
             <button
               key={chip.id}
               onClick={() => useGameStore.getState().selectPet(chip.id)}
               title={`Show ${chip.name}'s needs`}
               style={{
                 display: 'flex',
                 alignItems: 'center',
                 gap: 4,
                 padding: '3px 8px',
                 borderRadius: 999,
                 border: active ? '1px solid rgba(126,232,250,0.8)' : '1px solid rgba(255,255,255,0.18)',
                 background: active ? 'rgba(126,232,250,0.2)' : 'rgba(255,255,255,0.06)',
                 color: '#fff',
                 fontSize: 11,
                 fontWeight: active ? 800 : 600,
                 fontFamily: 'inherit',
                 cursor: 'pointer',
                 pointerEvents: 'auto',
                 transition: 'background 0.15s',
                 maxWidth: 130,
                 overflow: 'hidden',
                 textOverflow: 'ellipsis',
                 whiteSpace: 'nowrap',
               }}
             >
                <SvgIcon name={chip.moodIcon} size={14} />
               <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chip.name}</span>
             </button>
           );
         })}
       </div>

       {/* Mood header — sleeping icon while the pet sleeps */}
       <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
         <SvgIcon name="egg" size={16} />
         <span className={sleeping ? 'sleep-emoji' : undefined} style={{ fontSize: 16 }}>
           <SvgIcon name={moodIcon} size={16} />
         </span>
         <span style={{ fontWeight: 700, fontSize: 13 }}>{petName}</span>
         <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>· {moodLabel}</span>
       </div>

      {BARS.map((bar) => {
        const value = needs[bar.key];
        const low = value < 25;
        return (
          <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SvgIcon name={NEED_ICONS[bar.key]} size={14} />
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

      {/* Growth stage + progress toward the next evolution (starter only) */}
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
         <SvgIcon name="star" size={14} />
         <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 11 }}>{growth.label}</span>
              {growth.isMax ? (
                <span style={{ opacity: 0.75, fontSize: 11 }}>Fully grown <SvgIcon name="star" size={10} /></span>
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

      {memorialChip && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(212,212,212,0.12)', color: '#d4d4d4', fontSize: 11, textAlign: 'center' }}>🕊️ {memorialChip.name} — in loving memory</div>
      )}

      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        <button onClick={() => openRename(selectedPetId)} disabled={!selectedPetExists} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: '1px solid rgba(255,209,102,0.45)', background: 'rgba(255,209,102,0.13)', color: '#ffe7a3', cursor: selectedPetExists ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 800 }}>✎ Rename</button>
        <button onClick={() => useGameStore.getState().toggleFollow(selectedPetId)} disabled={!selectedPetExists || sick || deceased} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: '1px solid rgba(126,232,250,0.4)', background: followingPetId === selectedPetId ? 'rgba(126,232,250,0.28)' : 'rgba(255,255,255,0.08)', color: '#d9fbff', cursor: !selectedPetExists || sick || deceased ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800 }}>🚶 {followingPetId === selectedPetId ? 'Following' : 'Walk'}</button>
        <button onClick={() => {
          const st = useGameStore.getState();
          const row = st.playerPos.row + Math.round(Math.sin(st.playerDir) * 3);
          const col = st.playerPos.col + Math.round(Math.cos(st.playerDir) * 3);
          st.throwToy(selectedPetId, row, col);
        }} disabled={!selectedPetExists || !toyCount || sick || deceased} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: '1px solid rgba(255,158,107,0.45)', background: 'rgba(255,158,107,0.14)', color: '#ffd6b8', cursor: !selectedPetExists || !toyCount || sick || deceased ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800 }}>🎾 Play</button>
        <button onClick={() => useGameStore.getState().toggleHolding('soap')} disabled={!selectedPetExists || !soapCount || deceased} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: '1px solid rgba(201,169,255,0.45)', background: 'rgba(201,169,255,0.14)', color: '#eee0ff', cursor: !selectedPetExists || !soapCount || deceased ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800 }}>🧼 Bathe</button>
      </div>

      {/* Feed the selected pet a treat (fast path; holding a chip works too) */}
      <button
        onClick={feed}
        disabled={!selectedPetExists || !feedResource}
         style={{
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           gap: 6,
           marginTop: 6,
           padding: '5px 10px',
           borderRadius: 999,
           border: `1px solid ${feedResource ? 'rgba(255,93,126,0.6)' : 'rgba(255,255,255,0.2)'}`,
           background: feedResource ? 'rgba(255,93,126,0.22)' : 'rgba(255,255,255,0.08)',
           color: feedResource ? '#ffd6de' : 'rgba(255,255,255,0.45)',
           fontFamily: '"Segoe UI", system-ui, sans-serif',
           fontSize: 12,
           fontWeight: 700,
           cursor: feedResource ? 'pointer' : 'not-allowed',
           pointerEvents: 'auto',
           transition: 'background 0.2s, transform 0.15s',
         }}
         onMouseEnter={(e) => feedResource && (e.currentTarget.style.background = 'rgba(255,93,126,0.35)')}
         onMouseLeave={(e) => feedResource && (e.currentTarget.style.background = 'rgba(255,93,126,0.22)')}
       >
        <SvgIcon name={feedIconName} size={14} />
        {heldFeedable
          ? `Feeding ${petName}…`
          : `Feed ${petName} (${berries})`}
      </button>
    </div>
  );
}
