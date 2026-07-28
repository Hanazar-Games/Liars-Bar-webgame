import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_NAMES, GameEngine, WILD_CARD, cardMatchesTarget, createDeck } from '../src/game-engine.js';

const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));
const fixedRandom = () => 0;

function game(count = 4) {
  const engine = new GameEngine(players.slice(0, count), { random: fixedRandom });
  engine.start();
  return engine;
}

test('creates the expected deck and deals five private cards', () => {
  const deck = createDeck(fixedRandom);
  assert.equal(deck.length, 20);
  assert.deepEqual(
    Object.fromEntries(['A', 'K', 'Q', 'JOKER'].map((rank) => [rank, deck.filter((card) => card === rank).length])),
    { A: 6, K: 6, Q: 6, JOKER: 2 },
  );

  const engine = game();
  assert.equal(engine.round, 1);
  assert.equal(engine.players.every((player) => player.hand.length === 5), true);

  const view = engine.viewFor('a');
  assert.equal(view.pileCount, 0);
  assert.equal('deckCount' in view, false);
  assert.equal(view.players.find((player) => player.id === 'a').hand.length, 5);
  assert.equal('hand' in view.players.find((player) => player.id === 'b'), false);
  assert.equal(view.players.find((player) => player.id === 'b').handCount, 5);
});

test('treats only Joker as the wildcard and names Ace unambiguously', () => {
  assert.equal(WILD_CARD, 'JOKER');
  assert.equal(cardMatchesTarget('JOKER', 'K'), true);
  assert.equal(cardMatchesTarget('K', 'K'), true);
  assert.equal(cardMatchesTarget('Q', 'K'), false);
  assert.equal(CARD_NAMES.A, 'A牌');
  assert.match(CARD_NAMES.JOKER, /万能牌/);
});

test('validates turn ownership and card selections', () => {
  const engine = game();
  engine.current = 'a';

  assert.throws(() => engine.play('b', [0]), /还没轮到/);
  assert.throws(() => engine.play('a', []), /1–3/);
  assert.throws(() => engine.play('a', [0, 0]), /重复/);
  assert.throws(() => engine.play('a', [0, 1, 2, 3]), /1–3/);
  assert.throws(() => engine.play('a', [99]), /无效/);

  const before = [...engine.players[0].hand];
  const result = engine.play('a', [0, 2]);
  assert.deepEqual(result.cards, [before[0], before[2]]);
  assert.equal(engine.players[0].hand.length, 3);
  assert.equal(engine.pile.length, 2);
  assert.equal(engine.current, 'b');
  assert.equal(engine.viewFor('a').pileCount, 2);
});

test('punishes the accused when a lie is found', () => {
  const engine = game();
  engine.target = 'K';
  engine.current = 'b';
  engine.lastPlay = { player: 'a', cards: ['K', 'Q'], count: 2 };
  engine.players[0].bullet = 5;

  const result = engine.challenge('b');
  assert.equal(result.lied, true);
  assert.equal(result.loser, 'a');
  assert.equal(result.bang, false);
  assert.equal(engine.players[0].shots, 1);
  assert.equal(engine.phase, 'reveal');
});

test('punishes the challenger and eliminates on the loaded chamber', () => {
  const engine = game();
  engine.target = 'K';
  engine.current = 'b';
  engine.lastPlay = { player: 'a', cards: ['K', 'JOKER'], count: 2 };
  engine.players[1].bullet = 0;

  const result = engine.challenge('b');
  assert.equal(result.lied, false);
  assert.equal(result.loser, 'b');
  assert.equal(result.bang, true);
  assert.equal(engine.players[1].alive, false);
});

test('forfeit removes a disconnected player and advances the turn', () => {
  const engine = game(3);
  engine.current = 'b';
  engine.lastPlay = { player: 'b', cards: ['A'], count: 1 };

  engine.forfeit('b');
  assert.equal(engine.players[1].alive, false);
  assert.equal(engine.players[1].connected, false);
  assert.equal(engine.current, 'c');
  assert.equal(engine.lastPlay, null);
});

test('starts a fresh round after reveal and ends with one survivor', () => {
  const engine = game(2);
  engine.phase = 'reveal';
  engine.players[1].alive = false;

  engine.nextRound();
  assert.equal(engine.phase, 'ended');
  assert.equal(engine.winner, 'a');
});

test('preserves the completed result when the winner disconnects', () => {
  const engine = game(2);
  engine.players[1].alive = false;
  engine.finish();

  engine.forfeit('a');

  assert.equal(engine.phase, 'ended');
  assert.equal(engine.winner, 'a');
  assert.equal(engine.player('a').alive, true);
  assert.equal(engine.player('a').connected, false);
});
