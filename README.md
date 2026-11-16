# Miami 800

Top-down racing for up to 8 players, each on their own phone. Three tracks, the whole race on one screen.
Part of [Lubowcade](https://lubowcade.com/).

Run locally: `npm install && npm start`, then open http://localhost:3000

Tests: `npm test` (simulated phones against the server), and with the server running on a port,
`python3 test/phone.py http://127.0.0.1:PORT test/shots` (real browser; needs Playwright and Chrome).
