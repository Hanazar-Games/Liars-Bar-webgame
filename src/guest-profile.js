import { cardMatchesTarget } from './game-engine.js';

export function createGuestProfile() {
  return {
    cardsPlayed: 0,
    claims: 0,
    lies: 0,
    honestClaims: 0,
    challenges: 0,
    challengesWon: 0,
    roundsSurvived: 0,
  };
}

export function recordClaim(profile, cards, target) {
  if (!Array.isArray(cards) || !cards.length) return profile;
  const lied = cards.some((card) => !cardMatchesTarget(card, target));
  return {
    ...profile,
    cardsPlayed: profile.cardsPlayed + cards.length,
    claims: profile.claims + 1,
    lies: profile.lies + Number(lied),
    honestClaims: profile.honestClaims + Number(!lied),
  };
}

export function recordChallenge(profile, succeeded) {
  return {
    ...profile,
    challenges: profile.challenges + 1,
    challengesWon: profile.challengesWon + Number(succeeded),
  };
}

export function syncSurvivedRounds(profile, round, alive = true, completed = false) {
  if (!alive) return profile;
  return { ...profile, roundsSurvived: Math.max(profile.roundsSurvived, Math.max(0, round - Number(!completed))) };
}

export function describeGuest(profile) {
  const guile = profile.claims ? Math.round(profile.lies / profile.claims * 100) : 50;
  let title = '雾中新客';
  let quote = '酒保还在等你露出第一张底牌。';

  if (profile.claims || profile.challenges) {
    title = '薄雾行者';
    quote = '你的名字刚刚出现在酒馆的耳语里。';
  }
  if (profile.cardsPlayed >= 8) {
    title = '深桌常客';
    quote = '你已经懂得让每一次落牌都留有余味。';
  }
  if (profile.honestClaims >= 3 && profile.lies === 0) {
    title = '守誓酒客';
    quote = '在满桌谎话里，诚实反而成了最锋利的伪装。';
  }
  if (profile.lies >= 3 && profile.lies > profile.honestClaims) {
    title = '千面赌徒';
    quote = '没人能从你的眼神里分清真牌与假话。';
  }
  if (profile.challengesWon >= 2 && profile.challengesWon / profile.challenges >= .67) {
    title = '猎谎人';
    quote = '一句迟疑，已经足够让你闻到谎言。';
  }
  if (profile.roundsSurvived >= 4) {
    title = '空膛余生';
    quote = '左轮记得你的手温，却始终没能留下你。';
  }

  return { title, quote, guile };
}
