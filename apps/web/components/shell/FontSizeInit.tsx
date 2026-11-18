'use client';

import { useEffect } from 'react';

export const FONT_KEY = 'huisafe.fontSize';
export type FontSize = 'normal' | 'large';

/** "Chữ lớn" is 22px instead of 18px (docs/02 section 7 item 2). Stored per browser; applied on the root element. */
export function applyFontSize(v: FontSize) {
  document.documentElement.style.fontSize = v === 'large' ? '22px' : '';
  if (v === 'large') document.documentElement.dataset.font = 'large';
  else delete document.documentElement.dataset.font;
}

export function readFontSize(): FontSize {
  try {
    return localStorage.getItem(FONT_KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal'; // storage blocked: the app just uses the normal size
  }
}

export function FontSizeInit() {
  useEffect(() => applyFontSize(readFontSize()), []);
  return null;
}
