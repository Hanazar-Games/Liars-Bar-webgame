(() => {
  'use strict';

  const RANKS = ['A', 'K', 'Q'];
  const NAMES = { A: '王牌', K: '国王', Q: '皇后', JOKER: 'JOKER' };
  const AVATARS = ['♠', '☠', '♦', '♣'];
  const AI_NAMES = ['疤脸 · 弗林', '黑寡妇 · 伊芙', '老狐狸 · 摩根'];
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const state = {
    players: [], current: 0, target: 'K', lastPlay: null, pile: [],
    round: 0, selected: new Set(), busy: false, started: false, muted: false,
  };

  const els = {
    players: $('#players'), hand: $('#hand'), targetRank: $('#targetRank'),
    targetName: $('#targetName'), roundNo: $('#roundNo'), deckCount: $('#deckCount'),
    pile: $('#playedPile'), turnBanner: $('#turnBanner'), selectedCount: $('#selectedCount'),
    selectionHint: $('#selectionHint'), claimText: $('#claimText'), play: $('#playBtn'),
    challenge: $('#challengeBtn'), history: $('#historyList'), toast: $('#toast'),
    start: $('#startScreen'), reveal: $('#revealOverlay'), revealed: $('#revealedCards'),
    revealTitle: $('#revealTitle'), revealCopy: $('#revealCopy'), revealEyebrow: $('#revealEyebrow'),
    roulette: $('#roulette'), rouletteText: $('#rouletteText'), continue: $('#continueBtn'),
    end: $('#endOverlay'), endTitle: $('#endTitle'), endCopy: $('#endCopy'),
    menu: $('#menuOverlay'), sound: $('#soundBtn'),
  };

  let audio;
  function tone(freq = 220, duration = .08, type = 'sine', volume = .035) {
    if (state.muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator(); const gain = audio.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
      osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Audio is optional. */ }
  }

  function makeDeck() {
    return shuffle([...Array(6).fill('A'), ...Array(6).fill('K'), ...Array(6).fill('Q'), 'JOKER', 'JOKER']);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function alive() { return state.players.filter((p) => p.alive); }
  function nextAlive(from) {
    let i = from; do { i = (i + 1) % state.players.length; } while (!state.players[i].alive);
    return i;
  }

  function newGame() {
    state.players = [
      { name: '你', human: true, alive: true, hand: [], shots: 0, bullet: randomBullet() },
      ...AI_NAMES.map((name) => ({ name, human: false, alive: true, hand: [], shots: 0, bullet: randomBullet() })),
    ];
    state.round = 0; state.started = true; state.history = [];
    els.start.classList.add('hidden'); els.end.classList.add('hidden');
    startRound();
  }
  function randomBullet() { return Math.floor(Math.random() * 6); }

  function startRound() {
    if (alive().length <= 1) return finishGame();
    state.round += 1; state.target = RANKS[Math.floor(Math.random() * RANKS.length)];
    state.pile = []; state.lastPlay = null; state.selected.clear(); state.busy = false;
    const deck = makeDeck();
    state.players.forEach((p) => { p.hand = p.alive ? deck.splice(0, 5) : []; });
    const candidates = state.players.map((p, i) => p.alive ? i : -1).filter((i) => i >= 0);
    state.current = candidates[Math.floor(Math.random() * candidates.length)];
    log(`第 ${state.round} 局开始，指定牌是 ${state.target}`);
    render();
    if (state.current !== 0) scheduleAI(); else toast('你先出牌');
  }

  function render() {
    els.targetRank.textContent = state.target; els.targetName.textContent = NAMES[state.target];
    els.roundNo.textContent = state.round; els.deckCount.textContent = Math.max(0, 20 - alive().length * 5);
    els.claimText.textContent = `宣称是 ${state.target}`;
    renderOpponents(); renderHand(); renderPile(); renderControls(); renderHistory();
  }

  function renderOpponents() {
    els.players.innerHTML = state.players.slice(1).map((p, idx) => {
      const pi = idx + 1; const cards = p.hand.map(() => '<i class="mini-card"></i>').join('');
      const chambers = Array.from({length: 6}, (_, i) => `<span class="${i < p.shots ? 'used' : ''}"></span>`).join('');
      return `<article class="opponent ${!p.alive ? 'dead' : ''} ${state.current === pi && !state.busy ? 'active' : ''}" data-seat="${pi}">
        <div class="avatar-ring"><div class="avatar">${AVATARS[pi]}</div><i class="turn-dot"></i></div>
        <div class="name">${p.name}</div><div class="status">${p.alive ? `${p.hand.length} 张牌 · 弹巢 ${p.shots}/6` : '已离席'}</div>
        <div class="mini-cards">${cards}</div><div class="chambers">${chambers}</div>
      </article>`;
    }).join('');
  }

  function renderHand() {
    const me = state.players[0];
    if (!me) { els.hand.innerHTML = ''; return; }
    els.hand.innerHTML = me.hand.map((rank, i) => {
      const selected = state.selected.has(i); const red = rank === 'Q' ? 'red' : '';
      const rot = (i - (me.hand.length - 1) / 2) * 3;
      return `<button class="card ${rank === 'JOKER' ? 'joker' : ''} ${red} ${selected ? 'selected' : ''}" data-index="${i}" style="--rot:${rot}deg" ${state.current !== 0 || state.busy || !me.alive ? 'disabled' : ''}>
        <span class="corner">${rank === 'JOKER' ? '★' : rank}</span><span class="suit">${rank === 'Q' ? '♥' : rank === 'K' ? '♣' : rank === 'A' ? '♠' : '✦'}</span><span class="face">${rank === 'JOKER' ? 'J' : rank}</span>
      </button>`;
    }).join('');
    els.hand.querySelectorAll('.card').forEach((card) => card.addEventListener('click', () => toggleCard(Number(card.dataset.index))));
  }

  function renderPile() {
    if (!state.pile.length) { els.pile.innerHTML = '<div class="empty-pile">等待出牌</div>'; return; }
    els.pile.innerHTML = state.pile.slice(-9).map((_, i, a) => {
      const rot = (i * 23 % 34) - 17; const x = (i - (a.length - 1) / 2) * 5;
      return `<i class="pile-card" style="transform:translateX(${x}px) rotate(${rot}deg)"></i>`;
    }).join('');
  }

  function renderControls() {
    const me = state.players[0];
    const myTurn = Boolean(me && state.current === 0 && !state.busy && me.alive);
    els.selectedCount.textContent = state.selected.size;
    els.selectionHint.textContent = state.selected.size ? `已选择 ${state.selected.size} 张 · 将宣称为 ${state.target}` : '选择 1–3 张牌';
    els.play.disabled = !myTurn || state.selected.size < 1 || state.selected.size > 3;
    els.challenge.disabled = !myTurn || !state.lastPlay;
    const current = state.players[state.current];
    els.turnBanner.textContent = state.busy ? '等待裁决…' : myTurn ? '轮到你了' : `${current?.name || ''} 正在思考…`;
  }

  function renderHistory() {
    els.history.innerHTML = (state.history || []).slice(-5).reverse().map((x) => `<div class="history-item">${x}</div>`).join('');
  }

  function toggleCard(index) {
    tone(360, .05, 'triangle');
    if (state.selected.has(index)) state.selected.delete(index);
    else if (state.selected.size < 3) state.selected.add(index);
    else return toast('一次最多打出 3 张牌');
    renderHand(); renderControls();
  }

  function commitPlay(playerIndex, indices) {
    const p = state.players[playerIndex];
    const cards = indices.sort((a,b) => b-a).map((i) => p.hand.splice(i, 1)[0]).reverse();
    state.pile.push(...cards); state.lastPlay = { player: playerIndex, cards, count: cards.length };
    log(`${p.name} 宣称打出 ${cards.length} 张 ${state.target}`);
    tone(150, .12, 'square', .025); state.selected.clear();
    if (!p.hand.length) log(`${p.name} 已经出完手牌`);
    state.current = nextAlive(playerIndex); render();
    if (state.current !== 0) scheduleAI();
  }

  async function aiTurn() {
    if (!state.started || state.current === 0 || state.busy) return;
    const idx = state.current; const p = state.players[idx];
    render(); await sleep(900 + Math.random() * 800);
    if (!p.alive || state.current !== idx) return;

    if (state.lastPlay && shouldChallenge(idx)) return resolveChallenge(idx);
    const matching = p.hand.map((r,i) => (r === state.target || r === 'JOKER') ? i : -1).filter(i => i >= 0);
    const other = p.hand.map((_,i) => i).filter(i => !matching.includes(i));
    let count = Math.min(p.hand.length, 1 + (Math.random() < .28 ? 1 : 0) + (Math.random() < .08 ? 1 : 0));
    let chosen = [];
    if (matching.length) chosen.push(...shuffle([...matching]).slice(0, Math.min(count, matching.length)));
    if (chosen.length < count) chosen.push(...shuffle([...other]).slice(0, count - chosen.length));
    commitPlay(idx, chosen);
  }

  function shouldChallenge(idx) {
    const p = state.players[idx]; const last = state.lastPlay;
    if (!p.hand.length) return true;
    const knownMatches = p.hand.filter((r) => r === state.target || r === 'JOKER').length;
    const impossible = knownMatches + last.count > 8;
    let chance = .14 + last.count * .1 + (state.pile.length > 9 ? .12 : 0) + (impossible ? .65 : 0);
    if (!state.players[last.player].hand.length) chance += .3;
    return Math.random() < Math.min(.92, chance);
  }

  function scheduleAI() { setTimeout(aiTurn, 350); }

  async function resolveChallenge(challenger) {
    if (!state.lastPlay || state.busy) return;
    state.busy = true; const play = state.lastPlay; const accused = play.player;
    const lied = play.cards.some((r) => r !== state.target && r !== 'JOKER');
    const loser = lied ? accused : challenger;
    log(`${state.players[challenger].name} 质疑 ${state.players[accused].name}`);
    render(); tone(90, .35, 'sawtooth', .04);
    els.revealed.innerHTML = ''; els.reveal.classList.remove('hidden'); els.continue.classList.add('hidden');
    els.revealTitle.textContent = lied ? '谎言被揭穿' : '质疑失败';
    els.revealEyebrow.textContent = `${state.players[challenger].name} 发起质疑`;
    els.revealCopy.textContent = lied
      ? `${state.players[accused].name} 的牌中混入了假牌。`
      : `所有牌都能充当 ${state.target}，${state.players[challenger].name} 判断错了。`;
    els.roulette.className = 'roulette'; els.rouletteText.textContent = `${state.players[loser].name} 必须扣动扳机……`;
    await sleep(350);
    els.revealed.innerHTML = play.cards.map((r,i) => `<div class="reveal-mini ${(r !== state.target && r !== 'JOKER') ? 'lie' : ''}" style="animation-delay:${i*.14}s">${r === 'JOKER' ? '★' : r}</div>`).join('');
    await sleep(1100); await pullTrigger(loser);
  }

  async function pullTrigger(loserIndex) {
    const p = state.players[loserIndex]; els.roulette.classList.add('firing');
    tone(70, 1.1, 'sawtooth', .018); await sleep(1250);
    const bang = p.shots === p.bullet; p.shots += 1;
    if (bang) {
      p.alive = false; els.roulette.classList.add('bang'); els.rouletteText.textContent = `砰！${p.name} 被淘汰了。`;
      tone(48, .6, 'square', .12); log(`${p.name} 的左轮击发，已被淘汰`);
    } else {
      els.rouletteText.textContent = `咔哒……空膛。${p.name} 逃过一劫。`;
      tone(180, .08, 'square', .045); log(`${p.name} 扣下空膛，暂时生还`);
    }
    await sleep(750); els.continue.classList.remove('hidden');
    els.continue.onclick = () => { els.reveal.classList.add('hidden'); startRound(); };
  }

  function finishGame() {
    const winner = alive()[0]; state.busy = true;
    els.endTitle.textContent = winner?.human ? '你活了下来' : `${winner?.name} 获胜`;
    els.endCopy.textContent = winner?.human ? `历经 ${state.round} 局，你成为最后仍坐在桌前的人。` : `你的运气在第 ${state.round} 局耗尽。酒馆不会同情失败者。`;
    els.end.classList.remove('hidden');
  }

  function log(text) { state.history ||= []; state.history.push(text); renderHistory(); }
  let toastTimer;
  function toast(text) { els.toast.textContent = text; els.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800); }

  els.play.addEventListener('click', () => commitPlay(0, [...state.selected]));
  els.challenge.addEventListener('click', () => resolveChallenge(0));
  $('#startBtn').addEventListener('click', newGame);
  $('#restartBtn').addEventListener('click', newGame);
  $('#menuBtn').addEventListener('click', () => els.menu.classList.remove('hidden'));
  $('#closeMenuBtn').addEventListener('click', () => els.menu.classList.add('hidden'));
  $('#resumeBtn').addEventListener('click', () => els.menu.classList.add('hidden'));
  els.sound.addEventListener('click', () => { state.muted = !state.muted; els.sound.textContent = state.muted ? '♩' : '♪'; toast(state.muted ? '声音已关闭' : '声音已开启'); tone(440); });

  render();
})();
