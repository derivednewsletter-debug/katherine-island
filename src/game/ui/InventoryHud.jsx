import React from 'react';
import { useGameStore, FEED_BY_RESOURCE } from '../state/gameStore';
import { RESOURCES } from '../data/resources';
import { PET_SPECIES } from '../data/species';

// Gather + crop-harvest resources. Berry/fruit/herb/flower are feedable
// treats (click to hold, then click the pet); shell/stone are plain.
const ORDER = ['berry', 'shell', 'stone', 'flower', 'fruit', 'herb'];
const FEEDABLE = Object.keys(FEED_BY_RESOURCE);

/**
 * Inventory HUD — reads the shared store and shows a glass chip per
 * resource. Each count pops when it changes. Owned pet eggs appear in a
 * second row below — click an egg chip to place it on the island.
 */
export default function InventoryHud() {
  // Subscribe to just the inventory slice of the global store
  const inventory = useGameStore((s) => s.inventory);
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
      {ORDER.map((resource) => {
        const config = RESOURCES[resource];
        const isFeedable = FEEDABLE.includes(resource);
        const isHeld = holding === resource;
        const empty = isFeedable && (inventory[resource] ?? 0) < 1;
        const chipStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
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
            <span style={{ fontSize: 17 }}>{config.emoji}</span>
            {/* key={count} re-triggers the pop animation on change */}
            <span key={inventory[resource]} className="hud-count-pop">
              {inventory[resource]}
            </span>
          </>
        );
        // Feedable treats (berry/fruit/herb/flower) are hold-to-feed buttons;
        // shell/stone stay plain divs so they don't become tab stops.
        return isFeedable ? (
          <button
            key={resource}
            onClick={() => useGameStore.getState().toggleHolding(resource)}
            disabled={empty}
            title={
              isHeld
                ? `Click the pet to feed it! ${config.emoji}`
                : `Hold ${config.label.toLowerCase()} to feed the pet`
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
                    <span style={{ fontSize: 15 }}>{sp.emoji}</span>
                    <span>🥚 ×{count}</span>
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
              ⏳ {placedEggs.length} incubating — check the island!
            </div>
          )}
        </div>
      )}

      {/* Feeding hint when holding a treat — centered under the chips */}
      {holding && FEEDABLE.includes(holding) && (
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
          }}
        >
          {RESOURCES[holding]?.emoji ?? '🍓'} Click the pet to feed it!
        </div>
      )}
    </div>
  );
}
