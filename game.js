import { CARD_NAMES, GameEngine, shuffle } from './src/game-engine.js';

const $ = (selector) => document.querySelector(selector);
const AI_PLAYERS = [
  { id: 'flynn', name: '疤脸 · 弗林', avatar: '☠', bot: true },
  { id: 'eve', name: '黑寡妇 · 伊芙', avatar: '♦', bot: true },
  { id: 'morgan', name: '老狐狸 · 摩根', avatar: '♣', bot: true },
];

const els = {
  game: $('#game'), players: $('#players'), hand: $('#hand'), targetRank: $('#targetRank'),
  targetName: $('#targetName'), roundNo: $('#roundNo'), deckCount: $('#deckCount'),
  pile: $('#playedPile'), turnBanner: $('#turnBanner'), selectedCount: $('#selectedCount'),
  selectionHint: $('#selectionHint'), claimText: $('#claimText'), play: $('#playBtn'),
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
  modeBadge: $('#modeBadge'), youLabel: $('#youLabel'), connectionHint: $('#connectionHint'),
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
  lastFocus: null,
  announcementReturn: null,
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const playerName = (id) => app.view?.players.find((player) => player.id === id)?.name || '未知玩家';

let audio;
let ambience;

function ensureAudio() {
  if (app.muted) return null;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function tone(freq = 220, duration = .08, type = 'sine', volume = .035) {
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function startAmbience() {
  const context = ensureAudio();
  if (!context || ambience) return;
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const low = context.createOscillator();
  const fifth = context.createOscillator();
  gain.gain.value = app.muted ? 0 : .006;
  filter.type = 'lowpass';
  filter.frequency.value = 240;
  low.type = 'sine';
  fifth.type = 'triangle';
  low.frequency.value = 55;
  fifth.frequency.value = 82.5;
  low.connect(filter);
  fifth.connect(filter);
  filter.connect(gain).connect(context.destination);
  low.start();
  fifth.start();
  ambience = { gain, low, fifth };
}

function setSound(enabled) {
  app.muted = !enabled;
  els.sound.textContent = enabled ? '♪' : '♩';
  els.sound.setAttribute('aria-pressed', String(enabled));
  els.sound.setAttribute('aria-label', enabled ? '关闭声音与环境音乐' : '开启声音与环境音乐');
  if (enabled) startAmbience();
  if (ambience && audio) ambience.gain.gain.setTargetAtTime(enabled ? .006 : 0, audio.currentTime, .08);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function focusSoon(element) {
  requestAnimationFrame(() => element?.focus());
}

function showGame() {
  els.start.hidden = true;
  els.lobby.hidden = true;
  els.game.inert = false;
}

function render() {
  const view = app.view;
  if (!view) {
    els.players.innerHTML = '';
    els.hand.innerHTML = '';
    els.history.innerHTML = '';
    els.turnBanner.textContent = '等待入座';
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
  els.deckCount.textContent = view.deckCount;
  els.claimText.textContent = `宣称是 ${view.target}`;
  els.youLabel.textContent = me ? `${me.name} · 你的手牌` : '旁观牌局';
  els.connectionHint.textContent = app.mode === 'online' ? `房间 ${app.room?.code || ''}` : '单人模式';
  renderOpponents(opponents, view);
  renderHand(me, view);
  renderPile(view.pileCount);
  renderHistory(view.history);
  renderControls(me, view);
}

function renderOpponents(opponents, view) {
  els.players.innerHTML = opponents.map((player, index) => {
    const cards = Array.from({ length: player.handCount }, () => '<i class="mini-card"></i>').join('');
    const chambers = Array.from({ length: 6 }, (_, chamber) => `<span class="${chamber < player.shots ? 'used' : ''}"></span>`).join('');
    const status = !player.connected ? '已断开连接' : player.alive ? `${player.handCount} 张牌 · 弹巢 ${player.shots}/6` : '已离席';
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
  els.hand.innerHTML = hand.map((rank, index) => {
    const selected = app.selected.has(index);
    const red = rank === 'Q' ? 'red' : '';
    const rotation = (index - (hand.length - 1) / 2) * 3;
    const label = `${CARD_NAMES[rank]}，第 ${index + 1} 张${selected ? '，已选择' : ''}`;
    return `<button class="card ${rank === 'JOKER' ? 'joker' : ''} ${red} ${selected ? 'selected' : ''}" type="button" data-index="${index}" style="--rot:${rotation}deg" aria-label="${label}" aria-pressed="${selected}" ${myTurn ? '' : 'disabled'}>
      <span class="corner">${rank === 'JOKER' ? '★' : rank}</span><span class="suit">${rank === 'Q' ? '♥' : rank === 'K' ? '♣' : rank === 'A' ? '♠' : '✦'}</span><span class="face">${rank === 'JOKER' ? 'J' : rank}</span>
    </button>`;
  }).join('');
  els.hand.querySelectorAll('.card').forEach((card) => card.addEventListener('click', () => toggleCard(Number(card.dataset.index))));
}

function renderPile(count) {
  if (!count) {
    els.pile.innerHTML = '<div class="empty-pile">等待出牌</div>';
    return;
  }
  els.pile.innerHTML = Array.from({ length: Math.min(count, 9) }, (_, index, cards) => {
    const rotation = (index * 23 % 34) - 17;
    const offset = (index - (cards.length - 1) / 2) * 5;
    return `<i class="pile-card" style="transform:translateX(${offset}px) rotate(${rotation}deg)"></i>`;
  }).join('');
}

function renderHistory(history = []) {
  els.history.innerHTML = history.slice(-5).reverse().map((entry) => `<div class="history-item">${escapeHtml(entry)}</div>`).join('');
}

function renderControls(me, view) {
  const myTurn = Boolean(me?.alive && view.current === app.youId && view.phase === 'playing' && !app.busy && !app.paused);
  els.selectedCount.textContent = app.selected.size;
  els.selectionHint.textContent = app.selected.size ? `已选择 ${app.selected.size} 张 · 将宣称为 ${view.target}` : myTurn ? '选择 1–3 张牌' : me?.alive ? '等待轮到你' : '你已离席，正在旁观';
  els.play.disabled = !myTurn || app.selected.size < 1 || app.selected.size > 3;
  els.challenge.disabled = !myTurn || !view.lastPlay;
  const current = view.players.find((player) => player.id === view.current);
  els.turnBanner.textContent = view.phase === 'reveal' ? '等待裁决…' : view.phase === 'ended' ? '牌局结束' : myTurn ? '轮到你了' : `${current?.name || ''} 正在思考…`;
  els.modeBadge.className = `mode-badge ${app.mode || ''}`;
  els.modeBadge.querySelector('span').textContent = app.mode === 'online' ? `联机 · ${app.room?.code || ''}` : app.mode === 'solo' ? '单人牌局' : '未入座';
}

function toggleCard(index) {
  tone(360, .05, 'triangle');
  if (app.selected.has(index)) app.selected.delete(index);
  else if (app.selected.size < 3) app.selected.add(index);
  else return toast('一次最多打出 3 张牌');
  render();
}

function refreshLocal() {
  app.view = app.engine.viewFor(app.youId);
  app.busy = app.view.phase !== 'playing';
  render();
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
  app.engine = new GameEngine([{ id: 'you', name: '你', avatar: '♠' }, ...AI_PLAYERS]);
  app.engine.start();
  startAmbience();
  showGame();
  refreshLocal();
  maybeRunAI();
}

function shouldChallenge(engine, id) {
  const player = engine.player(id);
  const last = engine.lastPlay;
  if (!player.hand.length) return true;
  const knownMatches = player.hand.filter((card) => card === engine.target || card === 'JOKER').length;
  const impossible = knownMatches + last.count > 8;
  let chance = .14 + last.count * .1 + (engine.pile.length > 9 ? .12 : 0) + (impossible ? .65 : 0);
  if (!engine.player(last.player).hand.length) chance += .3;
  return Math.random() < Math.min(.92, chance);
}

function chooseAI(engine, id) {
  const player = engine.player(id);
  const matching = player.hand.map((rank, index) => rank === engine.target || rank === 'JOKER' ? index : -1).filter((index) => index >= 0);
  const other = player.hand.map((_, index) => index).filter((index) => !matching.includes(index));
  const count = Math.min(player.hand.length, 1 + (Math.random() < .28 ? 1 : 0) + (Math.random() < .08 ? 1 : 0));
  const chosen = shuffle([...matching]).slice(0, Math.min(count, matching.length));
  if (chosen.length < count) chosen.push(...shuffle([...other]).slice(0, count - chosen.length));
  return chosen;
}

function maybeRunAI() {
  clearTimeout(app.aiTimer);
  if (app.mode !== 'solo' || app.paused || app.busy || app.engine.phase !== 'playing') return;
  const current = app.engine.player(app.engine.current);
  if (!current.bot) return;
  const session = app.session;
  const currentId = current.id;
  app.aiTimer = setTimeout(async () => {
    await sleep(850 + Math.random() * 650);
    if (session !== app.session || app.paused || app.busy || app.engine.current !== currentId || app.engine.phase !== 'playing') return;
    if (app.engine.lastPlay && shouldChallenge(app.engine, currentId)) {
      await localChallenge(currentId);
      return;
    }
    app.engine.play(currentId, chooseAI(app.engine, currentId));
    tone(150, .12, 'square', .025);
    refreshLocal();
    maybeRunAI();
  }, 300);
}

async function showReveal(result, online) {
  const sequence = ++app.revealSequence;
  app.lastFocus = document.activeElement;
  els.reveal.hidden = false;
  els.game.inert = true;
  els.continue.hidden = true;
  els.onlineContinue.hidden = !online;
  els.revealed.innerHTML = '';
  els.roulette.className = 'roulette';
  els.revealTitle.textContent = result.lied ? '谎言被揭穿' : '质疑失败';
  els.revealEyebrow.textContent = `${playerName(result.challenger)} 发起质疑`;
  els.revealCopy.textContent = result.lied ? `${playerName(result.accused)} 的牌中混入了假牌。` : `所有牌都能充当 ${app.view.target}，${playerName(result.challenger)} 判断错了。`;
  els.rouletteText.textContent = `${playerName(result.loser)} 必须扣动扳机……`;
  els.revealTitle.tabIndex = -1;
  focusSoon(els.revealTitle);
  tone(90, .35, 'sawtooth', .04);

  await sleep(320);
  if (sequence !== app.revealSequence) return;
  els.revealed.innerHTML = result.cards.map((rank, index) => `<div class="reveal-mini ${rank !== app.view.target && rank !== 'JOKER' ? 'lie' : ''}" style="animation-delay:${index * .14}s">${rank === 'JOKER' ? '★' : rank}</div>`).join('');
  await sleep(950);
  if (sequence !== app.revealSequence) return;
  els.roulette.classList.add('firing');
  tone(70, 1.1, 'sawtooth', .018);
  await sleep(1250);
  if (sequence !== app.revealSequence) return;
  if (result.bang) {
    els.roulette.classList.add('bang');
    els.rouletteText.textContent = `砰！${playerName(result.loser)} 被淘汰了。`;
    tone(48, .6, 'square', .12);
  } else {
    els.rouletteText.textContent = `咔哒……空膛。${playerName(result.loser)} 逃过一劫。`;
    tone(180, .08, 'square', .045);
  }
  await sleep(550);
  if (sequence !== app.revealSequence || online) return;
  els.continue.hidden = false;
  focusSoon(els.continue);
}

async function localChallenge(challenger) {
  if (app.busy) return;
  app.busy = true;
  const result = app.engine.challenge(challenger);
  refreshLocal();
  await showReveal(result, false);
}

function continueLocal() {
  if (app.mode !== 'solo' || app.engine.phase !== 'reveal') return;
  app.revealSequence += 1;
  els.reveal.hidden = true;
  els.game.inert = false;
  app.engine.nextRound();
  app.selected.clear();
  app.busy = false;
  refreshLocal();
  if (app.view.phase !== 'ended') {
    maybeRunAI();
    focusSoon(app.view.current === app.youId ? els.hand.querySelector('.card') : $('#menuBtn'));
  }
}

function playSelected() {
  const indices = [...app.selected];
  if (app.mode === 'solo') {
    try {
      app.engine.play(app.youId, indices);
      app.selected.clear();
      tone(150, .12, 'square', .025);
      refreshLocal();
      maybeRunAI();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  sendOnline({ type: 'play', indices });
  app.busy = true;
  render();
}

function challenge() {
  if (app.mode === 'solo') {
    localChallenge(app.youId);
    return;
  }
  sendOnline({ type: 'challenge' });
  app.busy = true;
  render();
}

function openLanPanel() {
  startAmbience();
  els.modeChooser.hidden = true;
  els.lanPanel.hidden = false;
  focusSoon(els.playerName);
}

function connectRoom(action) {
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
  els.connectionHint.textContent = '正在连接…';
  toast('正在连接局域网服务…');

  socket.addEventListener('open', () => {
    if (socket !== app.socket) return;
    socket.send(JSON.stringify({ type: action, name, code }));
  });
  socket.addEventListener('message', ({ data }) => {
    if (socket !== app.socket) return;
    handleOnlineMessage(JSON.parse(data));
  });
  socket.addEventListener('close', () => {
    if (socket !== app.socket) return;
    app.socket = null;
    if (app.mode === 'online') {
      toast('已与房间断开连接');
      returnHome(false);
    }
  });
  socket.addEventListener('error', () => toast('无法连接服务，请通过 npm start 打开游戏'));
}

function sendOnline(message) {
  if (app.socket?.readyState !== WebSocket.OPEN) {
    app.busy = false;
    render();
    toast('联机连接不可用');
    return;
  }
  app.socket.send(JSON.stringify(message));
}

function handleOnlineMessage(message) {
  if (message.type === 'error') {
    app.busy = false;
    render();
    toast(message.message);
    return;
  }
  if (message.type === 'room') {
    app.youId = message.youId;
    app.room = message.room;
    if (!message.room.started) showLobby();
    return;
  }
  if (message.type === 'game-state') {
    const closingReveal = message.state.phase === 'playing' && !els.reveal.hidden;
    app.mode = 'online';
    app.youId = message.youId;
    app.room = message.room;
    app.view = message.state;
    app.selected.clear();
    app.busy = message.state.phase !== 'playing';
    showGame();
    if (message.state.phase === 'playing') {
      app.revealSequence += 1;
      els.reveal.hidden = true;
      els.end.hidden = true;
      els.game.inert = false;
      app.busy = false;
    }
    if (message.state.phase === 'ended') {
      app.revealSequence += 1;
      els.reveal.hidden = true;
    }
    render();
    if (closingReveal) focusSoon(message.state.current === app.youId ? els.hand.querySelector('.card') : $('#menuBtn'));
    if (message.state.phase === 'ended') showEnd();
    return;
  }
  if (message.type === 'reveal') {
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
  els.game.inert = true;
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
  els.endTitle.textContent = won ? '你活了下来' : `${winner?.name || '无人'} 获胜`;
  els.endCopy.textContent = won ? `历经 ${app.view.round} 局，你成为最后仍坐在桌前的人。` : `牌局在第 ${app.view.round} 局落幕。酒馆记住了最后的赢家。`;
  const online = app.mode === 'online';
  const host = online && app.room?.hostId === app.youId;
  els.restart.hidden = online && !host;
  els.restart.querySelector('span').textContent = online ? '再开一桌' : '再来一局';
  els.endLeave.hidden = !online;
  els.end.hidden = false;
  els.game.inert = true;
  if (opening) focusSoon(host || !online ? els.restart : els.endLeave);
}

function restartGame() {
  if (app.mode === 'solo') {
    els.end.hidden = true;
    els.game.inert = false;
    startSolo();
  } else {
    sendOnline({ type: 'start-game' });
  }
}

function openMenu() {
  app.lastFocus = document.activeElement;
  app.paused = app.mode === 'solo';
  clearTimeout(app.aiTimer);
  if (app.mode === 'online') toast('联机牌局不会暂停');
  els.menu.hidden = false;
  els.game.inert = true;
  focusSoon($('#closeMenuBtn'));
}

function closeMenu() {
  els.menu.hidden = true;
  els.game.inert = false;
  app.paused = false;
  focusSoon(app.lastFocus);
  maybeRunAI();
}

function openAnnouncement() {
  app.announcementReturn = !els.start.hidden ? els.start : !els.lobby.hidden ? els.lobby : null;
  if (app.announcementReturn) app.announcementReturn.hidden = true;
  els.announcement.hidden = false;
  focusSoon($('#closeAnnouncementBtn'));
}

function closeAnnouncement() {
  els.announcement.hidden = true;
  if (app.announcementReturn) app.announcementReturn.hidden = false;
  focusSoon($('#announcementBtn'));
  app.announcementReturn = null;
}

function returnHome(closeSocket = true) {
  app.session += 1;
  app.revealSequence += 1;
  clearTimeout(app.aiTimer);
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
  [els.lobby, els.reveal, els.end, els.menu, els.announcement].forEach((overlay) => { overlay.hidden = true; });
  els.start.hidden = false;
  els.modeChooser.hidden = false;
  els.lanPanel.hidden = true;
  els.game.inert = true;
  els.modeBadge.className = 'mode-badge';
  els.modeBadge.querySelector('span').textContent = '未入座';
  render();
  focusSoon($('#soloBtn'));
}

els.play.addEventListener('click', playSelected);
els.challenge.addEventListener('click', challenge);
els.continue.addEventListener('click', continueLocal);
$('#soloBtn').addEventListener('click', startSolo);
$('#lanBtn').addEventListener('click', openLanPanel);
$('#backModeBtn').addEventListener('click', () => {
  els.lanPanel.hidden = true;
  els.modeChooser.hidden = false;
  focusSoon($('#lanBtn'));
});
$('#createRoomBtn').addEventListener('click', () => connectRoom('create-room'));
$('#joinRoomBtn').addEventListener('click', () => connectRoom('join-room'));
els.roomCodeInput.addEventListener('input', () => { els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''); });
els.lanPanel.addEventListener('submit', (event) => {
  event.preventDefault();
  connectRoom(els.roomCodeInput.value.length === 4 ? 'join-room' : 'create-room');
});
els.lobbyCode.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(app.room.code);
    toast('房间码已复制');
  } catch {
    toast(`房间码：${app.room.code}`);
  }
});
els.startGame.addEventListener('click', () => sendOnline({ type: 'start-game' }));
$('#leaveRoomBtn').addEventListener('click', () => returnHome(true));
els.endLeave.addEventListener('click', () => returnHome(true));
els.restart.addEventListener('click', restartGame);
$('#menuBtn').addEventListener('click', openMenu);
$('#closeMenuBtn').addEventListener('click', closeMenu);
$('#resumeBtn').addEventListener('click', closeMenu);
$('#announcementBtn').addEventListener('click', openAnnouncement);
$('#closeAnnouncementBtn').addEventListener('click', closeAnnouncement);
$('#announcementDoneBtn').addEventListener('click', closeAnnouncement);
els.sound.addEventListener('click', () => {
  setSound(app.muted);
  toast(app.muted ? '声音与环境音乐已关闭' : '声音与环境音乐已开启');
  if (!app.muted) tone(440);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!els.announcement.hidden) closeAnnouncement();
    else if (!els.menu.hidden) closeMenu();
    return;
  }
  if (event.key !== 'Tab') return;
  const overlays = [...document.querySelectorAll('.overlay:not([hidden])')];
  const modal = overlays.at(-1);
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button, input, summary, [tabindex]')]
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
