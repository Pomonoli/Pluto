// Castle Defense — canvasrenderer voor de authoritatieve serversnapshots.
// Elk tijdperk heeft een eigen getekende wereld (achtergrond, basis, toren, figuren) met inktlijn.
// ---------- World constants ----------
export const W = 1400, H = 584;
export const GROUND_Y = 460;
export const P_CASTLE_X = 105, E_CASTLE_X = W - 105;
export const MAX_LEVEL = 10;
export const MAX_TURRETS = 3;
export const MAX_QUEUE = 5;
export const MAX_WORKERS = 5;
export const MINE_X = 430;

export const PLAYER_COLOR = '#4f7942', PLAYER_SHADE = '#2e4a24';
export const ENEMY_COLOR = '#9b3b35', ENEMY_SHADE = '#5c1f1b';
const INK = '#3a2418';
const SKIN = '#c98e64', HAIR = '#3b2a1e';

export const ERA_NAMES = ['Prehistorie', 'Klassieke Oudheid', 'Middeleeuwen', 'Renaissance', 'Verlichting', 'Moderne Tijd', 'Huidige Tijd'];
export const ERA_SHORT = ['Prehistorie', 'Oudheid', 'Middeleeuwen', 'Renaissance', 'Verlichting', 'Modern', 'Huidig'];
export const ERA_ICON = ['🪨', '🏛️', '🏰', '🎨', '🎩', '🪖', '🛰️'];
export const ROLES = ['melee', 'ranged', 'heavy', 'hero'];
export const ROLE_LABEL = { melee: 'Infanterie', ranged: 'Schutter', heavy: 'Zwaar', hero: 'Held', worker: 'Werker' };
export const ROLE_ICON = { melee: '⚔️', ranged: '🏹', heavy: '🐘', hero: '👑', worker: '⛏️' };
export const HERO_NAMES = ['Stamhoofd', 'Kampioen', 'Kruisridder', 'Condottiere', 'Veldmaarschalk', 'Commandant', 'Operator'];
export const TURRET_TYPES = ['near', 'far', 'bonus'];
export const TURRET_LABEL = { near: 'Nabij', far: 'Ver', bonus: 'Banier' };
export const TURRET_ICON = { near: '🎯', far: '💣', bonus: '🚩' };
export const TURRET_HINT = { near: 'Kort bereik, hoge schade', far: 'Artillerie, lang bereik', bonus: '+15% schade en ontginning' };
export const WALL_NAMES = [
  ['Palissade', 'Dubbele palissade', 'Aarden wal'], ['Palissade', 'Stenen muur', 'Muur met gracht'], ['Palissade', 'Ringmuur', 'Slotgracht'],
  ['Aarden wal', 'Bastionmuur', 'Gracht'], ['Aarden wal', 'Bastionmuur', 'Gracht'], ['Prikkeldraad', 'Loopgraaf', 'Tankgracht'], ['Barrières', 'Hesco-muur', 'Antitankgracht']
];
export const UNIT_NAMES = [
  { melee: 'Knuppelman', ranged: 'Slingeraar', heavy: 'Mammoetruiter' },
  { melee: 'Hopliet', ranged: 'Boogschutter', heavy: 'Strijdwagen' },
  { melee: 'Hellebaardier', ranged: 'Kruisboogschutter', heavy: 'Ridder' },
  { melee: 'Piekenier', ranged: 'Haakbusschutter', heavy: 'Kanon' },
  { melee: 'Grenadier', ranged: 'Musketier', heavy: 'Dragonder' },
  { melee: 'Infanterist', ranged: 'Scherpschutter', heavy: 'Tank' },
  { melee: 'Stormtroeper', ranged: 'Sluipschutter', heavy: 'Pantservoertuig' }
];
export const TURRET_NAMES = ['Speerwerper', 'Ballista', 'Katapult', 'Kanon', 'Houwitser', 'Mitrailleurnest', 'Raketwerper'];
export const SPECIAL_NAMES = ['Steenregen', 'Pijlenregen', 'Katapultsalvo', 'Kanonsalvo', 'Musketsalvo', 'Artilleriebarrage', 'Drone-aanval'];
// Per era: sky, distant ridge, hills, grass band, dirt gradient and the kind of static backdrop.
export const ERA_THEME = [
  { kind: 'paper', sky: ['#e3cfae', '#efe0c4'], far: '#c9ab88', hill: '#b8987a', grass: '#8a5f42', dirt: ['#6e4a32', '#4a3021'] },
  { kind: 'mosaic', sky: ['#e6ded0', '#d9cfbd'], far: null, hill: null, grass: '#b3afa4', dirt: ['#a8a49a', '#8d897f'] },
  { kind: 'sky', sky: ['#6fb8e0', '#cbe8f1'], far: '#5f8a66', hill: '#7fb35a', grass: '#6a9a44', dirt: ['#6b4a30', '#43301f'] },
  { kind: 'sky', sky: ['#bcd3e0', '#eee9dc'], far: '#8f9a80', hill: '#9fb36a', grass: '#8aa252', dirt: ['#8a6a45', '#5a4128'] },
  { kind: 'sky', sky: ['#a9c6dc', '#e9eee8'], far: '#8a9a7a', hill: '#8fb060', grass: '#7f9f4c', dirt: ['#6a5540', '#3f3327'] },
  { kind: 'sky', sky: ['#98a79a', '#d3d8ca'], far: '#6b7a5a', hill: '#8f9a58', grass: '#a3a05c', dirt: ['#5a4a3a', '#35291f'] },
  { kind: 'desert', sky: ['#cfdbe2', '#eae6d8'], far: '#b9bfc2', hill: '#cbb489', grass: '#d2b98a', dirt: ['#b89a6c', '#8f7550'] }
];

// ---------- Formulas (mirror of simulation.js, only what the HUD needs) ----------
export const ROLE_DEFS = {
  melee: { cost: 25, train: 1.8, hint: 'Sterk tegen schutters' },
  ranged: { cost: 40, train: 2.4, hint: 'Sterk tegen zwaar' },
  heavy: { cost: 90, train: 4.5, hint: 'Sterk tegen infanterie' },
  hero: { cost: 160, train: 6, hint: 'Eén tegelijk, geen zwakte' },
  worker: { cost: 30, train: 1.5, hint: 'Ontgint goud in het veld' }
};
export function mineRate(era) { return Math.round(1.2 * eraMult(era) * 10) / 10; }
const EVOLVE_XP = [120, 260, 450, 700, 1000, 1400];
export function eraMult(era) { return Math.pow(1.75, era); }
export function unitCost(role, era) { return Math.round(ROLE_DEFS[role].cost * eraMult(era)); }
export function castleMaxHp(lv, era) { return Math.round((900 + (lv - 1) * 120) * eraMult(era)); }
export function goldRate(lv, era) { return Math.round((3 + (lv - 1) * 0.6) * eraMult(era) * 10) / 10; }
export function costWalls(lv, era) { return Math.round(80 * Math.pow(1.5, lv - 1) * eraMult(era)); }
export function costEconomy(lv, era) { return Math.round(70 * Math.pow(1.5, lv - 1) * eraMult(era)); }
export function costTurret(count, era) { return Math.round(120 * Math.pow(1.6, count) * eraMult(era)); }
export function evolveXp(era) { return EVOLVE_XP[era] ?? Infinity; }
export function abilityCost(key, era) { return Math.round({ rally: 60, special: 140 }[key] * eraMult(era)); }

export function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(n);
}
export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function seeded(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

export function createBattle({ canvas }) {
  let ctx = canvas.getContext('2d');
  const screen = ctx;
  let state = null, stopped = false, onFrame = null;
  const now = () => (state ? state.elapsed : 0);
  const team = (side) => (side === 'player' ? PLAYER_COLOR : ENEMY_COLOR);
  const teamShade = (side) => (side === 'player' ? PLAYER_SHADE : ENEMY_SHADE);

  // ---------- Ink helpers ----------
  function ink(color, width = 1.8) { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.stroke(); }
  function limb(x1, y1, x2, y2, color, w = 5.5) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  function rect(x, y, w, h, color, lw = 1.6) { ctx.beginPath(); ctx.rect(x, y, w, h); ink(color, lw); }
  function circle(x, y, r, color, lw = 1.6) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ink(color, lw); }
  function poly(points, color, lw = 1.6) { ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ink(color, lw); }

  // ---------- Static backdrop (cached per era pair) ----------
  const farY = (x) => GROUND_Y - 130 + Math.sin(x / 90) * 18 + Math.sin(x / 37) * 6;
  const hillY = (x) => GROUND_Y - 70 + Math.sin(x / 160 + 1) * 22 + Math.sin(x / 55) * 5;
  function ridge(fn, xa, xb) {
    ctx.beginPath(); ctx.moveTo(xa, GROUND_Y + 1);
    for (let x = xa; x <= xb; x += 10) ctx.lineTo(x, fn(x));
    ctx.lineTo(xb, fn(xb)); ctx.lineTo(xb, GROUND_Y + 1); ctx.closePath(); ctx.fill();
  }
  function drawSkyOf(theme, xa, xb) {
    if (theme.kind === 'paper') {
      ctx.fillStyle = theme.sky[1]; ctx.fillRect(xa, 0, xb - xa, GROUND_Y);
      for (let i = 0; i < 30; i++) {
        const x = seeded(i * 7 + 1) * W, y = seeded(i * 7 + 2) * GROUND_Y * 0.85, r = 40 + seeded(i * 7 + 3) * 120;
        ctx.fillStyle = `rgba(150,110,70,${0.05 + seeded(i * 7 + 4) * 0.07})`;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, seeded(i) * 3, 0, Math.PI * 2); ctx.fill();
      }
      const haze = ctx.createLinearGradient(0, GROUND_Y - 200, 0, GROUND_Y);
      haze.addColorStop(0, 'rgba(200,170,130,0)'); haze.addColorStop(1, 'rgba(190,150,110,.45)');
      ctx.fillStyle = haze; ctx.fillRect(xa, GROUND_Y - 200, xb - xa, 200);
      return;
    }
    if (theme.kind === 'mosaic') {
      // Tesserae: kleine steentjes in cremetinten, met een zachte lichte cirkel in het midden van de wand.
      ctx.fillStyle = '#b9b0a0'; ctx.fillRect(xa, 0, xb - xa, GROUND_Y);
      const tones = ['#e8e1d3', '#ddd4c3', '#d2c8b6', '#e2dacb', '#cfc5b1', '#e9e4d8'];
      const T = 11;
      for (let y = 0; y < GROUND_Y; y += T) for (let x = Math.floor(xa / T) * T; x < xb; x += T) {
        const n = seeded(x * 0.37 + y * 1.13);
        const d = Math.hypot(x - W / 2, y - 180) / 380;
        ctx.fillStyle = tones[Math.min(5, Math.floor(n * 6 + Math.max(0, 1 - d) * 1.5))];
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
      }
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(xa, 0, xb - xa, GROUND_Y);
  }
  function drawGroundOf(theme, xa, xb) {
    if (theme.kind === 'mosaic') {
      // Stenen plaveisel met voegen.
      ctx.fillStyle = theme.grass; ctx.fillRect(xa, GROUND_Y, xb - xa, H - GROUND_Y);
      ctx.strokeStyle = '#7d786e'; ctx.lineWidth = 2;
      for (let y = GROUND_Y; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); const off = ((y / 26) % 2) * 45; for (let x = Math.floor(xa / 90) * 90 + off; x < xb; x += 90) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); } }
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(xa, GROUND_Y, xb - xa, 8);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(xa, GROUND_Y, xb - xa, 2);
      return;
    }
    ctx.fillStyle = theme.grass; ctx.fillRect(xa, GROUND_Y, xb - xa, 22);
    const gd = ctx.createLinearGradient(0, GROUND_Y + 22, 0, H);
    gd.addColorStop(0, theme.dirt[0]); gd.addColorStop(1, theme.dirt[1]);
    ctx.fillStyle = gd; ctx.fillRect(xa, GROUND_Y + 22, xb - xa, H - GROUND_Y - 22);
    ctx.fillStyle = 'rgba(40,20,10,.35)'; ctx.fillRect(xa, GROUND_Y + 20, xb - xa, 3); ctx.fillRect(xa, GROUND_Y - 1, xb - xa, 2);
    if (theme.kind === 'desert') { ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const x = xa + seeded(i * 3) * (xb - xa), y = GROUND_Y + 30 + seeded(i * 5) * 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + seeded(i) * 20, y + 2); ctx.stroke(); } }
    else { ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; for (let x = Math.floor(xa / 40) * 40; x < xb; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 26); ctx.lineTo(x - 10, H); ctx.stroke(); } }
    // Grasplukjes op de rand.
    if (theme.kind !== 'paper') { ctx.strokeStyle = theme.kind === 'desert' ? '#8f7a4a' : theme.hill; ctx.lineWidth = 1.5; for (let i = 0; i < (xb - xa) / 9; i++) { const x = xa + i * 9 + seeded(i + xa) * 6; ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 2); ctx.lineTo(x - 2 + seeded(i * 2 + xa) * 4, GROUND_Y - 6 - seeded(i * 4 + xa) * 8); ctx.stroke(); } }
  }
  function fillLayer(theme, xa, xb) {
    drawSkyOf(theme, xa, xb);
    if (theme.far) { ctx.fillStyle = theme.far; ridge(farY, xa, xb); }
    if (theme.hill) { ctx.fillStyle = theme.hill; ridge(hillY, xa, xb); }
    drawGroundOf(theme, xa, xb);
  }
  function drawBlendedLayer(theme) {
    // The opponent's era fades in over the middle of the field, in thin clipped strips.
    const x0 = W / 2 - 140, x1 = W / 2 + 140, STRIP = 10;
    for (let x = x0; x < x1; x += STRIP) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, 0, STRIP, H); ctx.clip();
      ctx.globalAlpha = (x + STRIP / 2 - x0) / (x1 - x0);
      fillLayer(theme, x - 20, x + STRIP + 20);
      ctx.restore();
    }
    fillLayer(theme, x1, W);
  }
  // Static scenery behind each base (no animation), mirrored for the right side.
  function drawStaticDecor(era, mirror) {
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    const base = GROUND_Y + 2;
    if (era === 0) {
      for (const [x, w] of [[250, 26], [300, 16], [330, 12]]) { ctx.beginPath(); ctx.ellipse(x, base - 4, w, w * 0.6, 0, Math.PI, 0); ink('#b28f6a', 1.5); }
      ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { const x = 200 + i * 12 + seeded(i) * 8; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x - 3 + seeded(i * 3) * 6, base - 10 - seeded(i * 5) * 10); ctx.stroke(); }
    } else if (era === 1) {
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, GROUND_Y - 6, 300, 6);
    } else if (era === 2) {
      for (let i = 0; i < 5; i++) { const x = 250 + i * 34, h = 60 + (i % 3) * 22; poly([[x - 16, base], [x, base - h], [x + 16, base]], '#3c6b3e', 1.4); }
    } else if (era === 3 || era === 4) {
      for (let i = 0; i < 3; i++) { const x = 270 + i * 26; poly([[x - 7, base], [x, base - 70 - i * 10], [x + 7, base]], '#3f6b3a', 1.4); }
      ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(200, base - 12); ctx.lineTo(330, base - 12); ctx.stroke();
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(200 + i * 26, base); ctx.lineTo(200 + i * 26, base - 20); ctx.stroke(); }
    } else if (era === 5) {
      // Zandzakken en prikkeldraadpaaltjes voor de bunker.
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) { ctx.beginPath(); ctx.ellipse(230 + i * 22 + r * 11, base - 6 - r * 11, 12, 6, 0, 0, Math.PI * 2); ink('#a08a5a', 1.3); }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(340 + i * 22, base); ctx.lineTo(346 + i * 22, base - 26); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(340, base - 14); ctx.lineTo(412, base - 20); ctx.stroke();
    } else if (era === 6) {
      // Skyline in de verte, duin en betonnen barrières.
      ctx.fillStyle = 'rgba(160,172,180,.55)';
      const hs = [18, 34, 26, 48, 30, 40, 22, 56, 32, 24];
      for (let i = 0; i < hs.length; i++) ctx.fillRect(W / 2 - 150 + i * 18, GROUND_Y - 62 - hs[i], 13, hs[i] + 20);
      ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.moveTo(300, GROUND_Y); ctx.quadraticCurveTo(500, GROUND_Y - 50, W / 2 + 100, GROUND_Y); ctx.fill();
      for (let i = 0; i < 2; i++) { poly([[240 + i * 44, base], [244 + i * 44, base - 24], [270 + i * 44, base - 24], [276 + i * 44, base]], '#cfcac0', 1.6); ctx.fillStyle = '#e0b83a'; ctx.fillRect(248 + i * 44, base - 20, 20, 5); ctx.fillStyle = INK; ctx.fillRect(252 + i * 44, base - 20, 4, 5); ctx.fillRect(262 + i * 44, base - 20, 4, 5); }
    }
    ctx.restore();
  }
  let bgCache = null; // { key, canvas }
  function makeOffscreen() {
    try { const c = (canvas.ownerDocument || globalThis.document).createElement('canvas'); c.width = W; c.height = H; return c; } catch { return null; }
  }
  function paintStatic() {
    const pTheme = ERA_THEME[state.player.era] || ERA_THEME[0];
    const eTheme = ERA_THEME[state.enemy.era] || ERA_THEME[0];
    fillLayer(pTheme, 0, W);
    if (state.player.era !== state.enemy.era) drawBlendedLayer(eTheme);
    drawStaticDecor(state.player.era, false);
    drawStaticDecor(state.enemy.era, true);
  }
  function drawBackground() {
    const key = `${state.player.era}-${state.enemy.era}`;
    if (!bgCache || bgCache.key !== key) {
      const off = makeOffscreen();
      if (off) { const prev = ctx; ctx = off.getContext('2d'); paintStatic(); ctx = prev; bgCache = { key, canvas: off }; }
      else bgCache = { key, canvas: null };
    }
    if (bgCache.canvas) ctx.drawImage(bgCache.canvas, 0, 0); else paintStatic();
    drawAnimatedDecor(state.player.era, false);
    drawAnimatedDecor(state.enemy.era, true);
  }
  function drawCloud(cx, cy, s = 1) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 26 * s, cy + 6 * s, 26 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 26 * s, cy + 6 * s, 24 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawAnimatedDecor(era, mirror) {
    const theme = ERA_THEME[era];
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.beginPath(); ctx.rect(0, 0, W / 2, GROUND_Y); ctx.clip();
    if (theme.kind === 'sky' || theme.kind === 'desert') {
      ctx.fillStyle = era === 5 ? 'rgba(235,235,225,.7)' : 'rgba(255,255,255,.8)';
      for (let i = 0; i < 3; i++) drawCloud(((i * 300 + now() * 8 + era * 90) % (W + 220)) - 110, 50 + i * 40, 0.7 + (i % 2) * 0.4);
    }
    if (era === 6) {
      // Patrouillerende drone boven de basis.
      const dx = 240 + Math.sin(now() * 0.7) * 60, dy = 120 + Math.sin(now() * 1.3) * 10;
      rect(dx - 10, dy - 3, 20, 6, '#6b6f68', 1.4);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dx + s * 10, dy); ctx.lineTo(dx + s * 20, dy - 6); ctx.stroke(); ctx.beginPath(); ctx.ellipse(dx + s * 20, dy - 7, 8, 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- Mine, walls ----------
  function drawMine(era, mirror) {
    // Ontginningsplek in het veld: rotsen met ertsglans en een kar; werkers hakken hier goud.
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.translate(MINE_X, GROUND_Y + 4);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 2, 60, 8, 0, 0, Math.PI * 2); ctx.fill();
    poly([[-46, 0], [-36, -30], [-14, -40], [10, -34], [24, -44], [44, -26], [50, 0]], era >= 5 ? '#8a8a80' : '#a08a6a', 1.8);
    poly([[-30, -6], [-22, -22], [-8, -18], [-12, -4]], era >= 5 ? '#6b6b62' : '#86704f', 1.2);
    ctx.fillStyle = '#e0b83a'; for (const [x, y] of [[-20, -14], [6, -24], [30, -20], [-4, -8], [18, -6]]) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); }
    if (era <= 1) { ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-56, -24); ctx.lineTo(-40, -30); ctx.stroke(); }
    else if (era <= 4) { rect(-72, -16, 22, 14, '#8a5a34', 1.4); circle(-66, 0, 5, '#4a3a2a', 1.2); circle(-54, 0, 5, '#4a3a2a', 1.2); }
    else { rect(-78, -18, 26, 16, '#6b6b4a', 1.4); circle(-72, 0, 5, '#2b2a26', 1.2); circle(-58, 0, 5, '#2b2a26', 1.2); }
    ctx.restore();
  }
  function drawWalls(era, level, mirror) {
    // Zichtbare verdediging vóór de basis, sterker per muurniveau: niveau 2–3, 4–6 en 7+ elk een stap.
    const tier = level >= 7 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0;
    if (!tier) return;
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    const x = 266, base = GROUND_Y + 6;
    const trench = () => { poly([[x - 26, base - 2], [x + 26, base - 2], [x + 18, base + 26], [x - 18, base + 26]], '#3a2a20', 1.6); ctx.fillStyle = '#5a7a9a'; if (era !== 5) ctx.fillRect(x - 16, base + 12, 32, 12); };
    if (era <= 2) {
      // Palissade → (dubbele) palissade/stenen muur → gracht ervoor.
      const stakes = (sx, n, h) => { for (let i = 0; i < n; i++) poly([[sx + i * 12 - 4, base], [sx + i * 12, base - h - (i % 2) * 6], [sx + i * 12 + 4, base]], '#8a6438', 1.3); };
      if (tier === 1) stakes(x - 24, 5, 38);
      if (tier >= 2) { if (era === 0) { stakes(x - 30, 6, 44); stakes(x - 18, 5, 30); } else { rect(x - 22, base - 56, 44, 56, '#a9a49a', 1.8); for (let i = 0; i < 3; i++) rect(x - 22 + i * 16, base - 66, 10, 10, '#b5b0a6', 1.3); ctx.strokeStyle = '#7d786e'; ctx.lineWidth = 1; for (let y = base - 50; y < base; y += 12) { ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.stroke(); } } }
      if (tier === 3) { ctx.save(); ctx.translate(46, 0); trench(); ctx.restore(); }
    } else if (era <= 4) {
      // Aarden wal → bastionmuur → gracht.
      poly([[x - 40, base], [x - 22, base - 26], [x + 22, base - 26], [x + 40, base]], '#8a9a5a', 1.6);
      if (tier >= 2) { rect(x - 20, base - 54, 40, 30, era === 4 && mirror ? '#7a3a30' : '#8f8a7c', 1.8); for (let i = 0; i < 3; i++) rect(x - 20 + i * 14, base - 62, 9, 8, '#b5b0a6', 1.3); }
      if (tier === 3) { ctx.save(); ctx.translate(48, 0); trench(); ctx.restore(); }
    } else if (era === 5) {
      // Prikkeldraad → loopgraaf met zandzakken → tankgracht.
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 24 + i * 16, base); ctx.lineTo(x - 20 + i * 16, base - 22); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 24, base - 12); ctx.lineTo(x + 28, base - 16); ctx.stroke();
      if (tier >= 2) { trench(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x - 30 + i * 12, base - 6 - (i % 2) * 8, 10, 5, 0, 0, Math.PI * 2); ink('#a08a5a', 1.2); } }
      if (tier === 3) { ctx.save(); ctx.translate(54, 0); poly([[x - 30, base - 2], [x + 30, base - 2], [x + 20, base + 30], [x - 20, base + 30]], '#3a2a20', 1.6); ctx.restore(); }
    } else {
      // Betonnen barrières → Hesco-muur → antitankgracht.
      for (let i = 0; i < 2; i++) poly([[x - 30 + i * 30, base], [x - 26 + i * 30, base - 22], [x - 6 + i * 30, base - 22], [x - 2 + i * 30, base]], '#cfcac0', 1.5);
      if (tier >= 2) { for (let i = 0; i < 3; i++) { rect(x - 24 + i * 18, base - 40, 18, 40, '#a89a72', 1.5); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 24 + i * 18, base - 40 + k * 10); ctx.lineTo(x - 6 + i * 18, base - 40 + k * 10); ctx.stroke(); } } }
      if (tier === 3) { ctx.save(); ctx.translate(56, 0); trench(); ctx.restore(); }
    }
    ctx.restore();
  }

  // ---------- Bases per era ----------
  function drawFlagAt(cx, topY, color) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx, topY - 33); ctx.stroke();
    const wobble = Math.sin(now() * 3) * 4;
    poly([[cx, topY - 33], [cx + 28, topY - 27 + wobble], [cx + 4, topY - 24], [cx + 28, topY - 21 + wobble], [cx, topY - 17]], color, 1.4);
  }
  function drawHut(cx, baseY, flag, mirror) {
    // Prehistorie: de eigen basis is een strohut met palen, de tegenstander bewoont een huidentent.
    if (mirror) { drawHideTent(cx, baseY, flag); return; }
    poly([[cx - 92, baseY], [cx - 84, baseY - 36], [cx + 84, baseY - 36], [cx + 92, baseY]], '#a67a52');
    ctx.strokeStyle = '#6e4a30'; ctx.lineWidth = 1.2;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 18, baseY - 36); ctx.lineTo(cx + i * 18 + 3, baseY); ctx.stroke(); }
    poly([[cx - 100, baseY - 34], [cx, baseY - 130], [cx + 100, baseY - 34]], '#c9a06a');
    ctx.strokeStyle = '#8a6438'; ctx.lineWidth = 1.5;
    for (let i = 1; i <= 5; i++) { const y = baseY - 34 - i * 16, hw = 100 * (1 - i * 16 / 96); ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.quadraticCurveTo(cx, y + 5, cx + hw, y); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(cx + dx * 0.3, baseY - 118); ctx.lineTo(cx + dx * 1.6, baseY - 160); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - 18, baseY); ctx.lineTo(cx - 18, baseY - 34); ctx.quadraticCurveTo(cx, baseY - 58, cx + 18, baseY - 34); ctx.lineTo(cx + 18, baseY); ctx.closePath(); ink(INK);
    drawFlagAt(cx - 60, baseY - 70, flag);
  }
  function drawHideTent(cx, baseY, flag) {
    poly([[cx - 100, baseY], [cx - 10, baseY - 138], [cx + 100, baseY]], '#b08a62');
    poly([[cx - 100, baseY], [cx - 10, baseY - 138], [cx + 30, baseY - 30], [cx + 10, baseY]], '#d7c3a3');
    ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 70 + i * 18, baseY - 8 - i * 6); ctx.lineTo(cx - 40 + i * 14, baseY - 60 - i * 8); ctx.stroke(); }
    poly([[cx - 6, baseY], [cx + 2, baseY - 60], [cx + 22, baseY]], INK);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (const dx of [-14, -4, 6, 16]) { ctx.beginPath(); ctx.moveTo(cx - 10 + dx * 0.4, baseY - 128); ctx.lineTo(cx - 10 + dx * 2, baseY - 168); ctx.stroke(); }
    drawFlagAt(cx + 70, baseY - 50, flag);
  }
  function drawTemple(cx, baseY, flag) {
    // Klassieke tempel: trappen, zuilen met kapiteel, architraaf en fronton.
    rect(cx - 110, baseY - 10, 220, 10, '#cfc7b7'); rect(cx - 104, baseY - 20, 208, 10, '#d9d2c1'); rect(cx - 98, baseY - 28, 196, 8, '#e3dccd');
    rect(cx - 90, baseY - 120, 180, 92, '#8d8578');
    for (let i = 0; i < 6; i++) { const x = cx - 84 + i * 33.6; rect(x, baseY - 116, 16, 88, '#efe9dc', 1.4); rect(x - 3, baseY - 120, 22, 6, '#e3dccd', 1.2); ctx.strokeStyle = '#c9c1b0'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 4, baseY - 114); ctx.lineTo(x + k * 4, baseY - 30); ctx.stroke(); } }
    rect(cx - 96, baseY - 130, 192, 12, '#e3dccd');
    poly([[cx - 104, baseY - 130], [cx, baseY - 176], [cx + 104, baseY - 130]], '#d4cbb8');
    poly([[cx - 86, baseY - 134], [cx, baseY - 170], [cx + 86, baseY - 134]], '#bdb39e', 1.2);
    rect(cx - 14, baseY - 96, 28, 68, '#3a3430', 1.4);
    drawFlagAt(cx, baseY - 176, flag);
  }
  function drawMedieval(cx, baseY, flag) {
    // Burcht: muur met kantelen, twee ronde torens met kegeldak, poort met valhek.
    rect(cx - 90, baseY - 96, 180, 96, '#a9a49a');
    ctx.strokeStyle = '#7d786e'; ctx.lineWidth = 1;
    for (let y = baseY - 90; y < baseY; y += 14) { ctx.beginPath(); ctx.moveTo(cx - 90, y); ctx.lineTo(cx + 90, y); ctx.stroke(); const off = ((y / 14) % 2) * 16; for (let x = cx - 90 + off; x < cx + 90; x += 32) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); } }
    for (let i = 0; i < 6; i++) rect(cx - 86 + i * 32, baseY - 108, 16, 12, '#b5b0a6', 1.4);
    for (const dx of [-100, 100]) {
      rect(dx + cx - 26, baseY - 170, 52, 170, '#b5b0a6');
      for (let i = -1; i <= 1; i++) rect(dx + cx + i * 18 - 6, baseY - 182, 12, 12, '#b5b0a6', 1.4);
      poly([[dx + cx - 30, baseY - 182], [dx + cx, baseY - 226], [dx + cx + 30, baseY - 182]], '#8a4a3a');
      rect(dx + cx - 4, baseY - 150, 8, 18, '#2b2620', 1.2); rect(dx + cx - 4, baseY - 110, 8, 18, '#2b2620', 1.2);
    }
    ctx.beginPath(); ctx.moveTo(cx - 22, baseY); ctx.lineTo(cx - 22, baseY - 40); ctx.quadraticCurveTo(cx, baseY - 64, cx + 22, baseY - 40); ctx.lineTo(cx + 22, baseY); ctx.closePath(); ink('#2b2620');
    ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8, baseY); ctx.lineTo(cx + i * 8, baseY - 50 + Math.abs(i) * 3); ctx.stroke(); }
    rect(cx - 14, baseY - 80, 28, 26, '#8a4a3a', 1.2); ctx.fillStyle = '#e0b83a'; ctx.fillRect(cx - 6, baseY - 74, 12, 14);
    drawFlagAt(cx - 100, baseY - 226, flag); drawFlagAt(cx + 100, baseY - 226, flag);
  }
  function drawStarFort(cx, baseY, flag, wall, top, roof) {
    // Sterfort in vogelperspectief: vier bastions rond een binnenplein met een huisje.
    const pts = [[-150, 0], [-110, -30], [-70, -22], [-40, -64], [0, -58], [40, -64], [70, -22], [110, -30], [150, 0], [110, 18], [40, 10], [0, 20], [-40, 10], [-110, 18]];
    ctx.save(); ctx.translate(cx, baseY - 20);
    poly(pts.map(([x, y]) => [x, y + 26]), wall, 2);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); }
    poly(pts, top, 2);
    poly([[-110, -14], [-60, -30], [60, -30], [110, -14], [60, 4], [-60, 4]], '#9db35a', 1.2);
    rect(-26, -58, 52, 36, '#d9c9a8', 1.6);
    poly([[-32, -58], [0, -82], [32, -58]], roof, 1.6);
    rect(-6, -40, 12, 18, INK, 1.2);
    ctx.restore();
    drawFlagAt(cx, baseY - 102, flag);
  }
  function drawBunker(cx, baseY, flag, mirror) {
    if (mirror) {
      // Betonnen kazemat met schietgat.
      poly([[cx - 100, baseY], [cx - 100, baseY - 70], [cx - 80, baseY - 96], [cx + 80, baseY - 96], [cx + 100, baseY - 70], [cx + 100, baseY]], '#a9aba0', 2);
      rect(cx - 60, baseY - 60, 120, 14, '#2b2a26', 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 100, baseY - 18 * i - 8); ctx.lineTo(cx + 100, baseY - 18 * i - 8); ctx.stroke(); }
      rect(cx - 20, baseY - 40, 40, 40, '#4a4a44', 1.4);
      drawFlagAt(cx + 70, baseY - 96, flag);
      return;
    }
    // Bakstenen bunker met betonnen dek en luchtafweerkanon.
    rect(cx - 110, baseY - 90, 220, 90, '#8a4a3a');
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (let y = baseY - 84; y < baseY; y += 12) { ctx.beginPath(); ctx.moveTo(cx - 110, y); ctx.lineTo(cx + 110, y); ctx.stroke(); const off = ((y / 12) % 2) * 12; for (let x = cx - 110 + off; x < cx + 110; x += 24) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke(); } }
    rect(cx - 116, baseY - 100, 232, 12, '#9a9a90', 1.6);
    rect(cx - 80, baseY - 150, 70, 50, '#8a4a3a'); rect(cx - 86, baseY - 158, 82, 10, '#9a9a90', 1.4);
    rect(cx - 20, baseY - 30, 40, 30, '#2b2a26', 1.4);
    for (let i = 0; i < 3; i++) rect(cx - 90 + i * 30, baseY - 70, 16, 10, '#2b2a26', 1.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 60, baseY - 158); ctx.lineTo(cx - 60, baseY - 190); ctx.stroke();
    circle(cx - 60, baseY - 196, 6, '#9a9a90', 1.4);
    rect(cx + 30, baseY - 114, 40, 14, '#4a4a44', 1.4);
    ctx.save(); ctx.translate(cx + 50, baseY - 116); ctx.rotate(-0.7); rect(-4, -6, 50, 8, '#5a5a52', 1.4); rect(38, -8, 12, 12, '#3a3a34', 1.2); ctx.restore();
    drawFlagAt(cx + 90, baseY - 100, flag);
  }
  function drawModernBase(cx, baseY, flag) {
    // Betonnen basis met poort, antennes en een dakplatform.
    poly([[cx - 112, baseY], [cx - 112, baseY - 80], [cx - 96, baseY - 100], [cx + 96, baseY - 100], [cx + 112, baseY - 80], [cx + 112, baseY]], '#b9b7ad', 2);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 112, baseY - 16 * i); ctx.lineTo(cx + 112, baseY - 16 * i); ctx.stroke(); }
    rect(cx - 60, baseY - 150, 80, 50, '#a9a79d', 1.6); rect(cx - 66, baseY - 156, 92, 8, '#8f8d84', 1.4);
    rect(cx - 22, baseY - 44, 44, 44, '#4a4f4a', 1.4); ctx.fillStyle = '#e0b83a'; ctx.fillRect(cx - 22, baseY - 46, 44, 3);
    for (let i = 0; i < 4; i++) rect(cx - 90 + i * 24, baseY - 74, 12, 8, '#2b2f2b', 1.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (const dx of [-40, -30, -20]) { ctx.beginPath(); ctx.moveTo(cx + dx, baseY - 156); ctx.lineTo(cx + dx, baseY - 200 + Math.abs(dx + 30) * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - 48, baseY - 186); ctx.lineTo(cx - 12, baseY - 186); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 60, baseY - 156); ctx.lineTo(cx + 60, baseY - 190); ctx.stroke();
    ctx.save(); ctx.translate(cx + 60, baseY - 194); ctx.rotate(Math.sin(now() * 1.2) * 0.6); ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.restore();
    ctx.fillStyle = Math.floor(now() * 2) % 2 ? '#ff5544' : '#7a2a22'; ctx.fillRect(cx - 32, baseY - 204, 4, 4);
    drawFlagAt(cx + 90, baseY - 100, flag);
  }
  const CASTLE_TOP = [136, 130, 108, 84, 84, 100, 100];
  function drawCastle(cx, army, side, mirror) {
    const baseY = GROUND_Y + 18, flag = team(side), era = army.era;
    ctx.save();
    if (mirror) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    if (era === 0) drawHut(cx, baseY, flag, mirror);
    else if (era === 1) drawTemple(cx, baseY, flag);
    else if (era === 2) drawMedieval(cx, baseY, flag);
    else if (era === 3) drawStarFort(cx, baseY, flag, '#8a6a48', '#c9ab7a', '#8a4a3a');
    else if (era === 4) drawStarFort(cx, baseY, flag, mirror ? '#7a3a30' : '#7d7a72', mirror ? '#b86a52' : '#b5b0a6', mirror ? '#6a2a22' : '#8a4a3a');
    else if (era === 5) drawBunker(cx, baseY, flag, mirror);
    else drawModernBase(cx, baseY, flag);
    const topY = baseY - CASTLE_TOP[era];
    army.turrets.forEach((t, i) => drawTurret(era, cx - 50 + i * 50, topY, t.cd, t.type || 'near', flag));
    ctx.restore();
    const pct = army.castleHp / army.castleMaxHp;
    if (pct < 0.4) {
      ctx.fillStyle = 'rgba(60,20,10,' + (0.35 * (1 - pct / 0.4)) + ')';
      ctx.fillRect(cx - 160, baseY - 240, 320, 240);
      ctx.fillStyle = 'rgba(80,80,80,.5)';
      for (let k = 0; k < 3; k++) { const t = (now() * 0.7 + k * 0.8) % 2.4; ctx.beginPath(); ctx.arc(cx - 40 + k * 40 + t * 8, baseY - 120 - t * 45, 10 + t * 8, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function drawTurret(era, x, y, cd, type, flag) {
    if (type === 'bonus') {
      // Banier: hoge stok met teamvaandel en een zachte gloed.
      ctx.fillStyle = 'rgba(255,211,92,.25)'; ctx.beginPath(); ctx.arc(x, y - 30, 22 + Math.sin(now() * 3) * 3, 0, Math.PI * 2); ctx.fill();
      rect(x - 8, y - 8, 16, 8, '#4a3a2a', 1.4);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 58); ctx.stroke();
      const wobble = Math.sin(now() * 3 + x) * 3;
      poly([[x, y - 58], [x + 26, y - 52 + wobble], [x + 4, y - 46], [x + 26, y - 40 + wobble], [x, y - 34]], flag, 1.4);
      circle(x, y - 60, 3, '#e0b83a', 1);
      return;
    }
    const far = type === 'far';
    const recoil = cd > (far ? 1.9 : 0.8) ? (cd - (far ? 1.9 : 0.8)) * 20 : 0;
    rect(x - (far ? 16 : 12), y - 10, far ? 32 : 24, 10, '#4a3a2a', 1.4);
    ctx.save(); ctx.translate(x - recoil, y - 12); ctx.rotate(far ? -0.85 : -0.5); if (far) ctx.scale(1.25, 1.25);
    if (era === 0) { rect(0, -2, 34, 4, '#8a5a34', 1.2); poly([[34, -5], [44, 0], [34, 5]], '#9aa0a6', 1.2); }
    else if (era === 1) { rect(0, -3, 30, 6, '#8a5a34', 1.2); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, -16); ctx.quadraticCurveTo(0, 0, 10, 16); ctx.stroke(); }
    else if (era === 2) { rect(0, -3, 38, 6, '#8a5a34', 1.2); circle(38, 0, 7, '#7a7a7a', 1.2); }
    else if (era === 3 || era === 4) { rect(0, -5, 34, 10, '#2b2b2b', 1.2); circle(6, 8, 6, '#8a5a34', 1.2); }
    else if (era === 5) { rect(0, -6, 36, 12, '#4a4a44', 1.2); ctx.fillStyle = '#2b2a26'; for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 10, -8, 4, 16); }
    else { rect(0, -8, 30, 16, '#4f5a48', 1.2); ctx.fillStyle = '#d24b3a'; ctx.fillRect(30, -6, 8, 4); ctx.fillRect(30, 2, 8, 4); }
    ctx.restore();
  }

  // ---------- Figures: one inked humanoid with per-era kits ----------
  function drawFigure(u, kit, step, swing, handMode, seated = false) {
    const legColor = kit.legs || SKIN;
    if (seated) { limb(0, -30, 12, -18, legColor); limb(12, -18, 11, -2, legColor); if (kit.boots) { ctx.beginPath(); ctx.ellipse(13, 0, 5, 3, 0, 0, Math.PI * 2); ink(kit.boots, 1.3); } }
    else limb(-3, -30, -8 - step, 0, legColor); if (!seated) limb(3, -30, 8 + step, 0, legColor);
    if (kit.boots && !seated) { ctx.beginPath(); ctx.ellipse(-8 - step, 0, 6, 3.5, 0, 0, Math.PI * 2); ink(kit.boots, 1.3); ctx.beginPath(); ctx.ellipse(8 + step, 0, 6, 3.5, 0, 0, Math.PI * 2); ink(kit.boots, 1.3); }
    const bottom = kit.tunicBottom ?? -20;
    if (kit.fur) {
      poly([[-10, -36], [10, -36], [12, -22], [8, -17], [4, -22], [0, -16], [-4, -22], [-8, -18], [-12, -22]], kit.tunic, 1.6);
      ctx.beginPath(); ctx.moveTo(-8, -60); ctx.quadraticCurveTo(-11, -46, -9, -34); ctx.lineTo(9, -34); ctx.quadraticCurveTo(11, -46, 8, -60); ctx.closePath(); ink(SKIN, 1.6);
      poly([[-9, -60], [9, -60], [7, -52], [-7, -52]], kit.tunic, 1.4);
    } else poly([[-9, -60], [9, -60], [11, bottom], [-11, bottom]], kit.tunic, 1.6);
    if (kit.armor) { ctx.beginPath(); ctx.moveTo(-9, -60); ctx.quadraticCurveTo(-12, -46, -9, -34); ctx.lineTo(9, -34); ctx.quadraticCurveTo(12, -46, 9, -60); ctx.closePath(); ink(kit.armor, 1.6); }
    if (kit.belt) rect(-10, -38, 20, 4, kit.belt, 1.2);
    if (kit.vest) rect(-8, -58, 16, 18, kit.vest, 1.4);
    if (kit.crossbelt) { ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -58); ctx.lineTo(8, -40); ctx.stroke(); }
    if (kit.patch) { ctx.fillStyle = kit.patch; ctx.fillRect(-9, -56, 5, 6); }
    const sleeve = kit.sleeves || SKIN;
    limb(-5, -56, -13, -40, sleeve);
    if (kit.shield) drawShield(kit.shield, kit.shieldColor, kit.shieldRim);
    const hand = handMode === 'aim' ? { x: 14, y: -46 } : handMode === 'hold' ? { x: 12, y: -44 } : { x: 16, y: -56 + swing * 6 };
    limb(5, -56, hand.x, hand.y, sleeve);
    circle(1, -70, 9, SKIN, 1.6);
    if (kit.hair) { ctx.beginPath(); ctx.moveTo(-9, -72); ctx.quadraticCurveTo(-2, -84, 8, -78); ctx.quadraticCurveTo(10, -74, 6, -70); ctx.quadraticCurveTo(-4, -76, -9, -66); ctx.closePath(); ink(HAIR, 1.2); }
    if (kit.beard) { ctx.beginPath(); ctx.moveTo(-4, -66); ctx.quadraticCurveTo(2, -58, 9, -66); ctx.lineTo(8, -70); ctx.lineTo(-4, -70); ctx.closePath(); ink(HAIR, 1.2); }
    ctx.fillStyle = INK; ctx.fillRect(5, -71, 2, 2);
    drawHelmet(kit.helmet, kit.helmetColor || '#9aa0a6', kit.plume);
    return hand;
  }
  function drawShield(type, color, rim) {
    ctx.save(); ctx.translate(-6, -46);
    if (type === 'round') { circle(0, 0, 14, color, 1.8); circle(0, 0, 9, rim || color, 1.2); circle(0, 0, 3, '#e0b83a', 1); }
    else if (type === 'scutum') { rect(-8, -16, 16, 32, color, 1.8); ctx.strokeStyle = '#e0b83a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); }
    else if (type === 'kite') { poly([[-8, -14], [8, -14], [8, 2], [0, 18], [-8, 2]], color, 1.8); ctx.fillStyle = '#e0b83a'; ctx.fillRect(-1, -8, 2, 16); ctx.fillRect(-6, -3, 12, 2); }
    else if (type === 'heater') { poly([[-9, -14], [9, -14], [9, 0], [0, 14], [-9, 0]], color, 1.8); ctx.fillStyle = '#efe6d4'; ctx.fillRect(-1, -10, 2, 18); }
    ctx.restore();
  }
  function drawHelmet(type, color, plume) {
    const x = 1, y = -70;
    if (!type) return;
    if (type === 'corinthian') { ctx.beginPath(); ctx.arc(x, y - 2, 10.5, Math.PI, 0); ctx.lineTo(x + 10.5, y + 6); ctx.lineTo(x + 5, y + 6); ctx.lineTo(x + 5, y + 1); ctx.lineTo(x - 5, y + 1); ctx.lineTo(x - 5, y + 6); ctx.lineTo(x - 10.5, y + 6); ctx.closePath(); ink(color, 1.4); poly([[x - 8, y - 12], [x, y - 22], [x + 12, y - 12], [x + 8, y - 8], [x - 4, y - 8]], plume || '#b5322a', 1.2); }
    else if (type === 'galea') { ctx.beginPath(); ctx.arc(x, y - 2, 10.5, Math.PI, 0); ctx.closePath(); ink(color, 1.4); rect(x - 11, y - 3, 22, 4, color, 1.2); rect(x + 6, y, 5, 8, color, 1.2); poly([[x - 6, y - 12], [x - 2, y - 22], [x + 6, y - 22], [x + 8, y - 12]], plume || '#b5322a', 1.2); }
    else if (type === 'kettle') { ctx.beginPath(); ctx.arc(x, y - 4, 9, Math.PI, 0); ctx.closePath(); ink(color, 1.4); ctx.beginPath(); ctx.ellipse(x, y - 4, 12.5, 3.5, 0, 0, Math.PI * 2); ink(color, 1.3); }
    else if (type === 'bascinet') { ctx.beginPath(); ctx.arc(x, y - 3, 10, Math.PI, 0); ctx.lineTo(x + 10, y + 4); ctx.lineTo(x - 10, y + 4); ctx.closePath(); ink(color, 1.4); ctx.fillStyle = INK; ctx.fillRect(x - 6, y - 2, 12, 2); }
    else if (type === 'greathelm') { rect(x - 10, y - 14, 20, 20, color, 1.4); ctx.fillStyle = INK; ctx.fillRect(x - 7, y - 4, 14, 2); if (plume) poly([[x - 4, y - 14], [x, y - 26], [x + 8, y - 14]], plume, 1.2); }
    else if (type === 'morion') { ctx.beginPath(); ctx.arc(x, y - 6, 9, Math.PI, 0); ctx.closePath(); ink(color, 1.4); ctx.beginPath(); ctx.moveTo(x - 15, y - 3); ctx.quadraticCurveTo(x, y - 12, x + 15, y - 3); ctx.quadraticCurveTo(x, y + 1, x - 15, y - 3); ink(color, 1.3); rect(x - 2, y - 22, 4, 12, color, 1.2); }
    else if (type === 'tricorn') { poly([[x - 15, y - 2], [x - 4, y - 16], [x + 8, y - 16], [x + 15, y - 2], [x + 7, y + 1], [x - 7, y + 1]], color, 1.4); if (plume) { ctx.fillStyle = plume; ctx.fillRect(x - 12, y - 5, 5, 3); } }
    else if (type === 'steel') { ctx.beginPath(); ctx.arc(x, y - 4, 10.5, Math.PI, 0); ctx.closePath(); ink(color, 1.4); ctx.beginPath(); ctx.ellipse(x, y - 4, 13, 3.5, 0, 0, Math.PI * 2); ink(color, 1.3); }
    else if (type === 'modern') { ctx.beginPath(); ctx.arc(x, y - 3, 10.5, Math.PI, 0); ctx.lineTo(x + 10.5, y + 2); ctx.lineTo(x - 10.5, y + 2); ctx.closePath(); ink(color, 1.4); rect(x - 9, y - 8, 18, 4, '#2b2f2b', 1.2); }
  }
  // Weapons in the front hand; `swing` 0..1 drives the strike, guns are held level.
  function drawWeaponInk(type, hand, swing, side) {
    ctx.save(); ctx.translate(hand.x, hand.y);
    const wood = '#8a5a34', steel = '#c9ccd1', barrel = '#3a3a3a';
    if (type === 'club') { ctx.rotate(-1.1 + swing * 1.2); poly([[-3, 4], [3, 4], [4, -28], [-4, -28]], wood); ctx.beginPath(); ctx.ellipse(0, -30, 7, 9, 0, 0, Math.PI * 2); ink('#6e4a30'); }
    else if (type === 'stoneaxe') { ctx.rotate(-1.1 + swing * 1.2); poly([[-3, 4], [3, 4], [4, -28], [-4, -28]], wood); poly([[-9, -28], [0, -40], [9, -28], [6, -22], [-6, -22]], '#9aa0a6'); }
    else if (type === 'sling') { ctx.strokeStyle = '#6e4a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(12 + Math.sin(swing * 20) * 6, -18, 22, -6); ctx.stroke(); circle(22, -6, 4, '#9aa0a6', 1.4); }
    else if (type === 'spear') { ctx.rotate(-1.25 + swing * 0.5); rect(-2, -44, 4, 80, wood, 1.4); poly([[-5, -44], [0, -60], [5, -44]], steel, 1.4); }
    else if (type === 'bow') { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(6, -24); ctx.quadraticCurveTo(26, 0, 6, 24); ctx.stroke(); ctx.strokeStyle = wood; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -24); ctx.quadraticCurveTo(26, 0, 6, 24); ctx.stroke(); ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(-4, 0); ctx.lineTo(6, 24); ctx.stroke(); rect(-6, -1, 30, 2, wood, 1); poly([[24, -3], [30, 0], [24, 3]], steel, 1); }
    else if (type === 'halberd') { ctx.rotate(-1.2 + swing * 0.6); rect(-2, -50, 4, 90, wood, 1.4); poly([[2, -46], [16, -40], [16, -24], [2, -20]], steel, 1.4); poly([[-3, -50], [0, -64], [3, -50]], steel, 1.4); }
    else if (type === 'crossbow') { rect(-8, -2, 34, 4, wood, 1.4); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(14, -16); ctx.quadraticCurveTo(24, 0, 14, 16); ctx.stroke(); ctx.strokeStyle = steel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -16); ctx.quadraticCurveTo(24, 0, 14, 16); ctx.stroke(); ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -16); ctx.lineTo(-2, 0); ctx.lineTo(14, 16); ctx.stroke(); }
    else if (type === 'pike') { ctx.rotate(-1.3 + swing * 0.4); rect(-1.5, -70, 3, 110, wood, 1.3); poly([[-4, -70], [0, -84], [4, -70]], steel, 1.3); }
    else if (type === 'arquebus' || type === 'musket' || type === 'bayonet') { const len = type === 'arquebus' ? 40 : 52; poly([[-16, 6], [-8, -3], [0, -3], [0, 3], [-12, 8]], wood, 1.4); rect(-2, -3, len, 5, barrel, 1.4); rect(-2, 2, len * 0.7, 3, wood, 1); if (type === 'arquebus') rect(14, 4, 3, 12, '#2b2a26', 1); if (type === 'bayonet') rect(len - 2, -2, 14, 2, steel, 1); }
    else if (type === 'rifle' || type === 'riflebayonet' || type === 'sniper') { poly([[-16, 6], [-8, -3], [0, -3], [0, 3], [-12, 8]], wood, 1.4); rect(-2, -3, 42, 5, barrel, 1.4); rect(-2, 2, 26, 3, wood, 1); rect(12, 2, 4, 8, '#2b2a26', 1); if (type === 'riflebayonet') rect(40, -2, 12, 2, steel, 1); if (type === 'sniper') rect(6, -8, 14, 4, '#2b2a26', 1.2); }
    else if (type === 'assault' || type === 'modernsniper') { rect(-14, -2, 14, 5, '#3a3a34', 1.4); rect(-2, -4, 34, 7, '#3a3a34', 1.4); rect(6, 3, 6, 12, '#2b2a26', 1.2); rect(18, 3, 5, 6, '#2b2a26', 1); rect(4, -9, 12, 4, '#2b2a26', 1.2); if (type === 'modernsniper') rect(32, -2, 16, 3, '#3a3a34', 1.2); }
    else if (type === 'rammer') { ctx.rotate(-0.35); rect(-4, -2, 44, 4, wood, 1.3); rect(40, -5, 10, 10, '#6e4a30', 1.2); }
    else if (type === 'bigclub') { ctx.rotate(-1.0 + swing * 1.2); poly([[-4, 4], [4, 4], [6, -30], [-6, -30]], '#8a5a34'); ctx.beginPath(); ctx.ellipse(0, -36, 11, 14, 0, 0, Math.PI * 2); ink('#6e4a30'); ctx.fillStyle = '#9aa0a6'; for (const [x, y] of [[-6, -40], [4, -46], [7, -30], [-4, -28]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); } }
    else if (type === 'pistol') { rect(-2, -3, 18, 5, '#3a3a34', 1.3); rect(-4, 0, 6, 10, '#6e4a30', 1.2); }
    else if (type === 'sword') { ctx.rotate(-1.0 + swing * 1.2); rect(-2, 2, 4, 8, wood, 1.2); rect(-7, 0, 14, 3, '#e0b83a', 1.2); poly([[-3, 0], [3, 0], [3, -34], [0, -40], [-3, -34]], steel, 1.2); }
    else if (type === 'saber') { ctx.rotate(-0.9 + swing * 1.2); rect(-2, 2, 4, 8, wood, 1.2); ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(4, -22, 2, -38); ctx.lineTo(5, -36); ctx.quadraticCurveTo(8, -20, 2, 0); ctx.closePath(); ink(steel, 1.2); }
    else if (type === 'lance') { ctx.rotate(0.15); rect(-20, -2, 70, 4, wood, 1.4); poly([[50, -4], [60, 0], [50, 4]], steel, 1.3); poly([[36, -8], [50, -2], [36, 4]], side, 1); }
    ctx.restore();
  }
  function kitFor(u) {
    const t = team(u.side), s = teamShade(u.side), enemy = u.side === 'enemy';
    switch (u.era) {
      case 0: return { fur: true, tunic: u.side === 'player' ? '#6b7a3e' : '#7a4a3e', hair: true, beard: true };
      case 1: return enemy
        ? { tunic: t, tunicBottom: -18, armor: '#c9a24a', belt: '#6e4a30', helmet: 'galea', helmetColor: '#c9a24a', plume: '#b5322a', shield: u.role === 'melee' ? 'scutum' : null, shieldColor: t, boots: '#8a5a34' }
        : { tunic: '#efe6d4', tunicBottom: -18, armor: '#c9a24a', belt: t, helmet: 'corinthian', helmetColor: '#c9a24a', plume: t, shield: u.role === 'melee' ? 'round' : null, shieldColor: '#c9a24a', shieldRim: t, boots: '#8a5a34' };
      case 2: return { legs: '#8f949a', boots: '#4a3a2a', tunic: t, tunicBottom: -14, sleeves: '#8f949a', belt: '#4a3a2a', helmet: enemy ? 'bascinet' : 'kettle', shield: u.role === 'melee' ? (enemy ? 'heater' : 'kite') : null, shieldColor: t };
      case 3: return { legs: t, boots: '#4a3a2a', tunic: t, tunicBottom: -30, armor: '#9aa0a6', sleeves: t, belt: '#4a3a2a', helmet: 'morion', plume: s, beard: true };
      case 4: return { legs: '#efe6d4', boots: '#2b2a26', tunic: t, tunicBottom: -22, sleeves: t, crossbelt: true, helmet: 'tricorn', helmetColor: '#2b2a26', plume: '#efe6d4' };
      case 5: return { legs: '#6b6b4a', boots: '#4a3a2a', tunic: '#6b6b4a', tunicBottom: -30, sleeves: '#6b6b4a', belt: '#4a3a2a', patch: t, helmet: 'steel', helmetColor: '#5f6448' };
      default: return { legs: '#a89a72', boots: '#4a3a2a', tunic: '#a89a72', tunicBottom: -30, sleeves: '#a89a72', vest: '#4f5443', patch: t, helmet: 'modern', helmetColor: '#a89a72' };
    }
  }
  const MELEE_WEAPON = ['club', 'spear', 'halberd', 'pike', 'bayonet', 'riflebayonet', 'assault'];
  const RANGED_WEAPON = ['sling', 'bow', 'crossbow', 'arquebus', 'musket', 'sniper', 'modernsniper'];
  const isGun = (w) => ['arquebus', 'musket', 'bayonet', 'rifle', 'riflebayonet', 'sniper', 'assault', 'modernsniper', 'pistol'].includes(w);
  const HERO_WEAPON = ['bigclub', 'spear', 'sword', 'sword', 'saber', 'pistol', 'assault'];
  // Helden per tijdperk: elk een herkenbaar silhouet boven de gewone troepen uit, 1.15x en met gouden ster.
  function drawHero(u, step, swing) {
    const t = team(u.side), s2 = teamShade(u.side), gold = '#e0b83a';
    const base = kitFor(u);
    ctx.save(); ctx.scale(1.15, 1.15);
    const cape = (color) => poly([[-6, -60], [6, -58], [-2, -12], [-24, -6]], color, 1.6);
    let kit, wpn = HERO_WEAPON[u.era];
    if (u.era === 0) {
      // Stamhoofd: vachtmantel, gewei-hoofdtooi, bottenketting en een grote knots.
      cape('#5c3a24');
      kit = { ...base, tunic: '#7a5236' };
    } else if (u.era === 1) {
      // Kampioen: bronzen spierkuras, hoge kam, rond schild met zonneteken.
      cape(t);
      kit = { ...base, tunic: t, armor: '#d4b25a', helmet: 'corinthian', helmetColor: '#d4b25a', plume: gold, shield: 'round', shieldColor: '#d4b25a', shieldRim: t };
    } else if (u.era === 2) {
      // Kruisridder: plaatharnas, grote helm met pluim, wapenrok met kruis, zwaard en schild.
      cape(t);
      kit = { ...base, legs: '#b5b8bd', sleeves: '#b5b8bd', tunic: '#efe6d4', helmet: 'greathelm', helmetColor: '#b5b8bd', plume: t, shield: 'heater', shieldColor: t };
    } else if (u.era === 3) {
      // Condottiere: sierharnas, brede verenhoed, cape.
      cape(t);
      kit = { ...base, armor: '#c9ccd1', helmet: null, beard: true };
    } else if (u.era === 4) {
      // Veldmaarschalk: steek met pluim, gouden epauletten, cape.
      cape(s2);
      kit = { ...base, helmet: null, crossbelt: true };
    } else if (u.era === 5) {
      // Commandant: officierspet, lange jas, pistool.
      kit = { ...base, tunic: '#4f5443', sleeves: '#4f5443', tunicBottom: -12, legs: '#6b6b4a', helmet: null, belt: '#2b2a26' };
    } else {
      // Operator: zwart tactisch tenue, plaatdrager, helm met nachtkijker.
      kit = { ...base, tunic: '#2f3330', sleeves: '#2f3330', legs: '#2f3330', vest: '#1e211f', helmet: 'modern', helmetColor: '#2f3330', patch: t };
    }
    const hand = drawFigure(u, kit, step, swing, isGun(wpn) ? 'aim' : 'strike');
    if (u.era === 0) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(1 + sgn * 6, -78); ctx.lineTo(1 + sgn * 12, -92); ctx.lineTo(1 + sgn * 18, -96); ctx.moveTo(1 + sgn * 10, -88); ctx.lineTo(1 + sgn * 6, -96); ctx.stroke(); }
      rect(-8, -80, 18, 4, '#7a5236', 1.2);
      ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -58); ctx.quadraticCurveTo(1, -48, 10, -58); ctx.stroke();
      for (let i = -6; i <= 6; i += 4) { ctx.fillStyle = '#efe6d4'; ctx.fillRect(i, -53 + Math.abs(i) * 0.4, 2, 5); }
    } else if (u.era === 1) {
      ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(-6, -46, 4, 0, Math.PI * 2); ctx.fill();
    } else if (u.era === 2) {
      ctx.fillStyle = t; ctx.fillRect(-1, -56, 2, 14); ctx.fillRect(-5, -52, 10, 2);
    } else if (u.era === 3) {
      poly([[-16, -78], [18, -78], [12, -84], [-10, -84]], '#4a3a2a', 1.3); ctx.beginPath(); ctx.arc(1, -84, 8, Math.PI, 0); ctx.closePath(); ink('#4a3a2a', 1.3);
      ctx.strokeStyle = t; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -88); ctx.quadraticCurveTo(18, -100, 26, -90); ctx.stroke();
    } else if (u.era === 4) {
      poly([[-16, -78], [-8, -92], [10, -92], [18, -78]], '#2b2a26', 1.3);
      ctx.fillStyle = gold; ctx.fillRect(-11, -60, 6, 4); ctx.fillRect(5, -60, 6, 4);
      ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -92); ctx.quadraticCurveTo(0, -102, 8, -94); ctx.stroke();
    } else if (u.era === 5) {
      rect(-9, -80, 20, 5, '#4f5443', 1.3); ctx.beginPath(); ctx.arc(1, -80, 9, Math.PI, 0); ctx.closePath(); ink('#4f5443', 1.3); ctx.fillStyle = gold; ctx.fillRect(-2, -84, 6, 3);
      ctx.fillStyle = gold; ctx.fillRect(-11, -60, 6, 3); ctx.fillRect(5, -60, 6, 3);
    } else {
      rect(4, -82, 8, 6, '#1e211f', 1.2); rect(10, -80, 5, 4, '#3a8a4a', 1);
      ctx.fillStyle = gold; ctx.fillRect(-9, -56, 6, 3);
    }
    drawWeaponInk(wpn, hand, swing, t);
    // Gouden ster boven de held.
    ctx.fillStyle = gold; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.5 : 5.5, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(1 + Math.cos(a) * r, -100 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Werkers per tijdperk: holbewoner, steengroevewerker, boer met kaproen, mijnwerker met schort,
  // arbeider met pet, genist met veldpet en bouwvakker met fluohesje en helm.
  function workerKit(u) {
    const t = team(u.side);
    switch (u.era) {
      case 0: return { kit: { fur: true, tunic: u.side === 'player' ? '#6b7a3e' : '#7a4a3e', hair: true, beard: true }, tool: 'stonepick' };
      case 1: return { kit: { tunic: '#d9cfb8', tunicBottom: -18, belt: t, hair: true, boots: '#8a5a34' }, tool: 'pick', headband: t };
      case 2: return { kit: { legs: '#6b5a45', boots: '#4a3a2a', tunic: '#a08a6a', tunicBottom: -18, sleeves: '#a08a6a', belt: t, beard: true }, tool: 'pick', hood: '#7a5a3a' };
      case 3: return { kit: { legs: '#5a4a3a', boots: '#4a3a2a', tunic: '#b09070', tunicBottom: -22, sleeves: '#b09070', belt: t, hair: true, beard: true }, tool: 'pick', apron: '#6e4a30', cap: '#4a3a2a' };
      case 4: return { kit: { legs: '#8a7a62', boots: '#2b2a26', tunic: '#efe6d4', tunicBottom: -28, sleeves: '#efe6d4', vest: t, hair: true }, tool: 'shovel', cap: '#4a3a2a' };
      case 5: return { kit: { legs: '#6b6b4a', boots: '#4a3a2a', tunic: '#6b6b4a', tunicBottom: -30, sleeves: '#6b6b4a', belt: '#4a3a2a', patch: t }, tool: 'shovel', cap: '#5f6448' };
      default: return { kit: { legs: '#5a6a7a', boots: '#2b2a26', tunic: '#a89a72', tunicBottom: -30, sleeves: '#a89a72', vest: '#ff8a1f', patch: t }, tool: 'jackhammer', hardhat: '#e0b83a' };
    }
  }
  function drawWorker(u, step, swing) {
    const { kit, tool, headband, hood, apron, cap, hardhat } = workerKit(u);
    const mining = u.state === 'mine';
    const k = mining ? swing : 0.15;
    const hand = drawFigure(u, kit, step, k, 'strike');
    if (apron) poly([[-7, -52], [7, -52], [9, -22], [-9, -22]], apron, 1.3);
    if (headband) { ctx.strokeStyle = headband; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -72); ctx.lineTo(10, -72); ctx.stroke(); }
    if (hood) { ctx.beginPath(); ctx.moveTo(-10, -66); ctx.quadraticCurveTo(-4, -86, 8, -80); ctx.quadraticCurveTo(14, -74, 10, -66); ctx.lineTo(4, -60); ctx.lineTo(-8, -60); ctx.closePath(); ink(hood, 1.3); circle(1, -70, 7, SKIN, 1.2); ctx.fillStyle = INK; ctx.fillRect(4, -71, 2, 2); }
    if (cap) { ctx.beginPath(); ctx.arc(1, -74, 9, Math.PI, 0); ctx.closePath(); ink(cap, 1.3); rect(-2, -75, 16, 3, cap, 1.1); }
    if (hardhat) { ctx.beginPath(); ctx.arc(1, -74, 10, Math.PI, 0); ctx.closePath(); ink(hardhat, 1.3); rect(-11, -75, 24, 3, hardhat, 1.1); }
    ctx.save(); ctx.translate(hand.x, hand.y);
    const wood = '#8a5a34';
    if (tool === 'stonepick') { ctx.rotate(-1.3 + k * 1.5); rect(-2, -30, 4, 36, wood, 1.3); poly([[-12, -32], [0, -40], [12, -32], [8, -26], [-8, -26]], '#9aa0a6', 1.3); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -34); ctx.lineTo(5, -26); ctx.moveTo(5, -34); ctx.lineTo(-5, -26); ctx.stroke(); }
    else if (tool === 'pick') { ctx.rotate(-1.3 + k * 1.5); rect(-2, -34, 4, 40, wood, 1.3); ctx.beginPath(); ctx.moveTo(-16, -30); ctx.quadraticCurveTo(0, -44, 16, -30); ctx.lineTo(14, -27); ctx.quadraticCurveTo(0, -37, -14, -27); ctx.closePath(); ink('#9aa0a6', 1.3); }
    else if (tool === 'shovel') { ctx.rotate(-1.0 + k * 1.2); rect(-2, -30, 4, 30, wood, 1.3); rect(-5, 0, 10, 4, wood, 1.1); poly([[-8, -30], [8, -30], [6, -46], [0, -50], [-6, -46]], '#9aa0a6', 1.3); }
    else { ctx.rotate(0.6 + k * 0.3); rect(-6, -6, 12, 16, '#e0b83a', 1.3); rect(-12, -10, 24, 6, '#3a3a34', 1.3); rect(-2, 10, 4, 22, '#9aa0a6', 1.3); if (mining) { ctx.fillStyle = 'rgba(120,110,90,.6)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 6, 34 + Math.sin(u.phase * 30 + i) * 3, 3, 0, Math.PI * 2); ctx.fill(); } } }
    ctx.restore();
    if (mining && swing > 0.85) {
      // Gouden vonkjes bij elke slag in de mijn.
      ctx.fillStyle = '#ffd35c';
      for (let i = 0; i < 3; i++) { const a = u.phase * 3 + i * 2.1, r = 8 + i * 5; ctx.beginPath(); ctx.arc(hand.x + 10 + Math.cos(a) * r, hand.y - 6 + Math.sin(a) * r * 0.6, 1.8, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function drawInfantry(u, step, swing) {
    const t = team(u.side);
    if (u.role === 'worker') { drawWorker(u, step, swing); return; }
    if (u.role === 'hero') { drawHero(u, step, swing); return; }
    const wpn = (u.role === 'ranged' ? RANGED_WEAPON : MELEE_WEAPON)[u.era];
    const mode = isGun(wpn) || wpn === 'crossbow' || wpn === 'bow' ? 'aim' : wpn === 'sling' ? 'hold' : 'strike';
    const hand = drawFigure(u, kitFor(u), step, swing, mode);
    drawWeaponInk(wpn, hand, swing, t);
  }

  // ---------- Heavy units per era ----------
  function drawHorse(color, bob, caparison) {
    const stepA = Math.sin(bob) * 5;
    for (const [x, d] of [[-20, 1], [16, -1], [-8, -1], [26, 1]]) limb(x, -30, x + d * stepA, 0, color, 5);
    ctx.beginPath(); ctx.ellipse(0, -38, 30, 14, 0, 0, Math.PI * 2); ink(color, 1.8);
    if (caparison) poly([[-26, -44], [26, -44], [30, -22], [-30, -22]], caparison, 1.4);
    poly([[20, -46], [34, -66], [44, -60], [36, -40]], color, 1.6);
    ctx.beginPath(); ctx.ellipse(44, -64, 10, 6, 0.3, 0, Math.PI * 2); ink(color, 1.6);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(47, -66, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-28, -44); ctx.quadraticCurveTo(-38, -34, -34, -16); ctx.stroke();
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(22, -50); ctx.quadraticCurveTo(32, -70, 40, -70); ctx.stroke();
  }
  function drawMammoth(fur, bob) {
    const stepA = Math.sin(bob) * 4;
    for (const [x, d] of [[-24, 1], [18, -1], [-10, -1], [30, 1]]) rect(x - 6 + d * stepA * 0.5, -22, 12, 22, '#6e4a30', 1.6);
    ctx.beginPath(); ctx.ellipse(0, -40, 40, 26, 0, 0, Math.PI * 2); ink('#7a5236', 1.8);
    ctx.beginPath(); ctx.moveTo(-40, -50); ctx.quadraticCurveTo(-10, -78, 30, -60); ctx.quadraticCurveTo(0, -60, -40, -50); ctx.closePath(); ink('#5c3a24', 1.2);
    circle(40, -46, 16, '#7a5236', 1.8);
    ctx.beginPath(); ctx.moveTo(50, -40); ctx.quadraticCurveTo(64, -30, 56, -8); ctx.quadraticCurveTo(52, -6, 50, -12); ctx.quadraticCurveTo(56, -28, 46, -36); ctx.closePath(); ink('#7a5236', 1.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(44, -36); ctx.quadraticCurveTo(66, -34, 62, -18); ctx.stroke();
    ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(44, -36); ctx.quadraticCurveTo(66, -34, 62, -18); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(44, -50, 1.8, 0, Math.PI * 2); ctx.fill();
    rect(-16, -70, 32, 8, fur, 1.4);
  }
  function drawCannon() {
    circle(-10, -12, 13, '#8a5a34', 1.8); circle(-10, -12, 4, '#4a3a2a', 1.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-10 + Math.cos(i) * 12, -12 + Math.sin(i) * 12); ctx.stroke(); }
    poly([[-30, -6], [-12, -22], [8, -20], [-20, -2]], '#8a5a34', 1.4);
    ctx.save(); ctx.translate(-6, -26); ctx.rotate(-0.35); poly([[-14, -6], [36, -5], [36, 5], [-14, 6]], '#2b2b2b', 1.6); rect(-16, -8, 6, 16, '#2b2b2b', 1.3); ctx.restore();
  }
  function drawTank(side) {
    poly([[-42, -12], [-38, -26], [38, -26], [42, -12]], '#5f6448', 1.8);
    rect(-44, -14, 88, 14, '#3a3a34', 1.8);
    for (let i = -4; i <= 4; i++) circle(i * 10, -7, 4, '#6b6b60', 1.2);
    rect(-18, -44, 36, 18, '#5f6448', 1.8);
    rect(14, -40, 40, 5, '#3a3a34', 1.4);
    circle(-4, -46, 5, '#4f5443', 1.2);
    ctx.fillStyle = team(side); ctx.fillRect(-14, -40, 8, 6);
  }
  function drawArmoredCar(side) {
    poly([[-44, -14], [-40, -34], [-14, -34], [-6, -44], [30, -44], [40, -34], [46, -14]], '#a89a72', 1.8);
    rect(-46, -16, 92, 10, '#7a7460', 1.6);
    rect(-2, -41, 26, 7, '#3a4a5a', 1.2);
    for (const x of [-26, 26]) { circle(x, -6, 10, '#2b2a26', 1.8); circle(x, -6, 4, '#6b6b60', 1.2); }
    rect(8, -56, 16, 12, '#7a7460', 1.4); rect(20, -53, 22, 4, '#3a3a34', 1.2);
    ctx.fillStyle = team(side); ctx.fillRect(-36, -30, 10, 6);
  }
  function drawHeavy(u, swing) {
    const bob = u.phase * 7, t = team(u.side);
    const rider = (kit, mode, wpn, sx, sy, sc = 0.8, seated = true) => { ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc); const hand = drawFigure(u, kit, 0, swing, mode, seated); drawWeaponInk(wpn, hand, swing, t); ctx.restore(); };
    const kit = kitFor(u);
    ctx.save(); ctx.scale(1.15, 1.15);
    if (u.era === 0) { drawMammoth(kit.tunic, bob); rider(kit, 'strike', 'stoneaxe', -4, -42); }
    else if (u.era === 1) {
      // Strijdwagen: paard voor een tweewielige kar met een speerwerper.
      ctx.save(); ctx.translate(30, 0); drawHorse('#8a5a34', bob); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, -30); ctx.lineTo(6, -30); ctx.stroke();
      circle(-30, -12, 12, '#8a5a34', 1.8); circle(-30, -12, 3, '#4a3a2a', 1.2);
      poly([[-46, -24], [-16, -24], [-14, -44], [-48, -48]], t, 1.6);
      rider(kit, 'strike', 'spear', -30, -24, 0.78, false);
    }
    else if (u.era === 2) { drawHorse('#5a4030', bob, t); rider({ ...kit, helmet: 'greathelm', plume: t, shield: 'heater' }, 'strike', 'lance', -2, -20); }
    else if (u.era === 3) { drawCannon(); rider(kit, 'hold', 'rammer', -34, 0, 0.85, false); }
    else if (u.era === 4) { drawHorse('#3a2a20', bob, null); rider({ ...kit, helmet: 'tricorn' }, 'strike', 'saber', -2, -20); }
    else if (u.era === 5) drawTank(u.side);
    else drawArmoredCar(u.side);
    ctx.restore();
  }
  function drawSoldier(u) {
    const moving = u.state === 'move';
    const fighting = u.state === 'fight' || u.state === 'siege';
    const step = moving ? Math.sin(u.phase * 7) * 9 : 3;
    const swing = fighting ? Math.sin(u.phase * 14) * 0.5 + 0.5 : 0.2;
    if (u.role === 'heavy') drawHeavy(u, swing); else drawInfantry(u, step, swing);
    if (u.flash > 0) {
      ctx.globalAlpha = Math.min(1, u.flash * 6); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(6, -42, 24, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function drawUnit(u) {
    ctx.save();
    if (u.dead) {
      ctx.globalAlpha = Math.max(0, 1 - u.deathT / 0.55);
      ctx.translate(u.x, u.y + u.deathT * 10); ctx.scale(u.dir, 1); ctx.rotate(0.9 * (u.deathT / 0.55));
      drawSoldier(u); ctx.restore(); return;
    }
    ctx.translate(u.x, u.y); ctx.scale(u.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 2, u.role === 'heavy' ? 44 : 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (state.elapsed < state[u.side].rallyUntil) { ctx.fillStyle = 'rgba(255,211,92,.3)'; ctx.beginPath(); ctx.ellipse(0, -2, 30, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    drawSoldier(u);
    ctx.restore();
    if (u.hp < u.maxHp) {
      const w = u.role === 'heavy' ? 44 : u.role === 'hero' ? 34 : 28, top = u.y - (u.role === 'heavy' ? 96 : u.role === 'hero' ? 104 : 88);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(u.x - w / 2, top, w, 5);
      ctx.fillStyle = u.side === 'player' ? '#9fe08a' : '#ff9a8a';
      ctx.fillRect(u.x - w / 2, top, w * Math.max(0, u.hp / u.maxHp), 5);
    }
  }

  // ---------- Effects ----------
  function drawShot(e) {
    const k = Math.min(1, e.t / 0.22);
    const x = e.x1 + (e.x2 - e.x1) * k, y = e.y1 + (e.y2 - e.y1) * k - Math.sin(k * Math.PI) * (e.heavy ? 90 : e.era <= 2 ? 26 : 4);
    const ang = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (e.heavy) { circle(0, 0, e.era <= 2 ? 7 : 5, e.era <= 2 ? '#7a7a7a' : '#222', 1.2); }
    else if (e.era <= 2) { ctx.fillStyle = '#5a4128'; ctx.fillRect(-10, -1, 20, 2); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(15, 0); ctx.lineTo(10, 3); ctx.fill(); }
    else { ctx.fillStyle = '#ffe28a'; ctx.fillRect(-8, -1, 16, 2); if (e.t < 0.08) { ctx.fillStyle = 'rgba(255,200,80,.8)'; ctx.beginPath(); ctx.arc(-14, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(200,200,200,.5)'; ctx.beginPath(); ctx.arc(-18, -4, 5, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  function drawSpecial(e) {
    const mirror = e.side === 'enemy';
    const t = e.t / 1.4;
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = `rgba(255,220,120,${0.25 * (1 - t)})`; ctx.fillRect(W / 2 - 80, 0, W, GROUND_Y + 22);
    for (let i = 0; i < 14; i++) {
      const s = seeded(i + e.era * 7), x = W / 2 - 40 + s * (W / 2 + 20), delay = seeded(i * 3) * 0.5;
      const k = Math.min(1, Math.max(0, (t - delay) / 0.5));
      if (k <= 0) continue;
      const y = -20 + k * (GROUND_Y + 10);
      ctx.save(); ctx.translate(x, y);
      if (e.era === 0) circle(0, 0, 9, '#6b5a45', 1.4);
      else if (e.era === 1) { ctx.rotate(1.3); ctx.fillStyle = '#5a4128'; ctx.fillRect(-12, -1, 24, 2); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(17, 0); ctx.lineTo(12, 3); ctx.fill(); }
      else if (e.era === 2) circle(0, 0, 12, '#7a7a7a', 1.4);
      else if (e.era <= 4) circle(0, 0, 7, '#222', 1.2);
      else if (e.era === 5) { ctx.rotate(1.4); rect(-10, -4, 20, 8, '#3a3a3a', 1.2); ctx.fillStyle = '#c96'; ctx.fillRect(10, -3, 5, 6); }
      else { ctx.rotate(1.2); rect(-14, -4, 28, 8, '#4a4f55', 1.2); ctx.fillStyle = '#d24b3a'; ctx.fillRect(-18, -6, 6, 12); }
      ctx.restore();
      if (k >= 1) { ctx.fillStyle = `rgba(255,150,60,${0.6 * (1 - t)})`; ctx.beginPath(); ctx.arc(x, GROUND_Y - 6, 18 + (t - delay) * 30, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function drawEffects() {
    for (const e of state.effects) {
      if (e.kind === 'hit') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - e.t / 0.3; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 4 + e.t * 40, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (e.kind === 'shot') drawShot(e);
      else if (e.kind === 'special') drawSpecial(e);
      else if (e.kind === 'rally') {
        const cx = e.side === 'player' ? P_CASTLE_X : E_CASTLE_X;
        ctx.fillStyle = `rgba(255,211,92,${0.5 * (1 - e.t)})`; ctx.beginPath(); ctx.arc(cx, GROUND_Y - 120, 40 + e.t * 160, 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'evolve') {
        const cx = e.side === 'player' ? P_CASTLE_X : E_CASTLE_X, a = 1 - e.t / 1.4;
        ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`; ctx.fillRect(cx - 170, 0, 340, GROUND_Y + 22);
        ctx.strokeStyle = `rgba(255,211,92,${a})`; ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 + e.t; ctx.beginPath(); ctx.moveTo(cx, GROUND_Y - 100); ctx.lineTo(cx + Math.cos(ang) * (60 + e.t * 200), GROUND_Y - 100 + Math.sin(ang) * (60 + e.t * 200)); ctx.stroke(); }
      }
    }
  }

  function render() {
    ctx = screen;
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawMine(state.player.era, false); drawMine(state.enemy.era, true);
    drawWalls(state.player.era, state.player.wallsLevel, false); drawWalls(state.enemy.era, state.enemy.wallsLevel, true);
    drawCastle(P_CASTLE_X, state.player, 'player', false);
    drawCastle(E_CASTLE_X, state.enemy, 'enemy', true);
    const sorted = state.units.slice().sort((a, b) => a.y - b.y);
    for (const u of sorted) drawUnit(u);
    drawEffects();
  }
  function frame() {
    if (stopped || !canvas.isConnected) return;
    if (state) { render(); onFrame?.(state); }
    requestAnimationFrame(frame);
  }
  return {
    get state() { return state; },
    setState(snapshot) { state = snapshot; },
    start(cb) { onFrame = cb; requestAnimationFrame(frame); },
    stop() { stopped = true; }
  };
}
