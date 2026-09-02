'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { changedFiles, normalizeRelease, selectTests } = require('../scripts/run-tests');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-selection-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  for (const file of ['games/hearts/server.js', 'games/golf/server.js', 'test/rooms.test.js',
    'test/hearts.test.js', 'test/hearts-ui.test.js', 'test/golf.test.js']) write(file);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => { git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture'); };
  git('init', '-q', '-b', 'main'); commit();
  return { root, write, git, commit };
}

test('one game selects its logic/UI and core, excluding other game logic', t => {
  const { root } = fixture(t);
  const plan = selectTests(root, ['games/hearts/styles.css']);
  assert.equal(plan.full, false);
  assert.deepEqual(plan.tests, ['test/hearts-ui.test.js', 'test/hearts.test.js', 'test/rooms.test.js']);
});

test('new games and nested game tests are discovered without a fixed mapping', t => {
  const { root, write } = fixture(t);
  write('games/new-game/manifest.json', '{}');
  write('test/new-game/npc.test.js');
  write('games/new-game/score.test.cjs');
  const plan = selectTests(root, ['games/new-game/manifest.json', 'test/new-game/npc.test.js']);
  assert.equal(plan.full, false);
  assert.deepEqual(plan.tests, ['games/new-game/score.test.cjs', 'test/new-game/npc.test.js', 'test/rooms.test.js']);
});

test('shared infrastructure, templates and unknown code require every game', t => {
  const { root } = fixture(t);
  for (const file of ['src/games.js', 'src/server/realtime.js', 'src/db.js', 'public/styles.css', 'public/js/game-ui.js', 'games/_template/server.js', 'scripts/run-tests.js', 'unknown.js']) {
    const plan = selectTests(root, [file]);
    assert.equal(plan.full, true, file);
    assert.equal(plan.tests.length, 4, file);
  }
});

test('release-only changes stay scoped, real dependency and UI changes do not', t => {
  const { root, write, commit } = fixture(t);
  const pkg = { version: '1.0.0', dependencies: { example: '1.0.0' } };
  write('package.json', JSON.stringify(pkg));
  write('public/app.js', "import './ui.js?v=1.0.0';\n"); commit();
  pkg.version = '1.0.1'; write('package.json', JSON.stringify(pkg));
  write('public/app.js', "import './ui.js?v=1.0.1';\n");
  const files = ['games/hearts/styles.css', 'package.json', 'public/app.js', 'CHANGELOG.md', 'src/updates.js'];
  assert.equal(selectTests(root, files).full, false);
  pkg.dependencies.example = '1.0.1'; write('package.json', JSON.stringify(pkg));
  assert.equal(selectTests(root, files).full, true);
  write('public/app.js', "import './ui.js?v=1.0.1';\nstart();\n");
  assert.equal(selectTests(root, ['public/app.js']).full, true);
  assert.notEqual(normalizeRelease('package-lock.json', '{"packages":{"node_modules/example":{"version":"1.0.0"}}}'),
    normalizeRelease('package-lock.json', '{"packages":{"node_modules/example":{"version":"1.0.1"}}}'));
});

test('branch selection combines multiple commits, staged, unstaged and untracked files', t => {
  const { root, write, git, commit } = fixture(t);
  git('checkout', '-qb', 'feature');
  write('games/hearts/server.js', '// first'); commit();
  write('games/golf/server.js', '// second'); commit();
  write('games/hearts/client.js', '// staged'); git('add', 'games/hearts/client.js');
  write('games/golf/server.js', '// unstaged');
  write('test/hearts-npc.test.js');
  assert.deepEqual(changedFiles(root).files, [
    'games/golf/server.js', 'games/hearts/client.js', 'games/hearts/server.js', 'test/hearts-npc.test.js'
  ]);
  assert.deepEqual(changedFiles(root, 'main').files, changedFiles(root).files);
});

test('clean main checks its last commit; dirty main checks only current changes', t => {
  const { root, write, commit } = fixture(t);
  write('games/hearts/server.js', '// previous'); commit();
  assert.deepEqual(changedFiles(root).files, ['games/hearts/server.js']);
  write('games/golf/server.js', '// current');
  assert.deepEqual(changedFiles(root).files, ['games/golf/server.js']);
});

test('renames include the removed and added paths, retaining shared-code impact', t => {
  const { root, write, git, commit } = fixture(t);
  write('src/shared.js', '// shared'); commit();
  git('mv', 'src/shared.js', 'games/hearts/moved.js');
  const changes = changedFiles(root);
  assert.ok(changes.files.includes('src/shared.js'));
  assert.ok(changes.files.includes('games/hearts/moved.js'));
  assert.equal(selectTests(root, changes.files).full, true);
});

test('invalid explicit refs and game names fail visibly', t => {
  const { root } = fixture(t);
  assert.throws(() => changedFiles(root, 'not-a-branch'));
  assert.throws(() => selectTests(root, [], { games: ['typo'] }), /Onbekende game/);
});
