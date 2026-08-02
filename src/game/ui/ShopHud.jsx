import React, { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { SHOP_ITEMS, canAfford } from '../data/shop';
import { RESOURCES } from '../data/resources';

/**
 * Shop HUD — a floating "🛒 Shop" button (bottom-right) that toggles a
 * glass panel listing everything the store sells. Each card shows the item,
 * its price in gathered goods, and a Buy button that disables when the
 * player can't afford it or already owns it (✓ Owned).
 *
 * The same panel opens when you click the 3D kiosk on the island.
 */
export default function ShopHud() {
  const shopOpen = useGameStore((s) => s.shopOpen);
  const toggleShop = useGameStore((s) => s.toggleShop);
  const buyItem = useGameStore((s) => s.buyItem);
  const inventory = useGameStore((s) => s.inventory);
  const upgrades = useGameStore((s) => s.upgrades);
  const unlockedDecorations = useGameStore((s) => s.unlockedDecorations);

  // Esc closes the shop
  useEffect(() => {
    if (!shopOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleShop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shopOpen, toggleShop]);

  const isOwned = (item) =>
    item.kind === 'upgrade' ? !!upgrades[item.id] : unlockedDecorations.includes(item.id);

  return (
    <>
      {/* Floating Shop button — stacked above the ocean toggle so they
          don't overlap in the bottom-right corner */}
      <button
        onClick={toggleShop}
        style={{
          position: 'absolute',
          bottom: 64,
          right: 16,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.55)',
          border: shopOpen ? '1px solid rgba(255, 209, 102, 0.7)' : 'none',
          borderRadius: 12,
          color: '#fff',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        🛒 Shop
      </button>

      {/* Panel */}
      {shopOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 112,
            right: 16,
            width: 300,
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 14,
            background: 'rgba(0, 0, 0, 0.78)',
            borderRadius: 14,
            color: '#fff',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>🏪 Beach Shop</span>
            <button
              onClick={toggleShop}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                padding: '2px 9px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Spend gathered goods on buildables &amp; perks
          </div>

          {SHOP_ITEMS.map((item) => {
            const owned = isOwned(item);
            const affordable = canAfford(item.price, inventory);
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: 22 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 3 }}>{item.desc}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(item.price).map(([res, amount]) => (
                      <span
                        key={res}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: (inventory[res] ?? 0) >= amount ? 'rgba(255,209,102,0.18)' : 'rgba(255,107,107,0.18)',
                          color: (inventory[res] ?? 0) >= amount ? '#ffd166' : '#ff8b8b',
                        }}
                      >
                        {RESOURCES[res]?.emoji ?? res} ×{amount}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  disabled={owned || !affordable}
                  onClick={() => buyItem(item.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: 10,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: owned || !affordable ? 'not-allowed' : 'pointer',
                    background: owned
                      ? 'rgba(74,222,128,0.22)'
                      : affordable
                        ? '#ffd166'
                        : 'rgba(255,255,255,0.12)',
                    color: owned ? '#7ee8a0' : affordable ? '#4a3800' : '#8a8a8a',
                  }}
                >
                  {owned ? '✓ Owned' : affordable ? 'Buy' : '—'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
