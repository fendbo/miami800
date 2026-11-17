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

  // ---- a second room: computer cars, a cup, the lap record, the horn
  const h2 = phone(); await h2.open; h2.send({ t: 'create', name: 'Cy', track: 1, laps: 3, rev: true, night: true });
  await until(() => h2.room, 'room 2');
  assert.strictEqual(h2.room.rev, true); assert.strictEqual(h2.room.night, true); assert.strictEqual(h2.room.cpu, true);
  const g2 = phone(); await g2.open; g2.send({ t: 'join', code: h2.room.code, name: 'Di' }); await until(() => g2.room, 'guest 2');
  g2.send({ t: 'opt', k: 'night', v: false }); g2.send({ t: 'cup', n: 3 }); await wait(60);
  assert.strictEqual(h2.room.night, true); assert.strictEqual(h2.room.cup, 0);
  h2.send({ t: 'opt', k: 'night', v: false }); h2.send({ t: 'cup', n: 3 });
  await until(() => g2.room.night === false && g2.room.cup === 3, 'options seen');
  ok('reverse, night and cup are the host\'s to set, and everyone sees them');

  h2.send({ t: 'start' }); await until(() => g2.last('go'), 'go 2');
  const go = g2.last('go');
  assert.strictEqual(go.bots.length, 6); assert.strictEqual(go.rev, true); assert.ok(go.seed > 0);
  const used = new Set(h2.room.players.map((q) => q.color));
  assert.ok(go.bots.every((b) => b.color !== 1 && !used.has(b.color)) && new Set(go.bots.map((b) => b.color)).size === 6);
  ok('6 computer cars fill the grid, in free colours, never blue');
  g2.send({ t: 'b', d: go.bots.map((b) => [b.id, 1, 1, 0, 0, 0, 999, 1]) }); await wait(100);   // only the host drives them
  h2.send({ t: 's', d: [5, 5, 0, 0, 0, 100] }); g2.send({ t: 's', d: [5, 5, 0, 0, 0, 90] });
  h2.send({ t: 'b', d: go.bots.map((b, i) => [b.id, 10 + i, 20, 0, 5, 0, 300 - i * 50, 0]) });
  await until(() => g2.last('snap') && g2.last('snap').p.length === 8, 'bots in snapshots');
  assert.ok(g2.last('snap').p.filter((d) => d[0] < 0).every((d) => d[1] >= 10 && d[7] === 0));
  ok('the host\'s phone drives the computer cars and everyone gets their positions');
  h2.send({ t: 'horn' }); await until(() => g2.last('horn'), 'horn'); assert.strictEqual(g2.last('horn').id, h2.room.you);
  ok('the horn is heard by the room');
  await wait(3400);   // a lap cannot be longer than the race has run
  g2.send({ t: 'lap', ms: 100 }); g2.send({ t: 'lap', ms: 4200 }); h2.send({ t: 'lap', ms: 99999 });
  h2.send({ t: 'b', d: [[go.bots[0].id, 10, 20, 0, 5, 0, 9999, 1]] }); await wait(50);          // one computer car finishes first
  g2.send({ t: 'fin' }); await wait(30); h2.send({ t: 'fin' });
  await until(() => h2.last('end'), 'results 2');
  const e2 = h2.last('end');
  assert.deepStrictEqual(e2.results.slice(0, 3).map((r) => r.name), ['Dash', 'Di', 'Cy']);
  assert.strictEqual(e2.results.length, 8); assert.strictEqual(e2.results[0].bot, true);
  assert.deepStrictEqual(e2.standings.map((q) => q.name + q.pts), ['Di8', 'Cy6']); assert.strictEqual(e2.final, false); assert.strictEqual(e2.cupDone, 1);
  ok('results rank computer cars with the players; cup points go to the players by place');
  await until(() => h2.room.state === 'results' && h2.room.rec, 'record');
  assert.strictEqual(h2.room.rec.ms, 4200); assert.strictEqual(h2.room.rec.name, 'Di');
  ok('the best believable lap is kept as the track record');
  for (let i = 0; i < 2; i++) {
    h2.send({ t: 'lobby' }); await until(() => h2.room.state === 'lobby', 'lobby'); h2.msgs.length = 0;
    h2.send({ t: 'start' }); await until(() => h2.last('go'), 'go again'); await wait(500);
    h2.send({ t: 'fin' }); await wait(20); g2.send({ t: 'fin' }); await until(() => h2.last('end'), 'end again');
  }
  const e3 = h2.last('end');
  assert.strictEqual(e3.final, true); assert.deepStrictEqual(e3.standings.map((q) => q.name + q.pts), ['Cy26', 'Di24']);
  h2.send({ t: 'lobby' }); await until(() => h2.room.state === 'lobby', 'lobby after cup');
  assert.ok(h2.room.players.every((q) => q.pts === 0) && h2.room.cupDone === 0);
  ok('after the third race the cup is decided, then the points start again');
  [h2, g2].forEach((p) => p.ws.terminate());

  console.log(passed + ' checks passed');
  everyone.concat(ninth).forEach((p) => { try { p.ws.terminate(); } catch (e) {} });
  server.close(); process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
