const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../games/slag-om-waas/server');

// Small event-capable DOM for renderer regressions; visual QA uses a real browser.
function element(tag, className = '', text = '') {
  const attrs = {}, listeners = {};
  const node = {
    tag, className, children: [], textContent: text, open: false,
    style: { setProperty() {} },
    classList: {
      add(name) { node.className += ' ' + name; },
      remove(name) { node.className = node.className.split(' ').filter(c => c !== name).join(' '); },
      toggle(name, active) { this.remove(name); if (active) this.add(name); }
    },
    append(...children) { this.children.push(...children); },
    prepend(...children) { this.children.unshift(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { attrs[key] = String(value); if (key === 'class') this.className = String(value); },
    getAttribute(key) { return attrs[key]; },
    addEventListener(type, handler) { listeners[type] = handler; },
    click() { if (!this.disabled) { this.onclick?.(); listeners.click?.({ target: this }); } },
    key(key) { listeners.keydown?.({ key, preventDefault() {} }); },
    focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
    querySelector(selector) {
      const match = selector.match(/^\[data-sector-id="([^"]+)"\]$/);
      return all(this).find(n => match && n.getAttribute('data-sector-id') === match[1]);
    }
  };
  return node;
}
function all(node) { return [node, ...node.children.flatMap(all)]; }
function text(node) { return [node.textContent, ...node.children.map(text)].join(' '); }
function harness() {
  const stage = element('main'), state = {}, calls = [];
  const g = engine.createGame([{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bob' }]);
  const game = engine.serialize(g, 'a');
  const context = vm.createContext({ document: {
    createElementNS: (_, tag) => element(tag),
    getElementById: id => all(stage).find(n => n.id === id)
  } });
  vm.runInContext(fs.readFileSync(require.resolve('../games/slag-om-waas/client.js'), 'utf8').replaceAll('export function ', 'function '), context);
  const draw = () => {
    stage.replaceChildren();
    context.render({ game, state, els: { gameStage: stage }, E: element,
      action: (...args) => calls.push(args), titlebar: () => element('header'), logBox: () => element('aside') });
  };
  draw();
  return { game, state, calls, draw,
    find: predicate => all(stage).find(predicate),
    cls: name => all(stage).filter(n => n.className.split(' ').includes(name)),
    province: id => all(stage).find(n => n.getAttribute('data-sector-id') === id),
    tab: id => all(stage).find(n => n.id === 'sow-tab-' + id)
  };
}

function lobbyHarness(room) {
  const container = element('div'), calls = [], context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../games/slag-om-waas/client.js'), 'utf8').replaceAll('export function ', 'function '), context);
  context.renderLobbyOptions({ room, container, E: element, socket: { emit: (...args) => calls.push(args) }, handleAck() {} });
  return { container, calls, nodes: all(container) };
}

test('lobby toont vier facties, markeert eigen keuze en blokkeert bezette facties', () => {
  const room = { gameOptions: { factions: { a: 'east', b: 'north' } }, players: [
    { id: 'a', name: 'Ada', isMe: true }, { id: 'b', name: 'Bob', isMe: false }
  ] };
  const h = lobbyHarness(room), buttons = h.nodes.filter(node => node.className.split(' ').includes('sow-faction-choice'));
  assert.equal(buttons.length, 4);
  assert.equal(buttons.find(button => text(button).includes('Oost')).getAttribute('aria-pressed'), 'true');
  assert.equal(buttons.find(button => text(button).includes('Noord')).disabled, true);
  assert.match(text(buttons.find(button => text(button).includes('Noord'))), /Gekozen door Bob/);
  buttons.find(button => text(button).includes('West')).click();
  assert.equal(h.calls[0][0], 'room:setPlayerOptions');
  assert.equal(h.calls[0][1].faction, 'west');
});

test('provincie opent Acties, onthoudt tab bij updates en reset bij heropenen', () => {
  const h = harness();
  assert.equal(h.find(n => n.tag === 'dialog').open, false);
  h.province('south_temse').click();
  assert.equal(h.tab('actions').getAttribute('aria-selected'), 'true');
  assert.match(text(h.cls('sow-actions')[0]), /Troepen \+1/);
  assert.doesNotMatch(text(h.cls('sow-actions')[0]), /Verplaats|Val aan/);
  h.tab('city').click(); h.draw();
  assert.equal(h.tab('city').getAttribute('aria-selected'), 'true');
  assert.ok(h.cls('sow-info-rows').length);
  h.tab('connections').click(); assert.ok(h.cls('sow-connections').length);
  h.cls('sow-popup-close')[0].click(); h.province('south_temse').click();
  assert.equal(h.tab('actions').getAttribute('aria-selected'), 'true');
  assert.equal(h.cls('sow-balance').length, 1);
});

test('legerfiguur selecteert bordbeweging, weigert onbereikbaar doel en annuleert met Escape', () => {
  const h = harness(), army = () => h.cls('sow-army').find(n => n.getAttribute('aria-label').startsWith('Temsehaven:'));
  army().click();
  assert.equal(h.find(n => n.tag === 'dialog').open, false);
  assert.equal(h.state.sow.moving, 'south_temse');
  h.province('north_stekene').click(); assert.equal(h.calls.length, 0);
  h.cls('sow-root')[0].key('Escape'); assert.equal(h.state.sow.moving, null);
  army().key('Enter');
  const target = h.game.board.sectors.find(s => s.id === 'south_temse').connections[0].to;
  h.province(target).click();
  assert.equal(h.calls[0][0], 'move'); assert.equal(h.calls[0][1].from, 'south_temse'); assert.equal(h.calls[0][1].to, target);
  assert.equal(h.state.sow.moving, null);
  h.game.sectors.south_temse.movement = 0; army().click();
  assert.match(text(h.cls('sow-move-hint')[0]), /onvoldoende beweging/);
  h.province(target).click(); assert.equal(h.calls.length, 1);
  h.game.canEndTurn = false; h.draw(); assert.equal(h.state.sow.moving, null);
});

test('hoofdstad zonder niveau toont nooit undefined en legt evolutie uit', () => {
  const h = harness();
  delete h.game.sectors.south_temse.capitalLevel;
  delete h.game.config.maxBuildingLevel;
  delete h.game.config.capitalUpgradeCost;
  h.draw(); h.province('south_temse').click();
  assert.doesNotMatch(text(h.cls('sow-info')[0]), /undefined|NaN/);
  assert.match(text(h.cls('sow-info')[0]), /bezit je eigen hoofdstad en betaal 8 goud/);
  assert.equal(h.cls('sow-tag')[0].textContent, 'Hoofdstad');
  h.tab('city').click();
  assert.match(text(h.cls('sow-info')[0]), /Niveau 1/);
  assert.doesNotMatch(text(h.cls('sow-info')[0]), /undefined|NaN/);
});

test('gevecht toont echte worpen, verliezen en knoppen; kaarten zijn tijdens strijd geblokkeerd', () => {
  const h = harness();
  const to = h.game.board.sectors.find(s => s.id === 'south_temse').connections[0].to;
  h.game.sectors[to].units.militia = 2; h.game.sectors[to].troops = 2;
  h.game.battle = { from: 'south_temse', to, attackerId: 'a', rounds: 1,
    lastRoll: { attackDice: [6, 3], defenseDice: [4, 3], attackScores: [6, 3], defenseScores: [4, 3], attackerLosses: 1, defenderLosses: 1 } };
  h.game.players[0].cards = [{ id: 't', type: 'treasury' }]; h.draw();
  assert.equal(h.cls('sow-die').length, 4);
  assert.match(text(h.cls('sow-battle')[0]), /verlies aanvaller 1, verdediger 1/);
  h.find(n => n.textContent === 'Gooi opnieuw').click(); assert.equal(h.calls[0][0], 'rollBattle');
  assert.equal(h.find(n => n.textContent === 'Speel kaart').disabled, true);
  assert.equal(h.find(n => n.textContent === 'Beurt beëindigen').disabled, true);
  h.game.battle = null; h.draw();
  h.find(n => n.textContent === 'Speel kaart').click();
  assert.equal(h.calls[1][0], 'playCard'); assert.equal(h.calls[1][1].cardId, 't');
});
