import { CARD_NAMES, GameEngine, WILD_CARD, cardMatchesTarget, shuffle } from './src/game-engine.js';
import { createGuestProfile, describeGuest, recordChallenge, recordClaim, syncSurvivedRounds } from './src/guest-profile.js';
import { translate } from './src/i18n.js';

const $ = (selector) => document.querySelector(selector);
const AI_PLAYERS = [
  { id: 'flynn', name: '疤脸 · 弗林', avatar: '☠', bot: true },
  { id: 'eve', name: '黑寡妇 · 伊芙', avatar: '♦', bot: true },
  { id: 'morgan', name: '老狐狸 · 摩根', avatar: '♣', bot: true },
];

const DEFAULT_PREFERENCES = Object.freeze({
  language: 'zh-CN', motion: true, motionSpeed: 100, visualEffects: true,
  sceneBrightness: 100, sceneContrast: 100, particleDensity: 100, cardScale: 100,
  aiSpeed: 100, autoFocus: true, shortcuts: true, history: true, turnEffects: true,
  masterVolume: .8, music: true, musicVolume: .7, ambienceIntensity: 100, musicWarmth: 55,
  sfx: true, sfxVolume: .85, cuePitch: 100, uiSounds: true, gameSounds: true, announcementSounds: true,
});

const els = {
  game: $('#game'), players: $('#players'), hand: $('#hand'), targetRank: $('#targetRank'),
  targetName: $('#targetName'), roundNo: $('#roundNo'), pileCount: $('#pileCount'),
  pile: $('#playedPile'), lastClaim: $('#lastClaim'), turnBanner: $('#turnBanner'),
  selectedCount: $('#selectedCount'), selectionHint: $('#selectionHint'),
  claimText: $('#claimText'), challengeText: $('#challengeText'), play: $('#playBtn'),
  challenge: $('#challengeBtn'), history: $('#historyList'), toast: $('#toast'),
  start: $('#startScreen'), modeChooser: $('#modeChooser'), lanPanel: $('#lanPanel'),
  playerName: $('#playerName'), roomCodeInput: $('#roomCode'), lobby: $('#lobbyOverlay'),
  lobbyCode: $('#lobbyCode'), lobbyPlayers: $('#lobbyPlayers'), lobbyStatus: $('#lobbyStatus'),
  startGame: $('#startGameBtn'), reveal: $('#revealOverlay'), revealed: $('#revealedCards'),
  revealTitle: $('#revealTitle'), revealCopy: $('#revealCopy'), revealEyebrow: $('#revealEyebrow'),
  roulette: $('#roulette'), rouletteText: $('#rouletteText'), continue: $('#continueBtn'),
  onlineContinue: $('#onlineContinue'), end: $('#endOverlay'), endTitle: $('#endTitle'),
  endCopy: $('#endCopy'), restart: $('#restartBtn'), endLeave: $('#endLeaveBtn'),
  menu: $('#menuOverlay'), announcement: $('#announcementOverlay'), sound: $('#soundBtn'),
  profile: $('#profileOverlay'), profileButton: $('#profileBtn'), profileTitle: $('#profileTitle'),
  profileQuote: $('#profileQuote'), profileCards: $('#profileCards'), profileLies: $('#profileLies'),
  profileChallenges: $('#profileChallenges'), profileRounds: $('#profileRounds'), profileGuile: $('#profileGuile'),
  endProfileSummary: $('#endProfileSummary'),
  modeBadge: $('#modeBadge'), youLabel: $('#youLabel'), connectionHint: $('#connectionHint'),
  createRoom: $('#createRoomBtn'), joinRoom: $('#joinRoomBtn'), backMode: $('#backModeBtn'),
  settings: $('#settingsOverlay'), settingsButton: $('#settingsBtn'), settingsTabs: $('#settingsTabs'),
  tutorial: $('#tutorialOverlay'), tutorialTitle: $('#tutorialTitle'), tutorialCopy: $('#tutorialCopy'),
  tutorialProgress: $('#tutorialProgress'), tutorialVisual: $('#tutorialVisual'), tutorialDots: $('#tutorialDots'),
  tutorialBack: $('#tutorialBackBtn'), tutorialNext: $('#tutorialNextBtn'), language: $('#languageSelect'),
  eliminationImpact: $('#eliminationImpact'), eliminationName: $('#eliminationName'),
  exitGame: $('#exitGameBtn'), exitGameHint: $('#exitGameHint'),
  soundEnabled: $('#soundEnabled'), masterVolume: $('#masterVolume'), musicEnabled: $('#musicEnabled'),
  musicVolume: $('#musicVolume'), sfxEnabled: $('#sfxEnabled'), sfxVolume: $('#sfxVolume'),
  motionEnabled: $('#motionEnabled'), visualEffectsEnabled: $('#visualEffectsEnabled'),
  motionSpeed: $('#motionSpeed'), cardScale: $('#cardScale'), sceneBrightness: $('#sceneBrightness'),
  sceneContrast: $('#sceneContrast'), particleDensity: $('#particleDensity'), aiSpeed: $('#aiSpeed'),
  autoFocusEnabled: $('#autoFocusEnabled'), shortcutsEnabled: $('#shortcutsEnabled'), historyEnabled: $('#historyEnabled'),
  turnEffectsEnabled: $('#turnEffectsEnabled'), ambienceIntensity: $('#ambienceIntensity'), musicWarmth: $('#musicWarmth'),
  cuePitch: $('#cuePitch'), uiSoundsEnabled: $('#uiSoundsEnabled'), gameSoundsEnabled: $('#gameSoundsEnabled'),
  announcementSoundsEnabled: $('#announcementSoundsEnabled'),
};

const app = {
  mode: null,
  engine: null,
  view: null,
  room: null,
  youId: null,
  socket: null,
  selected: new Set(),
  busy: false,
  paused: false,
  muted: false,
  session: 0,
  revealSequence: 0,
  aiTimer: null,
  toastTimer: null,
  connectionTimer: null,
  impactTimer: null,
  exitConfirmTimer: null,
  connecting: false,
  lastFocus: null,
  settingsFocus: null,
  settingsReturn: null,
  tutorialFocus: null,
  announcementReturn: null,
  announcementFocus: null,
  profileData: createGuestProfile(),
  profileActive: false,
  pendingClaim: null,
  animateDeal: false,
  tutorialStep: 0,
  tutorialReturn: null,
  preferences: { ...DEFAULT_PREFERENCES },
};

const t = (key, values) => translate(app.preferences.language, key, values);

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const playerName = (id) => app.view?.players.find((player) => player.id === id)?.name || '未知玩家';

let audio;
let audioBus;
let masterGain;
let sfxGain;
let ambience;
const AMBIENCE_VOLUME = .005;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function ensureAudio() {
  if (app.muted) return null;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (!audioBus) {
      audioBus = audio.createDynamicsCompressor();
      masterGain = audio.createGain();
      sfxGain = audio.createGain();
      audioBus.threshold.value = -18;
      audioBus.knee.value = 12;
      audioBus.ratio.value = 5;
      masterGain.gain.value = app.preferences.masterVolume;
      sfxGain.gain.value = app.preferences.sfxVolume;
      sfxGain.connect(audioBus);
      audioBus.connect(masterGain).connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

function tone(freq = 220, duration = .08, type = 'sine', volume = .035, delay = 0) {
  if (document.hidden || !app.preferences.sfx) return;
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.value = freq * app.preferences.cuePitch / 100;
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(.008, duration / 3));
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain).connect(sfxGain);
  oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); });
  oscillator.start(now);
  oscillator.stop(now + duration + .01);
}

function noiseBurst(duration = .06, volume = .02, frequency = 1200, delay = 0) {
  if (document.hidden || !app.preferences.sfx) return;
  const context = ensureAudio();
  if (!context) return;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const now = context.currentTime + delay;
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(.006, duration / 3));
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  source.connect(filter).connect(gain).connect(sfxGain);
  source.addEventListener('ended', () => { source.disconnect(); filter.disconnect(); gain.disconnect(); });
  source.start(now);
}

function soundCue(name, detail = 1) {
  if (['select', 'paper', 'warning', 'exit'].includes(name) && !app.preferences.uiSounds) return;
  if (['play', 'opponentPlay', 'deal', 'turn', 'join', 'challenge', 'spin', 'bang', 'eliminated', 'empty', 'ready', 'win', 'lose'].includes(name) && !app.preferences.gameSounds) return;
  if (name === 'notice' && !app.preferences.announcementSounds) return;
  if (name === 'select') tone(420, .045, 'triangle', .022);
  if (name === 'play') { noiseBurst(.07, .028, 850); tone(115, .09, 'triangle', .02); }
  if (name === 'opponentPlay') Array.from({ length: Math.min(3, detail) }, (_, index) => index * .065).forEach((delay, index) => {
    noiseBurst(.07, .022, 900 + index * 170, delay);
    tone(138 - index * 12, .075, 'triangle', .013, delay);
  });
  if (name === 'deal') Array.from({ length: 5 }, (_, index) => index * .055).forEach((delay, index) => {
    noiseBurst(.045, .011, 1450 + index * 100, delay);
    tone(230 + index * 18, .035, 'triangle', .007, delay);
  });
  if (name === 'turn') { tone(520, .065, 'sine', .018); tone(780, .1, 'triangle', .014, .055); }
  if (name === 'join') { tone(349, .06, 'triangle', .016); tone(523, .1, 'sine', .018, .055); }
  if (name === 'challenge') { tone(155, .15, 'sawtooth', .03); tone(82, .24, 'sawtooth', .024, .09); tone(620, .18, 'triangle', .012, .035); noiseBurst(.11, .016, 1900, .025); }
  if (name === 'spin') { noiseBurst(.62, .014, 520); tone(64, .78, 'sawtooth', .013); Array.from({ length: 7 }, (_, index) => index * .075).forEach((delay) => noiseBurst(.018, .012, 2200, delay)); }
  if (name === 'bang') { noiseBurst(.5, .12, 420); noiseBurst(.24, .07, 1200, .018); tone(42, .75, 'square', .09); tone(68, .45, 'sawtooth', .045, .025); }
  if (name === 'eliminated') { tone(196, .18, 'sawtooth', .025, .08); tone(131, .34, 'triangle', .026, .2); tone(65, .65, 'sine', .038, .32); }
  if (name === 'empty') { noiseBurst(.035, .026, 2400); tone(210, .06, 'triangle', .025); noiseBurst(.025, .014, 1850, .075); tone(145, .05, 'sine', .014, .075); }
  if (name === 'ready') { tone(440, .07, 'sine', .025); tone(660, .09, 'sine', .018, .06); }
  if (name === 'paper') { noiseBurst(.13, .012, 1800); tone(190, .08, 'triangle', .01); }
  if (name === 'notice') { noiseBurst(.1, .011, 1650); tone(330, .075, 'triangle', .015); tone(495, .09, 'sine', .009, .055); }
  if (name === 'warning') { tone(240, .08, 'square', .018); tone(180, .12, 'sawtooth', .016, .09); }
  if (name === 'exit') { noiseBurst(.12, .018, 700); tone(165, .16, 'triangle', .02); tone(98, .28, 'sine', .018, .12); }
  if (name === 'win') { tone(330, .13, 'sine', .02); tone(440, .18, 'sine', .018, .09); tone(660, .26, 'triangle', .016, .18); }
  if (name === 'lose') { tone(155, .22, 'sawtooth', .018); tone(104, .32, 'triangle', .016, .13); }
}

function startAmbience() {
  const context = ensureAudio();
  if (!context || ambience) return;
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const mix = context.createGain();
  const oscillators = [55, 82.5, 110].map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 1 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(mix);
    oscillator.start();
    return oscillator;
  });
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = Math.random() < .00045 ? (Math.random() * 2 - 1) * .8 : (Math.random() * 2 - 1) * .025;
  }
  const fire = context.createBufferSource();
  const fireFilter = context.createBiquadFilter();
  const fireGain = context.createGain();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  gain.gain.value = 0;
  mix.gain.value = .62;
  filter.type = 'lowpass';
  filter.frequency.value = 260;
  fire.buffer = noiseBuffer;
  fire.loop = true;
  fireFilter.type = 'bandpass';
  fireFilter.frequency.value = 620;
  fireFilter.Q.value = .7;
  fireGain.gain.value = .12;
  lfo.frequency.value = .075;
  lfoGain.gain.value = .08;
  mix.connect(filter);
  filter.connect(gain).connect(audioBus);
  fire.connect(fireFilter).connect(fireGain).connect(gain);
  lfo.connect(lfoGain).connect(mix.gain);
  fire.start();
  lfo.start();
  ambience = { gain, filter, mix, fire, fireGain, oscillators, lfo };
  syncAudioLevels();
  setAmbienceTension(app.view?.pileCount || 0, app.view?.current === app.youId);
}

function setAmbienceTension(pileCount = 0, yourTurn = false) {
  if (!ambience || !audio) return;
  const intensity = app.preferences.ambienceIntensity / 100;
  const warmth = app.preferences.musicWarmth / 100;
  const tension = Math.min(1.4, (pileCount / 12 + Number(yourTurn) * .12) * intensity);
  ambience.filter.frequency.setTargetAtTime(170 + warmth * 150 + tension * 105, audio.currentTime, .7);
  ambience.mix.gain.setTargetAtTime(.54 + intensity * .05 + tension * .07, audio.currentTime, .7);
  ambience.fireGain.gain.setTargetAtTime(.07 + warmth * .07 + tension * .035, audio.currentTime, .7);
}

function syncAudioLevels() {
  if (!audio) return;
  const audible = !app.muted && !document.hidden;
  masterGain?.gain.setTargetAtTime(audible ? app.preferences.masterVolume : 0, audio.currentTime, .03);
  sfxGain?.gain.setTargetAtTime(app.preferences.sfx ? app.preferences.sfxVolume : 0, audio.currentTime, .03);
  const ambienceLevel = AMBIENCE_VOLUME * app.preferences.musicVolume * app.preferences.ambienceIntensity / 100;
  ambience?.gain.gain.setTargetAtTime(audible && app.preferences.music ? ambienceLevel : 0, audio.currentTime, .08);
}

function setSound(enabled) {
  app.muted = !enabled;
  els.sound.querySelector('use').setAttribute('href', enabled ? '#icon-volume-on' : '#icon-volume-off');
  els.sound.setAttribute('aria-pressed', String(enabled));
  els.sound.setAttribute('aria-label', enabled ? '关闭声音与环境音乐' : '开启声音与环境音乐');
  if (enabled) startAmbience();
  syncAudioLevels();
}

function dismissToast() {
  clearTimeout(app.toastTimer);
  app.toastTimer = null;
  els.toast.classList.remove('show');
}

function hideEliminationImpact() {
  clearTimeout(app.impactTimer);
  app.impactTimer = null;
  els.eliminationImpact.hidden = true;
}

function showEliminationImpact(name) {
  hideEliminationImpact();
  els.eliminationName.textContent = `${name} 已被淘汰`;
  els.eliminationImpact.hidden = false;
  soundCue('eliminated');
  void els.eliminationImpact.offsetWidth;
  const duration = !app.preferences.motion || reducedMotion.matches
    ? 700 : Math.min(3000, 1200 * 100 / app.preferences.motionSpeed);
  app.impactTimer = setTimeout(hideEliminationImpact, duration);
}

function toast(message) {
  dismissToast();
  els.toast.textContent = message;
  els.toast.classList.add('show');
  app.toastTimer = setTimeout(dismissToast, 2200);
}

function focusSoon(element) {
  requestAnimationFrame(() => element?.focus({ preventScroll: true }));
}

function focusGameSoon(element) {
  if (app.preferences.autoFocus) focusSoon(element);
}

function syncGameInert() {
  els.game.inert = [els.start, els.lobby, els.reveal, els.end, els.menu, els.profile, els.settings, els.tutorial, els.announcement]
    .some((overlay) => !overlay.hidden);
}

function applyTranslations() {
  document.documentElement.lang = app.preferences.language;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  renderTutorial();
  render();
}

function syncPreferenceClasses() {
  const root = document.documentElement;
  const motionFactor = 100 / app.preferences.motionSpeed;
  document.body.classList.toggle('calm-motion', !app.preferences.motion);
  document.body.classList.toggle('visual-effects-off', !app.preferences.visualEffects);
  document.body.classList.toggle('history-hidden', !app.preferences.history);
  document.body.classList.toggle('turn-effects-off', !app.preferences.turnEffects);
  root.style.setProperty('--motion-speed', motionFactor.toFixed(3));
  root.style.setProperty('--duration-card', `${.48 * motionFactor}s`);
  root.style.setProperty('--duration-action', `${.24 * motionFactor}s`);
  root.style.setProperty('--duration-lamp', `${4 * motionFactor}s`);
  root.style.setProperty('--duration-flip', `${.45 * motionFactor}s`);
  root.style.setProperty('--duration-panel', `${.34 * motionFactor}s`);
  root.style.setProperty('--duration-dust', `${14 * motionFactor}s`);
  root.style.setProperty('--duration-turn', `${1.8 * motionFactor}s`);
  root.style.setProperty('--duration-tutorial', `${2.8 * motionFactor}s`);
  root.style.setProperty('--duration-glint', `${4.8 * motionFactor}s`);
  root.style.setProperty('--duration-impact', `${1.2 * motionFactor}s`);
  root.style.setProperty('--scene-brightness', app.preferences.sceneBrightness / 100);
  root.style.setProperty('--scene-contrast', app.preferences.sceneContrast / 100);
  root.style.setProperty('--particle-opacity', Math.min(.45, .28 * app.preferences.particleDensity / 100));
  root.style.setProperty('--card-scale', app.preferences.cardScale / 100);
}

function syncSettingsControls() {
  els.soundEnabled.checked = !app.muted;
  els.musicEnabled.checked = app.preferences.music;
  els.sfxEnabled.checked = app.preferences.sfx;
  els.motionEnabled.checked = app.preferences.motion;
  els.visualEffectsEnabled.checked = app.preferences.visualEffects;
  els.autoFocusEnabled.checked = app.preferences.autoFocus;
  els.shortcutsEnabled.checked = app.preferences.shortcuts;
  els.historyEnabled.checked = app.preferences.history;
  els.turnEffectsEnabled.checked = app.preferences.turnEffects;
  els.uiSoundsEnabled.checked = app.preferences.uiSounds;
  els.gameSoundsEnabled.checked = app.preferences.gameSounds;
  els.announcementSoundsEnabled.checked = app.preferences.announcementSounds;
  els.language.value = app.preferences.language;
  const ranges = {
    masterVolume: Math.round(app.preferences.masterVolume * 100),
    musicVolume: Math.round(app.preferences.musicVolume * 100),
    sfxVolume: Math.round(app.preferences.sfxVolume * 100),
    motionSpeed: app.preferences.motionSpeed, cardScale: app.preferences.cardScale,
    sceneBrightness: app.preferences.sceneBrightness, sceneContrast: app.preferences.sceneContrast,
    particleDensity: app.preferences.particleDensity, aiSpeed: app.preferences.aiSpeed,
    ambienceIntensity: app.preferences.ambienceIntensity, musicWarmth: app.preferences.musicWarmth,
    cuePitch: app.preferences.cuePitch,
  };
  Object.entries(ranges).forEach(([key, value]) => {
    els[key].value = value;
    $(`#${key}Value`).textContent = `${value}%`;
  });
  els.masterVolume.disabled = app.muted;
  [els.musicVolume, els.ambienceIntensity, els.musicWarmth].forEach((element) => { element.disabled = !app.preferences.music; });
  [els.sfxVolume, els.cuePitch, els.uiSoundsEnabled, els.gameSoundsEnabled, els.announcementSoundsEnabled]
    .forEach((element) => { element.disabled = !app.preferences.sfx; });
  els.motionSpeed.disabled = !app.preferences.motion;
  els.particleDensity.disabled = !app.preferences.visualEffects;
}

function resetPreferences() {
  Object.assign(app.preferences, DEFAULT_PREFERENCES);
  setSound(true);
  syncPreferenceClasses();
  syncSettingsControls();
  applyTranslations();
  setAmbienceTension(app.view?.pileCount || 0, app.view?.current === app.youId);
  soundCue('select');
  toast('已恢复默认设置');
}

const TUTORIAL_STEPS = Array.from({ length: 4 }, (_, index) => ({
  title: `tutorial${index + 1}Title`, copy: `tutorial${index + 1}Copy`,
}));

function renderTutorial() {
  const step = TUTORIAL_STEPS[app.tutorialStep];
  els.tutorialTitle.textContent = t(step.title);
  els.tutorialCopy.textContent = t(step.copy);
  els.tutorialProgress.textContent = t('tutorialProgress', { current: app.tutorialStep + 1, total: TUTORIAL_STEPS.length });
  els.tutorialVisual.dataset.step = app.tutorialStep;
  els.tutorialDots.innerHTML = TUTORIAL_STEPS.map((_, index) => `<i class="${index === app.tutorialStep ? 'active' : ''}"></i>`).join('');
  els.tutorialBack.disabled = app.tutorialStep === 0;
  els.tutorialNext.textContent = t(app.tutorialStep === TUTORIAL_STEPS.length - 1 ? 'finish' : 'next');
}

function renderProfile() {
  const profile = app.profileData;
  const description = describeGuest(profile);
  els.profileTitle.textContent = description.title;
  els.profileQuote.textContent = description.quote;
  els.profileCards.textContent = profile.cardsPlayed;
  els.profileLies.textContent = profile.lies;
  els.profileChallenges.textContent = profile.challengesWon;
  els.profileRounds.textContent = profile.roundsSurvived;
  els.profileGuile.style.setProperty('--guile', `${description.guile}%`);
  els.profileGuile.setAttribute('aria-valuenow', description.guile);
  els.profileGuile.setAttribute('aria-valuetext', profile.claims ? `诈术倾向 ${description.guile}%` : '尚未落牌');
  els.endProfileSummary.textContent = `酒馆称号 · ${description.title}`;
}

function resetProfile() {
  app.profileData = createGuestProfile();
  app.pendingClaim = null;
  renderProfile();
}

function syncProfileRound(view) {
  const alive = view.players.find((player) => player.id === app.youId)?.alive;
  const completed = view.phase === 'reveal' || view.phase === 'ended';
  const next = syncSurvivedRounds(app.profileData, view.round, alive, completed);
  if (next.roundsSurvived === app.profileData.roundsSurvived) return;
  app.profileData = next;
  renderProfile();
}

function setConnecting(connecting) {
  app.connecting = connecting;
  [els.createRoom, els.joinRoom, els.playerName, els.roomCodeInput]
    .forEach((element) => { element.disabled = connecting; });
}

function clearConnectionTimer() {
  clearTimeout(app.connectionTimer);
  app.connectionTimer = null;
  setConnecting(false);
}

function abortConnection(socket, message) {
  if (socket !== app.socket) return;
  const hadRoom = Boolean(app.room);
  app.socket = null;
  app.mode = null;
  clearConnectionTimer();
  socket.close();
  if (hadRoom) returnHome(false);
  else render();
  if (message) toast(message);
}

function showGame() {
  els.start.hidden = true;
  els.lobby.hidden = true;
  syncGameInert();
}

function render() {
  const view = app.view;
  if (!view) {
    els.players.innerHTML = '';
    els.hand.innerHTML = '';
    els.history.innerHTML = '';
    els.turnBanner.textContent = '等待入座';
    els.turnBanner.classList.remove('your-turn');
    els.lastClaim.textContent = '尚无出牌';
    els.lastClaim.classList.remove('active');
    els.challengeText.textContent = '尚无可质疑出牌';
    els.selectionHint.textContent = '入座后开始游戏';
    els.play.disabled = true;
    els.challenge.disabled = true;
    return;
  }

  const me = view.players.find((player) => player.id === app.youId);
  const opponents = view.players.filter((player) => player.id !== app.youId);
  els.targetRank.textContent = view.target;
  els.targetName.textContent = CARD_NAMES[view.target];
  els.roundNo.textContent = view.round;
  els.pileCount.textContent = view.pileCount;
  els.claimText.textContent = `宣称是 ${view.target}`;
  els.youLabel.textContent = me ? `${me.name} · 你的手牌` : '旁观牌局';
  const context = app.mode === 'online' ? `房间 ${app.room?.code || ''}` : '单人模式';
  els.connectionHint.textContent = `${context} · ${describeGuest(app.profileData).title}`;
  renderOpponents(opponents, view);
  renderHand(me, view);
  renderPile(view.pileCount, view.lastPlay, view.round);
  renderHistory(view.history);
  renderControls(me, view);
}

function renderOpponents(opponents, view) {
  els.players.innerHTML = opponents.map((player, index) => {
    const cards = Array.from({ length: player.handCount }, () => '<i class="mini-card"></i>').join('');
    const chambers = Array.from({ length: 6 }, (_, chamber) => `<span class="${chamber < player.shots ? 'used' : ''}"></span>`).join('');
    const status = !player.connected ? '已断开连接' : !player.alive ? '已淘汰' : player.handCount ? `${player.handCount} 张牌 · 弹巢 ${player.shots}/6` : `手牌已出尽 · 弹巢 ${player.shots}/6`;
    return `<article class="opponent ${!player.alive ? 'dead' : ''} ${view.current === player.id && view.phase === 'playing' ? 'active' : ''}" data-seat="${index + 1}" data-total="${opponents.length}">
      <div class="avatar-ring"><div class="avatar">${escapeHtml(player.avatar)}</div><i class="turn-dot"></i></div>
      <div class="name">${escapeHtml(player.name)}</div><div class="status">${status}</div>
      <div class="mini-cards" aria-label="${player.handCount} 张手牌">${cards}</div><div class="chambers" aria-label="已使用 ${player.shots} 个弹巢">${chambers}</div>
    </article>`;
  }).join('');
}

function renderHand(me, view) {
  const hand = me?.hand || [];
  const myTurn = view.current === app.youId && view.phase === 'playing' && !app.busy && !app.paused && me?.alive;
  const dealing = app.animateDeal && app.preferences.motion && !reducedMotion.matches;
  els.hand.innerHTML = hand.map((rank, index) => {
    const selected = app.selected.has(index);
    const red = rank === 'Q' ? 'red' : '';
    const rotation = (index - (hand.length - 1) / 2) * 3;
    const label = `${CARD_NAMES[rank]}，第 ${index + 1} 张${selected ? '，已选择' : ''}`;
    return `<button class="card ${rank === WILD_CARD ? 'joker' : ''} ${red} ${selected ? 'selected' : ''} ${dealing ? 'dealing' : ''}" type="button" data-index="${index}" style="--rot:${rotation}deg;--delay:${index * 55}ms" aria-label="${label}" aria-keyshortcuts="${index + 1}" aria-pressed="${selected}" ${myTurn ? '' : 'disabled'}>
      <span class="corner">${rank === WILD_CARD ? '★' : rank}</span><span class="suit">${rank === 'Q' ? '♥' : rank === 'K' ? '♣' : rank === 'A' ? '♠' : '✦'}</span><span class="face">${rank === WILD_CARD ? 'J' : rank}</span>${rank === WILD_CARD ? '<small class="wild-label">万能</small>' : ''}
    </button>`;
  }).join('');
  els.hand.querySelectorAll('.card').forEach((card) => card.addEventListener('click', (event) => {
    toggleCard(Number(card.dataset.index), event.detail === 0);
  }));
  app.animateDeal = false;
}

function renderPile(count, lastPlay, round) {
  const previousCount = Number(els.pile.dataset.count || 0);
  const sameRound = els.pile.dataset.round === String(round);
  if (sameRound && previousCount === count) return;
  els.pile.dataset.count = count;
  els.pile.dataset.round = round;
  if (!count) {
    els.pile.innerHTML = '<div class="empty-pile">等待出牌</div>';
    els.pile.setAttribute('aria-label', '桌面牌堆，等待出牌');
    return;
  }
  const visibleCount = Math.min(count, 9);
  const arriving = Math.min(visibleCount, sameRound ? Math.max(0, count - previousCount) : count);
  const fromOpponent = lastPlay?.player && lastPlay.player !== app.youId;
  if (arriving && fromOpponent) soundCue('opponentPlay', lastPlay.count);
  const arrivalStart = Math.max(0, visibleCount - arriving);
  const cards = Array.from({ length: visibleCount }, (_, index) => {
    const rotation = (index * 23 % 34) - 17;
    const offset = (index - (visibleCount - 1) / 2) * 5;
    const isArriving = index >= arrivalStart;
    const origin = fromOpponent ? 'from-opponent' : 'from-you';
    const arrivalDelay = isArriving ? (index - arrivalStart) * 65 : 0;
    return `<i class="pile-card ${isArriving ? `arriving ${origin}` : ''}" aria-hidden="true" style="--arrival-delay:${arrivalDelay}ms;--x:${offset}px;--r:${rotation}deg"></i>`;
  }).join('');
  const actor = lastPlay?.player ? playerName(lastPlay.player) : '上一位玩家';
  const played = lastPlay?.count || arriving;
  els.pile.innerHTML = `${cards}<span class="pile-play-badge" aria-hidden="true"><span class="pile-play-actor">${escapeHtml(actor)}</span><b class="pile-play-count">+${played} 张</b></span>`;
  els.pile.setAttribute('aria-label', `${actor}暗扣打出 ${lastPlay?.count || arriving} 张牌，桌面共 ${count} 张`);
}

function renderHistory(history = []) {
  els.history.innerHTML = history.slice(-5).reverse().map((entry) => `<div class="history-item">${escapeHtml(entry)}</div>`).join('');
}

function renderControls(me, view) {
  const myTurn = Boolean(me?.alive && view.current === app.youId && view.phase === 'playing' && !app.busy && !app.paused);
  setAmbienceTension(view.phase === 'reveal' ? 12 : view.pileCount, myTurn);
  const previous = view.lastPlay ? view.players.find((player) => player.id === view.lastPlay.player) : null;
  els.selectedCount.textContent = app.selected.size;
  const claimMessage = previous ? `${previous.name} 宣称打出 ${view.lastPlay.count} 张 ${view.target}` : '尚无出牌';
  if (els.lastClaim.getAttribute('aria-label') !== claimMessage) {
    if (previous) {
      els.lastClaim.innerHTML = `<span>${escapeHtml(previous.name)} 宣称</span><b class="last-claim-count">${view.lastPlay.count} 张 ${escapeHtml(view.target)}</b>`;
    } else {
      els.lastClaim.textContent = claimMessage;
    }
    els.lastClaim.setAttribute('aria-label', claimMessage);
  }
  els.lastClaim.classList.toggle('active', Boolean(previous));
  if (previous) {
    els.challengeText.innerHTML = `<span class="challenge-player">揭穿 ${escapeHtml(previous.name)} 的</span><em class="challenge-card-count">${view.lastPlay.count} 张牌</em>`;
  } else {
    els.challengeText.textContent = '尚无可质疑出牌';
  }
  els.selectionHint.textContent = app.selected.size
    ? `已选择 ${app.selected.size} 张 · 将宣称为 ${view.target}`
    : myTurn ? !me.handCount && view.lastPlay ? '手牌已出尽，只能质疑上一手' : view.lastPlay ? '继续出牌，或质疑上一手' : '选择 1–3 张牌' : me?.alive ? '等待轮到你' : '你已被淘汰，正在旁观';
  els.play.disabled = !myTurn || app.selected.size < 1 || app.selected.size > 3;
  els.challenge.disabled = !myTurn || !view.lastPlay;
  const current = view.players.find((player) => player.id === view.current);
  const waiting = current?.bot ? `${current.name} 正在盘算…` : `等待 ${current?.name || '玩家'} 出牌`;
  const turnMessage = view.phase === 'reveal' ? '等待裁决…' : view.phase === 'ended' ? '牌局结束' : myTurn ? '轮到你了' : waiting;
  if (els.turnBanner.textContent !== turnMessage) els.turnBanner.textContent = turnMessage;
  els.turnBanner.classList.toggle('your-turn', myTurn);
  els.modeBadge.className = `mode-badge ${app.mode || ''}`;
  els.modeBadge.querySelector('span').textContent = app.mode === 'online' ? `联机 · ${app.room?.code || ''}` : app.mode === 'solo' ? '单人牌局' : '未入座';
}

function toggleCard(index, restoreFocus = false) {
  if (app.selected.has(index)) app.selected.delete(index);
  else if (app.selected.size < 3) app.selected.add(index);
  else return toast('一次最多打出 3 张牌');
  soundCue('select');
  render();
  if (restoreFocus) focusSoon(els.hand.querySelector(`[data-index="${index}"]`));
}

function refreshLocal() {
  const previousCurrent = app.view?.current;
  const previousRound = app.view?.round;
  app.view = app.engine.viewFor(app.youId);
  syncProfileRound(app.view);
  app.busy = app.view.phase !== 'playing';
  render();
  if (previousRound === app.view.round && previousCurrent && previousCurrent !== app.youId && app.view.current === app.youId && app.view.phase === 'playing') soundCue('turn');
  if (app.view.phase === 'ended') showEnd();
}

function startSolo() {
  app.session += 1;
  clearTimeout(app.aiTimer);
  app.mode = 'solo';
  app.youId = 'you';
  app.room = null;
  app.selected.clear();
  app.busy = false;
  app.paused = false;
  app.profileActive = true;
  app.animateDeal = true;
  resetProfile();
  app.engine = new GameEngine([{ id: 'you', name: '你', avatar: '♠' }, ...AI_PLAYERS]);
  app.engine.start();
  startAmbience();
  showGame();
  refreshLocal();
  soundCue('deal');
  soundCue('ready');
  focusGameSoon(app.view.current === app.youId ? els.hand.querySelector('.card') : $('#menuBtn'));
  maybeRunAI();
}

function shouldChallenge(engine, id) {
  const player = engine.player(id);
  const last = engine.lastPlay;
  if (!player.hand.length) return true;
  const knownMatches = player.hand.filter((card) => cardMatchesTarget(card, engine.target)).length;
  const impossible = knownMatches + last.count > 8;
  let chance = .14 + last.count * .1 + (engine.pile.length > 9 ? .12 : 0) + (impossible ? .65 : 0);
  if (!engine.player(last.player).hand.length) chance += .3;
  return Math.random() < Math.min(.92, chance);
}

function chooseAI(engine, id) {
  const player = engine.player(id);
  const matching = player.hand.map((rank, index) => cardMatchesTarget(rank, engine.target) ? index : -1).filter((index) => index >= 0);
  const other = player.hand.map((_, index) => index).filter((index) => !matching.includes(index));
  const count = Math.min(player.hand.length, 1 + (Math.random() < .28 ? 1 : 0) + (Math.random() < .08 ? 1 : 0));
  const chosen = shuffle([...matching]).slice(0, Math.min(count, matching.length));
  if (chosen.length < count) chosen.push(...shuffle([...other]).slice(0, count - chosen.length));
  return chosen;
}

function scaledAIDelay(milliseconds) {
  return milliseconds * 100 / app.preferences.aiSpeed;
}

function revealDelay(milliseconds, reduced, online) {
  if (!app.preferences.motion || reducedMotion.matches) return reduced;
  const motionFactor = 100 / app.preferences.motionSpeed;
  return milliseconds * (online ? Math.min(motionFactor, 1.25) : motionFactor);
}

function maybeRunAI() {
  clearTimeout(app.aiTimer);
  if (app.mode !== 'solo' || app.paused || app.busy || app.engine.phase !== 'playing') return;
  const current = app.engine.player(app.engine.current);
  if (!current.bot) return;
  const session = app.session;
  const currentId = current.id;
  app.aiTimer = setTimeout(async () => {
    await sleep(scaledAIDelay(850 + Math.random() * 650));
    if (session !== app.session || app.paused || app.busy || app.engine.current !== currentId || app.engine.phase !== 'playing') return;
    if (app.engine.lastPlay && shouldChallenge(app.engine, currentId)) {
      await localChallenge(currentId);
      return;
    }
    app.engine.play(currentId, chooseAI(app.engine, currentId));
    refreshLocal();
    maybeRunAI();
  }, scaledAIDelay(300));
}

async function showReveal(result, online) {
  const sequence = ++app.revealSequence;
  [els.menu, els.profile, els.settings, els.tutorial, els.announcement].forEach((overlay) => { overlay.hidden = true; });
  app.tutorialReturn = null;
  app.settingsReturn = null;
  app.announcementReturn = null;
  app.paused = false;
  app.lastFocus = document.activeElement;
  els.reveal.hidden = false;
  syncGameInert();
  els.continue.hidden = true;
  els.onlineContinue.hidden = !online;
  hideEliminationImpact();
  els.revealed.innerHTML = '';
  els.roulette.className = 'roulette';
  els.revealTitle.textContent = result.lied ? '谎言被揭穿' : '质疑失败';
  els.revealEyebrow.textContent = `${playerName(result.challenger)}发起质疑`;
  els.revealCopy.textContent = result.lied ? `${playerName(result.accused)}的牌中混入了假牌。` : `揭开的牌均为 ${app.view.target} 或万能 JOKER，${playerName(result.challenger)}判断错了。`;
  els.rouletteText.textContent = `${playerName(result.loser)} 必须扣动扳机……`;
  els.revealTitle.tabIndex = -1;
  focusSoon(els.revealTitle);
  soundCue('challenge');

  await sleep(revealDelay(320, 20, online));
  if (sequence !== app.revealSequence) return;
  els.revealed.innerHTML = result.cards.map((rank, index) => `<div class="reveal-mini ${!cardMatchesTarget(rank, app.view.target) ? 'lie' : ''} ${rank === WILD_CARD ? 'joker' : ''}" style="animation-delay:${index * .14}s" aria-label="${CARD_NAMES[rank]}">${rank === WILD_CARD ? '★<small>万能</small>' : rank}</div>`).join('');
  await sleep(revealDelay(950, 40, online));
  if (sequence !== app.revealSequence) return;
  els.roulette.classList.add('firing');
  soundCue('spin');
  await sleep(revealDelay(1250, 50, online));
  if (sequence !== app.revealSequence) return;
  if (result.bang) {
    els.roulette.classList.add('bang');
    els.rouletteText.textContent = `砰！${playerName(result.loser)} 被淘汰了。`;
    soundCue('bang');
    showEliminationImpact(playerName(result.loser));
  } else {
    els.rouletteText.textContent = `咔哒……空膛。${playerName(result.loser)} 逃过一劫。`;
    soundCue('empty');
  }
  await sleep(revealDelay(result.bang ? 700 : 550, 30, online));
  if (sequence !== app.revealSequence || online) return;
  els.continue.hidden = false;
  focusSoon(els.continue);
}

async function localChallenge(challenger) {
  if (app.busy) return;
  app.busy = true;
  const result = app.engine.challenge(challenger);
  if (challenger === app.youId) {
    app.profileData = recordChallenge(app.profileData, result.lied);
    renderProfile();
  }
  refreshLocal();
  await showReveal(result, false);
}

function continueLocal() {
  if (app.mode !== 'solo' || app.engine.phase !== 'reveal') return;
  app.revealSequence += 1;
  els.reveal.hidden = true;
  hideEliminationImpact();
  syncGameInert();
  app.engine.nextRound();
  app.selected.clear();
  app.busy = false;
  app.animateDeal = app.engine.phase === 'playing';
  refreshLocal();
  if (app.view.phase !== 'ended') {
    soundCue('deal');
    soundCue('ready');
    maybeRunAI();
    focusGameSoon(app.view.current === app.youId ? els.hand.querySelector('.card') : $('#menuBtn'));
  }
}

function playSelected() {
  const indices = [...app.selected];
  if (app.mode === 'solo') {
    try {
      const result = app.engine.play(app.youId, indices);
      app.profileData = recordClaim(app.profileData, result.cards, app.engine.target);
      renderProfile();
      app.selected.clear();
      soundCue('play');
      refreshLocal();
      maybeRunAI();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const me = app.view.players.find((player) => player.id === app.youId);
  const pendingClaim = { cards: indices.map((index) => me.hand[index]), target: app.view.target };
  if (sendOnline({ type: 'play', indices })) {
    app.pendingClaim = pendingClaim;
    app.busy = true;
    soundCue('play');
    render();
  }
}

function challenge() {
  if (app.mode === 'solo') {
    localChallenge(app.youId);
    return;
  }
  if (sendOnline({ type: 'challenge' })) {
    app.busy = true;
    render();
  }
}

function openLanPanel() {
  startAmbience();
  els.modeChooser.hidden = true;
  els.lanPanel.hidden = false;
  focusSoon(els.playerName);
}

function connectRoom(action) {
  if (app.connecting) return;
  const name = els.playerName.value.trim();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!name) return toast('请先输入玩家昵称');
  if (action === 'join-room' && !/^[A-HJ-NP-Z2-9]{4}$/.test(code)) return toast('请输入四位房间码');

  if (!location.host) return toast('局域网模式需要通过 npm start 打开游戏');
  if (app.socket) app.socket.close();
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let socket;
  try {
    socket = new WebSocket(`${protocol}//${location.host}/ws`);
  } catch {
    toast('无法创建联机连接');
    return;
  }
  app.socket = socket;
  app.mode = 'online';
  setConnecting(true);
  els.connectionHint.textContent = '正在连接…';
  toast('正在连接局域网服务…');
  app.connectionTimer = setTimeout(() => abortConnection(socket, '连接超时，请确认服务地址后重试'), 8000);

  socket.addEventListener('open', () => {
    if (socket !== app.socket) return;
    socket.send(JSON.stringify({ type: action, name, code }));
  });
  socket.addEventListener('message', ({ data }) => {
    if (socket !== app.socket) return;
    try {
      handleOnlineMessage(JSON.parse(data), socket);
    } catch {
      abortConnection(socket, '服务返回了无法识别的数据');
    }
  });
  socket.addEventListener('close', () => {
    if (socket !== app.socket) return;
    const hadRoom = Boolean(app.room);
    app.socket = null;
    clearConnectionTimer();
    if (app.mode === 'online' && hadRoom) {
      toast('已与房间断开连接');
      returnHome(false);
    } else if (app.mode === 'online') {
      app.mode = null;
      render();
      toast('无法连接服务，请确认地址后重试');
    }
  });
  socket.addEventListener('error', () => abortConnection(socket, '无法连接服务，请确认地址后重试'));
}

function sendOnline(message) {
  if (app.socket?.readyState !== WebSocket.OPEN) {
    app.busy = false;
    render();
    toast('联机连接不可用');
    return false;
  }
  try {
    app.socket.send(JSON.stringify(message));
    return true;
  } catch {
    app.busy = false;
    render();
    toast('发送失败，请检查联机连接');
    return false;
  }
}

function handleOnlineMessage(message, socket) {
  if (message.type === 'error') {
    app.pendingClaim = null;
    if (!app.room) {
      abortConnection(socket, message.message);
      return;
    }
    app.busy = false;
    els.restart.disabled = false;
    if (!els.lobby.hidden) showLobby();
    render();
    toast(message.message);
    return;
  }
  if (message.type === 'room') {
    const previousPlayers = app.room?.players.length || 0;
    clearConnectionTimer();
    dismissToast();
    app.youId = message.youId;
    app.room = message.room;
    if (previousPlayers && message.room.players.length > previousPlayers) soundCue('join');
    if (!message.room.started) showLobby();
    return;
  }
  if (message.type === 'game-state') {
    const previousCurrent = app.view?.current;
    const roundStarted = message.state.phase === 'playing' && message.state.round !== app.view?.round;
    if (roundStarted) app.animateDeal = true;
    const startingMatch = !app.profileActive || (message.state.round === 1 && app.view?.phase === 'ended');
    if (startingMatch) {
      app.profileActive = true;
      resetProfile();
    }
    if (app.pendingClaim && message.state.lastPlay?.player === message.youId) {
      app.profileData = recordClaim(app.profileData, app.pendingClaim.cards, app.pendingClaim.target);
      app.pendingClaim = null;
      renderProfile();
    }
    app.mode = 'online';
    app.youId = message.youId;
    app.room = message.room;
    app.view = message.state;
    syncProfileRound(message.state);
    app.selected.clear();
    app.busy = message.state.phase !== 'playing';
    showGame();
    if (message.state.phase === 'playing') {
      app.revealSequence += 1;
      els.reveal.hidden = true;
      hideEliminationImpact();
      els.end.hidden = true;
      syncGameInert();
      app.busy = false;
    }
    if (message.state.phase === 'ended') {
      app.revealSequence += 1;
      els.reveal.hidden = true;
    }
    render();
    if (roundStarted) {
      soundCue('deal');
      soundCue('ready');
      focusGameSoon(message.state.current === app.youId ? els.hand.querySelector('.card') : $('#menuBtn'));
    } else if (previousCurrent && previousCurrent !== app.youId && message.state.current === app.youId && message.state.phase === 'playing') {
      soundCue('turn');
    }
    if (message.state.phase === 'ended') showEnd();
    return;
  }
  if (message.type === 'reveal') {
    if (message.result.challenger === app.youId) {
      app.profileData = recordChallenge(app.profileData, message.result.lied);
      renderProfile();
    }
    app.selected.clear();
    app.busy = true;
    render();
    showReveal(message.result, true);
  }
}

function showLobby() {
  const opening = els.lobby.hidden;
  els.start.hidden = true;
  els.lobby.hidden = false;
  syncGameInert();
  els.lobbyCode.textContent = app.room.code;
  const isHost = app.room.hostId === app.youId;
  const slots = [...app.room.players];
  while (slots.length < 4) slots.push(null);
  els.lobbyPlayers.innerHTML = slots.map((player) => player ? `<div class="lobby-player"><i>${escapeHtml(player.avatar)}</i><span>${escapeHtml(player.name)}</span>${player.id === app.room.hostId ? '<small>房主</small>' : ''}</div>` : '<div class="lobby-player lobby-slot"><i>＋</i><span>等待加入</span></div>').join('');
  els.startGame.hidden = !isHost;
  els.startGame.disabled = app.room.players.length < 2;
  els.lobbyStatus.textContent = isHost ? app.room.players.length < 2 ? '至少需要 2 名玩家' : `${app.room.players.length} 人已入座，可以开局` : '等待房主开始牌局';
  if (opening) focusSoon(els.lobbyCode);
}

function showEnd() {
  const opening = els.end.hidden;
  const winner = app.view.players.find((player) => player.id === app.view.winner);
  const won = winner?.id === app.youId;
  const online = app.mode === 'online';
  const host = online && app.room?.hostId === app.youId;
  els.endTitle.textContent = won ? '你活了下来' : `${winner?.name || '无人'} 获胜`;
  const result = won ? `历经 ${app.view.round} 局，你成为最后仍坐在桌前的人。` : `牌局在第 ${app.view.round} 局落幕。酒馆记住了最后的赢家。`;
  els.endCopy.textContent = `${result}${online && !host ? ' 可等待房主再开一桌，或返回首页。' : ''}`;
  [els.menu, els.profile, els.settings, els.tutorial, els.announcement].forEach((overlay) => { overlay.hidden = true; });
  app.tutorialReturn = null;
  app.settingsReturn = null;
  app.announcementReturn = null;
  app.paused = false;
  els.restart.hidden = online && !host;
  els.restart.disabled = false;
  els.restart.querySelector('span').textContent = online ? '再开一桌' : '再来一局';
  els.endLeave.hidden = !online;
  els.end.hidden = false;
  syncGameInert();
  if (opening) {
    soundCue(won ? 'win' : 'lose');
    focusSoon(host || !online ? els.restart : els.endLeave);
  }
}

function restartGame() {
  if (app.mode === 'solo') {
    els.end.hidden = true;
    syncGameInert();
    startSolo();
  } else {
    if (sendOnline({ type: 'start-game' })) els.restart.disabled = true;
  }
}

function openMenu() {
  resetGameExit();
  app.lastFocus = document.activeElement;
  app.paused = app.mode === 'solo';
  clearTimeout(app.aiTimer);
  if (app.mode === 'online') toast('联机牌局不会暂停');
  els.menu.hidden = false;
  syncGameInert();
  soundCue('paper');
  focusSoon($('#closeMenuBtn'));
}

function resetGameExit() {
  clearTimeout(app.exitConfirmTimer);
  app.exitConfirmTimer = null;
  els.exitGame.dataset.confirming = 'false';
  els.exitGame.textContent = els.exitGame.dataset.defaultLabel;
  els.exitGameHint.textContent = '';
}

function requestGameExit() {
  if (els.exitGame.dataset.confirming === 'true') {
    soundCue('exit');
    closeMenu(false);
    returnHome(app.mode === 'online');
    return;
  }
  resetGameExit();
  els.exitGame.dataset.confirming = 'true';
  els.exitGame.textContent = els.exitGame.dataset.confirmLabel;
  els.exitGameHint.textContent = '再次点击将在 3 秒内退出，当前牌局进度不会保留。';
  soundCue('warning');
  app.exitConfirmTimer = setTimeout(resetGameExit, 3000);
}

function closeMenu(resume = true) {
  resetGameExit();
  els.menu.hidden = true;
  syncGameInert();
  app.paused = false;
  if (resume) {
    soundCue('select');
    focusSoon(app.lastFocus);
    maybeRunAI();
  }
}

function openProfile() {
  if (!app.view) return;
  app.lastFocus = document.activeElement;
  app.paused = app.mode === 'solo';
  clearTimeout(app.aiTimer);
  if (app.mode === 'online') toast('联机牌局不会暂停');
  renderProfile();
  els.profile.hidden = false;
  syncGameInert();
  soundCue('paper');
  focusSoon($('#closeProfileBtn'));
}

function closeProfile() {
  els.profile.hidden = true;
  syncGameInert();
  app.paused = false;
  soundCue('paper');
  focusSoon(app.lastFocus);
  maybeRunAI();
}

function selectSettingsTab(name) {
  document.querySelectorAll('[data-settings-tab]').forEach((tab) => {
    const selected = tab.dataset.settingsTab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== name;
  });
  $('.settings-content').scrollTop = 0;
}

function openSettings() {
  startAmbience();
  app.settingsFocus = document.activeElement;
  app.settingsReturn = !els.start.hidden ? els.start : !els.lobby.hidden ? els.lobby : null;
  if (app.settingsReturn) app.settingsReturn.hidden = true;
  app.paused = app.mode === 'solo';
  clearTimeout(app.aiTimer);
  if (app.mode === 'online') toast('联机牌局不会暂停');
  syncSettingsControls();
  els.settings.hidden = false;
  syncGameInert();
  soundCue('paper');
  focusSoon($('#closeSettingsBtn'));
}

function closeSettings() {
  els.settings.hidden = true;
  if (app.settingsReturn) app.settingsReturn.hidden = false;
  app.settingsReturn = null;
  syncGameInert();
  app.paused = false;
  soundCue('paper');
  focusSoon(app.settingsFocus);
  app.settingsFocus = null;
  maybeRunAI();
}

function openTutorial() {
  app.tutorialFocus = document.activeElement;
  app.tutorialReturn = !els.settings.hidden ? els.settings : !els.start.hidden ? els.start : !els.lobby.hidden ? els.lobby : null;
  if (app.tutorialReturn) app.tutorialReturn.hidden = true;
  if (app.mode === 'solo') {
    app.paused = true;
    clearTimeout(app.aiTimer);
  }
  app.tutorialStep = 0;
  renderTutorial();
  els.tutorial.hidden = false;
  syncGameInert();
  soundCue('paper');
  focusSoon($('#closeTutorialBtn'));
}

function closeTutorial() {
  els.tutorial.hidden = true;
  if (app.tutorialReturn) app.tutorialReturn.hidden = false;
  const returnsToSettings = app.tutorialReturn === els.settings;
  app.tutorialReturn = null;
  syncGameInert();
  soundCue('paper');
  focusSoon(app.tutorialFocus);
  app.tutorialFocus = null;
  if (!returnsToSettings) {
    app.paused = false;
    maybeRunAI();
  }
}

function moveTutorial(direction) {
  const next = app.tutorialStep + direction;
  if (next >= TUTORIAL_STEPS.length) return closeTutorial();
  if (next < 0) return;
  app.tutorialStep = next;
  renderTutorial();
  soundCue('select');
  focusSoon(direction > 0 ? els.tutorialNext : els.tutorialBack);
}

function openAnnouncement() {
  if (app.connecting) return toast('请等待联机连接完成后再查看公告');
  app.announcementFocus = document.activeElement;
  app.announcementReturn = !els.settings.hidden ? els.settings : !els.start.hidden ? els.start : !els.lobby.hidden ? els.lobby : null;
  if (app.announcementReturn) app.announcementReturn.hidden = true;
  els.announcement.hidden = false;
  syncGameInert();
  soundCue('notice');
  focusSoon($('#closeAnnouncementBtn'));
}

function closeAnnouncement() {
  els.announcement.hidden = true;
  if (app.announcementReturn) app.announcementReturn.hidden = false;
  syncGameInert();
  soundCue('notice');
  focusSoon(app.announcementFocus);
  app.announcementFocus = null;
  app.announcementReturn = null;
}

function returnHome(closeSocket = true) {
  app.session += 1;
  app.revealSequence += 1;
  clearTimeout(app.aiTimer);
  clearConnectionTimer();
  hideEliminationImpact();
  resetGameExit();
  if (closeSocket && app.socket) {
    const socket = app.socket;
    app.socket = null;
    socket.close(1000, 'left room');
  }
  app.mode = null;
  app.engine = null;
  app.view = null;
  app.room = null;
  app.youId = null;
  app.selected.clear();
  app.busy = false;
  app.paused = false;
  app.profileActive = false;
  app.settingsReturn = null;
  app.tutorialReturn = null;
  app.announcementReturn = null;
  resetProfile();
  [els.lobby, els.reveal, els.end, els.menu, els.profile, els.settings, els.tutorial, els.announcement].forEach((overlay) => { overlay.hidden = true; });
  els.start.hidden = false;
  els.modeChooser.hidden = false;
  els.lanPanel.hidden = true;
  syncGameInert();
  els.modeBadge.className = 'mode-badge';
  els.modeBadge.querySelector('span').textContent = '未入座';
  render();
  focusSoon($('#soloBtn'));
}

function handleGameShortcut(event) {
  if (!app.preferences.shortcuts || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || els.game.inert) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return false;
  const key = event.key.toLowerCase();
  const card = /^[1-5]$/.test(key) ? els.hand.querySelector(`[data-index="${Number(key) - 1}"]`) : null;
  const action = key === 'c' ? els.challenge : key === 'p' ? els.play : card;
  if (!action || action.disabled) return false;
  event.preventDefault();
  action.click();
  return true;
}

els.play.addEventListener('click', playSelected);
els.challenge.addEventListener('click', challenge);
els.continue.addEventListener('click', continueLocal);
$('#soloBtn').addEventListener('click', startSolo);
$('#lanBtn').addEventListener('click', openLanPanel);
els.backMode.addEventListener('click', () => {
  if (app.socket && !app.room) abortConnection(app.socket);
  els.lanPanel.hidden = true;
  els.modeChooser.hidden = false;
  focusSoon($('#lanBtn'));
});
els.createRoom.addEventListener('click', () => connectRoom('create-room'));
els.joinRoom.addEventListener('click', () => connectRoom('join-room'));
els.roomCodeInput.addEventListener('input', () => { els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''); });
els.lanPanel.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!app.connecting) connectRoom(els.roomCodeInput.value.length === 4 ? 'join-room' : 'create-room');
});
els.lobbyCode.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(app.room.code);
    toast('房间码已复制');
  } catch {
    toast(`房间码：${app.room.code}`);
  }
});
els.startGame.addEventListener('click', () => {
  if (sendOnline({ type: 'start-game' })) {
    els.startGame.disabled = true;
    els.lobbyStatus.textContent = '正在开始牌局…';
  }
});
$('#leaveRoomBtn').addEventListener('click', () => returnHome(true));
els.endLeave.addEventListener('click', () => returnHome(true));
els.restart.addEventListener('click', restartGame);
$('#menuBtn').addEventListener('click', openMenu);
$('#closeMenuBtn').addEventListener('click', closeMenu);
$('#resumeBtn').addEventListener('click', closeMenu);
els.exitGame.addEventListener('click', requestGameExit);
els.profileButton.addEventListener('click', openProfile);
$('#closeProfileBtn').addEventListener('click', closeProfile);
$('#profileDoneBtn').addEventListener('click', closeProfile);
els.settingsButton.addEventListener('click', openSettings);
$('#startSettingsBtn').addEventListener('click', openSettings);
$('#closeSettingsBtn').addEventListener('click', closeSettings);
$('#settingsDoneBtn').addEventListener('click', closeSettings);
els.settingsTabs.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-settings-tab]');
  if (!tab) return;
  selectSettingsTab(tab.dataset.settingsTab);
  soundCue('select');
});
els.settingsTabs.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const tabs = [...els.settingsTabs.querySelectorAll('[data-settings-tab]')];
  const current = tabs.indexOf(document.activeElement);
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
  const next = tabs[(current + direction + tabs.length) % tabs.length];
  event.preventDefault();
  selectSettingsTab(next.dataset.settingsTab);
  next.focus();
});
$('#tutorialBtn').addEventListener('click', openTutorial);
$('#openTutorialBtn').addEventListener('click', openTutorial);
$('#closeTutorialBtn').addEventListener('click', closeTutorial);
els.tutorialBack.addEventListener('click', () => moveTutorial(-1));
els.tutorialNext.addEventListener('click', () => moveTutorial(1));
$('#settingsAnnouncementBtn').addEventListener('click', openAnnouncement);
$('#announcementBtn').addEventListener('click', openAnnouncement);
$('#closeAnnouncementBtn').addEventListener('click', closeAnnouncement);
$('#announcementDoneBtn').addEventListener('click', closeAnnouncement);
els.sound.addEventListener('click', () => {
  setSound(app.muted);
  toast(app.muted ? '声音与环境音乐已关闭' : '声音与环境音乐已开启');
  if (!app.muted) soundCue('ready');
});
els.soundEnabled.addEventListener('change', () => {
  setSound(els.soundEnabled.checked);
  syncSettingsControls();
  if (!app.muted) soundCue('ready');
});
els.musicEnabled.addEventListener('change', () => {
  app.preferences.music = els.musicEnabled.checked;
  if (app.preferences.music) startAmbience();
  syncAudioLevels();
  syncSettingsControls();
});
els.sfxEnabled.addEventListener('change', () => {
  app.preferences.sfx = els.sfxEnabled.checked;
  if (app.preferences.sfx) ensureAudio();
  syncAudioLevels();
  syncSettingsControls();
  if (app.preferences.sfx) soundCue('ready');
});
els.motionEnabled.addEventListener('change', () => {
  app.preferences.motion = els.motionEnabled.checked;
  syncPreferenceClasses();
  syncSettingsControls();
});
els.visualEffectsEnabled.addEventListener('change', () => {
  app.preferences.visualEffects = els.visualEffectsEnabled.checked;
  syncPreferenceClasses();
  syncSettingsControls();
});
const bindRange = (element, key, decimal, update) => element.addEventListener('input', () => {
  app.preferences[key] = Number(element.value) / (decimal ? 100 : 1);
  update?.();
  syncSettingsControls();
});
bindRange(els.masterVolume, 'masterVolume', true, syncAudioLevels);
bindRange(els.musicVolume, 'musicVolume', true, syncAudioLevels);
bindRange(els.sfxVolume, 'sfxVolume', true, syncAudioLevels);
bindRange(els.ambienceIntensity, 'ambienceIntensity', false, () => { syncAudioLevels(); setAmbienceTension(app.view?.pileCount || 0, app.view?.current === app.youId); });
bindRange(els.musicWarmth, 'musicWarmth', false, () => setAmbienceTension(app.view?.pileCount || 0, app.view?.current === app.youId));
bindRange(els.cuePitch, 'cuePitch', false);
['motionSpeed', 'cardScale', 'sceneBrightness', 'sceneContrast', 'particleDensity']
  .forEach((key) => bindRange(els[key], key, false, syncPreferenceClasses));
bindRange(els.aiSpeed, 'aiSpeed', false);
[
  [els.autoFocusEnabled, 'autoFocus'], [els.shortcutsEnabled, 'shortcuts'], [els.historyEnabled, 'history'],
  [els.turnEffectsEnabled, 'turnEffects'], [els.uiSoundsEnabled, 'uiSounds'], [els.gameSoundsEnabled, 'gameSounds'],
  [els.announcementSoundsEnabled, 'announcementSounds'],
].forEach(([element, key]) => element.addEventListener('change', () => {
  app.preferences[key] = element.checked;
  syncPreferenceClasses();
  syncSettingsControls();
}));
els.cuePitch.addEventListener('change', () => soundCue('select'));
els.sfxVolume.addEventListener('change', () => soundCue('select'));
els.uiSoundsEnabled.addEventListener('change', () => {
  if (app.preferences.uiSounds) soundCue('select');
});
els.gameSoundsEnabled.addEventListener('change', () => {
  if (app.preferences.gameSounds) soundCue('ready');
});
els.announcementSoundsEnabled.addEventListener('change', () => {
  if (app.preferences.announcementSounds) soundCue('notice');
});
$('#resetPreferencesBtn').addEventListener('click', resetPreferences);
els.language.addEventListener('change', () => {
  app.preferences.language = els.language.value;
  applyTranslations();
  soundCue('select');
});
document.addEventListener('visibilitychange', () => {
  syncAudioLevels();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!els.announcement.hidden) closeAnnouncement();
    else if (!els.tutorial.hidden) closeTutorial();
    else if (!els.settings.hidden) closeSettings();
    else if (!els.profile.hidden) closeProfile();
    else if (!els.menu.hidden) closeMenu();
    return;
  }
  if (handleGameShortcut(event)) return;
  if (event.key !== 'Tab') return;
  const overlays = [...document.querySelectorAll('.overlay:not([hidden])')];
  const modal = overlays.at(-1);
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button, input, select, a[href], summary, [tabindex]')]
    .filter((element) => !element.disabled && !element.closest('[hidden]') && element.tabIndex >= 0);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

returnHome(false);
selectSettingsTab('experience');
syncPreferenceClasses();
syncSettingsControls();
applyTranslations();
