'use strict';

// Rough Chrome tab strip measurements on Windows, in screen-independent pixels.
const STRIP_START = 44; // tab search button before the first tab
const STRIP_END = 360; // new tab button, Gemini button and window controls
const ICON_FROM_RIGHT = 183; // the penguin's toolbar icon, from the window's right edge
const ICON_Y = 63;
const MAX_TAB = 240;
const PINNED_TAB = 40;
const MAXIMIZED_EDGE = 8; // a maximized window hangs this far off the screen
const TAB_MIDDLE = 20;

const NUMBERS = ['left', 'top', 'width', 'index', 'count', 'pinned'];

function cleanStrip(raw) {
  if (!raw || !NUMBERS.every((key) => Number.isFinite(raw[key]))) return null;
  const strip = { state: typeof raw.state === 'string' ? raw.state : 'normal' };
  for (const key of NUMBERS) strip[key] = raw[key];
  return strip;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Where the right end of the tab is, relative to the screen's work area.
function tabTarget(strip, area) {
  if (!strip) return { x: Math.round(area.width / 2), y: TAB_MIDDLE, width: 200 };
  const edge = strip.state === 'maximized' ? MAXIMIZED_EDGE : 0;
  const unpinned = Math.max(1, strip.count - strip.pinned);
  const space = strip.width - edge * 2 - STRIP_START - STRIP_END - strip.pinned * PINNED_TAB;
  const normal = clamp(space / unpinned, 24, MAX_TAB);
  const isPinned = strip.index < strip.pinned;
  const width = isPinned ? PINNED_TAB : normal;
  const right = isPinned
    ? (strip.index + 1) * PINNED_TAB
    : strip.pinned * PINNED_TAB + (strip.index - strip.pinned + 1) * normal;
  const x = strip.left + edge + STRIP_START + right - area.x;
  const y = strip.top + edge + TAB_MIDDLE - area.y;
  return {
    x: Math.round(clamp(x, 0, area.width)),
    y: Math.round(clamp(y, TAB_MIDDLE, area.height - TAB_MIDDLE)),
    width: Math.round(width),
  };
}

// The extension icon in the toolbar, where the kicking penguin comes out.
// Chrome does not tell extensions where their icon is, so this is measured.
function iconSpot(strip, area) {
  if (!strip) return { x: area.width - ICON_FROM_RIGHT, y: ICON_Y };
  const edge = strip.state === 'maximized' ? MAXIMIZED_EDGE : 0;
  const x = strip.left + strip.width - edge - ICON_FROM_RIGHT - area.x;
  const y = strip.top + edge + ICON_Y - area.y;
  return {
    x: Math.round(clamp(x, 0, area.width)),
    y: Math.round(clamp(y, ICON_Y, area.height - TAB_MIDDLE)),
  };
}

// The desktop penguin is placed by the point under the penguin's feet (the anchor).
const PENGUIN_SIZE = { width: 240, height: 300 }; // the see-through window around it
const MINI = { half: 32, height: 100 }; // minimized penguin with its timer

function defaultAnchor(area) {
  return { x: area.x + area.width - 48, y: area.y + area.height - 8 };
}

// Keeps whatever is visible inside the screen, then works out the window position.
function penguinPlace(anchor, area, mini) {
  const half = mini ? MINI.half : PENGUIN_SIZE.width / 2;
  const tall = mini ? MINI.height : PENGUIN_SIZE.height;
  const x = Math.round(clamp(anchor.x, area.x + half, area.x + area.width - half));
  const y = Math.round(clamp(anchor.y, area.y + tall, area.y + area.height));
  return {
    anchor: { x, y },
    bounds: { x: x - PENGUIN_SIZE.width / 2, y: y - PENGUIN_SIZE.height, ...PENGUIN_SIZE },
  };
}

module.exports = { cleanStrip, tabTarget, iconSpot, defaultAnchor, penguinPlace, PENGUIN_SIZE };
