// Layouts are saved on this device only.
import { Layout } from './track/layout.js';

const KEY = 'toytrains.layout.v1';

export function loadLayout() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.pieces)) return null;
    return new Layout(data);
  } catch {
    return null;
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout.toJSON()));
  } catch {
    /* storage full or blocked: keep running */
  }
}

export function clearLayout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
