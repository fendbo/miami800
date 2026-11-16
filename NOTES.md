# Miami 800 project notes

Top-down racer for up to 8 players, each on their own phone; the whole track fits on one screen. Inspired by the 1975
eight-player overhead racing cabinet, with its own name and art. Called "Circuit 8" until 2026-11-16 (Lubowcade's
"Indy 800" placeholder was this game).

## How it is built
- `public/index.html`: the whole game (canvas, one file). `server.js`: plain `http` plus `ws`; serves `public/`,
  answers `/health` with `{game:'miami800'}`, and runs rooms over a web socket at `/ws`.
- Works from a folder: every path is relative, including the web socket and `health`, so it runs at
  `lubowcade.com/miami800/` as well as at its own address. The menu has a "< Lubowcade" link to https://lubowcade.com/ .
- Each phone simulates its own car and sends its position 15 times a second; the server relays, runs the room
  (track, laps, colours), the countdown, and the finishing order. A race ends when all finish or 30 s after the winner.
- Rooms: four-letter code, invite link `?room=CODE` (INVITE FRIENDS opens the phone's share sheet, or copies the link).
  Host plus 7. Rooms are held in memory and are lost on every deploy.
- Icon: `python3 tools/make_icon.py` writes `public/icon-*.png`. Lubowcade keeps its own copy in
  `public/icons/miami800.png`; copy it again if the icon changes.

## Decisions
- Multiplayer: up to 8 (host invites up to 7). Online races are humans only; practice has 7 computer cars.
- Colours: nine, picked first come, first served (on the menu as a preference, and in the room). Blue is Jeff's:
  a player whose name is "Jeff" (any capitals) is always blue and cannot change; nobody else can take blue, and
  computer cars never use it. Nine colours exist so that eight non-Jeff players still get one each. The rule goes by
  the typed name only: anyone who types Jeff gets blue (the first one in a room).
- Tracks, in rising difficulty (host picks in the room; practice picks on the menu): Training (wide plain oval),
  Classic (the original track), Twister (narrower road, five hairpins, kinked sides). Each track sets its own road width.
- Start: three lights, red then yellow then green, a beep with each, and a green flag waves on go.
- Finish: a finished car leaves the road and its icon pops onto the leader board in the infield, 1st place first.
  Your own finish shows a waving chequered flag.
- Controls (from the owner's first phone test, 2026-11-13): Wheel (default), Slide, Buttons; separate gas and brake
  pedals; tap D/R shifter. Track edges are barriers with a red and white kerb. No engine drone; only blips, beeps, bumps.
- Lap counting follows the car along the road, so short cuts earn nothing.

## Tested / not tested
- Tested (2026-11-16): `npm test` (rooms, 8-player limit, colour rules, track and laps, a whole race);
  `test/phone.py` in Chrome at phone size (computer cars complete every track; lights, flags, leader board; a
  two-phone room with Jeff in blue).
- Not tested: real phones, the live Render service, the game through the live Lubowcade.

## Not done yet
Reconnecting after a dropped connection; computer cars in online rooms; two players on one screen.
