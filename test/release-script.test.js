'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion, updateReadme, updateChangelog, updateReleases } = require('../scripts/release');

test('release script bumps patch and minor versions', () => {
  assert.equal(nextVersion('1.22.4', 'patch'), '1.22.5');
  assert.equal(nextVersion('1.22.4', 'minor'), '1.23.0');
});

test('patch README keeps only current, minor baseline and major baseline', () => {
  const readme = '# Pluto\n\n## Nieuw in versie 1.22.4\n\nOld current\n\n## Nieuw in versie 1.22.0\n\nMinor baseline\n\n## Nieuw in versie 1.0.0\n\nMajor baseline\n\n## Games\n\nTable\n';
  const output = updateReadme(readme, '1.22.5', 'Release summary');
  assert.match(output, /Nieuw in versie 1\.22\.5\n\nRelease summary/);
  assert.match(output, /Nieuw in versie 1\.22\.0\n\nMinor baseline/);
  assert.match(output, /Nieuw in versie 1\.0\.0\n\nMajor baseline/);
  assert.doesNotMatch(output, /Nieuw in versie 1\.22\.4/);
});

test('minor README does not duplicate its minor baseline', () => {
  const readme = '# Pluto\n\n## Nieuw in versie 1.22.4\n\nOld\n\n## Nieuw in versie 1.0.0\n\nMajor baseline\n\n## Games\n';
  const output = updateReadme(readme, '1.23.0', 'Release summary');
  assert.equal((output.match(/Nieuw in versie 1\.23\.0/g) || []).length, 1);
  assert.match(output, /Nieuw in versie 1\.0\.0/);
  assert.doesNotMatch(output, /Nieuw in versie 1\.22\.4/);
});

test('summary is added to changelog and improvements', () => {
  assert.match(updateChangelog('# Changelog\n\n## v1.0.0 — Old\n', '1.0.1', 'Fixed it'), /## v1\.0\.1 — Fixed it\n\n- Fixed it/);
  const updates = "const RELEASES = [\n  {\n    version:'1.0.0',\n    improvements:[\n      'Old'\n    ]\n  }\n];\n\nconst CATEGORIES = []";
  const output = updateReleases(updates, '1.0.1', "It's fixed");
  assert.match(output, /version:"1\.0\.1"/);
  assert.match(output, /improvements:\[\n      "It's fixed"/);
});
