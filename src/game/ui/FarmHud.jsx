import React, { useEffect, useState } from 'react';
import { useGameStore, weatherOpts } from '../state/gameStore';
import { CROPS, cropById, cropStageIndex, cropProgress, cropWilt } from '../data/crops';
import { getTile, gridToWorld } from '../data/mapData';
import { RESOURCES } from '../data/resources';
import { panTo } from '../state/cameraBus';

/** Stage names for the pill label under each crop's bar. */
const STAGE_LABELS = ['Seed', 'Sprout', 'Grown', 'Ready'];

/**
 * Farm HUD — a floating "🌱 Farm" button (top-left, under Quests) that
 * toggles a glass panel listing EVERY planted crop across the island:
 * its species, the biome it's growing in, a live growth progress bar
 * (driven by the shared game clock), and a fly-to button that glides the
 * camera to that patch via the camera bus — so managing a spread-out
 * orchard is a few clicks instead of a hunt.
 *
 * The panel re-renders on a light 1s tick (cheap) so the progress bars
 * move without subscribing the whole HUD to the per-frame clock.
 */
export default function FarmHud() {
  const farmOpen = useGameStore((s) => s.farmOpen);
  const crops = useGameStore((s) => s.crops);
  const toggleFarm = useGameStore((s) => s.toggleFarm);

  // A gentle local tick so progress bars animate at ~1Hz — the crop list
  // itself only changes on plant/harvest, but time advances every frame.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!farmOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [farmOpen]);

  // Esc closes the panel (same convention as the quest board)
  useEffect(() => {
    if (!farmOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleFarm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [farmOpen, toggleFarm]);

  // Read time + weather together (weather drives the growth math)
  const st = useGameStore.getState();
  const time = st.time;
  const wOpts = weatherOpts(st);
  const raining = !!st.weather?.raining;

  // How many crops are ready to harvest (drives the button badge)
  const readyCount = crops.filter((c) => {
    const def = cropById(c.cropId);
    return def && cropStageIndex(c, time, wOpts) >= def.durations.length;
  }).length;

  // How many crops are wilting right now (drives a second badge)
  const wiltCount = crops.filter((c) => cropWilt(c, time, wOpts) > 0).length;

  // Sort: ready first, then furthest along — what needs attention on top.
  const sorted = [...crops].sort((a, b) => {
    const ra = cropStageIndex(a, time, wOpts);
    const rb = cropStageIndex(b, time, wOpts);
    if (ra !== rb) return rb - ra;
    return cropProgress(b, time, wOpts) - cropProgress(a, time, wOpts);
  });

  const flyTo = (row, col) => {
    const { x, z } = gridToWorld(row, col);
    panTo(x, z, 26);
  };

  // Opening the Farm panel closes the quest board (they share the top-left
  // corner) — mutual exclusion keeps the two panels from stacking.
  const openFarm = () => {
    const st = useGameStore.getState();
    if (st.questBoardOpen) st.toggleQuestBoard();
    st.toggleFarm();
  };

  return (
    <>
      {/* Floating Farm button — under the Quests button (top-left) */}
      <button
        onClick={openFarm}
        style={{
          position: 'absolute',
          top: 164,
          left: 16,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.55)',
          border: farmOpen ? '1px solid rgba(126, 232, 250, 0.7)' : 'none',
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
        🌱 Farm
        {raining && <span style={{ marginLeft: 6, fontSize: 13 }}>🌧️</span>}
        {wiltCount > 0 && (
          <span
            style={{
              marginLeft: 6,
              padding: '1px 7px',
              borderRadius: 999,
              background: 'rgba(255, 176, 107, 0.25)',
              color: '#ffb06b',
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            🥀 {wiltCount}
          </span>
        )}
        {readyCount > 0 && (
          <span
            style={{
              marginLeft: 7,
              padding: '1px 7px',
              borderRadius: 999,
              background: '#7ee8a0',
              color: '#0c3a1e',
              fontSize: 11,
              fontWeight: 800,
              animation: 'hud-count-pop 0.3s ease-out',
            }}
          >
            {readyCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {farmOpen && (
        <div
          style={{
            position: 'absolute',
            top: 210,
            left: 16,
            width: 320,
            maxHeight: 'calc(100vh - 280px)',
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
            <span style={{ fontWeight: 800, fontSize: 15 }}>🌱 Island Farm</span>
            <button
              onClick={toggleFarm}
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
          {crops.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
              {crops.length} crop{crops.length === 1 ? '' : 's'} growing across the island
            </div>
          )}

          {raining && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 11px',
                borderRadius: 10,
                background: 'rgba(126, 232, 250, 0.12)',
                border: '1px solid rgba(126, 232, 250, 0.3)',
                fontSize: 12,
                fontWeight: 700,
                color: '#b8ecff',
              }}
            >
              🌧️ Rain shower — crops are growing at <b>2× speed</b> while it lasts
            </div>
          )}

          {sorted.length === 0 && (
            <div style={{ padding: '18px 8px', textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
              Nothing planted yet — use the 🌱 Plant row to start a patch.
              Berry bushes, flowers, jungle fruit, and mountain herbs all
              show up here as they grow.
            </div>
          )}

          {sorted.map((crop) => {
            const def = CROPS[crop.cropId];
            if (!def) return null;
            const stage = cropStageIndex(crop, time, wOpts);
            const ready = stage >= def.durations.length;
            const pct = Math.round(cropProgress(crop, time, wOpts) * 100);
            const wilted = cropWilt(crop, time, wOpts) > 0;
            const biomeLabel = getTile(crop.row, crop.col)?.label ?? 'Island';

            return (
              <div
                key={crop.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: '9px 11px',
                  borderRadius: 10,
                  background: ready ? 'rgba(126,232,160,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${ready ? 'rgba(126,232,160,0.35)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 20 }}>{def.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{def.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      {biomeLabel} · {ready ? '✨ ready to harvest!' : STAGE_LABELS[stage] ?? 'Growing'}
                      {wilted && !ready && (
                        <span style={{ color: '#ffb06b', fontWeight: 700 }}> · 🥀 wilting</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => flyTo(crop.row, crop.col)}
                    title="Fly to this crop"
                    style={{
                      flexShrink: 0,
                      padding: '5px 10px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: 'rgba(126,232,250,0.18)',
                      color: '#b8ecff',
                      fontFamily: 'inherit',
                      transition: 'background 0.15s, transform 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(126,232,250,0.32)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(126,232,250,0.18)')}
                  >
                    🧭 Fly
                  </button>
                </div>

                {/* Live growth progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.15)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: wilted ? '#ffb06b' : ready ? '#7ee8a0' : def.color,
                        boxShadow: ready ? '0 0 6px rgba(126,232,160,0.7)' : 'none',
                        transition: 'width 0.5s linear',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10, opacity: 0.75, whiteSpace: 'nowrap' }}>{pct}%</span>
                </div>

                {/* Harvest preview */}
                {ready && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Object.entries(def.reward).map(([resource, amount]) => (
                      <span
                        key={resource}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(126,232,160,0.14)',
                          color: '#7ee8a0',
                        }}
                      >
                        {RESOURCES[resource]?.emoji ?? resource} +{amount} — click it to harvest
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
