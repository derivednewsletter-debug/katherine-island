import React, { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { RECIPES, RECIPE_COST, canCraft } from '../data/recipes';
import SvgIcon from './SvgIcon';

const LABELS = {
  berry: 'berry',
  herb: 'herb',
  fruit: 'fruit',
  flower: 'flower',
  wood: 'wood',
};

export default function KitchenHud() {
  const active = useGameStore((s) => s.activeAppliance);
  const inventory = useGameStore((s) => s.inventory);
  const setActive = useGameStore((s) => s.setActiveAppliance);
  const [, refresh] = React.useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => refresh((n) => n + 1), 500);
    const onKey = (e) => e.key === 'Escape' && setActive(null);
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, setActive]);

  if (!active) return null;
  const recipes = RECIPES[active.kind] ?? [];

  return (
    <div style={{ position: 'absolute', right: 238, bottom: 78, width: 250, padding: 14, borderRadius: 16, color: '#fff', background: 'rgba(20, 24, 38, 0.9)', border: '1px solid rgba(255,209,102,0.4)', boxShadow: '0 12px 35px rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', fontFamily: '"Segoe UI", system-ui, sans-serif', zIndex: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SvgIcon name={active.kind} size={18} /> {active.kind === 'stove' ? 'Stove' : 'Grill'}</strong>
        <button onClick={() => setActive(null)} style={{ border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, cursor: 'pointer' }}><SvgIcon name="close" size={14} /></button>
      </div>
      {recipes.map((recipe) => {
        const ready = canCraft(inventory, recipe.id);
        return (
          <div key={recipe.id} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{recipe.emoji}</span>
              <div><div style={{ fontWeight: 800 }}>{recipe.name}</div><div style={{ fontSize: 11, opacity: 0.7 }}>Crafts 1 meal</div></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '8px 0', fontSize: 11, opacity: 0.8 }}>
              {Object.entries({ ...RECIPE_COST[recipe.appliance], ...recipe.inputs }).map(([resource, amount]) => <span key={resource} style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>{amount} {LABELS[resource] ?? resource}</span>)}
            </div>
            <button disabled={!ready} onClick={() => useGameStore.getState().craftMeal(recipe.id)} style={{ width: '100%', padding: '7px 10px', border: 0, borderRadius: 9, cursor: ready ? 'pointer' : 'not-allowed', background: ready ? '#ffd166' : 'rgba(255,255,255,0.12)', color: ready ? '#4a3800' : 'rgba(255,255,255,0.45)', fontWeight: 800 }}>{ready ? 'Cook meal' : 'Need ingredients'}</button>
          </div>
        );
      })}
    </div>
  );
}
