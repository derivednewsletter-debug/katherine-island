import React from 'react';
import { useGameStore, FEED_BY_RESOURCE } from '../state/gameStore';
import { RESOURCES } from '../data/resources';
import { PET_SPECIES } from '../data/species';
import SvgIcon from './SvgIcon';

// Gather + crop-harvest resources. Berry/fruit/herb/flower are feedable
// treats (click to hold, then click the pet); shell/stone are plain.
const ORDER = ['berry', 'shell', 'stone', 'flower', 'fruit', 'herb', 'wood', 'soap', 'medkit', 'toy', 'stew', 'grilled'];
const FEEDABLE = Object.keys(FEED_BY_RESOURCE);
// Hold-to-use care items (soap/medkit) — click the pet to apply them.
const CAREABLE = ['soap', 'medkit'];
const HOLDABLE = [...FEEDABLE, ...CAREABLE, 'toy'];
const ICON_MAP = { berry: 'berry', shell: 'shell', stone: 'stone', flower: 'flower', fruit: 'fruit', herb: 'herb', wood: 'wood', soap: 'soap', medkit: 'medkit', toy: 'toy', stew: 'stew', grilled: 'grilled' };

/**
 * Inventory HUD — reads the shared store and shows a glass chip per
 * resource. Each count pops when it changes. Owned pet eggs appear in a
 * second row below — click an egg chip to place it on the island.
 */
export default function InventoryHud() {
  // Subscribe to just the inventory slice of the global store
  const inventory = useGameStore((s) => s.inventory);
  const currency = useGameStore((s) => s.currency);
  const holding = useGameStore((s) => s.holding);
  const ownedEggs = useGameStore((s) => s.ownedEggs);
  const placedEggs = useGameStore((s) => s.placedEggs);
  const placement = useGameStore((s) => s.placement);

  // Group owned eggs by species with counts
  const eggGroups = {};
  ownedEggs.forEach((e) => {
    eggGroups[e.species] = (eggGroups[e.species] ?? 0) + 1;
  });

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
      {/* Coin balance chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          background: 'rgba(255, 215, 0, 0.25)',
          borderRadius: 999,
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 14,
          backdropFilter: 'blur(8px)',
          border: '1px solid #ffd700',
          boxShadow: '0 0 8px rgba(255,215,0,0.3)',
          pointerEvents: 'auto',
        }}
      >
        <SvgIcon name="coin" size={17} />
        <span className="hud-count-pop" key={currency}>{currency}</span>
      </div>
      {ORDER.map((resource) => {
        const config = RESOURCES[resource];
        const isFeedable = FEEDABLE.includes(resource);
        const isCare = CAREABLE.includes(resource);
        const isToy = resource === 'toy';
        const isHoldable = isFeedable || isCare || isToy;
        const isHeld = holding === resource;
        const empty = isHoldable && (inventory[resource] ?? 0) < 1;
        const chipStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
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
            <SvgIcon name={ICON_MAP[resource] || resource} size={17} />
            {/* key={count} re-triggers the pop animation on change */}
            <span key={inventory[resource]} className="hud-count-pop">
              {inventory[resource]}
            </span>
          </>
        );
        // Feedable treats (berry/fruit/herb/flower), care items (soap/medkit),
        // and toys are hold-to-use buttons; shell/stone stay plain.
        return isHoldable ? (
          <button
            key={resource}
            onClick={() => useGameStore.getState().toggleHolding(resource)}
            disabled={empty}
            title={
              isHeld
                ? (isToy ? `Click a tile to throw!` : `Click the pet to use it! ${config.label}`)
                : (isToy ? `Hold toy to play fetch` : `Hold ${config.label.toLowerCase()} to use on the pet`)
            }
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
      {/* Pet eggs — click to place one on the island */}
      {(ownedEggs.length > 0 || placedEggs.length > 0) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
          }}
        >
          {ownedEggs.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(eggGroups).map(([species, count]) => {
                const sp = PET_SPECIES[species];
                if (!sp) return null;
                const eggId = ownedEggs.find((e) => e.species === species)?.id;
                const isActive =
                  placement.active && placement.tool === 'egg' && placement.eggId === eggId;
                return (
                  <button
                    key={species}
                    onClick={() => eggId && useGameStore.getState().startEggPlacement(eggId)}
                    title={`Place a ${sp.label} egg — it hatches in 10 minutes`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 999,
                      border: isActive
                        ? '1px solid rgba(126,232,250,0.8)'
                        : '1px solid rgba(255,255,255,0.25)',
                      background: isActive
                        ? 'rgba(126,232,250,0.25)'
                        : 'rgba(0, 0, 0, 0.55)',
                      color: '#fff',
                      fontFamily: '"Segoe UI", system-ui, sans-serif',
                      fontSize: 12,
                      fontWeight: 700,
                      backdropFilter: 'blur(8px)',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      transition: 'background 0.2s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = isActive
                        ? 'rgba(126,232,250,0.25)'
                        : 'rgba(0, 0, 0, 0.55)')
                    }
                  >
                     <SvgIcon name="egg" size={15} />
                     <span>×{count}</span>
                     <span style={{ opacity: 0.7, fontSize: 11, fontWeight: 600 }}>
                       {isActive ? 'placing…' : 'place'}
                     </span>
                  </button>
                );
              })}
            </div>
          )}
          {placedEggs.length > 0 && (
            <div
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#ffe9a8',
                fontFamily: '"Segoe UI", system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 700,
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
            >
             <SvgIcon name="time" size={14} /> {placedEggs.length} incubating — check the island!
            </div>
          )}
        </div>
      )}

         {holding && HOLDABLE.includes(holding) && (
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
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <SvgIcon name={ICON_MAP[holding] || 'berry'} size={14} />
          {CAREABLE.includes(holding) ? 'Click the pet to use it!' : holding === 'toy' ? 'Click a tile to throw!' : 'Click the pet to feed it!'}
        </div>
      )}
    </div>
  );
}
