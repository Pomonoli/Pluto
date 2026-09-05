'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_FILES = [
  'package.json',
  'package-lock.json',
  'server.js',
  'public/app.js',
  'public/index.html',
  'public/service-worker.js',
  'CHANGELOG.md',
  'README.md',
  'src/updates.js'
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.error || result.status !== 0) {
    const detail = options.capture ? (result.stderr || result.stdout || '').trim() : '';
    throw new Error(detail || `${command} ${args.join(' ')} is mislukt.`);
  }
  return options.capture ? result.stdout : '';
}

function git(args, options) {
  return run('git', args, options);
}

function nextVersion(current, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`Ongeldige huidige versie: ${current}`);
  const [, major, minor, patch] = match.map(Number);
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  throw new Error('Gebruik release:patch of release:minor.');
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Versiereferentie ontbreekt in ${label}.`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function updateReadme(source, version, summary) {
  const gamesAt = source.indexOf('## Games');
  if (gamesAt < 0) throw new Error('README.md bevat geen Games-sectie.');
  const prefix = source.slice(0, gamesAt);
  const introEnd = prefix.indexOf('## Nieuw in versie');
  if (introEnd < 0) throw new Error('README.md bevat geen versiesectie.');
  const intro = prefix.slice(0, introEnd);
  const sections = new Map();
  for (const match of prefix.slice(introEnd).matchAll(/^## Nieuw in versie (\d+\.\d+\.\d+)\r?\n\r?\n([\s\S]*?)(?=\r?\n## Nieuw in versie|$)/gm)) {
    sections.set(match[1], match[2].trim());
  }
  sections.set(version, summary);
  const [major, minor] = version.split('.');
  const wanted = [...new Set([version, `${major}.${minor}.0`, `${major}.0.0`])];
  const missing = wanted.find(item => !sections.has(item));
  if (missing) throw new Error(`README.md mist de vereiste historische sectie ${missing}.`);
  const rendered = wanted.map(item => `## Nieuw in versie ${item}\n\n${sections.get(item)}`).join('\n\n');
  return `${intro}${rendered}\n\n${source.slice(gamesAt)}`;
}

function updateChangelog(source, version, summary) {
  const header = /^# Changelog\r?\n/;
  if (!header.test(source)) throw new Error('CHANGELOG.md heeft niet het verwachte formaat.');
  return source.replace(header, `# Changelog\n\n## v${version} — ${summary}\n\n- ${summary}\n`);
}

function updateReleases(source, version, summary) {
  const marker = /\n  }\r?\n];\r?\n\r?\nconst CATEGORIES/;
  if (!marker.test(source)) throw new Error('src/updates.js heeft niet het verwachte RELEASES-formaat.');
  const item = `\n  },\n  {\n    version:${JSON.stringify(version)},\n    improvements:[\n      ${JSON.stringify(summary)}\n    ]\n  }\n];\n\nconst CATEGORIES`;
  return source.replace(marker, item);
}

function buildFiles(originals, current, version, summary) {
  const output = { ...originals };
  const pkg = JSON.parse(output['package.json']);
  pkg.version = version;
  output['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;

  const lock = JSON.parse(output['package-lock.json']);
  lock.version = version;
  if (!lock.packages?.['']) throw new Error('Root-package ontbreekt in package-lock.json.');
  lock.packages[''].version = version;
  output['package-lock.json'] = `${JSON.stringify(lock, null, 2)}\n`;

  output['server.js'] = replaceRequired(output['server.js'], new RegExp(`Pluto v${current.replaceAll('.', '\\.')}`), `Pluto v${version}`, 'server.js');
  for (const file of ['public/app.js', 'public/index.html', 'public/service-worker.js']) {
    output[file] = replaceRequired(output[file], new RegExp(`\\?v=${current.replaceAll('.', '\\.')}`, 'g'), `?v=${version}`, file);
  }
  output['public/index.html'] = replaceRequired(output['public/index.html'], new RegExp(`Pluto v${current.replaceAll('.', '\\.')}`), `Pluto v${version}`, 'public/index.html');
  output['public/service-worker.js'] = replaceRequired(output['public/service-worker.js'], new RegExp(`pluto-v${current.replaceAll('.', '\\.')}`), `pluto-v${version}`, 'public/service-worker.js');
  output['CHANGELOG.md'] = updateChangelog(output['CHANGELOG.md'], version, summary);
  output['README.md'] = updateReadme(output['README.md'], version, summary);
  output['src/updates.js'] = updateReleases(output['src/updates.js'], version, summary);
  return output;
}

function restore(originals) {
  for (const [file, contents] of Object.entries(originals)) fs.writeFileSync(path.join(ROOT, file), contents);
}

function preflight() {
  if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).trim() !== 'main') {
    throw new Error('Releases mogen alleen vanaf main worden gemaakt.');
  }
  if (git(['status', '--porcelain'], { capture: true }).trim()) {
    throw new Error('De working tree bevat uncommitted of conflicterende wijzigingen. Commit of stash die eerst.');
  }
  git(['fetch', 'origin', 'main']);
  const local = git(['rev-parse', 'HEAD'], { capture: true }).trim();
  const remote = git(['rev-parse', 'origin/main'], { capture: true }).trim();
  const common = git(['merge-base', 'HEAD', 'origin/main'], { capture: true }).trim();
  if (common !== remote) throw new Error('main loopt achter op of wijkt af van origin/main. Synchroniseer eerst.');
  if (!local) throw new Error('Lokale main kon niet worden vastgesteld.');
}

function main() {
  const type = process.argv[2];
  const summaries = process.argv.slice(3);
  if (!['patch', 'minor'].includes(type) || summaries.length !== 1 || !summaries[0].trim()) {
    throw new Error('Gebruik: npm run release:patch -- "release summary" (of release:minor)');
  }
  const summary = summaries[0].trim();
  if (/\r|\n/.test(summary)) throw new Error('De release summary moet op één regel staan.');

  preflight();
  const originals = Object.fromEntries(RELEASE_FILES.map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));
  const current = JSON.parse(originals['package.json']).version;
  const version = nextVersion(current, type);
  const updated = buildFiles(originals, current, version, summary);
  for (const [file, contents] of Object.entries(updated)) fs.writeFileSync(path.join(ROOT, file), contents);

  try {
    if (process.env.npm_execpath) run(process.execPath, [process.env.npm_execpath, 'run', 'check']);
    else run('npm', ['run', 'check']);
  } catch (error) {
    restore(originals);
    throw new Error(`Checks faalden; alle releasewijzigingen zijn teruggedraaid. ${error.message}`);
  }

  const changed = git(['status', '--porcelain'], { capture: true }).split(/\r?\n/).filter(Boolean);
  const unexpected = changed.filter(line => !RELEASE_FILES.includes(line.slice(3).replaceAll('\\', '/')));
  if (unexpected.length) {
    restore(originals);
    throw new Error(`Onverwachte wijzigingen na de checks; release teruggedraaid:\n${unexpected.join('\n')}`);
  }

  try {
    git(['add', '--', ...RELEASE_FILES]);
    git(['commit', '-m', `Release Pluto v${version}`]);
  } catch (error) {
    git(['reset'], { capture: true });
    restore(originals);
    throw new Error(`Commit mislukt; alle releasewijzigingen zijn teruggedraaid. ${error.message}`);
  }

  try {
    git(['push', 'origin', 'main']);
  } catch (error) {
    throw new Error(`Push mislukt. Releasecommit v${version} staat veilig lokaal op main; los het pushprobleem op en push opnieuw. ${error.message}`);
  }
  console.log(`Pluto v${version} is gecontroleerd, gecommit en naar main gepusht.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Release afgebroken: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { nextVersion, updateReadme, updateChangelog, updateReleases, buildFiles };
