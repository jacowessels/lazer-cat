// Lazer Cat — guide the laser dot to the finish without getting pounced.
// Plain JS + canvas, no dependencies.
(() => {
'use strict';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
// World units: the board is L units long (start -> finish) and as wide as the
// screen allows. 1 unit ~ a laser-dot's "step".
const L = 18;
// The dot follows the pointer exactly (no speed limit). On touch screens, swipes get
// pointer acceleration like a mouse: slow = precise, fast = the dot travels further.
const TOUCH_ACCEL = 1.6;       // extra gain per (px/ms) of finger speed above TOUCH_ACCEL_FROM
const TOUCH_ACCEL_FROM = 0.25; // px/ms
const TOUCH_GAIN_MAX = 3;
// To finish, the dot must rest calmly on the flag for a moment.
const FINISH_HOLD = 0.8;       // seconds
const FINISH_CALM = 4;         // max dot speed that counts as resting
// (and it only counts while no cat is chasing / about to pounce / mid-air)
const DOT_R = 0.17;
const START_X = 1.6;
const FINISH_X = L - 1.6;
const FINISH_R = 0.75;
const GRACE_TIME = 0;        // seconds at level start where cats don't get excited

// Cat personalities. All distances in world units, times in seconds.
//  sens        how excitable by motion
//  rise/decay  how fast excitement builds up / fades
//  perception  distance at which motion is still very interesting
//  leapRange   max pounce distance
//  windup      butt-wiggle time before a pounce (your warning!)
//  lead        how much it predicts where the dot is going (0..1)
//  homing      mid-air steering (units / second)
//  recover     confused time after a missed pounce
//  iq          0..1: how much it cuts you off on the way to the finish,
//              guards the path, and holds back pointless jumps
//  patience    seconds it will stalk a dot in range before pouncing anyway
//  reflex      extra excitement when a resting dot suddenly moves
const CAT_TYPES = {
  big: {
    name: 'Big Tom', size: 1.55, fur: '#e3913f', stripe: '#b8641f', light: '#f7d6ac', eye: '#9ccc3c', tabby: true,
    sens: 0.3, rise: 1.2, decay: 0.45, perception: 5, stalkSpeed: 0.8, runSpeed: 3.2,
    leapRange: 3.6, leapTime: 0.55, windup: 0.7, lead: 0.85, homing: 1.6, recover: 1.4, turn: 3.5,
    iq: 0.3, patience: 2.5, reflex: 0.25,
  },
  normal: {
    name: 'Mittens', size: 1.15, fur: '#8d9095', stripe: '#5d6066', light: '#f2f2f2', eye: '#f2c53d', tabby: true,
    sens: 0.38, rise: 1.8, decay: 0.4, perception: 6, stalkSpeed: 1.2, runSpeed: 4.3,
    leapRange: 4.0, leapTime: 0.45, windup: 0.5, lead: 0.95, homing: 2.4, recover: 1.0, turn: 5,
    iq: 0.5, patience: 1.8, reflex: 0.35,
  },
  kitten: {
    name: 'Pip', size: 0.8, fur: '#f4e4cf', stripe: '#d8b48a', light: '#ffffff', eye: '#59b6e8',
    sens: 0.55, rise: 3.5, decay: 0.6, perception: 5.5, stalkSpeed: 1.8, runSpeed: 5.8,
    leapRange: 3.2, leapTime: 0.33, windup: 0.3, lead: 0.8, homing: 3, recover: 0.6, turn: 8,
    iq: 0.2, patience: 1.0, reflex: 0.6,
  },
  black: {
    name: 'Shadow', size: 1.2, fur: '#26232a', stripe: '#3a3640', light: '#3a3640', eye: '#f2d23d',
    sens: 0.4, rise: 1.8, decay: 0.3, perception: 7.5, stalkSpeed: 1.4, runSpeed: 5,
    leapRange: 5.0, leapTime: 0.48, windup: 0.42, lead: 1.0, homing: 2.8, recover: 0.9, turn: 6,
    iq: 0.8, patience: 1.5, reflex: 0.4,
  },
  chonk: {
    name: 'Biscuit', size: 1.95, fur: '#f3ede4', stripe: '#d9822b', light: '#ffffff', eye: '#7cc06a', calico: true,
    sens: 0.3, rise: 1.0, decay: 0.5, perception: 5, stalkSpeed: 0.6, runSpeed: 2.4,
    leapRange: 3.4, leapTime: 0.6, windup: 0.6, lead: 0.9, homing: 1.5, recover: 1.6, turn: 3,
    iq: 0.6, patience: 3, reflex: 0.2,
  },
  siamese: {
    name: 'Professor Miso', size: 1.1, fur: '#efe2cc', stripe: '#5a4030', light: '#f8f0e2', eye: '#4fa3f0', points: true,
    sens: 0.45, rise: 2.2, decay: 0.35, perception: 7, stalkSpeed: 1.6, runSpeed: 5.2,
    leapRange: 4.3, leapTime: 0.42, windup: 0.38, lead: 1.05, homing: 3.2, recover: 0.7, turn: 7,
    iq: 1.0, patience: 1.2, reflex: 0.4,
  },
  tuxedo: {
    name: 'Ninja', size: 1.15, fur: '#1f1f22', stripe: '#1f1f22', light: '#ffffff', eye: '#9be06a',
    sens: 0.28, rise: 1.6, decay: 0.25, perception: 8, stalkSpeed: 2.0, runSpeed: 4.6,
    leapRange: 4.6, leapTime: 0.45, windup: 0.33, lead: 1.0, homing: 2.8, recover: 0.8, turn: 6,
    iq: 0.9, patience: 0.8, reflex: 0.5,
  },
};

// x = position along the board (0..L), y = 0..1 across the board.
// sleep: true -> the cat starts asleep and wakes up if the dot gets close or a pounce lands nearby.
const LEVELS = [
  { name: 'Big Lazy Tom', intro: 'One big cat. Move calmly. If he wiggles his bum — get away!',
    goalY: 0.5, hints: true, cats: [{ type: 'big', x: 9, y: 0.5 }] },
  { name: 'Mittens', intro: 'A normal house cat. She will try to get between you and the finish.',
    goalY: 0.3, hints: true, cats: [{ type: 'normal', x: 9, y: 0.45 }] },
  { name: 'Two\'s Company', intro: 'Two cats. One pounce sets the other one off…',
    goalY: 0.7, hints: true, boost: 0.75, cats: [{ type: 'big', x: 6.5, y: 0.3 }, { type: 'normal', x: 12, y: 0.65 }] },
  { name: 'The Kitten', intro: 'Small, fast and extremely twitchy. Sudden moves drive it crazy.',
    goalY: 0.5, cats: [{ type: 'kitten', x: 9, y: 0.5 }] },
  { name: 'Shadow', intro: 'A sharp-eyed black cat with a very long jump.',
    goalY: 0.8, cats: [{ type: 'black', x: 9.5, y: 0.5 }] },
  { name: 'Sleepy Head', intro: 'Biscuit is asleep. Don\'t wake her… and watch out for Mittens.',
    goalY: 0.5, cats: [{ type: 'chonk', x: 8, y: 0.5, sleep: true }, { type: 'normal', x: 13.5, y: 0.25 }] },
  { name: 'The Professor', intro: 'A clever Siamese. Reads your moves and cuts you off.',
    goalY: 0.2, cats: [{ type: 'siamese', x: 10, y: 0.6 }] },
  { name: 'The Family', intro: 'Mum, dad and the kid.',
    goalY: 0.4, cats: [{ type: 'big', x: 5.5, y: 0.7 }, { type: 'kitten', x: 9, y: 0.3 }, { type: 'normal', x: 13, y: 0.6 }] },
  { name: 'Ninja', intro: 'Ninja creeps fast and barely warns before striking.',
    goalY: 0.7, cats: [{ type: 'tuxedo', x: 9, y: 0.35 }] },
  { name: 'Nap Time', intro: 'Three sleeping cats and one very awake kitten.',
    goalY: 0.5, boost: 0.8, cats: [{ type: 'normal', x: 6, y: 0.3, sleep: true }, { type: 'big', x: 9.5, y: 0.7, sleep: true },
      { type: 'black', x: 13, y: 0.35, sleep: true }, { type: 'kitten', x: 11, y: 0.85 }] },
  { name: 'Guard Duty', intro: 'Biscuit guards the finish. The Professor guards the middle.',
    goalY: 0.5, cats: [{ type: 'siamese', x: 8, y: 0.4 }, { type: 'chonk', x: 14, y: 0.5 }] },
  { name: 'The Wall', intro: 'A line of cats across the room. Find the gap.',
    goalY: 0.5, cats: [{ type: 'normal', x: 9, y: 0.15 }, { type: 'tuxedo', x: 9.5, y: 0.5 }, { type: 'normal', x: 9, y: 0.85 }] },
  { name: 'Cat Café', intro: 'Everyone is here.',
    goalY: 0.5, boost: 0.7, cats: [{ type: 'normal', x: 5.5, y: 0.3 }, { type: 'kitten', x: 8, y: 0.75 }, { type: 'black', x: 11, y: 0.35 }, { type: 'big', x: 14, y: 0.7 }] },
  { name: 'Night Shift', intro: 'The three smartest cats in town.',
    goalY: 0.8, cats: [{ type: 'tuxedo', x: 6, y: 0.6 }, { type: 'black', x: 10, y: 0.3 }, { type: 'siamese', x: 13.5, y: 0.65 }] },
  { name: 'Double Trouble', intro: 'Two kittens and their big sister.',
    goalY: 0.25, boost: 0.85, cats: [{ type: 'kitten', x: 6, y: 0.3 }, { type: 'kitten', x: 6.5, y: 0.75 }, { type: 'black', x: 12.5, y: 0.5 }] },
  { name: 'Crazy Cat House', intro: 'Seven cats. Two are asleep. Good luck.',
    goalY: 0.5, boost: 0.85, cats: [{ type: 'kitten', x: 5.5, y: 0.2 }, { type: 'big', x: 6.5, y: 0.75, sleep: true }, { type: 'normal', x: 8.5, y: 0.45 },
      { type: 'chonk', x: 11, y: 0.15, sleep: true }, { type: 'black', x: 11.5, y: 0.8 }, { type: 'tuxedo', x: 14, y: 0.35 }, { type: 'siamese', x: 14.5, y: 0.8 }] },
];

// Difficulty ramp: later levels have more excitable cats.
LEVELS.forEach((lv, i) => { if (lv.boost === undefined) lv.boost = 0.85 + 0.15 * i / (LEVELS.length - 1); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// distance from point (x,y) to segment (ax,ay)-(bx,by)
const segDist = (x, y, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1) : 0;
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
};
const turnTo = (a, target, maxStep) => a + clamp(angDiff(a, target), -maxStep, maxStep);

const store = {
  get(k, d) { try { const v = localStorage.getItem('lazercat.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lazercat.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------------------
// Sound (tiny synth, no files)
// ---------------------------------------------------------------------------
const Sound = {
  ctx: null, on: store.get('sound', true),
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  },
  tone(f0, f1, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  pounce() { this.tone(220, 900, 0.25, 'triangle', 0.1); },
  thud() { this.tone(140, 60, 0.15, 'sine', 0.2); },
  meow() { this.tone(520, 820, 0.18, 'sawtooth', 0.06); this.tone(820, 380, 0.35, 'sawtooth', 0.06, 0.17); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.18, 'square', 0.06, i * 0.11)); },
  mrrp() { this.tone(300, 420, 0.12, 'triangle', 0.08); },
};

// ---------------------------------------------------------------------------
// Layout / coordinate mapping
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { W: 0, H: 0, dpr: 1, U: 40, portrait: false, Wc: 10 };
let floorCache = null;

function layout() {
  view.W = window.innerWidth; view.H = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(view.W * view.dpr);
  canvas.height = Math.round(view.H * view.dpr);
  view.portrait = view.H > view.W * 1.05;
  const long = view.portrait ? view.H : view.W;
  const across = view.portrait ? view.W : view.H;
  view.U = long / L;
  view.Wc = across / view.U;
  floorCache = null;
  if (game.level) clampWorld();
}

// world (x along board, y across) -> CSS pixel
function toScreen(x, y) {
  return view.portrait ? { x: y * view.U, y: view.H - x * view.U } : { x: x * view.U, y: y * view.U };
}
function toWorld(sx, sy) {
  return view.portrait ? { x: (view.H - sy) / view.U, y: sx / view.U } : { x: sx / view.U, y: sy / view.U };
}
function deltaToWorld(dx, dy) {
  return view.portrait ? { x: -dy / view.U, y: dx / view.U } : { x: dx / view.U, y: dy / view.U };
}
function setWorldTransform() {
  const { U, dpr, H } = view;
  if (view.portrait) ctx.setTransform(0, -U * dpr, U * dpr, 0, 0, H * dpr);
  else ctx.setTransform(U * dpr, 0, 0, U * dpr, 0, 0);
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const game = {
  state: 'menu',        // menu | ready | play | won | lost | paused
  levelIndex: 0,
  level: null,
  cats: [],
  dot: null,
  goal: null,
  time: 0,
  playTime: 0,
  unlocked: store.get('unlocked', 1),
  done: store.get('done', []),
  fx: [],
};

function makeCat(spec, Wc) {
  const T = CAT_TYPES[spec.type];
  return {
    T, x: spec.x, y: clamp(spec.y * Wc, 0.6 * T.size + 0.3, Wc - 0.6 * T.size - 0.3),
    a: Math.PI,            // body heading (facing the start)
    head: 0,               // head angle relative to body
    E: 0,                  // excitement 0..1.3
    state: spec.sleep ? 'sleep' : 'watch',
    timer: 0,
    patienceT: 0,
    crouch: spec.sleep ? 1 : 0, wiggle: 0, height: 0,
    leap: null,
    t: Math.random() * 10,
    blink: 2 + Math.random() * 3,
  };
}

function loadLevel(i) {
  game.levelIndex = i;
  game.level = LEVELS[i];
  const Wc = view.Wc;
  game.cats = game.level.cats.map(c => makeCat(c, Wc));
  game.dot = { x: START_X, y: Wc / 2, tx: START_X, ty: Wc / 2, px: START_X, py: Wc / 2, vx: 0, vy: 0, speed: 0 };
  game.hold = 0;
  game.goal = { x: FINISH_X, y: clamp(game.level.goalY * Wc, 1.2, Wc - 1.2) };
  game.time = 0; game.playTime = 0; game.fx = [];
  game.state = 'ready';
  pointer.active = null;
  document.getElementById('hud-title').textContent = `Level ${i + 1} · ${game.level.name}`;
  showIntro();
}

function clampWorld() {
  const Wc = view.Wc;
  const d = game.dot;
  if (d) { d.y = clamp(d.y, 0.3, Wc - 0.3); d.ty = clamp(d.ty, 0.3, Wc - 0.3); }
  if (game.goal) game.goal.y = clamp(game.level.goalY * Wc, 1.2, Wc - 1.2);
  for (const c of game.cats) c.y = clamp(c.y, 0.55 * c.T.size, Wc - 0.55 * c.T.size);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const pointer = { active: null, lastX: 0, lastY: 0, type: 'mouse' };

canvas.addEventListener('pointerdown', e => {
  Sound.init();
  if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
  pointer.type = e.pointerType;
  document.body.classList.toggle('mouse', e.pointerType === 'mouse');
  if (game.state === 'ready') {
    if (e.pointerType === 'mouse') {
      // Mouse: you have to pick up the dot, so it never teleports.
      const w = toWorld(e.clientX, e.clientY);
      if (Math.hypot(w.x - game.dot.x, w.y - game.dot.y) > 1.4) return;
      game.dot.tx = w.x; game.dot.ty = w.y;
    }
    startPlay();
  }
  if (game.state === 'play') {
    pointer.active = e.pointerId;
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.lastT = e.timeStamp;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  e.preventDefault();
});

canvas.addEventListener('pointermove', e => {
  if (game.state !== 'play') return;
  const d = game.dot;
  if (e.pointerType === 'mouse') {
    // Mouse: the dot is exactly where the cursor is.
    const w = toWorld(e.clientX, e.clientY);
    d.tx = w.x; d.ty = w.y;
  } else if (pointer.active === e.pointerId) {
    // Touch / pen: swipe anywhere, the dot moves with your finger (relative),
    // so your finger never hides the dot.
    const mx = e.clientX - pointer.lastX, my = e.clientY - pointer.lastY;
    const ms = Math.max(1, e.timeStamp - (pointer.lastT || e.timeStamp - 16));
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.lastT = e.timeStamp;
    // pointer acceleration: fast swipes throw the dot further
    const fingerSpeed = Math.hypot(mx, my) / ms;
    const gain = Math.min(TOUCH_GAIN_MAX, 1 + Math.max(0, fingerSpeed - TOUCH_ACCEL_FROM) * TOUCH_ACCEL);
    const dw = deltaToWorld(mx * gain, my * gain);
    d.tx += dw.x; d.ty += dw.y;
  }
  d.tx = clamp(d.tx, 0.3, L - 0.3);
  d.ty = clamp(d.ty, 0.3, view.Wc - 0.3);
});

const endPointer = e => { if (pointer.active === e.pointerId) pointer.active = null; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') pauseGame(); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') { if (game.state === 'play') pauseGame(); else if (game.state === 'paused') resumeGame(); }
  if (e.key === 'r' && game.level && game.state !== 'menu') loadLevel(game.levelIndex);
});
window.addEventListener('resize', layout);

// ---------------------------------------------------------------------------
// UI overlays
// ---------------------------------------------------------------------------
const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');

function showPanel(html, handlers = {}) {
  panel.innerHTML = html;
  overlay.classList.add('show');
  for (const [id, fn] of Object.entries(handlers)) {
    const el = panel.querySelector('#' + id);
    if (el) el.addEventListener('click', ev => { Sound.init(); fn(ev); });
  }
}
function hidePanel() { overlay.classList.remove('show'); }

function showMenu() {
  game.state = 'menu';
  document.body.classList.remove('playing');
  document.getElementById('hud-title').textContent = 'Lazer Cat';
  const btns = LEVELS.map((lv, i) => {
    const locked = i >= game.unlocked;
    const done = game.done.includes(i);
    return `<button class="lvl ${done ? 'done' : ''}" data-l="${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒' : (done ? '✓ ' : '')}${i + 1}<small>${lv.name}</small></button>`;
  }).join('');
  showPanel(`
    <h1>LAZER CAT</h1>
    <p class="sub">Get the laser dot to the finish flag and hold it there a moment, without a cat catching it.</p>
    <ul>
      <li><b>Mouse:</b> click the red dot to pick it up, then move the mouse.</li>
      <li><b>Touch:</b> swipe anywhere — the dot follows your finger's movement. Fast swipes throw it further.</li>
      <li>Reach the flag and <b>hold the dot there</b> until the green ring fills. It pauses (orange) while a cat is hunting you.</li>
      <li>Still dot → cats just stare. Slow moves → they crouch and stalk. Fast moves → <b>POUNCE</b>.</li>
      <li>When a cat wiggles its bum, it's about to jump. Move the dot away — and once it's in the air, cut sideways!</li>
      <li>Cats predict where you're going, try to block your path, and won't wait forever if you sit still next to them.</li>
    </ul>
    <div class="levels">${btns}</div>
  `);
  panel.querySelectorAll('.lvl').forEach(b => b.addEventListener('click', () => { Sound.init(); loadLevel(+b.dataset.l); }));
}

function showIntro() {
  const touch = pointer.type !== 'mouse' || matchMedia('(pointer: coarse)').matches;
  showPanel(`
    <h2>Level ${game.levelIndex + 1}: ${game.level.name}</h2>
    <p>${game.level.intro}</p>
    <p class="sub">${touch ? 'Tap Go, then touch the screen and swipe to move the laser.' : 'Click Go, then click the red dot to pick up the laser.'}</p>
    <button class="btn" id="go">Go!</button>
    <button class="btn secondary" id="menu">Levels</button>
  `, { go: () => { hidePanel(); document.body.classList.add('playing'); }, menu: showMenu });
}

function startPlay() {
  game.state = 'play';
  game.time = 0;
  hidePanel();
  document.body.classList.add('playing');
}

function pauseGame() {
  game.state = 'paused';
  showPanel(`<h2>Paused</h2>
    <button class="btn" id="resume">Resume</button>
    <button class="btn secondary" id="restart">Restart</button>
    <button class="btn secondary" id="menu">Levels</button>`,
  { resume: resumeGame, restart: () => loadLevel(game.levelIndex), menu: showMenu });
}
function resumeGame() { game.state = 'play'; hidePanel(); }

function winLevel() {
  game.state = 'won';
  Sound.win();
  const i = game.levelIndex;
  if (!game.done.includes(i)) { game.done.push(i); store.set('done', game.done); }
  game.unlocked = Math.max(game.unlocked, Math.min(LEVELS.length, i + 2));
  store.set('unlocked', game.unlocked);
  const last = i === LEVELS.length - 1;
  setTimeout(() => showPanel(`
    <h2>🎉 Made it!</h2>
    <p>Level ${i + 1} cleared in ${game.playTime.toFixed(1)}s.</p>
    ${last ? '<p><b>You beat every level!</b> The cats are exhausted.</p>' : ''}
    ${last ? '' : '<button class="btn" id="next">Next level</button>'}
    <button class="btn secondary" id="again">Play again</button>
    <button class="btn secondary" id="menu">Levels</button>`,
  { next: () => loadLevel(i + 1), again: () => loadLevel(i), menu: showMenu }), 700);
}

function loseLevel(cat) {
  game.state = 'lost';
  Sound.meow();
  setTimeout(() => showPanel(`
    <h2>😼 Got it!</h2>
    <p>${cat.T.name} caught the laser dot.</p>
    <button class="btn" id="again">Try again</button>
    <button class="btn secondary" id="menu">Levels</button>`,
  { again: () => loadLevel(game.levelIndex), menu: showMenu }), 900);
}

document.getElementById('btn-menu').addEventListener('click', () => {
  Sound.init();
  if (game.state === 'play') pauseGame();
  else if (game.state !== 'menu') showMenu();
});
const soundBtn = document.getElementById('btn-sound');
const refreshSoundBtn = () => { soundBtn.textContent = Sound.on ? '🔊' : '🔇'; };
soundBtn.addEventListener('click', () => { Sound.init(); Sound.on = !Sound.on; store.set('sound', Sound.on); refreshSoundBtn(); });
refreshSoundBtn();

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
function updateDot(dt) {
  const d = game.dot;
  // The dot is exactly where the pointer says (no lag, no speed limit).
  const px = d.x, py = d.y;
  d.px = px; d.py = py;
  d.x = d.tx; d.y = d.ty;
  const ivx = (d.x - px) / dt, ivy = (d.y - py) / dt;
  // Smooth velocity so jittery input doesn't spike the cats.
  const k = 1 - Math.exp(-dt * 12);
  d.vx = lerp(d.vx, ivx, k); d.vy = lerp(d.vy, ivy, k);
  // Speed is smoothed separately so back-and-forth jiggling still counts.
  d.speed = lerp(d.speed, Math.min(40, Math.hypot(ivx, ivy)), k);
  // Sudden start after resting: cats react to that instantly.
  d.startle = false;
  if (d.speed < 0.4) d.still = (d.still || 0) + dt;
  else { if (d.still > 0.4 && d.speed > 2.5) d.startle = true; if (d.speed > 2.5) d.still = 0; }
}

// Where a cat wants to be: smart cats aim ahead of the dot, between it and the finish.
function aimPoint(c) {
  const d = game.dot, g = game.goal, T = c.T;
  const gx = g.x - d.x, gy = g.y - d.y, gd = Math.hypot(gx, gy) || 1;
  const ahead = Math.min(3, gd * 0.5);
  const px = d.x + gx / gd * ahead * 0.7 + d.vx * 0.5 * 0.3;
  const py = d.y + gy / gd * ahead * 0.7 + d.vy * 0.5 * 0.3;
  return { x: lerp(d.x, px, T.iq), y: lerp(d.y, py, T.iq) };
}

function updateCat(c, dt) {
  const T = c.T, d = game.dot;
  c.t += dt;
  c.blink -= dt; if (c.blink < -0.12) c.blink = 2 + Math.random() * 4;
  const dx = d.x - c.x, dy = d.y - c.y, dist = Math.hypot(dx, dy);
  const toDot = Math.atan2(dy, dx);

  // --- excitement ---------------------------------------------------------
  if (c.state === 'watch' || c.state === 'stalk' || c.state === 'chase') {
    const v = Math.max(0, d.speed - 0.15);
    // attention falls off sharply beyond the cat's perception distance
    const prox = 1 / (1 + (dist / T.perception) ** 4);
    // How worked-up the cat "wants" to be. Faster movement is
    // disproportionately exciting; slow movement gets it crouching (~0.35-0.9),
    // sustained fast movement pushes it past 1 = POUNCE.
    let target = T.sens * (v + v * v / 12) * prox;
    // A dot parked right under a cat's nose is very tempting.
    target += 0.6 * Math.max(0, 1 - dist / (1.6 * T.size));
    target *= game.level.boost;
    if (c.state === 'chase' && v < 0.3) target *= 0.5;
    if (d.startle && dist < T.perception) c.E = Math.min(1.5, c.E + T.reflex);
    if (game.time < GRACE_TIME) target = 0;
    // Big stimulus = near-instant reaction, like a real cat.
    const rate = target > c.E ? T.rise * (1 + 2 * Math.max(0, target - 1)) : T.decay;
    c.E = clamp(c.E + (target - c.E) * rate * dt, 0, 1.5);
  }

  // Head always tracks the dot (within neck limits).
  const wantHead = clamp(angDiff(c.a, toDot), -1.2, 1.2);
  c.head = lerp(c.head, wantHead, 1 - Math.exp(-dt * 10));

  const targetCrouch = { sleep: 1, watch: 0, stalk: 0.7, chase: 0.3, windup: 1, leap: 0, recover: 0, caught: 0.4 }[c.state];
  c.crouch = lerp(c.crouch, targetCrouch, 1 - Math.exp(-dt * 6));
  c.wiggle = lerp(c.wiggle, c.state === 'windup' ? 1 : 0, 1 - Math.exp(-dt * 10));

  const move = (speed, ang) => { c.x += Math.cos(ang) * speed * dt; c.y += Math.sin(ang) * speed * dt; };

  const moveTo = (p, speed, turnMul) => {
    const ang = Math.atan2(p.y - c.y, p.x - c.x), pd = Math.hypot(p.x - c.x, p.y - c.y);
    c.a = turnTo(c.a, ang, T.turn * turnMul * dt);
    if (pd > 0.15 && Math.abs(angDiff(c.a, ang)) < 0.8) move(Math.min(speed, pd / dt), c.a);
  };

  // Paw swipe: a dot zipping right under an alert cat's nose gets swatted.
  if ((c.state === 'stalk' || c.state === 'chase' || c.state === 'windup' || (c.state === 'watch' && c.E > 0.15))
      && game.time > GRACE_TIME && segDist(c.x, c.y, d.px, d.py, d.x, d.y) < 0.55 * T.size + DOT_R) {
    c.a = toDot; catchDot(c); return;
  }

  switch (c.state) {
    case 'sleep': {
      c.head = 0; c.E = 0;
      // Wakes up if the dot moves close by.
      // (fast movement wakes it from further away)
      if (game.time > GRACE_TIME && d.speed > 2 && dist < 1.5 * T.size + 1.5 + d.speed * 0.35) wakeUp(c);
      break;
    }

    case 'watch':
      c.a = turnTo(c.a, toDot, T.turn * 0.5 * dt);
      // Clever cats quietly reposition to guard the path to the finish.
      if (T.iq >= 0.5 && dist > T.leapRange * 1.2) {
        const p = aimPoint(c);
        if (Math.hypot(p.x - c.x, p.y - c.y) > 1.5) moveTo(p, T.stalkSpeed * 0.4 * T.iq, 0.6);
      }
      if (c.E >= 0.3) c.state = 'stalk';
      break;

    case 'stalk': {
      const p = aimPoint(c);
      // creep into striking distance, faster when more worked up
      if (dist > T.leapRange * 0.55) moveTo(p, T.stalkSpeed * (0.3 + 0.6 * c.E), 1);
      else c.a = turnTo(c.a, toDot, T.turn * dt);
      // A cat in range won't wait forever, even for a still dot.
      if (dist <= T.leapRange * 0.85 && c.E > 0.5) c.patienceT += dt; else c.patienceT = Math.max(0, c.patienceT - dt);
      if (c.E < 0.2) c.state = 'watch';
      else if (c.E >= 1 || c.patienceT > T.patience) {
        c.patienceT = 0;
        // A very worked-up cat strikes on instinct with less warning.
        if (dist <= T.leapRange) startWindup(c, T.windup * (c.E >= 1.4 ? 0.6 : 1));
        else { c.state = 'chase'; c.timer = 2.5; }
      }
      break;
    }

    case 'chase': {
      const p = aimPoint(c);
      moveTo(p, T.runSpeed, 2.5);
      c.timer -= dt; // chases are short bursts
      if (dist <= T.leapRange * 0.8) startWindup(c, T.windup * 0.5);
      else if (c.E < 0.5 || c.timer <= 0) { c.state = 'stalk'; c.E = Math.min(c.E, 0.6); }
      break;
    }

    case 'windup':
      c.a = turnTo(c.a, toDot, T.turn * 1.5 * dt);
      c.timer -= dt;
      // Smart cats don't waste a jump on a dot that's already out of reach.
      if (T.iq >= 0.7 && dist > T.leapRange * 1.25) { c.state = 'chase'; c.timer = 2; break; }
      if (c.timer <= 0) startLeap(c);
      break;

    case 'leap': {
      const lp = c.leap;
      lp.p += dt / T.leapTime;
      // mid-air steering toward the dot
      const hx = d.x - lp.tx, hy = d.y - lp.ty, hd = Math.hypot(hx, hy);
      if (hd > 1e-6) {
        const s = Math.min(hd, T.homing * dt);
        lp.tx += hx / hd * s; lp.ty += hy / hd * s;
        const ox = lp.tx - lp.x0, oy = lp.ty - lp.y0, od = Math.hypot(ox, oy), max = T.leapRange * 1.15;
        if (od > max) { lp.tx = lp.x0 + ox / od * max; lp.ty = lp.y0 + oy / od * max; }
      }
      const p = Math.min(1, lp.p);
      const e = p * p * (3 - 2 * p);
      c.x = lerp(lp.x0, lp.tx, e); c.y = lerp(lp.y0, lp.ty, e);
      c.height = Math.sin(Math.PI * p);
      c.a = Math.atan2(lp.ty - lp.y0, lp.tx - lp.x0);
      const catchR = 0.3 * T.size + DOT_R;
      if (p > 0.5 && Math.hypot(d.x - c.x, d.y - c.y) < catchR) { catchDot(c); break; }
      if (p >= 1) {
        c.height = 0;
        Sound.thud();
        const near = Math.hypot(d.x - c.x, d.y - c.y) < T.leapRange;
        c.state = 'recover'; c.timer = T.recover * (near ? 0.75 : 1); c.E = near ? 0.45 : 0.25;
        game.fx.push({ kind: 'puff', x: c.x, y: c.y, t: 0 });
        for (const o of game.cats) if (o.state === 'sleep' && Math.hypot(o.x - c.x, o.y - c.y) < 6) wakeUp(o);
      }
      break;
    }

    case 'recover':
      c.timer -= dt;
      // look around confused
      c.head = Math.sin(c.t * 3) * 0.9;
      if (c.timer <= 0) c.state = c.E >= 0.3 ? 'stalk' : 'watch';
      break;

    case 'caught':
      break;
  }

  // keep on the board
  if (c.state !== 'leap') {
    const m = 0.55 * T.size;
    c.x = clamp(c.x, m, L - m);
    c.y = clamp(c.y, m, view.Wc - m);
  }
}

function wakeUp(c) {
  // groggy for a moment ("?"), then very interested
  c.state = 'recover'; c.timer = 0.4; c.E = 0.6; c.patienceT = 0;
  game.fx.push({ kind: 'wake', x: c.x, y: c.y, t: 0 });
  Sound.mrrp();
}

function startWindup(c, time) {
  // Fast-moving prey gets a snap-pounce with hardly any warning,
  // and racing prey a pure reflex pounce with none at all.
  if (game.dot.speed > 8.5) time = 0.05;
  else if (game.dot.speed > 6) time *= 0.6;
  c.state = 'windup'; c.timer = time;
  Sound.mrrp();
}

function startLeap(c) {
  const T = c.T, d = game.dot;
  // predict where the dot is heading (a wild fling doesn't fool it into overshooting)
  const vm = Math.hypot(d.vx, d.vy), vs = vm > 14 ? 14 / vm : 1;
  let tx = d.x + d.vx * vs * T.leapTime * T.lead;
  let ty = d.y + d.vy * vs * T.leapTime * T.lead;
  const ox = tx - c.x, oy = ty - c.y, od = Math.hypot(ox, oy);
  if (od > T.leapRange) { tx = c.x + ox / od * T.leapRange; ty = c.y + oy / od * T.leapRange; }
  c.leap = { x0: c.x, y0: c.y, tx, ty, p: 0 };
  c.state = 'leap';
  Sound.pounce();
  // A pounce startles the other cats a little.
  for (const o of game.cats) if (o !== c && (o.state === 'watch' || o.state === 'stalk') && Math.hypot(o.x - c.x, o.y - c.y) < 6) o.E = Math.min(1.5, o.E + 0.15);
}

function catchDot(c) {
  const d = game.dot;
  c.state = 'caught'; c.height = 0;
  c.x = d.x - Math.cos(c.a) * 0.45 * c.T.size;
  c.y = d.y - Math.sin(c.a) * 0.45 * c.T.size;
  d.tx = d.x; d.ty = d.y;
  loseLevel(c);
}

function separateCats() {
  const cs = game.cats;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    if (a.state === 'leap' || b.state === 'leap') continue;
    const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 0.001;
    const min = (a.T.size + b.T.size) * 0.5;
    if (dd < min) {
      const push = (min - dd) / 2;
      a.x -= dx / dd * push; a.y -= dy / dd * push;
      b.x += dx / dd * push; b.y += dy / dd * push;
    }
  }
}

function update(dt) {
  if (game.state === 'play') {
    game.time += dt; game.playTime += dt;
    updateDot(dt);
    for (const c of game.cats) { updateCat(c, dt); if (game.state !== 'play') break; }
    separateCats();
    if (game.state === 'play') {
      const inside = Math.hypot(game.dot.x - game.goal.x, game.dot.y - game.goal.y) < FINISH_R;
      // The hold only counts while the dot rests and no cat is actively hunting it.
      const hunting = game.cats.some(c => (c.state === 'chase' || c.state === 'windup' || c.state === 'leap')
        && Math.hypot(c.x - game.dot.x, c.y - game.dot.y) < 8);
      game.holdPaused = inside && hunting;
      if (inside && game.dot.speed < FINISH_CALM && !hunting) game.hold += dt;
      else game.hold = inside ? Math.max(0, game.hold - dt) : 0;
      if (game.hold >= FINISH_HOLD) winLevel();
    }
  } else if (game.state === 'ready' || game.state === 'won' || game.state === 'lost') {
    // keep the cats alive-looking
    for (const c of game.cats) {
      c.t += dt;
      c.blink -= dt; if (c.blink < -0.12) c.blink = 2 + Math.random() * 4;
      if (game.state === 'won') c.crouch = lerp(c.crouch, 0, 1 - Math.exp(-dt * 4));
    }
  }
  for (const f of game.fx) f.t += dt;
  game.fx = game.fx.filter(f => f.t < 0.6);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function buildFloor() {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  const { U, dpr, H, Wc } = view;
  if (view.portrait) g.setTransform(0, -U * dpr, U * dpr, 0, 0, H * dpr);
  else g.setTransform(U * dpr, 0, 0, U * dpr, 0, 0);
  // wooden planks running along the board
  const plank = 0.9;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = -plank, row = 0; y < Wc + plank; y += plank, row++) {
    let x = -rnd() * 6;
    while (x < L + 1) {
      const len = 4 + rnd() * 5;
      const shade = 0.85 + rnd() * 0.2;
      g.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(98 * shade)},${Math.round(58 * shade)})`;
      g.fillRect(x, y, len, plank);
      // grain
      g.strokeStyle = 'rgba(60,30,10,0.12)'; g.lineWidth = 0.02;
      for (let k = 0; k < 3; k++) {
        const gy = y + plank * (0.2 + 0.3 * k) + rnd() * 0.1;
        g.beginPath(); g.moveTo(x + 0.2, gy); g.bezierCurveTo(x + len * 0.3, gy + 0.06, x + len * 0.6, gy - 0.06, x + len - 0.2, gy); g.stroke();
      }
      g.strokeStyle = 'rgba(40,20,5,0.55)'; g.lineWidth = 0.035;
      g.strokeRect(x, y, len, plank);
      x += len;
    }
  }
  // vignette
  g.setTransform(1, 0, 0, 1, 0, 0);
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
  floorCache = c;
}

function ellipse(x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), rot, 0, Math.PI * 2);
}

function drawStartAndGoal() {
  const t = performance.now() / 1000;
  // start pad
  ctx.save();
  ctx.setLineDash([0.18, 0.14]); ctx.lineWidth = 0.06; ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.arc(START_X, view.Wc / 2, 0.75, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // finish: checkered disc
  const g = game.goal, r = FINISH_R;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  const n = 6, sq = (2 * r) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#222' : '#f4f4f4';
    ctx.fillRect(-r + i * sq, -r + j * sq, sq, sq);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.lineWidth = 0.08; ctx.strokeStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(0, 0, r + 0.04 + Math.sin(t * 4) * 0.04, 0, Math.PI * 2); ctx.stroke();
  if (game.hold > 0) {
    // "hold it here" progress ring
    ctx.lineWidth = 0.16; ctx.strokeStyle = game.holdPaused ? '#ff9f43' : '#4cd964'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r + 0.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, game.hold / FINISH_HOLD)); ctx.stroke();
  }
  ctx.restore();
}

function drawCatShadowAndHint(c) {
  const s = c.T.size;
  ctx.save();
  ctx.translate(c.x + c.height * 0.35, c.y + c.height * 0.35);
  ctx.fillStyle = `rgba(0,0,0,${0.28 - c.height * 0.12})`;
  ellipse(0, 0, 0.62 * s * (1 - c.height * 0.25), 0.36 * s * (1 - c.height * 0.25), c.a);
  ctx.fill();
  ctx.restore();

  if (game.level.hints && (game.state === 'play' || game.state === 'ready') && c.state !== 'caught' && c.state !== 'sleep') {
    // excitement ring
    const e = clamp(c.E, 0, 1);
    const col = e < 0.35 ? '#7ad36b' : e < 0.75 ? '#ffcc33' : '#ff4b3a';
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.lineWidth = 0.08; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 0.82 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = c.state === 'recover' ? '#7fb2ff' : col;
    ctx.beginPath(); ctx.arc(0, 0, 0.82 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (c.state === 'recover' ? 1 : e)); ctx.stroke();
    // pounce range when getting dangerous
    if ((c.state === 'stalk' && c.E > 0.6) || c.state === 'windup' || c.state === 'chase') {
      ctx.setLineDash([0.2, 0.2]); ctx.lineWidth = 0.04;
      ctx.strokeStyle = 'rgba(255,80,60,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, c.T.leapRange, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCat(c) {
  const T = c.T, s = T.size;
  const cr = c.crouch;
  const flying = c.state === 'leap';
  const scale = 1 + c.height * 0.22;
  const w = c.wiggle * Math.sin(c.t * 26) * 0.08 * s; // butt wiggle

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.a);
  ctx.scale(scale * s, scale * s);
  // everything below in "cat units" (body length ~1.3)

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const outline = 'rgba(0,0,0,0.35)';

  // tail
  const tailSpeed = { sleep: 0.5, watch: 1.5, stalk: 4, chase: 3, windup: 9, leap: 0, recover: 2, caught: 6 }[c.state];
  const tailAmp = { sleep: 0.08, watch: 0.25, stalk: 0.35, chase: 0.15, windup: 0.5, leap: 0, recover: 0.3, caught: 0.6 }[c.state];
  const sw = Math.sin(c.t * tailSpeed) * tailAmp;
  const tailBase = { x: -0.5 - cr * 0.06, y: w / s };
  const tailLen = flying ? 0.85 : 0.75;
  ctx.strokeStyle = outline; ctx.lineWidth = 0.15;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(tailBase.x, tailBase.y);
    ctx.quadraticCurveTo(tailBase.x - tailLen * 0.55, tailBase.y + sw * 0.6,
      tailBase.x - tailLen * 0.9, tailBase.y + sw * 1.4 + (flying ? 0 : 0.15));
  };
  tail(); ctx.stroke();
  ctx.strokeStyle = T.points ? T.stripe : T.fur; ctx.lineWidth = 0.11; tail(); ctx.stroke();
  if (T.tabby) {
    ctx.strokeStyle = T.stripe; ctx.lineWidth = 0.11; ctx.setLineDash([0.06, 0.08]);
    tail(); ctx.stroke(); ctx.setLineDash([]);
  }

  // paws
  ctx.fillStyle = T.light; ctx.strokeStyle = outline; ctx.lineWidth = 0.025;
  const paw = (x, y) => { ellipse(x, y, 0.08, 0.06); ctx.fill(); ctx.stroke(); };
  if (flying) {
    paw(0.62, -0.14); paw(0.62, 0.14);
    paw(-0.62, -0.1 + w / s); paw(-0.62, 0.1 + w / s);
  } else if (c.state === 'caught') {
    paw(0.5, -0.07); paw(0.5, 0.07);
    paw(-0.36, -0.22); paw(-0.36, 0.22);
  } else {
    const spread = 0.2 + cr * 0.05;
    const step = c.state === 'chase' ? Math.sin(c.t * 18) * 0.08 : 0;
    paw(0.34 + step, -spread); paw(0.34 - step, spread);
    paw(-0.36 - step, -spread + w / s); paw(-0.36 + step, spread + w / s);
  }

  // body
  const bodyLen = 0.5 * (1 + cr * 0.1) * (flying ? 1.12 : 1);
  const bodyW = 0.27 * (1 + cr * 0.18) * (flying ? 0.9 : 1);
  ctx.fillStyle = T.fur; ctx.strokeStyle = outline; ctx.lineWidth = 0.03;
  // hips (wiggle)
  ellipse(-0.25, w / s, 0.3, bodyW * 1.04); ctx.fill(); ctx.stroke();
  ellipse(0.05, 0, bodyLen * 0.85, bodyW); ctx.fill(); ctx.stroke();
  ellipse(-0.25, w / s, 0.28, bodyW * 1.0); ctx.fill();
  if (T.calico) {
    ctx.fillStyle = T.stripe; ellipse(-0.3, -0.1, 0.16, 0.11, 0.4); ctx.fill();
    ctx.fillStyle = '#3a3036'; ellipse(0.12, 0.1, 0.13, 0.09, -0.3); ctx.fill();
    ctx.fillStyle = T.stripe; ellipse(0.25, -0.12, 0.08, 0.06); ctx.fill();
  }
  if (T.light === '#ffffff' && T.fur === '#1f1f22') { // tuxedo bib
    ctx.fillStyle = T.light; ellipse(0.32, 0, 0.1, 0.12); ctx.fill();
  }
  if (T.tabby) {
    ctx.strokeStyle = T.stripe; ctx.lineWidth = 0.05;
    for (const sx of [-0.38, -0.2, -0.02, 0.16]) {
      ctx.beginPath();
      ctx.moveTo(sx, -bodyW * 0.85); ctx.quadraticCurveTo(sx + 0.05, 0, sx, bodyW * 0.85);
      ctx.stroke();
    }
    ctx.lineWidth = 0.045;
    ctx.beginPath(); ctx.moveTo(-0.45, 0); ctx.lineTo(0.3, 0); ctx.stroke();
  }

  // head
  const hx = 0.5 - cr * 0.06 + (flying ? 0.08 : 0);
  ctx.save();
  ctx.translate(hx, 0);
  ctx.rotate(c.head);
  // ears (flatten during windup / leap)
  const earBack = clamp(c.wiggle + (flying ? 1 : 0), 0, 1);
  ctx.fillStyle = T.points ? T.stripe : T.fur; ctx.strokeStyle = outline; ctx.lineWidth = 0.025;
  for (const side of [-1, 1]) {
    const bx = 0.02, by = side * 0.17;
    const tipX = lerp(0.1, -0.12, earBack), tipY = side * lerp(0.3, 0.33, earBack);
    ctx.beginPath();
    ctx.moveTo(bx + 0.1, by * 0.7); ctx.lineTo(tipX, tipY); ctx.lineTo(bx - 0.1, by * 0.9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e9a0a0';
    ctx.beginPath();
    ctx.moveTo(bx + 0.06, by * 0.75); ctx.lineTo(lerp(tipX, bx, 0.25), lerp(tipY, by, 0.25)); ctx.lineTo(bx - 0.06, by * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = T.points ? T.stripe : T.fur;
  }
  ctx.fillStyle = T.fur;
  ellipse(0, 0, 0.21, 0.23); ctx.fill(); ctx.stroke();
  if (T.points) { ctx.fillStyle = T.stripe; ellipse(0.09, 0, 0.13, 0.15); ctx.fill(); }
  if (T.tabby) {
    ctx.strokeStyle = T.stripe; ctx.lineWidth = 0.035;
    for (const k of [-0.06, 0, 0.06]) { ctx.beginPath(); ctx.moveTo(-0.12, k); ctx.lineTo(0.0, k * 0.6); ctx.stroke(); }
  }
  // muzzle
  ctx.fillStyle = T.light;
  ellipse(0.13, 0, 0.08, 0.11); ctx.fill();
  // nose
  ctx.fillStyle = '#e57b8a';
  ctx.beginPath(); ctx.moveTo(0.21, 0); ctx.lineTo(0.17, -0.035); ctx.lineTo(0.17, 0.035); ctx.closePath(); ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.012;
  for (const side of [-1, 1]) for (const k of [0, 1, 2]) {
    ctx.beginPath(); ctx.moveTo(0.15, side * 0.06); ctx.lineTo(0.22 + k * 0.02, side * (0.24 + k * 0.05)); ctx.stroke();
  }
  // eyes
  const blinking = c.state === 'sleep' || (c.blink < 0 && c.state !== 'leap' && c.state !== 'windup');
  const dot = game.dot;
  for (const side of [-1, 1]) {
    const ex = 0.06, ey = side * 0.095;
    if (blinking) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.moveTo(ex - 0.03, ey); ctx.lineTo(ex + 0.05, ey); ctx.stroke();
      continue;
    }
    ctx.fillStyle = T.eye;
    ellipse(ex, ey, 0.055, 0.05); ctx.fill();
    // pupils dilate with excitement
    const pr = 0.012 + 0.035 * clamp(c.E, 0, 1) + (c.state === 'windup' || flying ? 0.01 : 0);
    let lx = 0, ly = 0;
    if (dot) {
      // direction to dot in head-local space
      const wa = Math.atan2(dot.y - c.y, dot.x - c.x) - c.a - c.head;
      lx = Math.cos(wa) * 0.015; ly = Math.sin(wa) * 0.015;
    }
    ctx.fillStyle = '#111';
    ellipse(ex + lx + 0.01, ey + ly, Math.min(0.045, pr * 0.8), Math.min(0.045, pr)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ellipse(ex + 0.025, ey - 0.02, 0.012, 0.012); ctx.fill();
  }
  ctx.restore(); // head
  ctx.restore(); // cat
}

function drawLabels() {
  // screen-space text above cats (! when about to pounce, ? when confused)
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of game.cats) {
    let txt = null, col = '#fff';
    if (c.state === 'windup' || c.state === 'chase') { txt = '!'; col = '#ff3b2f'; }
    else if (c.state === 'recover') { txt = '?'; col = '#fff'; }
    else if (c.state === 'sleep') { txt = 'z'; col = '#cfe3ff'; }
    else if (c.state === 'caught') { txt = '♥'; col = '#ff6b8a'; }
    if (!txt) continue;
    const p = toScreen(c.x, c.y);
    const fs = Math.max(18, view.U * 0.7);
    const bob = Math.sin(c.t * 8) * 3;
    let yOff = c.T.size * view.U * 0.85;
    if (p.y - yOff < 56) yOff = -yOff; // near the top edge: show it below the cat
    ctx.font = `900 ${fs}px system-ui, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(txt, p.x, p.y - yOff + bob);
    ctx.fillStyle = col; ctx.fillText(txt, p.x, p.y - yOff + bob);
  }
}

function drawFx() {
  for (const f of game.fx) {
    if (f.kind === 'puff') {
      const k = f.t / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(f.x, f.y, 0.4 + k * 0.9, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'wake') {
      const k = f.t / 0.6;
      ctx.strokeStyle = `rgba(255,220,80,${0.8 * (1 - k)})`; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.arc(f.x, f.y, 0.8 + k * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawLaser() {
  const d = game.dot;
  const t = performance.now() / 1000;
  // faint beam from the player's hand (bottom of the screen)
  const hand = toWorld(view.W / 2, view.H + 40);
  ctx.strokeStyle = 'rgba(255,40,40,0.10)'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(d.x, d.y); ctx.stroke();

  const flick = 1 + Math.sin(t * 40) * 0.05;
  const glow = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 0.55 * flick);
  glow.addColorStop(0, 'rgba(255,60,60,0.75)');
  glow.addColorStop(0.35, 'rgba(255,0,0,0.25)');
  glow.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(d.x, d.y, 0.55 * flick, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff2a2a';
  ctx.beginPath(); ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9d9';
  ctx.beginPath(); ctx.arc(d.x, d.y, DOT_R * 0.45, 0, Math.PI * 2); ctx.fill();

  if (game.state === 'ready') {
    // "pick me up" pulse
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 5)})`; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(d.x, d.y, 0.55 + 0.15 * Math.sin(t * 5), 0, Math.PI * 2); ctx.stroke();
  }
}

function drawReadyHint() {
  if (game.state !== 'ready' || overlay.classList.contains('show')) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const txt = coarse ? 'Touch anywhere and swipe to move the laser' : 'Click the red dot to pick up the laser';
  ctx.font = `700 ${Math.max(15, Math.min(22, view.W / 30))}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const y = 72;
  const w = ctx.measureText(txt).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(view.W / 2 - w / 2, y - 18, w, 36, 18); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(txt, view.W / 2, y);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!floorCache) buildFloor();
  ctx.drawImage(floorCache, 0, 0);
  if (!game.level) return;

  setWorldTransform();
  drawStartAndGoal();
  for (const c of game.cats) drawCatShadowAndHint(c);
  const order = [...game.cats].sort((a, b) => a.height - b.height);
  // dot is drawn under airborne cats but over grounded ones
  for (const c of order) if (c.height <= 0.01) drawCat(c);
  drawLaser();
  for (const c of order) if (c.height > 0.01) drawCat(c);
  drawFx();
  drawLabels();
  drawReadyHint();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

layout();
// Show a cat on the title screen background.
loadLevel(0);
showMenu();
requestAnimationFrame(frame);

// Expose for debugging in the console.
window.lazerCat = { game, LEVELS, CAT_TYPES, update, loadLevel, startPlay };
})();
