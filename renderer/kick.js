'use strict';

const $ = (id) => document.getElementById(id);
const walker = $('walker');
const pose = $('pose');
const spark = $('spark');
const ghost = $('ghost');
const SMALL = 0.38; // size of the penguin up at the tab strip

// Milliseconds. The kick lands about 1 to 1.5 seconds after the tab opens.
const TIME = { pop: 170, jump: 220, lunge: 130, recover: 200, cheer: 220, back: 260 };
const TINY = 0.12; // the size of the toolbar icon

// Longer walks take longer, within limits, so it always looks like walking.
const walkTime = (from, to) => Math.min(1000, Math.max(450, Math.abs(from.x - to.x) * 1.6));

let running = [];
let clearTimer = null;

const at = (p, scale, sx = 1, sy = 1) => `translate(${p.x}px, ${p.y}px) scale(${scale * sx}, ${scale * sy})`;

function move(element, frames, duration, easing = 'linear') {
  const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
  running.push(animation);
  return animation.finished;
}

// An arc through the air with a stretch on take-off and a squash on landing.
function jump(from, to, fromScale, toScale, duration) {
  const lift = Math.min(90, Math.max(20, Math.min(from.y, to.y) - 40));
  const frames = [];
  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * lift,
    };
    const stretch = i === steps ? 0 : Math.sin(Math.PI * t) * 0.14;
    frames.push({ transform: at(point, fromScale + (toScale - fromScale) * t, 1 - stretch, 1 + stretch) });
  }
  return move(walker, frames, duration, 'ease-in-out');
}

async function squash(point, scale, duration) {
  await move(walker, [
    { transform: at(point, scale) },
    { transform: at({ x: point.x, y: point.y + 12 * scale }, scale, 1.2, 0.78) },
    { transform: at(point, scale) },
  ], duration);
}

function hitEffects(host, target, tabWidth) {
  spark.hidden = false;
  move(spark, [
    { transform: `translate(${target.x}px, ${target.y}px) scale(.4)`, opacity: 1 },
    { transform: `translate(${target.x}px, ${target.y}px) scale(1.4) rotate(30deg)`, opacity: 0 },
  ], 380, 'ease-out');

  // A copy of the tab spins away across the screen.
  const ghostWidth = Math.max(110, tabWidth);
  const start = { x: Math.max(0, target.x - ghostWidth), y: Math.max(0, target.y - 17) };
  const side = start.x > 420 ? -1 : 1; // fly toward the side with room
  $('host').textContent = host;
  ghost.style.width = `${ghostWidth}px`;
  ghost.hidden = false;
  const spin = (x, y, turn) => `translate(${start.x + x}px, ${start.y + y}px) rotate(${turn}deg)`;
  return move(ghost, [
    { transform: spin(0, 0, 0), opacity: 1 },
    { transform: spin(side * 190, 60, side * 200), opacity: 1, offset: 0.35 },
    { transform: spin(side * 360, 230, side * 460), opacity: 1, offset: 0.65 },
    { transform: spin(side * 480, 560, side * 760), opacity: 0 },
  ], 850, 'cubic-bezier(.2, .65, .55, 1)');
}

function reset() {
  for (const animation of running) animation.cancel();
  running = [];
  pose.className = '';
  document.body.className = 'warn';
  walker.hidden = true;
  spark.hidden = true;
  ghost.hidden = true;
}

async function kick({ host, target, door }) {
  clearTimeout(clearTimer);
  reset();
  const edge = window.innerWidth - 60;
  const y = Math.max(target.y + 16, 34); // keep the whole penguin on screen
  const start = { x: Math.min(door.x + 80, edge), y }; // right end of the tab bar
  const ready = { x: Math.min(target.x + 70, edge), y };
  const hit = { x: Math.min(target.x + 34, edge), y: y - 4 };

  walker.style.transform = at(door, TINY);
  walker.hidden = false;

  // 1. Pop out of the toolbar icon.
  await move(walker, [
    { transform: at(door, TINY) },
    { transform: at(door, SMALL * 1.15), offset: 0.7 },
    { transform: at(door, SMALL * 0.9) },
  ], TIME.pop, 'ease-out');

  // 2. Hop up to the tab bar.
  pose.className = 'side';
  await jump(door, start, SMALL * 0.9, SMALL, TIME.jump);

  // 3. Walk along the tab bar to the tab.
  pose.className = 'side walking';
  await move(walker, [{ transform: at(start, SMALL) }, { transform: at(ready, SMALL) }], walkTime(start, ready));

  // 4. Flying kick: lean right back so the foot meets the tab.
  pose.className = 'side kicking';
  await Promise.all([
    move(walker, [{ transform: at(ready, SMALL) }, { transform: at(hit, SMALL) }], TIME.lunge, 'ease-in'),
    move(pose, [{ transform: 'rotate(-12deg)' }, { transform: 'rotate(88deg)' }], TIME.lunge, 'ease-in'),
  ]);
  window.buddy.kickImpact();
  const flight = hitEffects(host, target, target.width);

  // 5. Land and cheer.
  await move(walker, [{ transform: at(hit, SMALL) }, { transform: at(ready, SMALL) }], TIME.recover, 'ease-out');
  await move(pose, [{ transform: 'rotate(88deg)' }, { transform: 'rotate(0deg)' }], 120, 'ease-out');
  pose.className = '';
  document.body.className = 'break'; // happy face
  await squash(ready, SMALL, TIME.cheer);

  // 6. Walk back and slip into the icon again.
  pose.className = 'side walking back';
  await move(walker, [{ transform: at(ready, SMALL) }, { transform: at(start, SMALL) }], walkTime(ready, start));
  pose.className = '';
  await jump(start, door, SMALL, TINY, TIME.back);
  walker.hidden = true;
  await flight;
  window.buddy.kickDone();
  clearTimer = setTimeout(reset, 100); // leave the overlay empty for the next kick
}

// A new kick cancels the animations of the one before, which is expected.
window.buddy.onKick((plan) => kick(plan).catch((error) => {
  if (error.name !== 'AbortError') throw error;
}));
