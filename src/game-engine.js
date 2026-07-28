export const RANKS = ['A', 'K', 'Q'];
export const WILD_CARD = 'JOKER';
export const CARD_NAMES = { A: 'A牌', K: '国王', Q: '皇后', JOKER: '万能牌 · JOKER' };

export const cardMatchesTarget = (card, target) => card === target || card === WILD_CARD;

export function shuffle(cards, random = Math.random) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function createDeck(random = Math.random) {
  return shuffle([
    ...Array(6).fill('A'),
    ...Array(6).fill('K'),
    ...Array(6).fill('Q'),
    WILD_CARD,
    WILD_CARD,
  ], random);
}

export class GameEngine {
  constructor(players, { random = Math.random } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
      throw new Error('玩家人数必须为 2–4 人');
    }
    if (new Set(players.map(({ id }) => id)).size !== players.length) {
      throw new Error('玩家 ID 不能重复');
    }

    this.random = random;
    this.players = players.map(({ id, name, avatar = '♠', bot = false }) => ({
      id,
      name,
      avatar,
      bot,
      alive: true,
      connected: true,
      hand: [],
      shots: 0,
      bullet: 0,
    }));
    this.round = 0;
    this.target = 'K';
    this.current = null;
    this.lastPlay = null;
    this.pile = [];
    this.phase = 'lobby';
    this.history = [];
    this.winner = null;
    this.reveal = null;
  }

  start() {
    this.players.forEach((player) => {
      player.alive = true;
      player.connected = true;
      player.hand = [];
      player.shots = 0;
      player.bullet = Math.floor(this.random() * 6);
    });
    this.round = 0;
    this.history = [];
    this.winner = null;
    return this.startRound();
  }

  startRound() {
    if (this.alivePlayers().length <= 1) return this.finish();

    this.round += 1;
    this.target = RANKS[Math.floor(this.random() * RANKS.length)];
    this.pile = [];
    this.lastPlay = null;
    this.reveal = null;
    this.phase = 'playing';

    const deck = createDeck(this.random);
    this.players.forEach((player) => {
      player.hand = player.alive ? deck.splice(0, 5) : [];
    });
    const candidates = this.alivePlayers();
    this.current = candidates[Math.floor(this.random() * candidates.length)].id;
    this.log(`第 ${this.round} 局开始，指定牌是 ${this.target}`);
    return this.viewFor(this.current);
  }

  alivePlayers() {
    return this.players.filter((player) => player.alive);
  }

  player(id) {
    const player = this.players.find((candidate) => candidate.id === id);
    if (!player) throw new Error('玩家不存在');
    return player;
  }

  nextAlive(id) {
    let index = this.players.findIndex((player) => player.id === id);
    for (let checked = 0; checked < this.players.length; checked += 1) {
      index = (index + 1) % this.players.length;
      if (this.players[index].alive) return this.players[index].id;
    }
    return null;
  }

  assertTurn(id) {
    if (this.phase !== 'playing') throw new Error('当前不能行动');
    if (this.current !== id) throw new Error('还没轮到你');
    if (!this.player(id).alive) throw new Error('你已被淘汰');
  }

  play(id, indices) {
    this.assertTurn(id);
    if (!Array.isArray(indices) || indices.length < 1 || indices.length > 3) {
      throw new Error('请选择 1–3 张牌');
    }
    if (new Set(indices).size !== indices.length) throw new Error('不能选择重复的牌');

    const player = this.player(id);
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= player.hand.length)) {
      throw new Error('包含无效手牌');
    }

    const cards = [...indices]
      .sort((a, b) => b - a)
      .map((index) => player.hand.splice(index, 1)[0])
      .reverse();
    this.pile.push(...cards);
    this.lastPlay = { player: id, cards, count: cards.length };
    this.log(`${player.name} 宣称打出 ${cards.length} 张 ${this.target}`);
    if (!player.hand.length) this.log(`${player.name} 已经出完手牌`);
    this.current = this.nextAlive(id);
    return { player: id, cards, count: cards.length };
  }

  challenge(id) {
    this.assertTurn(id);
    if (!this.lastPlay) throw new Error('现在没有可以质疑的出牌');

    const play = this.lastPlay;
    const lied = play.cards.some((card) => !cardMatchesTarget(card, this.target));
    const loser = lied ? play.player : id;
    const punished = this.player(loser);
    const bang = punished.shots === punished.bullet;
    punished.shots += 1;
    if (bang) punished.alive = false;

    this.phase = 'reveal';
    this.log(`${this.player(id).name} 质疑 ${this.player(play.player).name}`);
    this.log(bang ? `${punished.name} 的左轮击发，已被淘汰` : `${punished.name} 扣下空膛，暂时生还`);
    this.reveal = {
      challenger: id,
      accused: play.player,
      cards: [...play.cards],
      lied,
      loser,
      bang,
    };
    return { ...this.reveal, cards: [...this.reveal.cards] };
  }

  nextRound() {
    if (this.phase !== 'reveal') throw new Error('当前无需进入下一局');
    return this.alivePlayers().length <= 1 ? this.finish() : this.startRound();
  }

  forfeit(id) {
    const player = this.player(id);
    if (!player.connected) return;
    player.connected = false;
    player.hand = [];
    this.log(`${player.name} 已断开连接并离席`);
    if (this.phase === 'ended') return;
    player.alive = false;

    if (this.lastPlay?.player === id) this.lastPlay = null;
    if (this.alivePlayers().length <= 1) {
      this.finish();
    } else if (this.phase === 'playing' && this.current === id) {
      this.current = this.nextAlive(id);
    }
  }

  finish() {
    this.phase = 'ended';
    this.winner = this.alivePlayers()[0]?.id ?? null;
    this.current = null;
    if (this.winner) this.log(`${this.player(this.winner).name} 成为最后的赢家`);
    return this.winner;
  }

  log(message) {
    this.history.push(message);
    if (this.history.length > 80) this.history.shift();
  }

  viewFor(viewerId) {
    return {
      round: this.round,
      target: this.target,
      current: this.current,
      phase: this.phase,
      pileCount: this.pile.length,
      lastPlay: this.lastPlay ? { player: this.lastPlay.player, count: this.lastPlay.count } : null,
      winner: this.winner,
      history: [...this.history],
      players: this.players.map((player) => {
        const view = {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          bot: player.bot,
          alive: player.alive,
          connected: player.connected,
          shots: player.shots,
          handCount: player.hand.length,
        };
        if (player.id === viewerId) view.hand = [...player.hand];
        return view;
      }),
    };
  }
}
