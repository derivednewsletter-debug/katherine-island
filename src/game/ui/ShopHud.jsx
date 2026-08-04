import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { SHOP_ITEMS, canAfford, SELL_PRICES } from '../data/shop';
import { RESOURCES } from '../data/resources';
import SvgIcon from './SvgIcon';

/**
 * Shop HUD — a floating "Shop" button (bottom-right) that toggles a
 * glass panel listing everything the store sells. Each card shows the item,
 * its price in gathered goods or coins, and a Buy button that disables when
 * the player can't afford it or already owns it.
 *
 * Includes a Sell tab for converting gathered resources into coins.
 */
export default function ShopHud() {
  const shopOpen = useGameStore((s) => s.shopOpen);
  const toggleShop = useGameStore((s) => s.toggleShop);
  const buyItem = useGameStore((s) => s.buyItem);
  const inventory = useGameStore((s) => s.inventory);
  const currency = useGameStore((s) => s.currency);
  const upgrades = useGameStore((s) => s.upgrades);
  const unlockedDecorations = useGameStore((s) => s.unlockedDecorations);
  const ownedEggs = useGameStore((s) => s.ownedEggs);
  const seeds = useGameStore((s) => s.seeds);
  const unlockedCrops = useGameStore((s) => s.unlockedCrops);
  const sellResource = useGameStore((s) => s.sellResource);
  const setPlayerTool = useGameStore((s) => s.setPlayerTool);
  const tools = useGameStore((s) => s.tools);

  const [activeTab, setActiveTab] = useState('buy');

  // Esc closes the shop
  useEffect(() => {
    if (!shopOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleShop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shopOpen, toggleShop]);

  const isOwned = (item) => {
    if (item.kind === 'upgrade') return !!upgrades[item.id];
    if (item.kind === 'decoration') return unlockedDecorations.includes(item.id);
    if (item.kind === 'exotic') return unlockedCrops.includes(item.crop);
    return false;
  };

  const sections = [
    {
      id: 'tools',
      title: 'Tools',
      icon: 'axe',
      test: (i) => i.kind === 'tool',
    },
    {
      id: 'build',
      title: 'Build & Perks',
      icon: 'shop',
      test: (i) => i.kind === 'decoration' || i.kind === 'upgrade',
    },
    { id: 'eggs', title: 'Pet Eggs', icon: 'egg', test: (i) => i.kind === 'egg' },
    { id: 'care', title: 'Pet Care', icon: 'medkit', test: (i) => i.kind === 'item' },
    { id: 'seeds', title: 'Seeds', icon: 'plant', test: (i) => i.kind === 'seed' && i.crop !== 'nightFlower' },
    {
      id: 'exotic',
      title: 'Exotic',
      icon: 'star',
      test: (i) =>
        i.kind === 'exotic' ||
        (i.kind === 'seed' && i.crop === 'nightFlower' && unlockedCrops.includes('nightFlower')),
    },
  ];

  const eggCount = (item) =>
    item.kind === 'egg' ? ownedEggs.filter((e) => e.species === item.species).length : 0;

  return (
    <>
      {/* Floating Shop button */}
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)')}
      >
        <SvgIcon name="shop" size={16} />
        Shop
      </button>

      {/* Panel */}
      {shopOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 112,
            right: 16,
            width: 320,
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
          {/* Header with tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <SvgIcon name="shop" size={18} />
              Island Shop
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setActiveTab('buy')}
                style={{
                  background: activeTab === 'buy' ? 'rgba(79,138,255,0.3)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '4px 10px',
                }}
              >
                Buy
              </button>
              <button
                onClick={() => setActiveTab('sell')}
                style={{
                  background: activeTab === 'sell' ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '4px 10px',
                }}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Coin balance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <SvgIcon name="coin" size={18} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Coins: {currency}</span>
          </div>

          {/* Sell Tab */}
          {activeTab === 'sell' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(SELL_PRICES).map(([res, price]) => {
                const have = inventory[res] ?? 0;
                if (have === 0 && res !== 'wood') return null;
                return (
                  <div
                    key={res}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'rgba(255, 215, 0, 0.08)',
                      border: '1px solid rgba(255, 215, 0, 0.15)',
                    }}
                  >
                    <SvgIcon name={res} size={16} />
                    <span style={{ flex: 1, fontSize: 12 }}>{RESOURCES[res]?.label || res}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>Have: {have}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <SvgIcon name="coin" size={11} /> {price}
                    </span>
                    <button
                      disabled={have === 0}
                      onClick={() => {
                        if (have > 0) sellResource(res, 1);
                      }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: have === 0 ? 'not-allowed' : 'pointer',
                        background: '#ffd700',
                        color: '#4a3800',
                      }}
                    >
                      Sell
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Buy Tab */}
          {activeTab === 'buy' && (
            <>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                Spend coins &amp; gathered goods to buy tools, seeds, and unlocks.
              </div>

              {sections.map((section) => {
                const items = SHOP_ITEMS.filter(section.test);
                if (items.length === 0) return null;
                return (
                  <div key={section.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        opacity: 0.65,
                        marginTop: 4,
                        paddingBottom: 2,
                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <SvgIcon name={section.icon} size={12} />
                      {section.title}
                    </div>
                    {items.map((item) => {
                      const owned = isOwned(item);
                      const ownedEggsCount = eggCount(item);
                      const seedCount = item.kind === 'seed' ? seeds[item.crop] ?? 0 : 0;
                      const affordable = canAfford(item.price, inventory, currency);
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SvgIcon name={item.kind === 'item' ? item.resource : item.id.split(':')[0]} size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{item.name}</div>
                            <div style={{ fontSize: 10, opacity: 0.75 }}>{item.desc}</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                              {item.kind === 'seed' && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 999,
                                    background: 'rgba(158,232,168,0.14)',
                                    color: seedCount > 0 ? '#9fe8a8' : '#8a8a8a',
                                  }}
                                >
                                  {seedCount > 0 ? `${seedCount} owned` : 'none'}
                                </span>
                              )}
                              {owned && item.kind === 'tool' && tools[item.tool] > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 999,
                                    background: 'rgba(74,222,128,0.14)',
                                    color: '#7ee8a0',
                                  }}
                                >
                                  Owned: {tools[item.tool]}
                                </span>
                              )}
                              {Object.entries(item.price).map(([res, amount]) => (
                                <span
                                  key={res}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 999,
                                    background: (res === 'coin' ? currency : (inventory[res] ?? 0)) >= amount
                                      ? 'rgba(255,209,102,0.18)'
                                      : 'rgba(255,107,107,0.18)',
                                    color: (res === 'coin' ? currency : (inventory[res] ?? 0)) >= amount
                                      ? '#ffd166'
                                      : '#ff8b8b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                  }}
                                >
                                  {res === 'coin' ? <SvgIcon name="coin" size={10} /> : <SvgIcon name={res} size={10} />}
                                  {amount}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            disabled={owned || !affordable}
                            onClick={() => buyItem(item.id)}
                            style={{
                              flexShrink: 0,
                              padding: '4px 10px',
                              borderRadius: 8,
                              border: 'none',
                              fontSize: 11,
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
                            {owned
                              ? '✓ Owned'
                              : item.kind === 'egg'
                                ? `Buy ×${ownedEggsCount + 1}`
                                : affordable
                                  ? 'Buy'
                                  : '—'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
}
