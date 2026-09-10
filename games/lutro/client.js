const BOARD_SIZE = 15;
const DICE = ['–', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const CAMPS = [
  { key: 'red', name: 'Sauron', glyph: '◉', startIndex: 0 },
  { key: 'green', name: 'Elven', glyph: '❧', startIndex: 13 },
  { key: 'yellow', name: 'Dwergen', glyph: '⚒', startIndex: 26 },
  { key: 'blue', name: 'Mensen', glyph: '♜', startIndex: 39 }
];
const ATTACK_SITES = new Map([
  [0, 0], [9, 0],
  [13, 1], [22, 1],
  [26, 2], [35, 2],
  [39, 3], [48, 3]
]);
function unitSprite(E, player, pawn, className) {
  const sprite = E('span', `${className} lutro-unit-sprite camp-${player.camp} unit-${pawn.type}`);
  sprite.setAttribute('aria-hidden', 'true');
  return sprite;
}
const FACTION_CHOICES = [
  { key: 'red', faction: 'Mordor', hero: 'Sauron', glyph: '◉', ability: 'De Ene Ring', copy: 'Overleeft één dodelijke treffer met 1 HP.' },
  { key: 'green', faction: 'Elven', hero: 'Legolas', glyph: '❧', ability: 'Elvenboog', copy: 'Valt kastelen aan vanaf één extra routevak.' },
  { key: 'yellow', faction: 'Dwergen', hero: 'Gimli', glyph: '⚒', ability: 'Mithrilpantser', copy: 'Ontvangt 5 minder schade van troepen.' },
  { key: 'blue', faction: 'Mensen', hero: 'Aragorn', glyph: '♜', ability: 'Athelas', copy: 'Geneest 5 HP na een overleefd gevecht.' }
];

export function renderLobbyOptions({ room, container, E, socket, handleAck }) {
  const selected = room.gameOptions?.startingFaction || 'red';
  const wrap = E('section', 'lutro-faction-picker');
  const head = E('div', 'lutro-faction-picker-head');
  head.append(
    E('strong', '', 'Kies je factie en held'),
    E('small', '', room.isHost ? 'Jouw keuze bepaalt waar de eerste speler start' : 'De host kiest de startfactie')
  );
  const choices = E('div', 'lutro-faction-choices');
  FACTION_CHOICES.forEach((choice) => {
    const active = selected === choice.key;
    const button = E('button', `lutro-faction-choice camp-${choice.key}${active ? ' active' : ''}`);
    button.type = 'button';
    button.disabled = !room.isHost;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.append(
      E('span', 'lutro-faction-glyph', choice.glyph),
      E('span', 'lutro-faction-realm', choice.faction),
      E('strong', 'lutro-faction-hero', choice.hero),
      E('b', 'lutro-faction-ability', choice.ability),
      E('small', 'lutro-faction-copy', choice.copy)
    );
    button.onclick = () => socket.emit('room:setOptions', { startingFaction: choice.key }, handleAck);
    choices.append(button);
  });
  wrap.append(head, choices);
  container.append(wrap);
}
const PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5], [5,6],[4,6],[3,6],[2,6],[1,6],[0,6], [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8], [6,9],[6,10],[6,11],[6,12],[6,13],[6,14], [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9], [9,8],[10,8],[11,8],[12,8],[13,8],[14,8], [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6], [8,5],[8,4],[8,3],[8,2],[8,1],[8,0], [7,0],[6,0]
];
const HOME_LANES = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
];
const YARDS = [
  [[1,1],[1,4],[4,1],[4,4]], [[1,10],[1,13],[4,10],[4,13]],
  [[10,10],[10,13],[13,10],[13,13]], [[10,1],[10,4],[13,1],[13,4]]
];

function key(row, col) { return `${row},${col}`; }
const PATH_LOOKUP = new Map(PATH.map(([row, col], index) => [key(row, col), index]));
const HOME_LOOKUP = new Map();
HOME_LANES.forEach((lane, seat) => lane.forEach(([row, col], index) => HOME_LOOKUP.set(key(row, col), { seat, index })));
const YARD_LOOKUP = new Set(YARDS.flat().map(([row, col]) => key(row, col)));

function baseSeat(row, col) {
  if (row <= 5 && col <= 5) return 0;
  if (row <= 5 && col >= 9) return 1;
  if (row >= 9 && col >= 9) return 2;
  if (row >= 9 && col <= 5) return 3;
  return -1;
}
function pawnCoord(player, pawn) {
  if (pawn.zone === 'yard') return YARDS[player.seat][pawn.number - 1];
  if (pawn.zone === 'track') return PATH[pawn.pathIndex];
  if (pawn.zone === 'home' || pawn.zone === 'finished') return HOME_LANES[player.seat][Math.min(5, pawn.homeIndex)];
  return null;
}
function turnStatus(game) {
  if (game.gameOver) return game.resultText || 'De strijd is afgelopen.';
  const turn = game.players.find((player) => player.id === game.turnPlayerId);
  if (game.canRoll) return 'Jij bent aan de beurt. Gooi voor coins.';
  if (game.canAct) return `Je verdiende ${game.lastCoinGain} coins. Kies één troep voor worp + bonus, koop of val aan.`;
  return `${turn?.name || 'De volgende speler'} is aan de beurt.`;
}

function buildPlayerCard(player, game, E, action) {
  const canSkipNpc = game.npcCanSkip && player.id === game.turnPlayerId;
  const card = E(canSkipNpc ? 'button' : 'div', `lutro-player camp-${player.camp}${player.id === game.turnPlayerId ? ' active' : ''}${player.eliminated ? ' eliminated' : ''}${player.connected === false ? ' offline' : ''}${canSkipNpc ? ' npc-skippable' : ''}`);
  if (canSkipNpc) {
    card.type = 'button';
    card.title = 'Klik om de wachttijd van deze NPC-stap over te slaan';
    card.setAttribute('aria-label', `Sla de wachttijd van ${player.name} over`);
    card.onclick = () => action('skipNpc');
  }
  const marker = E('span', 'lutro-player-marker', CAMPS[player.seat]?.glyph || '•');
  const identity = E('div', 'lutro-player-identity');
  identity.append(marker, E('strong', '', player.name), E('span', 'lutro-camp-name', CAMPS[player.seat]?.name || player.camp));
  const economy = E('span', 'lutro-economy', `◉ ${player.coins}`);
  const hp = E('div', 'lutro-castle-hp');
  const fill = E('span', 'lutro-castle-hp-fill');
  fill.style.width = `${player.castleHp}%`;
  hp.append(fill);
  card.append(identity, economy, hp, E('span', 'lutro-castle-hp-text', `${player.castleHp}/100 HP`));
  return card;
}

function buildPlayerAttacks(player, game, me, E, action, sound) {
  const attacks = E('div', 'lutro-player-attacks');
  (game.attackOptions || []).filter((option) => option.targetPlayerId === player.id).forEach((option) => {
    const pawn = me?.pawns.find((item) => item.id === option.pawnId);
    if (!pawn) return;
    const attack = E('button', 'lutro-castle-attack', `⚔ ${pawn.label} valt aan (${pawn.damage})`);
    attack.type = 'button';
    attack.onclick = () => { sound('score'); action('castleAttack', option); };
    attacks.append(attack);
  });
  return attacks;
}

function buildPawnToken(player, pawn, canMove, canAttack, E, action, sound) {
  const interactive = canMove || canAttack;
  const token = E(interactive ? 'button' : 'span', `lutro-pawn camp-${player.camp} unit-${pawn.type}${canMove ? ' movable' : ''}${canAttack ? ' attackable' : ''}${pawn.zone === 'yard' ? ' inactive' : ''}${pawn.zone === 'finished' ? ' finished' : ''}${player.isYou ? ' mine' : ''}`);
  if (canMove) {
    token.type = 'button';
    token.onclick = () => { sound('score'); action('move', { pawnId: pawn.id }); };
    token.setAttribute('aria-label', `Verplaats ${pawn.label}`);
  } else if (canAttack) {
    token.type = 'button';
    token.onclick = () => { sound('score'); action('unitAttack', { targetPlayerId: player.id, targetPawnId: pawn.id }); };
    token.setAttribute('aria-label', `Val ${player.name}s ${pawn.label} aan voor 50% damage`);
  } else token.setAttribute('aria-label', `${player.name}, ${pawn.label}`);
  token.title = `${pawn.label} · ${pawn.damage} damage · ${pawn.hp}/${pawn.maxHp} HP · +${pawn.movementBonus} beweging`;
  token.append(unitSprite(E, player, pawn, 'lutro-pawn-glyph'));
  if (pawn.zone !== 'yard') {
    const hp = E('span', 'lutro-unit-hp');
    const hpFill = E('span', 'lutro-unit-hp-fill');
    hpFill.style.width = `${Math.max(0, (pawn.hp / pawn.maxHp) * 100)}%`;
    hp.append(hpFill);
    token.append(hp);
  }
  token.append(E('span', 'lutro-pawn-number', String(pawn.number)));
  return token;
}

function buildBoard(game, movable, attackable, E, action, sound) {
  const wrap = E('div', 'lutro-board-wrap');
  const board = E('div', 'lutro-board');
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', 'Lutro-slagveld');
  const occupants = new Map();
  game.players.forEach((player) => player.pawns.forEach((pawn) => {
    const coord = pawnCoord(player, pawn);
    if (!coord) return;
    const id = key(coord[0], coord[1]);
    if (!occupants.has(id)) occupants.set(id, []);
    occupants.get(id).push({ player, pawn });
  }));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const id = key(row, col);
      const pathIndex = PATH_LOOKUP.get(id);
      const home = HOME_LOOKUP.get(id);
      const seat = baseSeat(row, col);
      const classes = new Set(['lutro-cell']);
      if (seat >= 0) { classes.add('base'); classes.add(`camp-${CAMPS[seat].key}`); }
      if (YARD_LOOKUP.has(id)) classes.add('yard');
      if (pathIndex !== undefined) classes.add('track');
      if (ATTACK_SITES.has(pathIndex)) { classes.add('attack-site'); classes.add(`camp-${CAMPS[ATTACK_SITES.get(pathIndex)].key}`); }
      if (home) { classes.add('home-lane'); classes.add(`camp-${CAMPS[home.seat].key}`); }
      const startSeat = CAMPS.findIndex((camp) => camp.startIndex === pathIndex);
      if (startSeat >= 0) { classes.add('safe'); classes.add(`camp-${CAMPS[startSeat].key}`); }
      if (row >= 6 && row <= 8 && col >= 6 && col <= 8) classes.add('centre');
      const cell = E('div', [...classes].join(' '));
      if (ATTACK_SITES.has(pathIndex)) cell.title = `Aanvalsveld voor het kasteel van ${CAMPS[ATTACK_SITES.get(pathIndex)].name}`;
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      if (pathIndex !== undefined && pathIndex % 3 === 1 && startSeat < 0) {
        const rune = E('span', 'lutro-rune', ['ᚠ', 'ᚢ', 'ᚦ', 'ᚱ'][pathIndex % 4]);
        rune.setAttribute('aria-hidden', 'true');
        cell.append(rune);
      }
      (occupants.get(id) || []).forEach(({ player, pawn }, index, list) => {
        const token = buildPawnToken(player, pawn, movable.has(pawn.id), attackable.has(pawn.id), E, action, sound);
        token.style.setProperty('--stack-x', `${(index - (list.length - 1) / 2) * 22}%`);
        token.style.setProperty('--stack-y', `${(index % 2) * 13}%`);
        cell.append(token);
      });
      board.append(cell);
    }
  }
  wrap.append(board);
  return wrap;
}

function buildShop(game, me, E, action, sound) {
  const shop = E('div', 'lutro-shop');
  me.pawns.forEach((pawn) => {
    const available = pawn.zone === 'yard' && me.coins >= pawn.cost && !game.startOccupied;
    const button = E('button', `lutro-unit-card unit-${pawn.type}`);
    button.type = 'button';
    button.disabled = !available;
    button.title = pawn.type === 'hero' ? `${pawn.hero.ability}: ${pawn.hero.description}` : pawn.label;
    button.append(
      unitSprite(E, me, pawn, 'lutro-unit-card-icon'),
      E('strong', '', pawn.label),
      E('span', 'lutro-unit-card-stats', `${pawn.damage}⚔ ${pawn.maxHp}♥ +${pawn.movementBonus}➜`),
      E('b', 'lutro-unit-card-cost', pawn.zone !== 'yard' ? 'Ingezet' : game.startOccupied ? 'Startvak bezet' : `${pawn.cost} coins`)
    );
    if (available) button.onclick = () => { sound('score'); action('buy', { type: pawn.type }); };
    shop.append(button);
  });
  return shop;
}

function buildControls(game, E, action, sound) {
  const me = game.players.find((player) => player.isYou);
  const controls = E('div', 'lutro-controls');
  const summary = E('div', 'lutro-roll-summary');
  const die = E('div', `lutro-die${game.lastRoll ? ' rolled' : ''}`, DICE[game.lastRoll || 0]);
  const copy = E('div', 'lutro-control-copy');
  copy.append(E('strong', '', game.lastRoll ? `Worp ${game.lastRoll} · +${game.lastCoinGain} coins` : 'Jouw worp'), E('span', '', turnStatus(game)));
  summary.append(die, copy);
  controls.append(summary);
  if (game.canRoll) {
    const roll = E('button', 'lutro-roll', 'Gooi voor coins');
    roll.type = 'button';
    roll.onclick = () => { sound('turn'); action('roll'); };
    controls.append(roll);
  } else if (game.canAct && me) {
    controls.append(buildShop(game, me, E, action, sound));
    const footer = E('div', 'lutro-action-footer');
    let footerMsg = `Tik één oplichtende troep: worp ${game.lastRoll} + diens bonus.`;
    if (!game.movablePawnIds.length) footerMsg = game.canPass ? 'Geen troep kan de worp gebruiken.' : 'Koop een troep of val een kasteel aan om verder te gaan.';
    if (game.unitAttackOptions?.length) footerMsg = 'Kies een rood omcirkelde vijandelijke troep voor 50% damage, of voer een andere actie uit.';
    footer.append(E('span', '', footerMsg));
    if (game.canPass) {
      const pass = E('button', 'lutro-pass', 'Pas');
      pass.type = 'button';
      pass.onclick = () => action('pass');
      footer.append(pass);
    }
    controls.append(footer);
  }
  return controls;
}

let dismissedCombatSeq = 0;
function combatMessage(combat) {
  const lines = [`⚔ ${combat.attackerName}s ${combat.attackerUnit} valt ${combat.defenderName}s ${combat.defenderUnit} aan voor ${combat.damageToDefender} schade${combat.defenderRingSaved ? ' (De Ene Ring redt hem)' : ''}.`];
  if (combat.defenderDefeated) lines.push(`${combat.defenderUnit} sneuvelt — ${combat.defenderName}s kasteel krijgt ${combat.defenderCastleDamage} schade.`);
  else {
    lines.push(`${combat.defenderUnit} slaat terug voor ${combat.damageToAttacker} schade${combat.attackerRingSaved ? ' (De Ene Ring redt hem)' : ''}.`);
    if (combat.attackerDefeated) lines.push(`${combat.attackerUnit} sneuvelt — ${combat.attackerName}s kasteel krijgt ${combat.attackerCastleDamage} schade.`);
  }
  return lines;
}
function buildCombatToast(game, E) {
  const combat = game.lastCombat;
  if (!combat || combat.seq <= dismissedCombatSeq) return null;
  const toast = E('div', `lutro-combat-toast camp-${combat.attackerCamp}`);
  const body = E('div', 'lutro-combat-body');
  combatMessage(combat).forEach((line) => body.append(E('p', '', line)));
  const close = E('button', 'lutro-combat-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Melding sluiten');
  close.onclick = () => { dismissedCombatSeq = combat.seq; toast.remove(); };
  toast.append(E('strong', 'lutro-combat-title', 'Gevecht!'), body, close);
  return toast;
}

export function render({ game, els, E, action, titlebar, logBox, sound }) {
  const legacyRoom = game.schemaVersion !== 8 || !game.players.every((player) => Array.isArray(player.pawns));
  if (legacyRoom) {
    const notice = E('div', 'lutro-legacy');
    notice.append(E('strong', '', 'Deze spelronde gebruikt de vorige Lutro-versie.'), E('span', '', 'Ga terug naar de lobby en start een nieuw spel om de kasteelstrijd te laden.'));
    els.gameStage.append(titlebar('Lutro', 'Start een nieuwe spelronde.'), notice);
    return;
  }
  const root = E('div', 'lutro-root');
  const players = E('div', 'lutro-players');
  const me = game.players.find((player) => player.isYou);
  game.players.forEach((player) => {
    const slot = E('div', 'lutro-player-slot');
    slot.append(buildPlayerCard(player, game, E, action));
    const attacks = buildPlayerAttacks(player, game, me, E, action, sound);
    if (attacks.childElementCount) slot.append(attacks);
    players.append(slot);
  });
  const attackable = new Set((game.unitAttackOptions || []).map((option) => option.targetPawnId));
  root.append(players, buildBoard(game, new Set(game.movablePawnIds || []), attackable, E, action, sound), buildControls(game, E, action, sound));
  const combatToast = buildCombatToast(game, E);
  if (combatToast) root.append(combatToast);
  els.gameStage.append(root, logBox(game.log || []));
}

export function metric({ game, player }) {
  const current = game.players.find((item) => item.id === player.id);
  return { text: current ? `${current.castleHp}/100 HP` : '', score: current?.castleHp || 0 };
}
export function isWinner({ game, myId }) { return game.winnerId === myId; }
export function presentResult({ game }) {
  const winner = game.players.find((player) => player.id === game.winnerId);
  return winner ? { title: winner.name, copy: 'heeft het laatste kasteel overeind en wint Lutro.' } : game.resultText;
}
