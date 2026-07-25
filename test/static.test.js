import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps HTML identifiers, labels and client selectors consistent', async () => {
  const [html, script, styles, manifest, changelog, server] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('game.js', 'utf8'),
    readFile('styles.css', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('CHANGELOG.md', 'utf8'),
    readFile('server.js', 'utf8'),
  ]);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const queried = [...script.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map((match) => match[1]);
  const labelTargets = [
    ...[...html.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    ...[...html.matchAll(/aria-describedby="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    ...[...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((match) => match[1]),
  ];

  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...new Set(queried.filter((id) => !ids.includes(id)))], []);
  assert.deepEqual(labelTargets.filter((id) => !ids.includes(id)), []);
  assert.match(html, /<script type="module" src="game\.js"><\/script>/);
  assert.doesNotMatch(html, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(html, /id="lastClaim"[^>]+aria-live="polite"/);
  assert.match(html, /id="challengeText"/);
  assert.doesNotMatch(script, /\(_, index, cards\)/);
  assert.doesNotMatch(script, /\$\{playerName\([^)]*\)\} 的牌/);
  assert.match(html, /<symbol id="icon-menu"/);
  assert.match(html, /<symbol id="icon-volume-on"/);
  assert.match(html, /<symbol id="icon-network"/);
  assert.doesNotMatch(html, /id="menuBtn"[^>]*>☰<\/button>/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*grid-template-columns:\s*minmax\(0,1fr\) 330px/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.mode-badge\s*\{[^}]*position:\s*static/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.lan-panel\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.lobby-players\s*\{[^}]*grid-template-columns:\s*repeat\(2,1fr\)/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.panel-actions\s*\{[^}]*flex-direction:\s*row/);
  assert.match(script, /lfo\.connect\(lfoGain\)\.connect\(mix\.gain\)/);
  assert.match(html, /v1\.2\.0/);
  const { version } = JSON.parse(manifest);
  assert.equal(version, '1.2.0');
  assert.match(server, new RegExp(`v${version.replaceAll('.', '\\.')}`));
  assert.match(changelog, /v1\.1\.1/);
  assert.match(changelog, /v1\.2\.0/);
  assert.match(changelog, /v1\.1\.0/);
  assert.match(changelog, /v1\.0\.0/);
});
