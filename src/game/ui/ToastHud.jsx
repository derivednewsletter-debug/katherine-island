import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';

/**
 * Transient HUD toast — renders the store's latest `toast` message
 * (harvest feedback, "not ready yet" hints, etc.) with a pop-in and fade.
 * Keyed by toast id so a new message re-triggers the animation.
 */
export default function ToastHud() {
  const toast = useGameStore((s) => s.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div key={toast.id} className={visible ? 'toast toast-show' : 'toast'}>
      {toast.text}
    </div>
  );
}
