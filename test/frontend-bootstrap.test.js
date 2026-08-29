const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('frontend app.js is geldige ES-module syntax', () => {
  const source = path.join(__dirname, '../public/app.js');
  const temp = path.join(os.tmpdir(), `minigames-app-${process.pid}.mjs`);
  fs.copyFileSync(source, temp);
  try {
    const result = spawnSync(process.execPath, ['--check', temp], { encoding:'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(temp, { force:true });
  }
});

test('game UI krijgt gedeelde card helpers expliciet geïnjecteerd', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../public/js/game-ui.js'), 'utf8');
  assert.match(app, /createGameUi\(\{[\s\S]*cardNode, valueLabel[\s\S]*\}\)/);
  assert.match(ui, /const \{[\s\S]*cardNode, valueLabel[\s\S]*\} = ctx;/);
});
