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
- Multiplayer: up to 8 (host invites up to 7). Practice has 7 computer cars; rooms can fill empty places with them.
- Colours: nine, picked first come, first served (on the menu as a preference, and in the room). Blue is Jeff's:
  a player whose name is "Jeff" (any capitals) is always blue and cannot change; nobody else can take blue, and
  computer cars never use it. Nine colours exist so that eight non-Jeff players still get one each. The rule goes by
  the typed name only: anyone who types Jeff gets blue (the first one in a room).
- Tracks, in rising difficulty (host picks in the room; practice picks on the menu): Miami (wide plain oval),
  New York (the original track), Utah (narrower road, five hairpins, kinked sides). Each track sets its own road width.
- Start: three lights, red then yellow then green, a beep with each, and a green flag waves on go.
- Finish: a finished car leaves the road and its icon pops onto the leader board in the infield, 1st place first.
  Your own finish shows a waving chequered flag.
- Controls (from the owner's first phone test, 2026-11-13): Wheel (default), Slide, Buttons; separate gas and brake
  pedals; tap D/R shifter. Track edges are barriers with a red and white kerb. No engine drone; only blips, beeps, bumps.
- Lap counting follows the car along the road, so short cuts earn nothing.

## Added 2026-11-16 (second round, all at the owner's request)
- Tracks are places now, each with its own scenery drawn in code: Miami (the easy oval: ocean, beach, palms, pool,
  pastel hotels), New York (medium, the original track: city blocks, cabs, a park), Utah (hard: red desert, mesas,
  snow peaks, pines). To add a place, add an entry to `TRACKS` and a branch in `drawScenery`.
- Extras: Reverse (same track the other way) and Night (dark except headlights, boost pads and the start line).
  Practice sets them on the menu; in a room the host does.
- Slipstream: sit close behind another car for extra speed (HUD says DRAFT).
- Boost pads: two per track on the straightest stretches, one each side of the road, 2.6 s of extra speed. The owner's
  idea list said "pit-lane boost"; pads were built instead of a side lane, because a second lane would need its own
  lap-counting path.
- Oil: two patches (three in Utah) move every 10 seconds; each blinks for a second before it bites. Every phone works
  out the same spots from the seed the server sends with the start.
- Lap times: best lap on the HUD; best per track kept on the phone; the server keeps a record lap per track and
  direction **in memory only** (gone on every deploy or restart), shown in the room.
- Ghost: in practice your best lap on that track (kept on the phone) replays as a faint car.
- Cup: host picks 3 or 5 races; points 10-8-6-5-4-3-2-1 by place; standings after each race, a winner after the last,
  then points start again. Computer cars hold their finishing places but score nothing.
- Computer cars in rooms (CPU cars, on by default): they fill the grid up to 8. **The host's phone drives them** and
  the server relays them; if the host leaves mid-race they vanish. A race still ends when all players finish.
- Horn button (also key H): everyone in the room hears it.
- Skid marks stay for the whole race; dust on barrier hits.

## Tested / not tested
- Tested (2026-11-16): `npm test` (rooms, 8-player limit, colour rules, track and laps, a whole race, computer cars, cup, record, horn);
  `test/phone.py` in Chrome at phone size (computer cars complete every track; lights, flags, leader board; a
  two-phone room with Jeff in blue).
- Not tested: real phones, the live Render service, the game through the live Lubowcade.

## Not done yet
Reconnecting after a dropped connection; two players on one screen; records that survive a restart (needs a database);
how the new extras feel on a real phone (boost strength, oil, slipstream and night darkness are first guesses).
