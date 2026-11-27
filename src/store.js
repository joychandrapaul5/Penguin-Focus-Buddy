'use strict';

const fs = require('fs');
const path = require('path');
const { cleanList } = require('./blocklist');

const DEFAULTS = Object.freeze({
  focusMinutes: 25,
  breakMinutes: 5,
  graceSeconds: 0, // 0 = kick the tab at once
  blockedSites: ['facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'x.com'],
  penguinMinimized: false,
  penguinPosition: null, // null = bottom right corner
});

function clamp(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (value === '' || value === null || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
}

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    focusMinutes: clamp(data.focusMinutes, 1, 180, DEFAULTS.focusMinutes),
    breakMinutes: clamp(data.breakMinutes, 1, 60, DEFAULTS.breakMinutes),
    graceSeconds: clamp(data.graceSeconds, 0, 120, DEFAULTS.graceSeconds),
    blockedSites: cleanList(Array.isArray(data.blockedSites) ? data.blockedSites : DEFAULTS.blockedSites),
    penguinMinimized: data.penguinMinimized === true,
    penguinPosition: cleanPoint(data.penguinPosition),
  };
}

class Store {
  constructor(folder) {
    this.file = path.join(folder, 'settings.json');
    this.isNew = !fs.existsSync(this.file); // true on the very first run
    try {
      this.settings = sanitize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      this.settings = sanitize({});
    }
  }

  save(next) {
    this.settings = sanitize({ ...this.settings, ...next });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.settings, null, 2));
    return this.settings;
  }
}

module.exports = { Store, sanitize, DEFAULTS };
