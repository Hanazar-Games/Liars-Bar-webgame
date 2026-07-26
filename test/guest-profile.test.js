import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuestProfile,
  describeGuest,
  recordChallenge,
  recordClaim,
  syncSurvivedRounds,
} from '../src/guest-profile.js';

test('records truthful and false claims without mutating previous state', () => {
  const initial = createGuestProfile();
  const honest = recordClaim(initial, ['K', 'JOKER'], 'K');
  const liar = recordClaim(honest, ['K', 'Q'], 'K');

  assert.deepEqual(initial, {
    cardsPlayed: 0,
    claims: 0,
    lies: 0,
    honestClaims: 0,
    challenges: 0,
    challengesWon: 0,
    roundsSurvived: 0,
  });
  assert.deepEqual(liar, { ...initial, cardsPlayed: 4, claims: 2, lies: 1, honestClaims: 1 });
});

test('records challenge accuracy and survived rounds monotonically', () => {
  let profile = createGuestProfile();
  profile = recordChallenge(profile, true);
  profile = recordChallenge(profile, false);
  profile = syncSurvivedRounds(profile, 4);
  profile = syncSurvivedRounds(profile, 2);
  profile = syncSurvivedRounds(profile, 7, false);

  assert.equal(profile.challenges, 2);
  assert.equal(profile.challengesWon, 1);
  assert.equal(profile.roundsSurvived, 3);
  assert.equal(syncSurvivedRounds(profile, 4, true, true).roundsSurvived, 4);
});

test('awards thematic titles from observable play styles', () => {
  const newcomer = describeGuest(createGuestProfile());
  const honest = describeGuest(recordClaim(recordClaim(recordClaim(createGuestProfile(), ['A'], 'A'), ['A'], 'A'), ['JOKER'], 'A'));
  const liar = describeGuest(recordClaim(recordClaim(recordClaim(createGuestProfile(), ['Q'], 'A'), ['K'], 'A'), ['Q'], 'A'));
  const hunter = describeGuest(recordChallenge(recordChallenge(createGuestProfile(), true), true));
  const survivor = describeGuest(syncSurvivedRounds(createGuestProfile(), 5));

  assert.equal(newcomer.title, '雾中新客');
  assert.equal(newcomer.guile, 50);
  assert.equal(honest.title, '守誓酒客');
  assert.equal(honest.guile, 0);
  assert.equal(liar.title, '千面赌徒');
  assert.equal(liar.guile, 100);
  assert.equal(hunter.title, '猎谎人');
  assert.equal(survivor.title, '空膛余生');
});
