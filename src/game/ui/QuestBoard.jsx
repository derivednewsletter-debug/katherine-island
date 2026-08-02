import React, { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { questById } from '../data/quests';
import { RESOURCES } from '../data/resources';
import { playQuestClaim } from '../audio/sfx';
import SvgIcon from './SvgIcon';

// Map quest icons from data file to icon registry
const QUEST_ICON_MAP = {
  berry: 'berry',
  heart: 'heart',
  shop: 'shop',
  bed: 'sleep',
  egg: 'egg',
  farm: 'farm',
};

/**
 * Quest board HUD — a floating "📋 Quests" button (top-left, under the
 * title) that toggles a glass panel listing every active quest with a live
 * progress bar. Finished quests show a Claim button that pays the reward
 * into the inventory (with a little chime); claimed quests show ✓ Done.
 */
export default function QuestBoard() {
  const questBoardOpen = useGameStore((s) => s.questBoardOpen);
  const quests = useGameStore((s) => s.quests);
  const toggleQuestBoard = useGameStore((s) => s.toggleQuestBoard);

  // Esc closes the board
  useEffect(() => {
    if (!questBoardOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleQuestBoard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [questBoardOpen, toggleQuestBoard]);

  // How many quests are ready to claim (drives the button badge)
  const claimable = quests.filter((q) => {
    const def = questById(q.id);
    return def && !q.claimed && q.progress >= def.target;
  }).length;

  const claim = (questId) => {
    // Only chime when the reward actually paid out (claimQuestReward returns
    // false for double-clicks / already-claimed quests).
    if (useGameStore.getState().claimQuestReward(questId)) {
      playQuestClaim();
    }
  };

  // Opening the quest board closes the Farm panel (they share the top-left
  // corner) — mutual exclusion keeps the two panels from stacking.
  const openQuestBoard = () => {
    const st = useGameStore.getState();
    if (st.farmOpen) st.toggleFarm();
    st.toggleQuestBoard();
  };

  return (
    <>
      {/* Floating Quests button — under the title overlay (top-left) */}
      <button
        onClick={openQuestBoard}
        style={{
          position: 'absolute',
          top: 118,
          left: 16,
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.55)',
          border: questBoardOpen ? '1px solid rgba(255, 209, 102, 0.7)' : 'none',
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
       <SvgIcon name="question" size={16} /> Quests
        {claimable > 0 && (
          <span
            style={{
              marginLeft: 7,
              padding: '1px 7px',
              borderRadius: 999,
              background: '#ffd166',
              color: '#4a3800',
              fontSize: 11,
              fontWeight: 800,
              animation: 'hud-count-pop 0.3s ease-out',
            }}
          >
            {claimable}
          </span>
        )}
      </button>

      {/* Panel */}
      {questBoardOpen && (
        <div
          style={{
            position: 'absolute',
            top: 164,
            left: 16,
            width: 300,
            maxHeight: 'calc(100vh - 220px)',
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
            <span style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <SvgIcon name="question" size={16} />
              Island Tasks
            </span>
            <button
              onClick={toggleQuestBoard}
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
              <SvgIcon name="close" size={14} />
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Little goals that keep the island humming
          </div>

          {quests.map((q) => {
            const def = questById(q.id);
            if (!def) return null;
            const pct = Math.min(100, (q.progress / def.target) * 100);
            const done = q.progress >= def.target;
            return (
              <div
                key={q.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: '9px 11px',
                  borderRadius: 10,
                  background: q.claimed ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${q.claimed ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
               <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                   <SvgIcon name={QUEST_ICON_MAP[def.id?.split(':')[0]] || 'question'} size={20} />
                   <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{def.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{def.desc}</div>
                  </div>
                  {q.claimed ? (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#7ee8a0', whiteSpace: 'nowrap' }}>
                      Done
                    </span>
                  ) : (
                    <button
                      disabled={!done}
                      onClick={() => claim(q.id)}
                      style={{
                        flexShrink: 0,
                        padding: '5px 11px',
                        borderRadius: 999,
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: done ? 'pointer' : 'not-allowed',
                        background: done ? '#ffd166' : 'rgba(255,255,255,0.12)',
                        color: done ? '#4a3800' : '#8a8a8a',
                        fontFamily: 'inherit',
                        transition: 'background 0.15s, transform 0.1s',
                      }}
                      onMouseEnter={(e) => done && (e.currentTarget.style.background = '#ffe08a')}
                      onMouseLeave={(e) => done && (e.currentTarget.style.background = '#ffd166')}
                    >
                      {done ? 'Claim' : `${q.progress}/${def.target}`}
                    </button>
                  )}
                </div>

                {/* Progress bar (hidden once claimed) */}
                {!q.claimed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 5,
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
                          background: done ? '#7ee8a0' : '#ffd166',
                          transition: 'width 0.25s linear',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10, opacity: 0.75 }}>
                      {q.progress}/{def.target}
                    </span>
                  </div>
                )}

                {/* Reward preview */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Object.entries(def.reward).map(([resource, amount]) => (
                    <span
                      key={resource}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 999,
                        background: 'rgba(255,209,102,0.14)',
                        color: '#ffd166',
                      }}
                    >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <SvgIcon name={res === 'coin' ? 'coin' : res} size={12} />
                    <span>+{amount}</span>
                  </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
