import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, TRANSLATIONS, translate } from '../src/i18n.js';

const REQUIRED_KEYS = [
  'settingsTitle', 'tutorialTitle', 'startSolo', 'startLan', 'actionPlay', 'actionChallenge',
  'tabExperience', 'tabSound', 'tabLanguage', 'tabNews', 'tabAbout', 'openTutorial',
  'done', 'next', 'back', 'finish', 'repository', 'issues', 'discussions', 'author', 'home',
  'tabGameplay', 'resetDefaults', 'motionSpeed', 'cardScale', 'sceneBrightness', 'sceneContrast', 'particles',
  'aiSpeed', 'autoFocus', 'shortcuts', 'history', 'turnEffects', 'ambienceIntensity', 'musicWarmth',
  'uiSounds', 'gameSounds', 'announcementSounds', 'cuePitch',
  'wildcardHint',
];

test('ships ten complete language choices for core UI', () => {
  assert.equal(LANGUAGES.length, 10);
  assert.equal(new Set(LANGUAGES.map(({ code }) => code)).size, 10);
  LANGUAGES.forEach(({ code, label }) => {
    assert.ok(label);
    REQUIRED_KEYS.forEach((key) => assert.ok(TRANSLATIONS[code][key], `${code}.${key}`));
  });
});

test('localizes the expanded settings instead of leaking English fallbacks', () => {
  const keys = ['tabGameplay', 'resetDefaults', 'motionSpeed', 'cardScale', 'sceneBrightness', 'aiSpeed', 'autoFocus', 'history', 'ambienceIntensity', 'musicWarmth', 'uiSounds', 'gameSounds', 'announcementSounds', 'cuePitch'];
  LANGUAGES.filter(({ code }) => !['zh-CN', 'en'].includes(code)).forEach(({ code }) => {
    keys.forEach((key) => assert.notEqual(TRANSLATIONS[code][key], TRANSLATIONS.en[key], `${code}.${key}`));
  });
});

test('translates placeholders and falls back to simplified Chinese', () => {
  assert.equal(translate('en', 'tutorialProgress', { current: 2, total: 4 }), 'Step 2 of 4');
  assert.equal(translate('missing', 'settingsTitle'), '游戏设置');
  assert.equal(translate('ja', 'missingKey'), 'missingKey');
});
