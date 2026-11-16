// Simulated phones against the real server: rooms, the 8-player limit, colours (first come, first served;
// Jeff always blue), track and lap choice, and a whole race. Run: npm test
'use strict';
process.env.PORT = process.env.PORT || '3977';
process.env.M800_COUNTDOWN = '150';
process.env.M800_MIN_RACE = '200';
const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { server } = require('../server.js');
const BASE = 'ws://127.0.0.1:' + process.env.PORT + '/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function phone() {
  const ws = new WebSocket(BASE); const p = { ws, room: null, msgs: [], closed: false };
  ws.on('message', (raw) => { const m = JSON.parse(raw); p.msgs.push(m); if (m.t === 'room') p.room = m; });
  ws.on('close', () => { p.closed = true; });
  p.send = (o) => ws.send(JSON.stringify(o));
  p.open = new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  p.last = (t) => [...p.msgs].reverse().find((m) => m.t === t);
  p.me = () => p.room.players.find((q) => q.id === p.room.you);
  return p;
}
async function until(f, what) { for (let i = 0; i < 200; i++) { if (f()) return; await wait(10); } throw new Error('timed out: ' + what); }
let passed = 0; const ok = (name) => { passed++; console.log('  ok  ' + name); };

(async () => {
  // health
  const health = await new Promise((r) => http.get('http://127.0.0.1:' + process.env.PORT + '/health', (res) => { let b = ''; res.on('data', (c) => b += c); res.on('end', () => r(JSON.parse(b))); }));
  assert.strictEqual(health.game, 'miami800'); ok('health says miami800');

  // host makes a room with a track, laps and a colour
  const host = phone(); await host.open;
  host.send({ t: 'create', name: 'Ann', color: 3, track: 0, laps: 3 });
  await until(() => host.room, 'room');
  const code = host.room.code;
  assert.strictEqual(host.room.track, 0); assert.strictEqual(host.room.laps, 3); assert.strictEqual(host.me().color, 3);
  ok('room made with the host\'s track, laps and colour');

  // a second player wants the same colour: first come, first served
  const bob = phone(); await bob.open; bob.send({ t: 'join', code, name: 'Bob', color: 3 });
  await until(() => bob.room, 'bob in');
  assert.notStrictEqual(bob.me().color, 3); assert.notStrictEqual(bob.me().color, 1);
  ok('taken colour is not given twice, and blue is not handed out');

  // nobody but Jeff can take blue
  bob.send({ t: 'color', n: 1 }); await wait(60);
  assert.notStrictEqual(bob.me().color, 1);
  bob.send({ t: 'color', n: 3 }); await wait(60);
  assert.notStrictEqual(bob.me().color, 3);
  bob.send({ t: 'color', n: 6 }); await until(() => bob.me().color === 6, 'bob pink');
  ok('picking: blue and taken colours refused, a free colour accepted');

  // Jeff joins late, asks for red, and is blue anyway; he cannot change it
  const jeff = phone(); await jeff.open; jeff.send({ t: 'join', code, name: ' jeff ', color: 0 });
  await until(() => jeff.room, 'jeff in');
  assert.strictEqual(jeff.me().color, 1);
  jeff.send({ t: 'color', n: 0 }); await wait(60);
  assert.strictEqual(jeff.me().color, 1);
  ok('Jeff is always blue');

  // fill the room: 8 in, the 9th is turned away; every colour is different
  const more = [];
  for (let i = 0; i < 5; i++) { const p = phone(); await p.open; p.send({ t: 'join', code, name: 'P' + i }); more.push(p); }
  await until(() => host.room.players.length === 8, '8 players');
  const cols = host.room.players.map((q) => q.color);
  assert.strictEqual(new Set(cols).size, 8); assert.strictEqual(cols.filter((c) => c === 1).length, 1);
  const ninth = phone(); await ninth.open; ninth.send({ t: 'join', code, name: 'Late' });
  await until(() => ninth.last('err'), 'full message');
  assert.ok(/full/.test(ninth.last('err').msg));
  ok('host plus 7 fit, all in different colours; a 9th is told the room is full');

  // only the host changes track and laps
  bob.send({ t: 'track', n: 2 }); await wait(60); assert.strictEqual(host.room.track, 0);
  host.send({ t: 'track', n: 2 }); host.send({ t: 'laps', n: 5 });
  await until(() => bob.room.track === 2 && bob.room.laps === 5, 'track change seen by all');
  host.send({ t: 'track', n: 7 }); await wait(60); assert.strictEqual(host.room.track, 2);
  ok('host picks the track and laps; everyone sees it');

  // race: everyone gets go with the track; positions are relayed; finishing order by time
  const everyone = [host, bob, jeff, ...more];
  host.send({ t: 'start' });
  await until(() => everyone.every((p) => p.last('go')), 'go');
  assert.strictEqual(bob.last('go').track, 2); assert.strictEqual(bob.last('go').laps, 5);
  bob.send({ t: 'color', n: 8 }); await wait(40); assert.strictEqual(bob.me().color, 6);
  ok('everyone gets the start with the track; no colour changes mid-race');
  everyone.forEach((p, i) => p.send({ t: 's', d: [100 + i, 100, 0, 10, 0, 50 + i] }));
  await until(() => host.last('snap') && host.last('snap').p.length === 8, 'snapshot with 8 cars');
  ok('positions relayed for all 8');
  await wait(400);
  jeff.send({ t: 'fin' }); await wait(30); bob.send({ t: 'fin' }); await wait(30);
  await until(() => host.last('snap').p.some((d) => d[7] > 0), 'finish shown in snapshots');
  everyone.filter((p) => p !== jeff && p !== bob).forEach((p) => p.send({ t: 'fin' }));
  await until(() => host.last('end'), 'results');
  const res = host.last('end').results;
  assert.strictEqual(res.length, 8); assert.strictEqual(res[0].name, 'jeff'); assert.strictEqual(res[0].color, 1); assert.strictEqual(res[1].name, 'Bob'); assert.strictEqual(res[1].color, 6);
  ok('results in finishing order, with each car\'s colour');

  // back to the room; a leaver frees their colour; host hand-over
  host.send({ t: 'lobby' }); await until(() => bob.room.state === 'lobby', 'lobby again');
  bob.send({ t: 'leave' }); await until(() => host.room.players.length === 7, 'bob gone');
  more[0].send({ t: 'color', n: 6 }); await until(() => more[0].me().color === 6, 'freed colour reused');
  host.ws.close(); await until(() => jeff.room.host !== host.room.you, 'new host');
  ok('leaving frees the colour and hands the room on');

  console.log(passed + ' checks passed');
  everyone.concat(ninth).forEach((p) => { try { p.ws.terminate(); } catch (e) {} });
  server.close(); process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
