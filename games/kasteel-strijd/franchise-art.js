// Castle Defense — franchise-art: dezelfde geschilderde diorama-stijl als Trough the Ages,
// maar met vijf upgrades binnen Star Wars, Lord of the Rings of Harry Potter.
// Alle vormen worden gevuld én omlijnd met de inkthelpers uit engine.js.

const W = 1400, H = 584, GROUND_Y = 460;
const MINE_X = 430, WALL_X = 266;
const INK = '#3a2418', SKIN = '#c98e64', HAIR = '#3b2a1e';

// Kamp-identiteit: accent, stof, metaal en het soort energie/magie dat het kamp uitstraalt.
const CAMPS = {
  jedi: { accent: '#63bfff', cloth: '#e2d8c2', robe: '#b9a888', metal: '#cfd6dd', shade: '#7d8794', energy: 'saber', beast: 'walker', emblem: 'ring' },
  sith: { accent: '#ed4545', cloth: '#3c3a40', robe: '#2a262c', metal: '#9aa0a6', shade: '#4a4650', energy: 'saber', beast: 'walker', emblem: 'hex' },
  good: { accent: '#e2ca79', cloth: '#dfd6be', robe: '#7f9a5c', metal: '#c3c7cc', shade: '#8a7f63', energy: 'steel', beast: 'horse', emblem: 'tree' },
  evil: { accent: '#739452', cloth: '#4a4438', robe: '#3a3128', metal: '#8e8a80', shade: '#3f3a30', energy: 'steel', beast: 'mammoth', emblem: 'eye' },
  harry: { accent: '#6aaee5', cloth: '#5a2b2b', robe: '#2f2a3c', metal: '#c9b789', shade: '#463f58', energy: 'spell', beast: 'griffin', emblem: 'bolt' },
  voldemort: { accent: '#86bd55', cloth: '#2a2a2e', robe: '#1e1e22', metal: '#8a8f86', shade: '#33313a', energy: 'spell', beast: 'serpent', emblem: 'skull' }
};
const DEFAULT_CAMP = CAMPS.jedi;

// Wereldpalet per franchise; het decor verschuift licht per upgrade.
const WORLDS = {
  starwars: { sky: ['#101a2c', '#41597f'], haze: 'rgba(120,160,210,.35)', far: '#2b3a52', hill: '#3e4a5c', ground: '#8e8474', ground2: '#6d6455' },
  lotr: { sky: ['#6f9fc6', '#dce7de'], haze: 'rgba(225,235,220,.45)', far: '#6c7f86', hill: '#5f7a4a', ground: '#7d8a55', ground2: '#5d6a3c' },
  harrypotter: { sky: ['#1d1c33', '#5a5578'], haze: 'rgba(150,140,190,.35)', far: '#2f2c46', hill: '#3c4442', ground: '#5a5b48', ground2: '#43442f' }
};
const DEFAULT_WORLD = WORLDS.starwars;

function seeded(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function shade(color, amount) {
  const n = parseInt(color.slice(1), 16);
  const mix = (c) => Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return '#' + [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function createFranchiseArt({ ctx: getCtx, state: getState, rect, circle, poly, limb, flag, horse, mammoth }) {
  let ctx = null, state = null;
  const sync = () => { ctx = getCtx(); state = getState(); };
  const now = () => (state ? state.elapsed : 0);
  const world = () => WORLDS[state && state.franchise] || DEFAULT_WORLD;
  const campOf = (side) => CAMPS[state && state[side] && state[side].faction] || DEFAULT_CAMP;
  const stageOf = (side) => Math.max(0, Math.min(4, (state && state[side] && state[side].era) || 0));

  function ink(color, width = 1.6) { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.stroke(); }
  function glow(color, blur, draw) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; draw(); ctx.restore(); }

  // ---------- Achtergrond ----------
  function ridge(fn, xa, xb, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(xa, GROUND_Y + 1);
    for (let x = xa; x <= xb; x += 10) ctx.lineTo(x, fn(x));
    ctx.lineTo(xb, GROUND_Y + 1); ctx.closePath(); ctx.fill();
  }
  function skyline(camp, xa, xb, stage) {
    // Kampsilhouetten in de verte: torens of bergkammen, hoger naarmate het kamp evolueert.
    ctx.fillStyle = 'rgba(20,18,26,.35)';
    for (let i = 0; i < 4; i++) {
      const x = xa + (xb - xa) * (0.15 + i * 0.23) + seeded(i * 5) * 20;
      const h = 60 + stage * 16 + seeded(i * 3) * 40;
      if (camp.beast === 'walker') { ctx.fillRect(x - 14, GROUND_Y - 110 - h * 0.4, 28, h * 0.4 + 40); ctx.fillRect(x - 4, GROUND_Y - 150 - h * 0.4, 8, 40); }
      else { ctx.beginPath(); ctx.moveTo(x - 46, GROUND_Y - 96); ctx.lineTo(x, GROUND_Y - 96 - h); ctx.lineTo(x + 46, GROUND_Y - 96); ctx.closePath(); ctx.fill(); }
    }
  }
  function background() {
    sync();
    const w = world();
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, w.sky[0]); sky.addColorStop(1, w.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND_Y);
    for (let i = 0; i < 26; i++) {
      const x = seeded(i * 9 + 1) * W, y = seeded(i * 9 + 2) * GROUND_Y * 0.8, r = 30 + seeded(i * 9 + 3) * 110;
      ctx.fillStyle = `rgba(255,255,255,${0.02 + seeded(i * 9 + 4) * 0.05})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, seeded(i) * 3, 0, Math.PI * 2); ctx.fill();
    }
    skyline(campOf('player'), 0, W / 2, stageOf('player'));
    skyline(campOf('enemy'), W / 2, W, stageOf('enemy'));
    ridge((x) => GROUND_Y - 132 + Math.sin(x / 90) * 18 + Math.sin(x / 37) * 6, 0, W, w.far);
    ridge((x) => GROUND_Y - 70 + Math.sin(x / 160 + 1) * 22 + Math.sin(x / 55) * 5, 0, W, w.hill);
    const haze = ctx.createLinearGradient(0, GROUND_Y - 190, 0, GROUND_Y);
    haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(1, w.haze);
    ctx.fillStyle = haze; ctx.fillRect(0, GROUND_Y - 190, W, 190);
    const soil = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    soil.addColorStop(0, w.ground); soil.addColorStop(1, w.ground2);
    ctx.fillStyle = soil; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = 'rgba(40,30,20,.18)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) {
      const x = seeded(i * 11) * W, y = GROUND_Y + 8 + seeded(i * 11 + 3) * (H - GROUND_Y - 14);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 24, y - 4, x + 52, y); ctx.stroke();
    }
    // Zachte energie- of magiegloed boven elke helft houdt de twee kampen leesbaar gescheiden.
    for (const side of ['player', 'enemy']) {
      const camp = campOf(side), cx = side === 'player' ? W * 0.25 : W * 0.75;
      ctx.fillStyle = camp.accent + '14';
      ctx.beginPath(); ctx.ellipse(cx, GROUND_Y - 40, 300, 150, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Veld: mijn en muren ----------
  function field(side) {
    sync();
    const camp = campOf(side), army = (state && state[side]) || {}, stage = stageOf(side);
    ctx.save();
    if (side === 'enemy') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    // Mijn: rotsader die oplicht in de kampkleur.
    ctx.save(); ctx.translate(MINE_X, GROUND_Y + 4);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 2, 60, 8, 0, 0, Math.PI * 2); ctx.fill();
    poly([[-46, 0], [-36, -30], [-14, -40], [10, -34], [24, -44], [44, -26], [50, 0]], shade(camp.shade, 0.25), 1.8);
    poly([[-30, -6], [-22, -22], [-8, -18], [-12, -4]], camp.shade, 1.2);
    glow(camp.accent, 8, () => {
      ctx.fillStyle = camp.accent;
      for (const [x, y] of [[-20, -14], [6, -24], [30, -20], [-4, -8], [18, -6]]) {
        ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
      }
    });
    rect(-74, -16, 24, 14, camp.metal, 1.4); circle(-68, 0, 5, INK, 1.2); circle(-56, 0, 5, INK, 1.2);
    ctx.restore();
    // Muren: drie tiers, zwaarder per muurniveau en iets hoger per upgrade.
    const level = army.wallsLevel || 1;
    const tier = level >= 7 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0;
    if (tier) {
      const base = GROUND_Y + 6;
      for (let i = 0; i < 3; i++) poly([[WALL_X - 30 + i * 20, base], [WALL_X - 26 + i * 20, base - 26 - stage * 2], [WALL_X - 10 + i * 20, base - 26 - stage * 2], [WALL_X - 6 + i * 20, base]], camp.metal, 1.5);
      if (tier >= 2) {
        rect(WALL_X - 26, base - 58, 52, 34, shade(camp.shade, 0.15), 1.8);
        for (let i = 0; i < 3; i++) rect(WALL_X - 24 + i * 17, base - 68, 11, 10, camp.metal, 1.3);
        glow(camp.accent, 6, () => { ctx.strokeStyle = camp.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(WALL_X - 24, base - 44); ctx.lineTo(WALL_X + 24, base - 44); ctx.stroke(); });
      }
      if (tier === 3) poly([[WALL_X + 20, base - 2], [WALL_X + 80, base - 2], [WALL_X + 70, base + 28], [WALL_X + 30, base + 28]], '#3a2a20', 1.6);
    }
    ctx.restore();
  }

  // ---------- Basis ----------
  function base(cx, army, side) {
    sync();
    const camp = campOf(side), stage = Math.max(0, Math.min(4, army.era || 0)), baseY = GROUND_Y + 18;
    ctx.save();
    if (side === 'enemy') { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    for (let i = 4; i > 0; i--) {
      ctx.fillStyle = `rgba(38,27,17,${0.035 + (4 - i) * 0.015})`;
      ctx.beginPath(); ctx.ellipse(cx + 12, baseY + 1, 112 + i * 9, 10 + i * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    const grow = 1 + stage * 0.06, h = (110 + stage * 12) * grow, wide = 96 * grow;
    const wall = ctx.createLinearGradient(cx - wide, baseY - h, cx + wide, baseY);
    wall.addColorStop(0, shade(camp.shade, 0.35)); wall.addColorStop(0.5, camp.shade); wall.addColorStop(1, shade(camp.shade, -0.35));
    // Uitgesleten toegangspad verbindt de basis met het terrein.
    ctx.beginPath(); ctx.moveTo(cx - 17, baseY - 8); ctx.lineTo(cx + 18, baseY - 8);
    ctx.quadraticCurveTo(cx + 29, baseY + 20, cx + 66, baseY + 42); ctx.quadraticCurveTo(cx + 8, baseY + 30, cx - 17, baseY - 8);
    ctx.fillStyle = 'rgba(120,108,88,.55)'; ctx.fill();
    if (camp.beast === 'walker') {
      // Star Wars: hoekige hangar met landingsdek en antennes.
      poly([[cx - wide, baseY], [cx - wide + 14, baseY - h], [cx + wide - 14, baseY - h], [cx + wide, baseY]], wall, 1.8);
      rect(cx - wide + 26, baseY - h - 16, wide, 16, camp.metal, 1.5);
      for (let i = 0; i < 4; i++) rect(cx - 62 + i * 34, baseY - h + 18, 20, 26, shade(camp.shade, -0.25), 1.2);
      rect(cx - 16, baseY - 46, 32, 46, '#1d1b20', 1.6);
      for (const dx of [-wide + 20, wide - 22]) limb(cx + dx, baseY - h, cx + dx, baseY - h - 34, camp.metal, 3);
    } else if (camp.beast === 'horse' || camp.beast === 'mammoth') {
      // Lord of the Rings: burcht met hoektorens en een diepe poort.
      poly([[cx - wide, baseY], [cx - wide + 8, baseY - h], [cx + wide - 8, baseY - h], [cx + wide, baseY]], wall, 1.8);
      for (let i = 0; i < 5; i++) rect(cx - wide + 10 + i * (wide * 2 - 30) / 4, baseY - h - 12, 16, 12, camp.metal, 1.3);
      for (const dx of [-wide + 6, wide - 28]) {
        rect(cx + dx, baseY - h - 44, 22, 46, shade(camp.shade, 0.1), 1.6);
        poly([[cx + dx - 5, baseY - h - 44], [cx + dx + 11, baseY - h - 76], [cx + dx + 27, baseY - h - 44]], camp.accent, 1.5);
      }
      ctx.beginPath(); ctx.moveTo(cx - 20, baseY); ctx.lineTo(cx - 20, baseY - 34);
      ctx.quadraticCurveTo(cx, baseY - 60, cx + 20, baseY - 34); ctx.lineTo(cx + 20, baseY); ctx.closePath(); ink('#241a12', 1.6);
    } else {
      // Harry Potter: kasteeltorens met verlichte ramen.
      poly([[cx - wide, baseY], [cx - wide + 10, baseY - h * 0.8], [cx + wide - 10, baseY - h * 0.8], [cx + wide, baseY]], wall, 1.8);
      for (const [dx, th] of [[-wide + 4, h], [wide - 32, h * 0.85], [-14, h * 1.15]]) {
        rect(cx + dx, baseY - th, 28, th, shade(camp.shade, 0.12), 1.6);
        poly([[cx + dx - 6, baseY - th], [cx + dx + 14, baseY - th - 40], [cx + dx + 34, baseY - th]], camp.accent, 1.5);
        glow(camp.accent, 7, () => { ctx.fillStyle = '#ffd98a'; ctx.fillRect(cx + dx + 10, baseY - th + 20, 8, 12); });
      }
      rect(cx - 14, baseY - 42, 28, 42, '#1d1a22', 1.6);
    }
    // Metselwerk en zichtbaar materiaallicht.
    ctx.strokeStyle = 'rgba(30,22,15,.2)'; ctx.lineWidth = 1;
    for (let y = baseY - h + 14; y < baseY - 6; y += 14) { ctx.beginPath(); ctx.moveTo(cx - wide + 10, y); ctx.lineTo(cx + wide - 10, y); ctx.stroke(); }
    emblem(cx, baseY - h * 0.55, 16, camp);
    for (let i = 0; i < 9; i++) {
      const x = cx - 94 + i * 23;
      if (Math.abs(x - cx) < 29) continue;
      ctx.beginPath(); ctx.ellipse(x, baseY + 2 + seeded(i) * 4, 5 + seeded(i + 20) * 4, 3, -0.15, 0, Math.PI * 2); ink('#827d6e', 0.7);
    }
    flag(cx + 90, baseY - 100, camp.accent);
    const topY = baseY - h - (camp.beast === 'walker' ? 16 : 0);
    (army.turrets || []).forEach((t, i) => turret(cx - 50 + i * 50, topY, t.cd || 0, t.type || 'near', camp));
    ctx.restore();
    const pct = (army.castleHp || 0) / (army.castleMaxHp || 1);
    if (pct < 0.4) {
      ctx.fillStyle = `rgba(60,20,10,${0.35 * (1 - pct / 0.4)})`;
      ctx.fillRect(cx - 160, baseY - 240, 320, 240);
      ctx.fillStyle = 'rgba(80,80,80,.5)';
      for (let k = 0; k < 3; k++) { const t = (now() * 0.7 + k * 0.8) % 2.4; ctx.beginPath(); ctx.arc(cx - 40 + k * 40 + t * 8, baseY - 120 - t * 45, 10 + t * 8, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function emblem(x, y, r, camp) {
    glow(camp.accent, 10, () => {
      if (camp.emblem === 'ring') { ctx.strokeStyle = camp.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
      else if (camp.emblem === 'hex') poly([[x, y - r], [x + r, y - r / 2], [x + r, y + r / 2], [x, y + r], [x - r, y + r / 2], [x - r, y - r / 2]], camp.accent, 1.4);
      else if (camp.emblem === 'tree') { limb(x, y + r, x, y - r * 0.2, camp.accent, 3); for (const s of [-1, 1]) limb(x, y, x + s * r * 0.8, y - r, camp.accent, 2); }
      else if (camp.emblem === 'eye') { poly([[x - r, y], [x, y - r * 0.6], [x + r, y], [x, y + r * 0.6]], camp.accent, 1.4); circle(x, y, r * 0.3, INK, 1); }
      else if (camp.emblem === 'bolt') poly([[x - 3, y - r], [x + r * 0.6, y - 2], [x + 1, y - 2], [x + 5, y + r], [x - r * 0.7, y + 1], [x - 1, y + 1]], camp.accent, 1.2);
      else { circle(x, y - r * 0.2, r * 0.7, camp.accent, 1.4); ctx.fillStyle = INK; ctx.fillRect(x - 5, y - 4, 3, 4); ctx.fillRect(x + 2, y - 4, 3, 4); }
    });
  }
  function turret(x, y, cd, type, camp) {
    ctx.fillStyle = 'rgba(30,22,15,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 1, 23, 5, 0, 0, Math.PI * 2); ctx.fill();
    poly([[x - 20, y], [x - 16, y - 14], [x + 16, y - 14], [x + 20, y]], camp.metal, 1.3);
    if (type === 'bonus') {
      // Banier: stok met golvend vaandel en het kampembleem.
      limb(x, y - 8, x, y - 69, camp.metal, 3);
      const wave = Math.sin(now() * 3 + x) * 3;
      ctx.beginPath(); ctx.moveTo(x + 2, y - 62);
      ctx.bezierCurveTo(x + 13, y - 69, x + 23, y - 56 + wave, x + 33, y - 62 + wave);
      ctx.lineTo(x + 30, y - 29 + wave); ctx.quadraticCurveTo(x + 17, y - 35, x + 3, y - 29); ctx.closePath(); ink(camp.accent, 1.3);
      emblem(x + 17, y - 46, 6, camp);
      return;
    }
    const far = type === 'far';
    const recoil = cd > (far ? 1.9 : 0.8) ? (cd - (far ? 1.9 : 0.8)) * 20 : 0;
    rect(x - 9, y - 27, 18, 13, camp.shade, 1.2); circle(x, y - 20, 5, camp.metal, 1);
    ctx.save(); ctx.translate(x - recoil, y - 29); ctx.rotate(far ? -0.85 : -0.25); if (far) ctx.scale(1.15, 1.15);
    if (camp.energy === 'saber') { rect(0, -5, 34, 10, camp.metal, 1.2); glow(camp.accent, 8, () => { ctx.fillStyle = camp.accent; ctx.fillRect(30, -2, 10, 4); }); }
    else if (camp.energy === 'spell') { limb(0, 0, 28, 0, camp.metal, 4); glow(camp.accent, 10, () => circle(32, 0, 6, camp.accent, 1)); }
    else {
      rect(0, -3, 36, 6, '#8a5a34', 1.2);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(8, -15); ctx.quadraticCurveTo(-2, 0, 8, 15); ctx.stroke();
      poly([[28, -3], [42, 0], [28, 3]], camp.metal, 1);
    }
    ctx.restore();
  }

  // ---------- Figuren ----------
  // Eén ingekt silhouet met kampgewaad, borstembleem en energie; de rol bepaalt de uitrusting.
  function figure(u, camp, step, swing, scale) {
    ctx.save(); ctx.scale(scale, scale);
    const lift = Math.abs(step) * 0.25;
    limb(-3, -30, -8 - step * 0.6, -2 - (step > 0 ? lift : 0), camp.robe, 6);
    limb(3, -30, 8 + step * 0.6, -2 - (step < 0 ? lift : 0), camp.robe, 6);
    poly([[-9, -60], [9, -60], [11, -26], [-11, -26]], camp.cloth, 1.6);
    poly([[-9, -60], [9, -60], [13, -34], [-13, -34]], camp.robe, 1.4);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-6, -56); ctx.quadraticCurveTo(-2, -44, -5, -32); ctx.stroke();
    circle(1, -70, 9, SKIN, 1.6);
    ctx.fillStyle = HAIR; ctx.fillRect(-7, -79, 16, 5);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(5, -70, 1.4, 0, Math.PI * 2); ctx.fill();
    glow(camp.accent, 6, () => { ctx.fillStyle = camp.accent; ctx.beginPath(); ctx.arc(-8, -54, 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = camp.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-5, -48); ctx.lineTo(0, -43); ctx.lineTo(5, -48); ctx.stroke();
    const hand = { x: 15 + swing * 6, y: -50 - swing * 8 };
    limb(6, -56, hand.x, hand.y, camp.robe, 5);
    limb(-6, -56, -10, -40 + swing * 4, camp.robe, 5);
    ctx.restore();
    return { x: hand.x * scale, y: hand.y * scale };
  }
  function weapon(u, camp, hand, swing) {
    const accent = camp.accent;
    if (camp.energy === 'saber' && u.role !== 'ranged') {
      limb(hand.x, hand.y, hand.x + 4, hand.y + 8, camp.metal, 4);
      glow(accent, 9, () => { ctx.strokeStyle = accent; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + 16, hand.y - 22 + swing * 20); ctx.stroke(); });
      return;
    }
    if (camp.energy === 'saber') {
      rect(hand.x - 6, hand.y - 3, 26, 6, camp.metal, 1.2);
      glow(accent, 8, () => { ctx.fillStyle = accent; ctx.fillRect(hand.x + 20, hand.y - 1.5, 6, 3); });
      return;
    }
    if (camp.energy === 'spell') {
      limb(hand.x, hand.y, hand.x + 18, hand.y - 8, '#6b4a2e', 3);
      glow(accent, 10, () => {
        ctx.fillStyle = accent;
        for (let i = 0; i < 3; i++) { const a = u.phase * 2 + i * 2.1; ctx.beginPath(); ctx.arc(hand.x + 20 + Math.cos(a) * 5, hand.y - 8 + Math.sin(a) * 5, 1.8, 0, Math.PI * 2); ctx.fill(); }
      });
      return;
    }
    if (u.role === 'ranged') {
      ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hand.x + 4, hand.y, 18, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#e6dcc0'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(hand.x + 12, hand.y - 16); ctx.lineTo(hand.x + 2 - swing * 6, hand.y); ctx.lineTo(hand.x + 12, hand.y + 16); ctx.stroke();
      return;
    }
    limb(hand.x - 8, hand.y + 16, hand.x + 14, hand.y - 20, '#6b4a2e', 3.5);
    poly([[hand.x + 12, hand.y - 18], [hand.x + 22, hand.y - 34], [hand.x + 20, hand.y - 14]], camp.metal, 1.2);
  }
  function tool(camp, hand, swing) {
    ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(-1.2 + swing * 1.4);
    rect(-2, -32, 4, 38, '#8a5a34', 1.3);
    ctx.beginPath(); ctx.moveTo(-16, -30); ctx.quadraticCurveTo(0, -44, 16, -30);
    ctx.lineTo(14, -27); ctx.quadraticCurveTo(0, -37, -14, -27); ctx.closePath(); ink(camp.metal, 1.3);
    ctx.restore();
  }
  function heavy(u, camp) {
    const bob = u.phase * 7;
    if (camp.beast === 'horse') { horse(camp.robe, bob, camp.accent); return; }
    if (camp.beast === 'mammoth') { mammoth(camp.accent, bob); return; }
    if (camp.beast === 'walker') {
      // Gepantserde loper: stappende poten en een geschutskoepel.
      for (const [x] of [[-24], [16], [-8], [28]]) {
        const sw = Math.sin(bob + x) * 6;
        limb(x, -46, x + sw, -22, camp.metal, 6); limb(x + sw, -22, x + sw * 0.4, 0, camp.metal, 5);
      }
      poly([[-40, -60], [34, -66], [44, -46], [-34, -40]], camp.shade, 1.8);
      rect(-18, -84, 42, 22, camp.metal, 1.6);
      glow(camp.accent, 8, () => { ctx.strokeStyle = camp.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(24, -74); ctx.lineTo(48, -74); ctx.stroke(); });
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-34, -56); ctx.lineTo(32, -60); ctx.stroke();
      for (let i = 0; i < 5; i++) circle(-30 + i * 14, -52, 1.2, camp.metal, 0.5);
      return;
    }
    if (camp.beast === 'griffin') {
      // Gevleugeld rijdier met vleugelslag boven een gedrongen lijf.
      const wing = Math.sin(bob * 0.6) * 16;
      poly([[-10, -60], [-46, -92 - wing], [-2, -70]], camp.cloth, 1.6);
      poly([[6, -60], [40, -96 - wing], [14, -68]], camp.cloth, 1.6);
      ctx.beginPath(); ctx.ellipse(0, -44, 34, 18, 0, 0, Math.PI * 2); ink(camp.robe, 1.8);
      for (const [x, d] of [[-20, 1], [18, -1]]) limb(x, -34, x + d * Math.sin(bob) * 5, 0, camp.robe, 5);
      circle(36, -56, 12, camp.cloth, 1.6);
      poly([[46, -58], [60, -52], [46, -48]], camp.accent, 1.2);
      return;
    }
    // Serpent: kronkelend lijf met opgeheven kop.
    ctx.beginPath(); ctx.moveTo(-50, -8);
    for (let i = 0; i <= 8; i++) { const x = -50 + i * 12; ctx.lineTo(x, -8 - Math.sin(bob + i * 0.8) * 10 - i * 2); }
    ctx.lineTo(46, -36); ctx.lineTo(-50, 4); ctx.closePath(); ink(camp.robe, 1.8);
    circle(52, -48, 13, camp.cloth, 1.8);
    glow(camp.accent, 8, () => { ctx.fillStyle = camp.accent; ctx.beginPath(); ctx.arc(57, -50, 2.4, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = camp.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(62, -44); ctx.lineTo(74, -40 + Math.sin(bob * 2) * 4); ctx.stroke();
  }
  function unit(u, step, swing) {
    sync();
    const camp = campOf(u.side);
    if (u.role === 'heavy') { heavy(u, camp); return; }
    const scale = u.role === 'hero' ? 1.24 : 1.18;
    const hand = figure(u, camp, step, swing, scale);
    if (u.role === 'worker') { tool(camp, hand, swing); return; }
    weapon(u, camp, hand, swing);
    if (u.role === 'hero') {
      // Held: kampmantel en een gouden ster boven het silhouet.
      poly([[-8, -74], [8, -70], [-2, -16], [-30, -8]], camp.accent, 1.6);
      ctx.fillStyle = '#e0b83a'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 6.5, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(1 + Math.cos(a) * r, -112 + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // ---------- Effecten ----------
  function shot(e) {
    sync();
    const camp = campOf(e.side);
    const k = Math.min(1, e.t / 0.22);
    const arc = camp.energy === 'saber' ? 2 : e.heavy ? 90 : 22;
    const x = e.x1 + (e.x2 - e.x1) * k, y = e.y1 + (e.y2 - e.y1) * k - Math.sin(k * Math.PI) * arc;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(e.y2 - e.y1, e.x2 - e.x1));
    if (camp.energy === 'saber') glow(camp.accent, 10, () => { ctx.fillStyle = camp.accent; ctx.fillRect(-12, -1.5, 24, 3); });
    else if (camp.energy === 'spell') glow(camp.accent, 12, () => { ctx.fillStyle = camp.accent; ctx.beginPath(); ctx.arc(0, 0, e.heavy ? 8 : 5, 0, Math.PI * 2); ctx.fill(); });
    else if (e.heavy) circle(0, 0, 7, '#7a7a7a', 1.2);
    else {
      ctx.fillStyle = '#5a4128'; ctx.fillRect(-10, -1, 20, 2);
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(15, 0); ctx.lineTo(10, 3); ctx.fill();
    }
    ctx.restore();
  }
  function special(e) {
    sync();
    const camp = campOf(e.side), t = Math.min(1, e.t / 1.4), mirror = e.side === 'enemy';
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = camp.accent + Math.round(40 * (1 - t)).toString(16).padStart(2, '0');
    ctx.fillRect(W / 2 - 80, 0, W, GROUND_Y + 22);
    for (let i = 0; i < 14; i++) {
      const s = seeded(i * 5 + 1), x = W / 2 - 40 + s * (W / 2 + 20), delay = seeded(i * 3) * 0.5;
      const k = Math.min(1, Math.max(0, (t - delay) / 0.5));
      if (k <= 0) continue;
      ctx.save(); ctx.translate(x, -20 + k * (GROUND_Y + 10));
      if (camp.energy === 'saber') glow(camp.accent, 12, () => { ctx.fillStyle = camp.accent; ctx.fillRect(-2, -18, 4, 36); });
      else if (camp.energy === 'spell') glow(camp.accent, 14, () => circle(0, 0, 9, camp.accent, 1));
      else { ctx.rotate(1.3); circle(0, 0, 9, '#6b5a45', 1.4); }
      ctx.restore();
      if (k >= 1) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(x, GROUND_Y - 6, 18 + (t - delay) * 30, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  return { background, field, base, unit, shot, special };
}
