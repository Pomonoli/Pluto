const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const patcher = import(pathToFileURL(path.join(__dirname, '../games/bakkermansjones/dom-update.js')).href);

// Minimal DOM model: records detachments to catch interrupted touch targets.
function node(name, text = null) {
  const attrs = new Map();
  return {
    nodeType: name === '#text' ? 3 : 1, nodeName: name,
    nodeValue: text, childNodes: [], parentNode: null, detachments: 0,
    get attributes() { return [...attrs].map(([name, value]) => ({ name, value })); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    hasAttribute(name) { return attrs.has(name); },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    get lastChild() { return this.childNodes.at(-1); },
    insertBefore(child, before) {
      child.remove();
      this.childNodes.splice(before ? this.childNodes.indexOf(before) : this.childNodes.length, 0, child);
      child.parentNode = this;
    },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1);
      this.parentNode = null;
      this.detachments++;
    }
  };
}
function append(parent, child) { parent.insertBefore(child, null); return child; }
function frame(minute, paused, speed, action) {
  const root = node('DIV');
  append(root, node('#text', String(minute)));
  const pause = append(root, node('BUTTON'));
  pause.setAttribute('aria-label', paused ? 'Hervatten' : 'Pauzeren');
  pause.onclick = () => action('togglePause');
  for (const n of [1, 2, 4]) {
    const button = append(root, node('BUTTON'));
    button.setAttribute('aria-pressed', n === speed);
    button.onclick = () => action('setSpeed', n);
  }
  return root;
}

test('time updates preserve attached pause/speed buttons and refresh their state and handlers', async () => {
  const { patchChildren } = await patcher;
  const calls = [], parent = node('DIV');
  patchChildren(parent, frame(0, false, 1, () => assert.fail('stale handler')));
  const buttons = parent.childNodes.slice(1);
  for (let minute = 1; minute <= 100; minute++) {
    patchChildren(parent, frame(minute, minute === 100, 4, (...args) => calls.push(args)));
    assert.deepEqual(parent.childNodes.slice(1), buttons);
  }
  assert.equal(parent.childNodes[0].nodeValue, '100');
  assert.equal(buttons[0].getAttribute('aria-label'), 'Hervatten');
  assert.equal(buttons[3].getAttribute('aria-pressed'), 'true');
  assert.ok(buttons.every((button) => button.detachments === 1)); // initial move from detached frame only
  buttons[0].onclick(); buttons[1].onclick();
  assert.deepEqual(calls, [['togglePause'], ['setSpeed', 1]]);
});

test('removed customers cannot inherit the next customer action', async () => {
  const { patchChildren } = await patcher;
  function customers(ids) {
    const list = node('DIV');
    for (const id of ids) {
      const button = append(list, node('BUTTON'));
      button.setAttribute('data-bj-key', id);
      button.onclick = () => id;
    }
    return list;
  }
  const parent = node('DIV');
  patchChildren(parent, customers(['a', 'b']));
  const [a, b] = parent.childNodes;
  patchChildren(parent, customers(['b']));
  assert.equal(parent.childNodes[0], b);
  assert.equal(a.parentNode, null);
  assert.equal(a.onclick(), 'a');
  assert.equal(b.onclick(), 'b');
});
