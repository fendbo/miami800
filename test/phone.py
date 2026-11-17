# Phone checks in a real browser. Start the server first (PORT=3978 node server.js), then:
#   python3 test/phone.py http://127.0.0.1:3978 test/shots
# 1. Practice on each of the three tracks with the computer driving your car: every car must finish,
#    leave the road and line up on the leader board. Pictures of the lights, the green flag and the chequered flag.
# 2. Two phones in a room: Jeff is blue, the guest picks a colour, the host picks the track, both race.
import sys, os, time
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/'); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
LAND = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
PORT = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
fails = []
def check(ok, what):
    print(('  ok  ' if ok else '  FAIL ') + what)
    if not ok: fails.append(what)

with sync_playwright() as pw:
    br = pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    # ---- 1. practice on each track
    ctx = br.new_context(**LAND); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '/'); pg.wait_for_function('window.__m8 && document.getElementById("onlineBox").hidden === false')
    pg.screenshot(path=out + '/menu-landscape.png')
    for k, name in enumerate(['miami', 'newyork', 'utah']):
        pg.evaluate('k => { __m8.setTrack(k, k === 1); __m8.night = k === 2; __m8.laps = 1; __m8.autopilot = true; __m8.startPractice(); }', k)   # New York reversed, Utah at night
        pg.wait_for_timeout(1300); pg.screenshot(path=out + '/%s-1-red.png' % name)
        pg.wait_for_timeout(1500); pg.screenshot(path=out + '/%s-2-yellow.png' % name)
        pg.wait_for_function('__m8.phase === "go"'); pg.wait_for_timeout(500); pg.screenshot(path=out + '/%s-3-green-flag.png' % name)
        pg.wait_for_timeout(6000); pg.screenshot(path=out + '/%s-4-racing.png' % name)
        pg.wait_for_function('__m8.me.fin > 0', timeout=90000); pg.wait_for_timeout(700); pg.screenshot(path=out + '/%s-5-chequered.png' % name)
        pg.wait_for_function('__m8.cars.every(c => c.fin > 0)', timeout=90000)
        n = pg.evaluate('__m8.board.length'); times = pg.evaluate('__m8.cars.map(c => Math.round(c.fin / 100) / 10)')
        check(n == 8, '%s: all 8 cars finished and are on the leader board (lap times %s s)' % (name, times))
        check(pg.evaluate('__m8.pads.length') == 2 and pg.evaluate('__m8.oil.length') >= 2 and pg.evaluate('__m8.best') > 4000, '%s: two boost pads, oil on the road, a lap time recorded' % name)
        pg.evaluate('document.getElementById("results").hidden = true'); pg.wait_for_timeout(500); pg.screenshot(path=out + '/%s-6-board-full.png' % name)
        pg.evaluate('document.getElementById("bResMenu").click()')
    check(not errs, 'no page errors in practice ' + str(errs[:2]))
    ctx.close()
    # portrait look
    ctx = br.new_context(**PORT); pg = ctx.new_page(); pg.goto(base + '/'); pg.wait_for_function('window.__m8')
    pg.wait_for_timeout(400); pg.screenshot(path=out + '/menu-portrait.png')
    pg.evaluate('() => { __m8.setTrack(2, false); __m8.night = false; __m8.laps = 1; __m8.autopilot = true; __m8.startPractice(); }')
    pg.wait_for_function('__m8.phase === "go"'); pg.wait_for_timeout(400); pg.screenshot(path=out + '/portrait-green-flag.png')
    pg.wait_for_function('__m8.board.length >= 3', timeout=90000); pg.wait_for_timeout(600); pg.screenshot(path=out + '/portrait-board.png')
    ctx.close()

    # ---- 2. two phones in a room
    a = br.new_context(**LAND).new_page(); b = br.new_context(**LAND).new_page()
    for p in (a, b):
        p.goto(base + '/'); p.wait_for_function('window.__m8 && document.getElementById("onlineBox").hidden === false')
    a.fill('#name', 'Jeff'); a.wait_for_timeout(100)
    check(a.evaluate('document.querySelector("#menuSw [aria-pressed=true]").dataset.c') == '1', 'menu: typing Jeff selects blue')
    a.click('#bCreate'); a.wait_for_function('!document.getElementById("lobby").hidden')
    code = a.inner_text('#lobCode')
    b.goto(base + '/?room=' + code); b.wait_for_function('document.getElementById("code").value.length === 4')
    b.fill('#name', 'Maya'); b.click('#menuSw [data-c="5"]'); b.click('#bJoin')
    b.wait_for_function('!document.getElementById("lobby").hidden')
    a.wait_for_function('__m8.net.players.length === 2')
    cols = a.evaluate('__m8.net.players.map(p => p.name + ":" + p.color)')
    check(cols == ['Jeff:1', 'Maya:5'], 'room: Jeff blue, Maya got the purple she picked ' + str(cols))
    check(b.evaluate('document.querySelector("#lobSw [data-c=\\"1\\"]").disabled'), 'room: blue is greyed out for the guest')
    b.click('#lobSw [data-c="2"]'); a.wait_for_function('__m8.net.players[1].color === 2')
    check(True, 'room: guest changed to yellow and the host saw it')
    a.click('#segLobTrack [data-v="0"]'); b.wait_for_function('__m8.track === 0')
    check(True, 'room: host picked Training and the guest\'s screen switched track')
    a.click('#segLobLaps [data-v="3"]'); a.click('#segLobCup [data-v="3"]'); b.wait_for_function('__m8.net.cup === 3'); a.wait_for_timeout(300)
    a.screenshot(path=out + '/room-host.png'); b.screenshot(path=out + '/room-guest.png')
    for p in (a, b): p.evaluate('__m8.autopilot = true')
    a.click('#bStart')
    for p in (a, b): p.wait_for_function('__m8.phase === "go"', timeout=15000)
    a.wait_for_timeout(2500)
    check(a.evaluate('__m8.cars.length') == 8 and b.evaluate('__m8.cars.length') == 8, 'race: 2 players and 6 computer cars on both phones')
    check(b.evaluate('__m8.cars.find(c => c.id === __m8.net.host).color') == '#38bdf8', 'race: the guest sees Jeff\'s car in blue')
    moved = b.evaluate('__m8.cars.filter(c => c.id < 0 && c.s > 0).length')
    check(moved >= 5, 'race: the guest sees the host-driven computer cars moving (%d of 6 past the line)' % moved)
    a.evaluate('__m8.horn()'); b.wait_for_function('performance.now() - __m8.cars.find(c => c.id === __m8.net.host).hornT < 1000', timeout=3000)
    check(True, 'race: Jeff\'s horn reaches the guest')
    a.screenshot(path=out + '/room-race.png')
    for p in (a, b): p.wait_for_function('!document.getElementById("results").hidden', timeout=120000)
    check('PTS' not in a.inner_text('#resList') and '+' in b.inner_text('#resList') and 'Cup race 1 of 3' in b.inner_text('#resCup'), 'cup: points shown after race 1 of 3: ' + b.inner_text('#resCup'))
    b.screenshot(path=out + '/room-results.png')
    br.close()
print('FAILED: %d' % len(fails) if fails else 'all phone checks passed'); sys.exit(1 if fails else 0)
