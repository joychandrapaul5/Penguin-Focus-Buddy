'use strict';

const { isBlocked } = require('./blocklist');

const MIN_RETURN_MS = 3000;
const KICK_MS = 10000; // time given to reach the tab, wait for its page and close it

// Timer and distraction rules. No Electron code here, so it can be tested on its own.
class FocusEngine {
  constructor(getSettings, now = Date.now) {
    this.getSettings = getSettings;
    this.now = now;
    this.phase = 'idle'; // idle | focus | break
    this.endsAt = 0;
    this.active = null; // { tabId, host } currently in front in the browser
    this.deadlines = new Map(); // "tabId|host" -> time the tab gets closed
    this.closedCount = 0;
    this.kicking = new Map(); // "tabId|host" -> ignore repeat reports until this time
    this.allowed = new Set(); // "tabId|host" brought back by the user, left alone this round
  }

  startFocus() {
    const front = this.active && { ...this.active, restored: false }; // a new round, a clean slate
    this.phase = 'focus';
    this.endsAt = this.now() + this.getSettings().focusMinutes * 60000;
    this.deadlines.clear();
    this.kicking.clear();
    this.allowed.clear();
    this.closedCount = 0;
    this.active = null;
    this.setActive(front);
  }

  startBreak() {
    this.phase = 'break';
    this.endsAt = this.now() + this.getSettings().breakMinutes * 60000;
    this.deadlines.clear();
  }

  stop() {
    this.phase = 'idle';
    this.endsAt = 0;
    this.deadlines.clear();
  }

  setActive(active) {
    const previous = this.active ? this.key(this.active) : null;
    this.active = active && active.host ? active : null;
    if (this.phase === 'focus' && this.active && this.active.restored) this.allowed.add(this.key(this.active));
    if (this.phase !== 'focus' || !this.currentIsBlocked()) return;
    const key = this.key(this.active);
    const grace = this.getSettings().graceSeconds * 1000;
    const existing = this.deadlines.get(key);
    // Leaving and coming back does not restart the countdown.
    let deadline = existing === undefined ? this.now() + grace : existing;
    if (existing !== undefined && previous !== key) {
      deadline = Math.max(existing, this.now() + Math.min(MIN_RETURN_MS, grace));
    }
    this.deadlines.set(key, deadline);
  }

  currentIsBlocked() {
    return Boolean(this.active) && !this.allowed.has(this.key(this.active))
      && isBlocked(this.active.host, this.getSettings().blockedSites);
  }

  isBeingKicked() {
    return this.kicking.get(this.key(this.active)) > this.now();
  }

  key(active) {
    return active.tabId + '|' + active.host;
  }

  // Call about 4 times a second. Returns the events that just happened.
  tick() {
    const events = [];
    const time = this.now();
    if (this.phase === 'focus' && time >= this.endsAt) {
      this.startBreak();
      events.push({ type: 'break-started' });
    } else if (this.phase === 'break' && time >= this.endsAt) {
      this.stop();
      events.push({ type: 'break-ended' });
    } else if (this.phase === 'focus' && this.currentIsBlocked() && !this.isBeingKicked()) {
      const key = this.key(this.active);
      const deadline = this.deadlines.get(key);
      if (deadline === undefined) {
        this.deadlines.set(key, time + this.getSettings().graceSeconds * 1000); // site was added while the tab was open
      }
      if (time >= this.deadlines.get(key)) {
        events.push({
          type: 'close-tab', tabId: this.active.tabId, host: this.active.host, strip: this.active.strip,
        });
        this.deadlines.delete(key);
        this.kicking.set(key, time + KICK_MS);
        this.active = null;
        this.closedCount += 1;
      }
    }
    return events;
  }

  snapshot() {
    const time = this.now();
    let warning = null;
    if (this.phase === 'focus' && this.currentIsBlocked() && !this.isBeingKicked()) {
      const deadline = this.deadlines.get(this.key(this.active));
      if (deadline !== undefined && deadline > time) {
        warning = { host: this.active.host, seconds: Math.max(0, Math.ceil((deadline - time) / 1000)) };
      }
    }
    return {
      phase: this.phase,
      secondsLeft: this.phase === 'idle' ? 0 : Math.max(0, Math.ceil((this.endsAt - time) / 1000)),
      warning,
      closedCount: this.closedCount,
    };
  }
}

module.exports = { FocusEngine };
