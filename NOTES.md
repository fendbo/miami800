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
- Tracks, in rising difficulty (host picks in the room; practice picks on the menu): Training (wide plain oval),
  Classic (the original track), Twister (narrower road, five hairpins, kinked sides). Each track sets its own road width.
- Start: three lights, red then yellow then green, a beep with each, and a green flag waves on go.
- Finish: a finished car leaves the road and its icon pops onto the leader board in the infield, 1st place first.
  Your own finish shows a waving chequered flag.
- Controls (from the owner's first phone test, 2026-11-13): Wheel (default), Slide, Buttons; separate gas and brake
  pedals; tap D/R shifter. Track edges are barriers with a red and white kerb. No engine drone; only blips, beeps, bumps.
- Lap counting follows the car along the road, so short cuts earn nothing.

## Added 2026-11-16 (second round, all at the owner's request)
- Scenery backgrounds (Miami, New York, Utah) were added here and removed the next day; see below.
- Extras: Reverse (same track the other way) and Night (dark except headlights, boost pads and the start line).
  Practice sets them on the menu; in a room the host does.
- Slipstream: sit close behind another car for extra speed (HUD says DRAFT).
- Boost pads: two per track on the straightest stretches, one each side of the road, 2.6 s of extra speed. The owner's
  idea list said "pit-lane boost"; pads were built instead of a side lane, because a second lane would need its own
  lap-counting path.
- Oil: two patches (three on Twister) move every 10 seconds; each blinks for a second before it bites. Every phone works
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

## Changed 2026-11-17 after the owner played it on an iPhone
- **Scenery removed.** The owner prefers the original retro look (see the next section for the dotted track).
  The Miami / New York / Utah backgrounds are gone and the tracks are Training, Classic and Twister again.
  (The scenery code is in git history, commit 3fe4715, if it is ever wanted back.) Do not add backgrounds again unasked.
- Cars drawn bigger (`CAR` 1.55, was 1.2), with the bump distance, barrier gap and start grid spacing scaled to match.
- Wheel, second change the same day: it is now a real steering wheel. The owner said the old one (car heading
  follows the wheel's angle, any number of turns) is not how a car works: you had to keep winding it through every
  curve. Now the wheel's angle is the steering angle: it stops at 100 degrees each way (`WHEEL_MAX`), holding it
  turned keeps the car curving, further is tighter, and it springs back to straight when the thumb lifts. The car
  only turns while it is rolling, and steers the other way in reverse. Do not go back to the 1:1 spinner.
- Gas: new setting, "Tap to lock" (default) or "Hold down". Locked: one tap and the gas stays down; a second tap,
  the brake, or the shifter lifts it. The gas pedal is also wider. The owner was unsure whether locking is too
  unrealistic, so Hold stays available.

## Look changed 2026-11-17 (owner sent a photo of the 1975 cabinet's screen as the inspiration)
- The road is no longer a solid strip. The screen is black and each edge of the road is a row of small square dots,
  alternating white and red (the owner kept the white and red). No road surface, no centre dashes. Our own track
  shapes and car drawings stay; only the style is borrowed.
- Car palette follows that screen: red, blue, lime, green, cyan, violet, lavender, white, plus orange as the ninth
  (nine are needed because blue is Jeff's). Blue is still colour number 1.
- Skid marks and oil were lightened so they show on black.

## Tested / not tested
- Tested (2026-11-16): `npm test` (rooms, 8-player limit, colour rules, track and laps, a whole race, computer cars, cup, record, horn);
  `test/phone.py` in Chrome at phone size (computer cars complete every track; lights, flags, leader board; a
  two-phone room with Jeff in blue).
- Not tested: real phones, the live Render service, the game through the live Lubowcade.

## Not done yet
Reconnecting after a dropped connection; two players on one screen; records that survive a restart (needs a database);
how the new extras feel on a real phone (boost strength, oil, slipstream and night darkness are first guesses).
