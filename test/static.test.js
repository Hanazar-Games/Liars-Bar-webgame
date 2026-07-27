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
  assert.doesNotMatch(styles, /\.game-shell\s*\{[^}]*filter:\s*brightness/);
  assert.match(styles, /\.table-stage\s*\{[^}]*filter:\s*brightness\(var\(--scene-brightness\)\)\s*contrast\(var\(--scene-contrast\)\)/);
  assert.match(html, /id="lastClaim"[^>]+aria-live="polite"/);
  assert.match(html, /<span>桌面 <b id="pileCount">0<\/b><\/span>/);
  assert.match(html, /id="hand"[^>]+tabindex="-1"[^>]+aria-describedby="selectionHint"/);
  assert.match(html, /id="challengeText"/);
  assert.match(html, /id="challengeBtn"[^>]+aria-keyshortcuts="C"/);
  assert.match(html, /id="playBtn"[^>]+aria-keyshortcuts="P"/);
  assert.match(html, /数字键 1–5 选牌/);
  assert.doesNotMatch(script, /\(_, index, cards\)/);
  assert.doesNotMatch(script, /\$\{playerName\([^)]*\)\} 的牌/);
  assert.match(html, /<symbol id="icon-menu"/);
  assert.match(html, /<symbol id="icon-volume-on"/);
  assert.match(html, /<symbol id="icon-network"/);
  assert.match(html, /<symbol id="icon-profile"/);
  assert.match(html, /id="profileBtn"[^>]+aria-label="查看酒客档案"/);
  assert.match(html, /id="profileBtn"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /id="settingsBtn"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /id="settingsOverlay"[^>]+aria-labelledby="settingsTitle"/);
  assert.match(html, /id="settingsTabs"[^>]+role="tablist"/);
  assert.match(html, /data-settings-tab="gameplay"/);
  assert.match(html, /id="languageSelect"[\s\S]*?(?:<option[\s\S]*?){10}/);
  assert.match(html, /id="tutorialOverlay"[^>]+aria-labelledby="tutorialTitle"/);
  assert.match(html, /id="masterVolume"[^>]+type="range"/);
  assert.match(html, /id="musicVolume"[^>]+type="range"/);
  assert.match(html, /id="sfxVolume"[^>]+type="range"/);
  const adjustableRanges = {
    motionSpeed: ['40', '200'], cardScale: ['75', '130'], sceneBrightness: ['55', '145'],
    sceneContrast: ['70', '150'], particleDensity: ['0', '150'], aiSpeed: ['50', '250'],
    ambienceIntensity: ['0', '150'], musicWarmth: ['0', '100'], cuePitch: ['70', '130'],
  };
  Object.entries(adjustableRanges).forEach(([id, [min, max]]) => {
    assert.match(html, new RegExp(`id="${id}"[^>]+type="range"[^>]+min="${min}"[^>]+max="${max}"`));
  });
  ['autoFocusEnabled', 'shortcutsEnabled', 'historyEnabled', 'turnEffectsEnabled', 'uiSoundsEnabled', 'gameSoundsEnabled', 'announcementSoundsEnabled']
    .forEach((id) => assert.match(html, new RegExp(`id="${id}"[^>]+type="checkbox"`)));
  assert.match(html, /id="resetPreferencesBtn"/);
  assert.match(html, /https:\/\/github\.com\/Hanazar-Games\/Liars-Bar-webgame\/issues/);
  assert.match(html, /https:\/\/github\.com\/Hanazar-Games\/Liars-Bar-webgame\/discussions/);
  assert.match(html, /https:\/\/github\.com\/hzagaming/);
  assert.match(html, /https:\/\/hanazargames\.com/);
  assert.match(html, /id="menuBtn"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /id="profileOverlay"[^>]+aria-labelledby="profileHeading"/);
  assert.match(html, /id="profileGuile"[^>]+role="meter"/);
  assert.doesNotMatch(html, /id="menuBtn"[^>]*>☰<\/button>/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*grid-template-columns:\s*minmax\(0,1fr\) 330px/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.mode-badge\s*\{[^}]*position:\s*static/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.lan-panel\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.lobby-players\s*\{[^}]*grid-template-columns:\s*repeat\(2,1fr\)/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.panel-actions\s*\{[^}]*flex-direction:\s*row/);
  assert.match(script, /lfo\.connect\(lfoGain\)\.connect\(mix\.gain\)/);
  assert.match(script, /context\.sampleRate \* 8/);
  assert.match(script, /function setAmbienceTension/);
  assert.match(script, /describeGuest\(app\.profileData\)\.title/);
  assert.match(script, /recordClaim\(app\.profile/);
  assert.match(script, /recordChallenge\(app\.profile/);
  assert.match(script, /masterGain\?\.gain\.setTargetAtTime/);
  assert.match(script, /sfxGain\?\.gain\.setTargetAtTime/);
  assert.match(script, /ambience\?\.gain\.gain\.setTargetAtTime/);
  assert.match(script, /soundCue\('ready'\)/);
  assert.match(script, /手牌已出尽，只能质疑上一手/);
  assert.match(script, /aria-keyshortcuts="\$\{index \+ 1\}"/);
  assert.match(script, /function handleGameShortcut/);
  assert.match(script, /function openSettings/);
  assert.match(script, /function openTutorial/);
  assert.match(script, /DEFAULT_PREFERENCES/);
  assert.match(script, /function resetPreferences/);
  assert.match(script, /\.settings-content'\)\.scrollTop = 0/);
  assert.match(script, /function scaledAIDelay/);
  assert.match(script, /announcementSounds/);
  assert.match(script, /--motion-speed/);
  assert.match(script, /--card-scale/);
  assert.match(script, /sfxGain/);
  assert.match(script, /button, input, select, a\[href\], summary, \[tabindex\]/);
  assert.match(script, /你已被淘汰，正在旁观/);
  assert.match(script, /if \(roundStarted\) \{[\s\S]*focusSoon/);
  assert.match(html, /v1\.5\.0/);
  const { version } = JSON.parse(manifest);
  assert.equal(version, '1.5.0');
  assert.match(server, new RegExp(`v${version.replaceAll('.', '\\.')}`));
  assert.match(server, /\['\/src\/guest-profile\.js', \['src\/guest-profile\.js', 'text\/javascript; charset=utf-8'\]\]/);
  assert.match(changelog, /v1\.1\.1/);
  assert.match(changelog, /v1\.3\.0/);
  assert.match(changelog, /v1\.3\.1/);
  assert.match(changelog, /v1\.4\.0/);
  assert.match(changelog, /v1\.5\.0/);
  assert.match(changelog, /v1\.2\.0/);
  assert.match(changelog, /v1\.1\.0/);
  assert.match(changelog, /v1\.0\.0/);
  assert.match(styles, /orientation:\s*landscape[\s\S]*\.toast\s*\{[^}]*top:\s*max\(4px,/);
  assert.match(styles, /max-width:\s*360px[\s\S]*\.brand\s*\{[^}]*display:\s*none/);
  assert.match(styles, /max-width:\s*620px[\s\S]*\.opponent \.status\s*\{[^}]*font-size:\s*10px/);
  assert.match(styles, /max-width:\s*620px[\s\S]*\.action-btn small\s*\{[^}]*font-size:\s*9px/);
  assert.match(styles, /input::placeholder\s*\{[^}]*color:\s*#857766/);
  assert.match(styles, /@keyframes card-deal/);
  assert.match(styles, /@keyframes dust-drift/);
  assert.match(styles, /@keyframes settings-panel-in/);
  assert.match(server, /\['\/src\/i18n\.js', \['src\/i18n\.js', 'text\/javascript; charset=utf-8'\]\]/);
});
