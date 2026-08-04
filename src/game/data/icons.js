/**
 * SVG icon registry — replaces all emoji in the UI.
 * Each icon is a 24x24 viewBox SVG string, rendered inline.
 */

export const ICONS = {
  // Resources
  berry: '<svg viewBox="0 0 24 24" fill="#ff5d7e"><circle cx="12" cy="12" r="5" fill="#ff5d7e"/><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" fill="#ff9eb0"/></svg>',
  shell: '<svg viewBox="0 0 24 24" fill="#ffd9b0"><path d="M7 12c-2 0-4 1-4 4v2c0 1.5 2 2 4 2s4-1 4-2v-2c0-3-2-4-4-4z"/><path d="M17 12c-2 0-4 1-4 4v2c0 1.5 2 2 4 2s4-1 4-2v-2c0-3-2-4-4-4z"/><circle cx="12" cy="8" r="2.5" fill="#ffd9b0"/></svg>',
  stone: '<svg viewBox="0 0 24 24" fill="#aab4bf"><path d="M7 8a4 4 0 1 1-4-4 4 4 0 0 1 7.9 1v1.5A4 4 0 0 1 7 8zm10 0a4 4 0 1 1-4-4 4 4 0 0 1 7.9 1v1.5A4 4 0 0 1 17 8z"/><ellipse cx="5" cy="16" rx="2" ry="1" fill="#aab4bf"/><ellipse cx="19" cy="16" rx="2" ry="1" fill="#aab4bf"/></svg>',
  wood: '<svg viewBox="0 0 24 24" fill="#8d6b4b"><rect x="10" y="4" width="4" height="16" rx="2" fill="#8d6b4b"/><path d="M6 8h4v12H6z" fill="#a67c52"/><path d="M14 6h4v14h-4z" fill="#a67c52"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="#ff9eb0"><circle cx="12" cy="12" r="2" fill="#ffd93d"/><circle cx="12" cy="12" r="4" fill="none" stroke="#ff9eb0" strokeWidth="1"/><path d="M12 4v8m0 0l-3-3m3 3 3-3" stroke="#ff9eb0" strokeWidth="1"/></svg>',
  fruit: '<svg viewBox="0 0 24 24" fill="#b06ad4"><circle cx="8" cy="10" r="3"/><circle cx="16" cy="14" r="3"/><circle cx="12" cy="7" r="2.5"/><path d="M3 18c4-2 8-3 12-3s8 1 12 3" fill="none" stroke="#b06ad4" strokeWidth="1.5"/></svg>',
  herb: '<svg viewBox="0 0 24 24" fill="#8fd694"><path d="M12 4c2 3 3 6 3 9 0 2-1 4-3 5s-3-3-3-5c0-3 1-6 3-9z"/><path d="M9 13c0 1 .5 2 1 3 .5 0 1-1 1-2s-.5-2-1-3h-1zm6-2c0 1-.5 2-1 3-.5 0-1-1-1-2s.5-2 1-3h1z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="#ffd700"><circle cx="12" cy="12" r="8" fill="#ffd700" stroke="#e6c200" strokeWidth="1"/><circle cx="12" cy="12" r="3" fill="#e6c200"/></svg>',

  // Biome/decoration icons
  palm: '<svg viewBox="0 0 24 24" fill="#4ade80"><path d="M12 4L9 12H6l6 4-2 6 6-4 6-4h-3l-3-8z"/></svg>',
  bed: '<svg viewBox="0 0 24 24" fill="#f2b8d0"><path d="M4 8h16v2H4zm0 2h16v8H4zm2 0v6h12v-6m-4-6V4h-4v6h4z"/><circle cx="10" cy="5" r="1" fill="#f2b8d0"/></svg>',

  // Tools
  axe: '<svg viewBox="0 0 24 24" fill="#6b4423"><path d="M18 2l4 4-8 8-4-4 8-8zm-8 8l-6 6v4l2-2 6-6z"/><rect x="6" y="14" width="4" height="2" fill="#6b4423"/></svg>',
  hoe: '<svg viewBox="0 0 24 24" fill="#8d6b4b"><path d="M15 3a3 3 0 0 1 6 0v6a3 3 0 0 1-3 3h-2v-3h1a1 1 0 0 0 0-2h-1V4h1a1 1 0 0 0 0-2h-1V3zm-7 8v10H6V11a2 2 0 0 0-2-2H2v-2h4a2 2 0 0 0 2 2z"/></svg>',

  // Pet care items
  soap: '<svg viewBox="0 0 24 24" fill="#c9a9ff"><rect x="6" y="9" width="12" height="11" rx="3" fill="#c9a9ff" stroke="#a985e0" strokeWidth="1"/><path d="M8 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="#a985e0" strokeWidth="1.5"/><circle cx="10" cy="13" r="1" fill="#e6d9ff"/><circle cx="14" cy="15" r="1.2" fill="#e6d9ff"/><circle cx="12" cy="17" r="0.8" fill="#e6d9ff"/></svg>',
  medkit: '<svg viewBox="0 0 24 24" fill="#ff7b7b"><rect x="5" y="6" width="14" height="14" rx="2" fill="#ff7b7b" stroke="#e05656" strokeWidth="1"/><rect x="9" y="2" width="6" height="5" rx="1" fill="#ff9b9b"/><path d="M12 9v6M9 12h6" stroke="#fff" strokeWidth="2"/></svg>',

  // UI
  shop: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M3 3h18v2H3zM5 7h14l-1 12H6l-1-12zm3 3v7h1v-7zm3 0v7h1v-7zm3 0v7h1v-7z"/></svg>',
  inventory: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M4 4h16v2H4zm2 4h12l-1 12H7l-1-12zm2 2v9h1v-9zm3 0v9h1v-9zm3 0v9h1v-9z"/></svg>',
  farm: '<svg viewBox="0 0 24 24" fill="#4ade80"><path d="M3 13h2v6H3zm4 0h2v6H7zm4 0h2v6h-2zm6-8v8h2v-8h-2z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="#ffd166"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m-8.66-10.34L4 12m16 0l-1.34 1.34M6.34 6.34 6 6l-.34.34M18.34 18.34 18 18l-.34.34M6.34 18.34 6 18l-.34.34M18.34 6.34 18 6l-.34.34"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="#a3e4ff"><path d="M21 12.79A9 9 0 0 1 11.21 3a7 7 0 0 0 0 14 9 9 0 0 0 9-3.21z"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="#a3d4ff"><path d="M8 14c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 8-4 8zm8 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-1.3 4-2 4zm0 2c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 8-4 8z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19.4 11h-2.8a5.9 5.9 0 0 0-.1-1l.7-1.7.7-2.2a.5.5 0 0 0-.3-.6l-2.5-.4a.5.5 0 0 0-.6.4v2.9a5.9 5.9 0 0 0 1 0v2.8zm-4.2 6.1c-.2.1-.4.2-.6.3l-.5 2.9a.5.5 0 0 1-.6.4l-2-.1a.5.5 0 0 1-.4-.3l-.5-2.9c-.2-.3-.3-.5-.3-.8v-3.4a.5.5 0 0 1 .3-.4l2.5-1.1c.2-.1.5 0 .7.3.2.3.1.7-.1 1l-.5 2.9h3.9l.6-3c.1-.3.3-.5.7-.5h2.9a.5.5 0 0 1 0 1l-.6 3c-.2.5-.9 1.2-1.5 1.7z"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-.5-4h1v-4h-1v3a2 2 0 0 0 2 2z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="#f9579b"><path d="M12 21.35l-1.45-1.34C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18.58 4 21 6.42 21 9.5c0 3.78-3.4 6.86-8.55 12.85l-1.45 1.35z"/></svg>',
  egg: '<svg viewBox="0 0 24 24" fill="#fff9e6"><ellipse cx="12" cy="14" rx="3.5" ry="5" fill="#fff9e6" stroke="#ffd166" strokeWidth="0.5"/><path d="M12 5a7 7 0 0 1 5 2 7 7 0 0 1 0 10 5 5 0 0 1-10 0 7 7 0 0 1 0-12 5 5 0 0 1 5-2z" fill="none" stroke="#ffd166" strokeWidth="1"/></svg>',
  sleep: '<svg viewBox="0 0 24 24" fill="#a3e4ff"><path d="M3 13h2v6H3zm4 0h2v6H7zm4 0h2v6h-2zm6-8v8h2v-8h-2z"/></svg>',
  happy: '<svg viewBox="0 0 24 24" fill="#ffd93d"><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/><path d="M12 15c-2 0-3.5 1.5-3.5 3h7c0-1.5-1.5-3-3.5-3z"/></svg>',
  neutral: '<svg viewBox="0 0 24 24" fill="#ffd93d"><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/><path d="M9 16h6v1H9z"/></svg>',
  hungry: '<svg viewBox="0 0 24 24" fill="#ff9f43"><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/><path d="M12 15c-1.8 0-3.2 1.3-3.5 3h7c-.3-1.7-1.7-3-3.5-3z"/><path d="M12 13l1.8-3.2a1 1 0 0 0-3.6 0z" fill="#fff"/></svg>',
  tired: '<svg viewBox="0 0 24 24" fill="#a3e4ff"><path d="M7 6l-2 3 2 3 2-3zM17 6l-2 3 2 3 2-3z" opacity="0.9"/><circle cx="8" cy="12" r="1.4"/><circle cx="16" cy="12" r="1.4"/><path d="M12 18.5a3.2 3.2 0 0 1-3-2h6a3.2 3.2 0 0 1-3 2z" opacity="0.5"/></svg>',
  sick: '<svg viewBox="0 0 24 24" fill="#58c0ff"><circle cx="9" cy="11" r="1.5"/><circle cx="16" cy="11" r="1.5"/><path d="M8 16a4 4 0 0 1 8 0z" fill="#9fe8ff"/><path d="M4 4h5a3 3 0 0 0 6 0h5v2h-5a1 1 0 0 1-1-2h2l-2 6-2-6h2a5 5 0 0 1-5 0 3 3 0 0 1-3-3 1 1 0 0 1 1-1z" transform="translate(0 -1)"/></svg>',
  sad: '<svg viewBox="0 0 24 24" fill="#a3e4ff"><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><path d="M12 17c-2 0-3.5-1.5-3.5-3h7c0 1.5-1.5 3-3.5 3z"/></svg>',
  question: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-.5-4h1v-3h-1v3zm0-4h1v-2h-1v2z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="#ffd93d"><path d="M12 2l10 16H2L12 2zm0 6v4h1v4h-1v-4h1V8h-1zm0 6c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="#4ade80"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 8l-1.41-1.41z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="#ffd700"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27 8.91 8.26z"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M12 20l1.41-1.41L17.17 13H4v-2h13.17l-5.58-5.59L12 4l8 8z"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M10.41 6L6 10.41 7.41 12l5.59-5.59z"/><path d="M14 18h2v-12h-2z"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="#4f8cff"><path d="M13.59 6 18 10.41 16.59 12l-5.59-5.59z"/><path d="M10 18h2V6h-2z"/></svg>',
  waterDrop: '<svg viewBox="0 0 24 24" fill="#3b82f6"><path d="M12 2C8 8 4 11 4 15a8 8 0 0 0 16 0c0-4-4-7-8-13z"/></svg>',
  plant: '<svg viewBox="0 0 24 24" fill="#4ade80"><path d="M12 2l1 4h2l1-4h2v6h-2l1 4-1 4h-2l-1-4-1-4h-2l1-4z"/><rect x="10" y="10" width="4" height="10" fill="#8d6b4b"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="#7ee8fa"><path d="M12 2C7 2 3 6 3 11c0 6.5 9 11 9 11s9-4.5 9-11c0-5-4-9-9-9zm0 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="#9fe8a8"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="#ffd166"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
};
