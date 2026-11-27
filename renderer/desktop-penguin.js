'use strict';

const $ = (id) => document.getElementById(id);
const primary = $('primary');
const stopButton = $('stop');

let state = null;
let flash = null; // short message after a tab is closed

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function render() {
  if (!state) return;
  const { phase, warning, secondsLeft, connected, serverError, settings, closedCount } = state;
  const mood = warning ? 'warn' : phase;
  if (document.body.className !== mood) document.body.className = mood;

  let message;
  if (serverError) message = serverError;
  else if (warning) message = `Hey! ${warning.host} can wait. Closing it in ${warning.seconds}s.`;
  else if (phase === 'focus' && flash && flash.until > Date.now()) message = flash.text;
  else if (phase === 'focus') {
    if (!connected) message = 'Browser extension is not connected, so I cannot guard your tabs.';
    else message = closedCount ? `Focusing. Distractions closed: ${closedCount}` : 'Focusing. I am watching your tabs.';
  } else if (phase === 'break') message = 'Break time! Stretch and rest your eyes.';
  else message = 'Hi! Ready to focus?';

  setText($('message'), message);
  $('timer').hidden = phase === 'idle';
  setText($('timer'), clock(secondsLeft));
  setText(primary, phase === 'focus' ? 'Break' : phase === 'break' ? 'Focus again' : `Focus ${settings.focusMinutes} min`);
  stopButton.hidden = phase === 'idle';

  const mini = settings.penguinMinimized;
  document.documentElement.classList.toggle('mini', mini);
  // When minimized, the penguin itself is the button that brings everything back.
  const penguin = $('penguin');
  penguin.querySelector('title').textContent = mini ? 'Click to show, drag to move' : 'Drag to move';
  const chip = $('chip');
  chip.hidden = !mini || (phase === 'idle' && !serverError);
  setText(chip, serverError ? '!' : warning ? `${warning.seconds}s` : clock(secondsLeft));
}

primary.addEventListener('click', () => window.buddy.action(state && state.phase === 'focus' ? 'break' : 'start'));
stopButton.addEventListener('click', () => window.buddy.action('stop'));
$('settings').addEventListener('click', () => window.buddy.openSettings());

// Only the penguin and bubble catch the mouse; the rest of the window is click-through.
const penguinArt = $('penguin');
const DRAG_START = 4; // pixels: a smaller movement counts as a click
let passthrough = true;
let drag = null;

function setPassthrough(value) {
  if (value === passthrough) return;
  passthrough = value;
  window.buddy.setPassthrough(value);
}

document.addEventListener('mousemove', (event) => {
  if (!drag) setPassthrough(!event.target.closest('.hit'));
});
document.addEventListener('mouseleave', () => { if (!drag) setPassthrough(true); });

penguinArt.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  drag = { x: event.screenX, y: event.screenY, dx: 0, dy: 0, moved: false };
  penguinArt.setPointerCapture(event.pointerId);
  window.buddy.dragStart();
});
penguinArt.addEventListener('pointermove', (event) => {
  if (!drag) return;
  drag.dx = event.screenX - drag.x;
  drag.dy = event.screenY - drag.y;
  if (Math.hypot(drag.dx, drag.dy) >= DRAG_START) drag.moved = true;
  if (drag.moved) window.buddy.dragMove(drag.dx, drag.dy);
});
penguinArt.addEventListener('pointerup', () => {
  if (!drag) return;
  const { dx, dy, moved } = drag;
  drag = null;
  if (moved) window.buddy.dragEnd(dx, dy);
  else if (state && state.settings.penguinMinimized) window.buddy.setMinimized(false);
});
penguinArt.addEventListener('pointercancel', () => { drag = null; });

$('minimize').addEventListener('click', () => window.buddy.setMinimized(true));
$('chip').addEventListener('click', () => window.buddy.setMinimized(false));

window.buddy.onState((next) => { state = next; render(); });
window.buddy.onClosed((host) => { flash = { text: `Closed ${host}. Back to work!`, until: Date.now() + 4000 }; });
window.buddy.getState().then((next) => { state = next; render(); });
