import React from 'react';
import { ICONS } from '../data/icons';

/**
 * Renders an SVG icon from the registry as inline SVG.
 * Usage: <SvgIcon name="berry" size={24} />
 */
export default function SvgIcon({ name, size = 20, color, style, onClick }) {
  const svg = ICONS[name] || ICONS.question;

  let svgContent = svg;
  if (color) {
    svgContent = svg.replace(/fill="[^"]*"/g, `fill="${color}"`);
  }

  const processed = svgContent.replace(/<svg /, `<svg style="width: ${size}px; height: ${size}px; display: inline-block; vertical-align: middle;" `);

  return (
    <span
      dangerouslySetInnerHTML={{ __html: processed }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        ...style,
      }}
      onClick={onClick}
    />
  );
}

export { ICONS };
