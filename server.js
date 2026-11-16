// Miami 800 server: serves the game page and runs race rooms for up to 8 phones.
// Each phone drives its own car and reports where it is; the server relays positions,
// runs the lobby (track, laps, car colours) and the start, and decides the finishing order.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const MAX_PLAYERS = 8;          // the host plus 7 invited
const TRACKS = 3;               // 0 Training, 1 Classic, 2 Twister (shapes live in the page)
const COLORS = 9;               // car colours, in the page's order
const BLUE = 1;                 // kept for Jeff: nobody else can take it
const COUNTDOWN_MS = +process.env.M800_COUNTDOWN || 4200;   // time from START to the green light
const MIN_RACE_MS = process.env.M800_MIN_RACE ? +process.env.M800_MIN_RACE : 8000;   // nobody finishes sooner than this
const GRACE_MS = 30000;         // how long the rest get after the winner finishes
const SNAP_MS = 66;             // position relay rate (15 per second)

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, game: 'miami800', rooms: rooms.size }));
  }
  const file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

const rooms = new Map();
let nextId = 1;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
}
const cleanName = (n) => (String(n || '').replace(/[^\w .\-']/g, '').trim().slice(0, 10) || 'Racer');
const isJeff = (n) => String(n).trim().toLowerCase() === 'jeff';
const send = (p, o) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); };
const all = (room, o) => { const s = JSON.stringify(o); for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(s); };

function roomInfo(room) {
  for (const p of room.players.values()) {
    send(p, { t: 'room', code: room.code, you: p.id, host: room.host, state: room.state, laps: room.laps, track: room.track,
      players: [...room.players.values()].map((q) => ({ id: q.id, name: q.name, slot: q.slot, color: q.color, racing: q.racing })) });
  }
}
// Colours are first come, first served. Jeff is always blue, and blue is never handed to anyone else.
function colorFree(room, p, c) {
  if (!Number.isInteger(c) || c < 0 || c >= COLORS) return false;
  if (c === BLUE && !isJeff(p.name)) return false;
  for (const q of room.players.values()) if (q !== p && q.color === c) return false;
  return true;
}
function pickColor(room, p, want) {
  if (isJeff(p.name) && colorFree(room, p, BLUE)) return BLUE;
  if (want !== BLUE && colorFree(room, p, want)) return want;
  for (let c = 0; c < COLORS; c++) if (c !== BLUE && colorFree(room, p, c)) return c;
  return 0;
}
function join(room, p, want) {
  const used = new Set([...room.players.values()].map((q) => q.slot));
  let slot = 0; while (used.has(slot)) slot++;
  p.slot = slot; p.room = room; p.racing = false; p.fin = 0; p.d = null;
  p.color = pickColor(room, p, want);
  room.players.set(p.id, p);
  if (!room.host) room.host = p.id;
  roomInfo(room);
}
function leave(p) {
  const room = p.room; if (!room) return;
  p.room = null; room.players.delete(p.id);
  if (!room.players.size) { stopRace(room); rooms.delete(room.code); return; }
  if (room.host === p.id) room.host = room.players.keys().next().value;
  roomInfo(room);
  if (room.state === 'race') checkEnd(room);
}
function stopRace(room) { clearInterval(room.snap); clearTimeout(room.endTimer); room.snap = room.endTimer = null; }
function start(room) {
  room.state = 'race'; room.startAt = Date.now() + COUNTDOWN_MS;
  for (const p of room.players.values()) { p.racing = true; p.fin = 0; p.d = null; }
  roomInfo(room);
  all(room, { t: 'go', laps: room.laps, track: room.track, in: COUNTDOWN_MS });
  room.snap = setInterval(() => {
    const list = [];
    for (const p of room.players.values()) if (p.racing && p.d) list.push([p.id, ...p.d, p.fin]);
    all(room, { t: 'snap', p: list });
  }, SNAP_MS);
}
function checkEnd(room) {
  const racers = [...room.players.values()].filter((p) => p.racing);
  if (!racers.length || racers.every((p) => p.fin)) endRace(room);
}
function endRace(room) {
  if (room.state !== 'race') return;
  stopRace(room); room.state = 'results';
  const racers = [...room.players.values()].filter((p) => p.racing);
  racers.sort((a, b) => (a.fin && b.fin) ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : ((b.d ? b.d[5] : -1e9) - (a.d ? a.d[5] : -1e9)));
  all(room, { t: 'end', results: racers.map((p) => ({ id: p.id, name: p.name, slot: p.slot, color: p.color, time: p.fin || null })) });
  roomInfo(room);
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });
wss.on('connection', (ws) => {
  const p = { id: nextId++, ws, name: 'Racer', room: null, alive: true };
  ws.on('pong', () => { p.alive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = p.room;
    switch (m.t) {
      case 'create': {
        if (room) return;
        p.name = cleanName(m.name);
        const r = { code: newCode(), players: new Map(), host: null, state: 'lobby',
          laps: [3, 5, 8].includes(m.laps) ? m.laps : 5,
          track: Number.isInteger(m.track) && m.track >= 0 && m.track < TRACKS ? m.track : 1 };
        rooms.set(r.code, r); join(r, p, m.color); break;
      }
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!r) return send(p, { t: 'err', msg: 'No room with that code. Check the four letters.' });
        if (r.players.size >= MAX_PLAYERS) return send(p, { t: 'err', msg: 'That room is full (8 players).' });
        p.name = cleanName(m.name); join(r, p, m.color); break;
      }
      case 'laps':
        if (room && room.host === p.id && room.state === 'lobby' && [3, 5, 8].includes(m.n)) { room.laps = m.n; roomInfo(room); }
        break;
      case 'track':
        if (room && room.host === p.id && room.state === 'lobby' && Number.isInteger(m.n) && m.n >= 0 && m.n < TRACKS) { room.track = m.n; roomInfo(room); }
        break;
      case 'color':   // pick a car colour while waiting in the room; taken colours and Jeff's blue are refused
        if (room && !(room.state === 'race' && p.racing) && !(p.color === BLUE && isJeff(p.name)) && colorFree(room, p, m.n)) p.color = m.n;
        if (room) roomInfo(room);
        break;
      case 'start':
        if (room && room.host === p.id && room.state === 'lobby') start(room);
        break;
      case 's':
        if (room && room.state === 'race' && p.racing && Array.isArray(m.d) && m.d.length === 6 && m.d.every(Number.isFinite)) p.d = m.d;
        break;
      case 'fin':
        if (room && room.state === 'race' && p.racing && !p.fin && Date.now() - room.startAt >= MIN_RACE_MS) {
          const mine = Date.now() - room.startAt;                 // server's own clock
          const theirs = Number(m.time);                          // the phone's clock, used if it is close
          p.fin = Math.max(1, Math.round(Number.isFinite(theirs) && Math.abs(theirs - mine) < 1500 ? theirs : mine));
          if (!room.endTimer) room.endTimer = setTimeout(() => endRace(room), GRACE_MS);
          checkEnd(room);
        }
        break;
      case 'lobby':
        if (room && room.host === p.id && room.state === 'results') {
          room.state = 'lobby'; for (const q of room.players.values()) q.racing = false; roomInfo(room);
        }
        break;
      case 'leave': leave(p); break;
    }
  });
  ws.on('close', () => leave(p));
  ws.on('error', () => {});
  p.beat = setInterval(() => {
    if (!p.alive) { clearInterval(p.beat); return ws.terminate(); }
    p.alive = false; try { ws.ping(); } catch (e) {}
  }, 25000);
  ws.on('close', () => clearInterval(p.beat));
});

server.listen(PORT, () => console.log('Miami 800 on port ' + PORT));
module.exports = { server };
