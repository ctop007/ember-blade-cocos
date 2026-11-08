/** Headless core sim: a simple bot plays a full run. Usage: node tools/run-sim.mjs [seed] */
import { World } from '../assets/scripts/core/world';
import { emptyInput } from '../assets/scripts/core/types';
// eslint-disable-next-line
declare const require: any; declare const process: any; declare const __dirname: string;
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/../../../assets/resources/config/game.json', 'utf8'));

function run(seed: number) {
    const w = new World(cfg, seed);
    w.start();
    const dt = 1 / 60;
    let t = 0, ev: { [k: string]: number } = {};
    let frame = 0;
    while (t < 600) {
        frame++;
        const inp = emptyInput();
        const h = w.hero;
        const tgt = w.nearestEnemy(h.x, h.y, 2000);
        if (w.phase === 'draft') w.pickCard(0);
        if (w.phase === 'advance') inp.mx = 1;
        if (tgt) {
            const dx = tgt.x - h.x, dy = tgt.y - h.y;
            if (Math.abs(dx) > 90) inp.mx = Math.sign(dx);
            if (Math.abs(dy) > 20) inp.my = Math.sign(dy);
            if (Math.abs(dx) < 140 && Math.abs(dy) < 40) inp.attackPressed = frame % 6 === 0;
            inp.attackHeld = inp.attackPressed;
            if (frame % 120 === 0) inp.skill1 = true;
            if (frame % 170 === 0) inp.skill2 = true;
            if (frame % 140 === 0) inp.skill3 = true;
            if (frame % 90 === 45) inp.dodgePressed = true;
            if (h.rage >= 100) inp.ult = true;
            if (frame % 200 === 100) inp.jumpPressed = true;
            if (h.state === 'jump' && h.vz < 0) inp.attackPressed = true;
        }
        w.step(dt, inp);
        for (const e of w.drain()) ev[e.type] = (ev[e.type] || 0) + 1;
        t += dt;
        if (w.phase === 'victory' || w.phase === 'defeat') break;
    }
    return { seed, phase: w.phase, wave: w.wave + 1, t: +t.toFixed(1), hp: Math.round(w.hero.hp), stats: w.stats, cards: w.takenCards, ev };
}

const seeds = process.argv.slice(2).map(Number);
for (const s of (seeds.length ? seeds : [1, 2, 3])) console.log(JSON.stringify(run(s)));
