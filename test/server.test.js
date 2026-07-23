import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createGameServer } from '../server.js';

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const messages = [];
    const waiters = [];
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex(({ type }) => type === message.type);
      if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
      else messages.push(message);
    });
    socket.once('open', () => resolve({
      socket,
      send: (message) => socket.send(JSON.stringify(message)),
      next(type) {
        const index = messages.findIndex((message) => message.type === type);
        if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
        return new Promise((resolveMessage, rejectMessage) => {
          const timer = setTimeout(() => rejectMessage(new Error(`等待 ${type} 超时`)), 1500);
          waiters.push({
            type,
            resolve(message) {
              clearTimeout(timer);
              resolveMessage(message);
            },
          });
        });
      },
    }));
    socket.once('error', reject);
  });
}

test('creates a private room and broadcasts authoritative redacted state', async (t) => {
  const gameServer = createGameServer({ host: '127.0.0.1', port: 0, revealDelay: 30, logger: null });
  await gameServer.start();
  t.after(() => gameServer.close());

  const address = gameServer.server.address();
  const page = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /骗子酒馆/);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/styles.css`, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/server.js`)).status, 404);
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const host = await connect(url);
  const guest = await connect(url);
  t.after(() => {
    host.socket.close();
    guest.socket.close();
  });

  host.send({ type: 'create-room', name: '房主' });
  const hostRoom = await host.next('room');
  assert.match(hostRoom.room.code, /^[A-Z2-9]{4}$/);
  assert.equal(hostRoom.room.players.length, 1);

  guest.send({ type: 'join-room', name: '客人', code: hostRoom.room.code });
  const guestRoom = await guest.next('room');
  await host.next('room');
  assert.equal(guestRoom.room.players.length, 2);

  guest.send({ type: 'start-game' });
  assert.match((await guest.next('error')).message, /房主/);

  host.send({ type: 'start-game' });
  const [hostState, guestState] = await Promise.all([host.next('game-state'), guest.next('game-state')]);
  const hostSelf = hostState.state.players.find((player) => player.id === hostState.youId);
  const hostOpponent = hostState.state.players.find((player) => player.id !== hostState.youId);
  const guestSelf = guestState.state.players.find((player) => player.id === guestState.youId);
  assert.equal(hostSelf.hand.length, 5);
  assert.equal(guestSelf.hand.length, 5);
  assert.equal('hand' in hostOpponent, false);

  const currentClient = hostState.state.current === hostState.youId ? host : guest;
  const waitingClient = currentClient === host ? guest : host;
  waitingClient.send({ type: 'play', indices: [0] });
  assert.match((await waitingClient.next('error')).message, /还没轮到/);
  currentClient.send({ type: 'play', indices: [0] });
  const [afterHostPlay, afterGuestPlay] = await Promise.all([host.next('game-state'), guest.next('game-state')]);
  assert.equal(afterHostPlay.state.pileCount, 1);
  assert.equal(afterGuestPlay.state.pileCount, 1);

  const challenger = afterHostPlay.state.current === afterHostPlay.youId ? host : guest;
  challenger.send({ type: 'challenge' });
  const [hostReveal, guestReveal] = await Promise.all([host.next('reveal'), guest.next('reveal')]);
  assert.equal(hostReveal.result.cards.length, 1);
  assert.deepEqual(hostReveal.result, guestReveal.result);

  await Promise.all([host.next('game-state'), guest.next('game-state')]);
  const room = gameServer.rooms.get(hostRoom.room.code);
  clearTimeout(room.roundTimer);
  room.engine.phase = 'ended';
  room.engine.winner = room.engine.players[0].id;
  host.send({ type: 'start-game' });
  const [rematch, guestRematch] = await Promise.all([host.next('game-state'), guest.next('game-state')]);
  assert.equal(rematch.state.phase, 'playing');
  assert.equal(rematch.state.round, 1);
  assert.equal(guestRematch.state.round, 1);

  host.socket.close();
  const transferredRoom = await guest.next('room');
  const afterDisconnect = await guest.next('game-state');
  assert.equal(transferredRoom.room.hostId, transferredRoom.youId);
  const disconnectedHost = afterDisconnect.state.players.find((player) => player.id === hostState.youId);
  assert.equal(disconnectedHost.connected, false);
  assert.equal(disconnectedHost.alive, false);
});
