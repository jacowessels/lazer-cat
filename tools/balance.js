// Balance check: plays every level many times with simple bots and prints win rates.
//   naive   = moves straight to the finish at a fixed speed (should lose)
//   skilled = "expert feel": keeps cats below their pounce threshold, steers around them,
//             dodges wiggling cats and cuts sideways once they jump.
// Usage: node tools/balance.js   (needs Playwright; N=40 node tools/balance.js for more runs)
const path = require('path');
const { chromium } = require('playwright');
const N = +process.env.N || 24;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  const res = await p.evaluate((N) => {
    const { game, LEVELS, update, loadLevel, startPlay } = lazerCat;
    const Wc = 720 / (1280 / 18);
    function run(li, mode, spd, seed) {
      let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
      loadLevel(li); startPlay();

      const bestDir = (cands, src) => {
        let best = cands[0], bs = -1e9;
        for (const [px, py] of cands) {
          const nx = d.x + px * 2, ny = d.y + py * 2;
          let sc = 0;
          if (nx < 0.6 || nx > 17.4 || ny < 0.6 || ny > Wc - 0.6) sc -= 50;
          for (const o of game.cats) if (o !== src && o.state !== 'sleep') sc -= 8 / Math.max(0.5, Math.hypot(nx - o.x, ny - o.y) - o.T.leapRange * 0.5);
          sc += 0.3 * (px * (game.goal.x - d.x) + py * (game.goal.y - d.y)) / (Math.hypot(game.goal.x - d.x, game.goal.y - d.y) || 1);
          if (sc > bs) { bs = sc; best = [px, py]; }
        }
        return { x: best[0], y: best[1] };
      };
      const d = game.dot, dt = 1 / 60; let dodge = null, dodgeT = 0, react = 0.15 + rnd() * 0.15;
      while (game.state === 'play' && game.time < 60) {
        let vx = game.goal.x - d.x, vy = game.goal.y - d.y; let gd = Math.hypot(vx, vy); vx /= gd; vy /= gd;
        let speed = spd;
        if (mode === 'skilled') {
          let maxE = 0;
          for (const c of game.cats) {
            const cx = d.x - c.x, cy = d.y - c.y, cd = Math.hypot(cx, cy) || 1;
            const R = (c.state === 'sleep' ? 2.5 * c.T.size + 1.5 : c.T.leapRange + 1.5);
            if (cd < R) {
              const w = (R - cd) / R * 2.2;
              // sidestep: perpendicular to cat direction, on the side away from the cat
              let px = -cy / cd, py = cx / cd; if (px * vx + py * vy < 0) { px = -px; py = -py; }
              vx += (cx / cd * 0.6 + px) * w; vy += (cy / cd * 0.6 + py) * w;
            }
            if (c.state !== 'sleep') maxE = Math.max(maxE, c.E * (cd < c.T.leapRange + 2 ? 1 : 0.5));
            if ((c.state === 'windup' || c.state === 'leap') && !dodge) {
              if ((c.wupSeen = (c.wupSeen || 0) + dt) > react) {
                const px = -cy / cd, py = cx / cd, ax = cx / cd, ay = cy / cd;
                dodge = bestDir([[px + ax * 0.5, py + ay * 0.5], [-px + ax * 0.5, -py + ay * 0.5], [ax, ay]].map(([x, y]) => { const n = Math.hypot(x, y); return [x / n, y / n]; }), c); dodgeT = 0.6 + rnd() * 0.3;
              }
            } else if (c.state !== 'windup' && c.state !== 'leap') c.wupSeen = 0;
          }
          // expert feel: fastest speed that keeps every awake cat below the threshold
          const tgt = (c, v) => { const dd = Math.hypot(d.x - c.x, d.y - c.y); return c.T.sens * game.level.boost * (v + v * v / 12) / (1 + (dd / c.T.perception) ** 4) + 0.6 * Math.max(0, 1 - dd / (1.6 * c.T.size)); };
          speed = 0.4;
          for (let v = spd; v >= 0.4; v -= 0.2) { if (game.cats.every(c => c.state === 'sleep' || c.state === 'recover' || tgt(c, v) < 0.7)) { speed = v; break; } }
          let minGap = 99; for (const c of game.cats) if (c.state !== 'sleep') minGap = Math.min(minGap, Math.hypot(d.x - c.x, d.y - c.y) - c.T.leapRange);
          if (minGap > 1.2 && maxE > 0.5) speed = 0;
          // a cat just missed: sprint past it
          if (game.cats.some(c => c.state === 'recover' && Math.hypot(d.x - c.x, d.y - c.y) < 5)) speed = Math.max(speed, spd);
          // juke: once a cat is airborne, cut sideways to its flight line
          for (const c of game.cats) if (c.state === 'leap' && !c.juked) {
            c.juked = true;
            const lx = c.leap.tx - c.leap.x0, ly = c.leap.ty - c.leap.y0, ld = Math.hypot(lx, ly) || 1;
            const px = -ly / ld, py = lx / ld;
            dodge = bestDir([[px, py], [-px, -py]], c); dodgeT = c.T.leapTime + 0.2;
          }
          for (const c of game.cats) if (c.state !== 'leap') c.juked = false;
          if (dodge) { vx = dodge.x; vy = dodge.y; speed = 22; dodgeT -= dt; if (dodgeT <= 0) dodge = null; }
        }
        const vd = Math.hypot(vx, vy) || 1;
        d.tx = Math.min(17.7, Math.max(0.3, d.x + vx / vd * speed * dt));
        d.ty = Math.min(Wc - 0.3, Math.max(0.3, d.y + vy / vd * speed * dt));
        update(dt);
      }
      return game.state === 'play' ? 'timeout' : game.state;
    }
    const out = [];
    for (let li = 0; li < LEVELS.length; li++) {
      const row = { lvl: li + 1, name: LEVELS[li].name };
      for (const [mode, spd] of [["naive", 3], ["naive", 9.5], ["naive", 22], ["skilled", 3], ["skilled", 5]]) {
        let w = 0, to = 0;
        for (let k = 0; k < N; k++) { const o = run(li, mode, spd * (0.85 + 0.3 * (k / N)), 1000 + k * 77); if (o === 'won') w++; if (o === 'timeout') to++; }
        row[mode + spd] = Math.round(100 * w / N) + '%' + (to ? ` (${to}to)` : '');
      }
      out.push(row);
    }
    return out;
  }, N);
  console.table(res);
  await b.close();
})();
