'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.stderr?.trim() || 'Git niet beschikbaar');
  return result.stdout;
}

function walk(root, directory) {
  if (!fs.existsSync(path.join(root, directory))) return [];
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(root, file) : [file];
  });
}

function catalog(root) {
  const games = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !/^[_.]/.test(entry.name)).map(entry => entry.name);
  const tests = [...walk(root, 'test'), ...walk(root, 'games')]
    .filter(file => /\.test\.[cm]?js$/.test(file) && !file.startsWith('games/_')).sort();
  const owners = file => games.filter(game => file.startsWith(`games/${game}/`)
    || file.startsWith(`test/${game}.test.`) || file.startsWith(`test/${game}-`)
    || file.startsWith(`test/${game}/`));
  return { games, tests, owners };
}

// Compare with the branch base, including staged, unstaged and untracked files.
// On a clean main checkout, examine the last commit instead of silently testing nothing.
function changedFiles(root, explicitBase) {
  const local = [git(root, ['diff', '--name-only', '--no-renames', '-z', 'HEAD', '--']),
    git(root, ['ls-files', '--others', '--exclude-standard', '-z'])].join('\0').split('\0').filter(Boolean);
  let base = 'HEAD';
  if (explicitBase) {
    if (explicitBase.startsWith('-')) throw new Error('Ongeldige --base');
    base = git(root, ['merge-base', explicitBase, 'HEAD']).trim();
  } else {
    const head = git(root, ['rev-parse', 'HEAD']).trim();
    for (const candidate of ['origin/main', 'main']) {
      let ancestor;
      try { ancestor = git(root, ['merge-base', candidate, 'HEAD']).trim(); } catch { continue; }
      if (ancestor !== head) { base = ancestor; break; }
    }
    if (base === 'HEAD' && local.length === 0) base = git(root, ['rev-parse', 'HEAD^']).trim();
  }
  const committed = git(root, ['diff', '--name-only', '--no-renames', '-z', `${base}..HEAD`, '--']).split('\0');
  return { base, files: [...new Set([...committed, ...local].filter(Boolean))].sort() };
}

// A release bump must not turn a one-game fix into a full run. Dependency,
// script and real application changes still count as shared changes.
function normalizeRelease(file, source) {
  if (file === 'package.json' || file === 'package-lock.json') {
    const data = JSON.parse(source);
    delete data.version;
    if (file === 'package-lock.json' && data.packages?.['']) delete data.packages[''].version;
    return JSON.stringify(data);
  }
  if (['server.js', 'public/app.js', 'public/index.html', 'public/service-worker.js'].includes(file)) {
    return source.replace(/(\?v=|pluto-v|Pluto v)\d+\.\d+\.\d+/g, '$1VERSION');
  }
  return source;
}

function releaseOnly(root, base, file) {
  if (!['package.json', 'package-lock.json', 'server.js', 'public/app.js', 'public/index.html', 'public/service-worker.js'].includes(file)) return false;
  try {
    const before = git(root, ['show', `${base}:${file}`]);
    const after = fs.readFileSync(path.join(root, file), 'utf8');
    return normalizeRelease(file, before) === normalizeRelease(file, after);
  } catch { return false; }
}

function selectTests(root, files, { full = false, games: requested = [], base = 'HEAD' } = {}) {
  const { games, tests, owners } = catalog(root);
  for (const game of requested) if (!games.includes(game)) throw new Error(`Onbekende game: ${game}`);
  const selectedGames = new Set(requested);
  const reasons = [];
  const changedTests = new Set();
  for (const file of files) {
    if (/\.md$/i.test(file) || releaseOnly(root, base, file)) continue;
    if (tests.includes(file)) { changedTests.add(file); owners(file).forEach(game => selectedGames.add(game)); continue; }
    const match = /^games\/([^/]+)\//.exec(file);
    if (match && !/^[_.]/.test(match[1])) { selectedGames.add(match[1]); continue; }
    if (file === 'src/updates.js' || file.startsWith('test/')) continue;
    // Unknown/shared code deliberately falls back to the complete suite.
    reasons.push(file);
  }
  full ||= reasons.length > 0;
  const selected = tests.filter(file => full || !owners(file).length || changedTests.has(file)
    || owners(file).some(game => selectedGames.has(game))
    || (file === 'test/hofslag-render.test.js' && ['blackjack', 'pesten', 'presidenten'].some(game => selectedGames.has(game))));
  return { full, tests: selected, games: [...selectedGames].sort(), reasons };
}

function syntaxCheck(root, files) {
  for (const file of files.filter(file => /\.[cm]?js$/.test(file) && fs.existsSync(path.join(root, file)))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const module = file.endsWith('.mjs') || /^\s*(?:import\s|export\s)/m.test(source);
    const result = spawnSync(process.execPath, ['--check', `--input-type=${module ? 'module' : 'commonjs'}`],
      { cwd: root, input: source, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`Syntaxfout in ${file}\n${result.stderr || result.error}`);
  }
}

function main(args) {
  let full = false, check = false, list = false, base;
  const games = [];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--full') full = true;
    else if (flag === '--check') check = true;
    else if (flag === '--list') list = true;
    else if (flag === '--game' || flag === '--base') {
      const value = args.shift();
      if (!value || value.startsWith('-')) throw new Error(`${flag} vereist een waarde`);
      if (flag === '--game') games.push(value); else base = value;
    } else throw new Error(`Onbekende optie: ${flag}`);
  }
  if (games.length && base) throw new Error('Gebruik --game of --base, niet beide');
  let changes = { files: [], base: 'HEAD' };
  if (!full && !games.length) {
    try { changes = changedFiles(ROOT, base); } catch (error) {
      if (base) throw error;
      console.warn(`Wijzigingen niet betrouwbaar te bepalen (${error.message}); volledige suite.`);
      full = true;
    }
  }
  const plan = selectTests(ROOT, changes.files, { full, games, base: changes.base });
  console.log(plan.full ? 'Volledige testsuite' : `Gerichte tests: basis + ${plan.games.join(', ') || 'geen gewijzigde games'}`);
  if (plan.reasons.length) console.log(`Gedeelde wijzigingen: ${plan.reasons.join(', ')}`);
  console.log(`${plan.tests.length} testbestanden geselecteerd.`);
  if (list) { console.log(plan.tests.join('\n')); return; }
  if (!plan.tests.length) throw new Error('Geen tests gevonden');
  if (check) {
    const files = plan.full ? ['server.js', ...walk(ROOT, 'src'), ...walk(ROOT, 'public'), ...walk(ROOT, 'games'), ...walk(ROOT, 'scripts'), ...walk(ROOT, 'test')]
      : [...new Set(['server.js', ...changes.files, ...plan.tests, ...games.flatMap(game => walk(ROOT, `games/${game}`))])];
    syntaxCheck(ROOT, files);
    console.log('Syntaxcontrole geslaagd.');
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-tests-'));
  try {
    const result = spawnSync(process.execPath, ['--test', ...plan.tests], {
      cwd: ROOT, stdio: 'inherit', env: { ...process.env, DATA_DIR: dataDir }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally { fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 }); }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { changedFiles, normalizeRelease, selectTests };
