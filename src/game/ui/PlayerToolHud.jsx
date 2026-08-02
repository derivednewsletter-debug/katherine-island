import React from 'react';
import { useGameStore } from '../state/gameStore';
import SvgIcon from './SvgIcon';

/**
 * Player tool bar — bottom-left, above the time controls.
 * Shows the player's avatar, current tool, and lets you switch tools.
 */
export default function PlayerToolHud() {
  const playerTool = useGameStore((s) => s.playerTool);
  const tools = useGameStore((s) => s.tools);
  const setPlayerTool = useGameStore((s) => s.setPlayerTool);
  const currency = useGameStore((s) => s.currency);
  const playerPos = useGameStore((s) => s.playerPos);

  const TOOL_ITEMS = [
    { id: 'axe', name: 'Axe', icon: 'axe', color: '#8d6b4b', durability: tools?.axe },
    { id: 'hoe', name: 'Hoe', icon: 'hoe', color: '#6b4423', durability: tools?.hoe },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
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
        minWidth: 130,
      }}
    >
      {/* Player position */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.8 }}>
        <SvgIcon name="egg" size={12} />
        <span>You: ({playerPos.row}, {playerPos.col})</span>
      </div>

      {/* Tool selection */}
      <div style={{ display: 'flex', gap: 6 }}>
        {TOOL_ITEMS.map((tool) => {
          const equipped = playerTool === tool.id;
          const has = tools?.[tool.id] > 0;
          return (
            <button
              key={tool.id}
              onClick={() => setPlayerTool(tool.id)}
              disabled={!has}
              title={tool.name + (has ? ` (durability: ${tool.durability}/50)` : 'No tool owned!')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 10px',
                borderRadius: 10,
                border: equipped
                  ? '2px solid #ffd166'
                  : has
                    ? '1px solid rgba(255,255,255,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                background: equipped
                  ? 'rgba(255, 209, 102, 0.25)'
                  : has
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                color: has ? '#fff' : 'rgba(255,255,255,0.45)',
                cursor: has ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: equipped ? 700 : 500,
                backdropFilter: 'blur(6px)',
                transition: 'all 0.2s',
                minWidth: 48,
              }}
              onMouseEnter={(e) => has && (e.currentTarget.style.borderColor = '#ffd166')}
              onMouseLeave={(e) => {
                if (has) {
                  e.currentTarget.style.borderColor = equipped
                    ? '#ffd166'
                    : 'rgba(255,255,255,0.3)';
                }
              }}
            >
              <SvgIcon name={tool.icon} size={18} />
              <span>{tool.name}</span>
              {has && (
                <span style={{ opacity: 0.75, fontSize: 9 }}>
                  {tool.durability}/50
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Coins */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.9 }}>
        <SvgIcon name="coin" size={12} />
        <span>{currency} coins</span>
      </div>
    </div>
  );
}
