import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('keeps HTML identifiers, labels and client selectors consistent', async () => {
  const [html, script, styles, manifest, changelog] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('game.js', 'utf8'),
    readFile('styles.css', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('CHANGELOG.md', 'utf8'),
  ]);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const queried = [...script.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map((match) => match[1]);
  const labelTargets = [
    ...[...html.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    ...[...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((match) => match[1]),
  ];

  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...new Set(queried.filter((id) => !ids.includes(id)))], []);
  assert.deepEqual(labelTargets.filter((id) => !ids.includes(id)), []);
  assert.match(html, /<script type="module" src="game\.js"><\/script>/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(html, /v1\.1\.0/);
  assert.equal(JSON.parse(manifest).version, '1.1.0');
  assert.match(changelog, /v1\.1\.0/);
  assert.match(changelog, /v1\.0\.0/);
});
