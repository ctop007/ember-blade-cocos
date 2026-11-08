/** Projectiles (spear, fireball) and ground zones (skyfall, flame). Pure TS. */
import type { World } from './world';
import { Proj, Zone, inEllipse } from './types';

export function newProj(w: World, kind: Proj['kind']): Proj {
    return { id: w.nextId++, kind, x: 0, y: 0, z: 0, vx: 0, vy: 0, travelled: 0, range: 0, hitSet: {}, emberAcc: 0,
        fx: 0, fy: 0, tx: 0, ty: 0, t: 0, flight: 1, arc: 0, dead: false };
}

export function newZone(w: World, kind: Zone['kind'], x: number, y: number, r: number, life: number, damage: number): Zone {
    return { id: w.nextId++, kind, x, y, r, t: 0, life, tickT: 0, damage, done: false };
}

export function updateProjs(w: World, dt: number) {
    const S = w.cfg.skills.meteorSpear, h = w.hero;
    for (const p of w.projs) {
        if (p.dead) continue;
        if (p.kind === 'spear') {
            const sx = p.vx * dt, sy = p.vy * dt;
            p.x += sx; p.y += sy; p.travelled += Math.abs(sx);
            p.emberAcc += Math.abs(sx);
            if (p.emberAcc >= S.emberInterval) { p.emberAcc = 0; w.emit('ember', { x: p.x, y: p.y, life: S.emberLife }); }
            for (const e of w.enemies) {
                if (e.state === 'dead' || e.state === 'intro' || p.hitSet[e.id]) continue;
                const r = w.cfg.enemies[e.type].radius;
                if (Math.abs(e.x - p.x) < r + 30 && Math.abs(e.y - p.y) < S.width * 0.5 + r * 0.5 && e.z < 150) {
                    p.hitSet[e.id] = true;
                    w.hitEnemy(e, S.damage, { src: 'spear', kb: S.knockback, kdir: p.vx > 0 ? 1 : -1 });
                }
            }
            if (p.travelled >= p.range || p.x < w.arenaL - 100 || p.x > w.arenaR + 100) {
                p.dead = true; w.emit('spearEnd', { id: p.id, x: p.x, y: p.y });
            }
        } else {
            p.t += dt;
            const u = Math.min(1, p.t / p.flight);
            p.x = p.fx + (p.tx - p.fx) * u; p.y = p.fy + (p.ty - p.fy) * u;
            p.z = (1 - u) * 90 + Math.sin(u * Math.PI) * p.arc;
            if (u >= 1) {
                p.dead = true;
                const L = w.cfg.enemies.lantern;
                w.emit('fireballLand', { x: p.x, y: p.y, r: L.projectile.radius });
                if (inEllipse(h.x - p.x, h.y - p.y, L.projectile.radius + 20) && h.z < 60) w.damageHero(L.damage, p.x, 'fireball');
            }
        }
    }
    w.projs = w.projs.filter(p => !p.dead);
}

export function updateZones(w: World, dt: number) {
    const S = w.cfg.skills.skyfall, F = w.cfg.dodgeFlame;
    for (const z of w.zones) {
        z.t += dt;
        if (z.kind === 'skyfall') {
            if (!z.done && z.t >= z.life) {
                z.done = true;
                const hits = w.inCircle(z.x, z.y, z.r);
                for (const e of hits) w.hitEnemy(e, z.damage, { src: 'skyfall', kb: S.knockback, launch: S.launch, kdir: e.x >= z.x ? 1 : -1 });
                w.emit('skyfallStrike', { x: z.x, y: z.y, r: z.r, n: hits.length });
            }
        } else {
            z.tickT -= dt;
            if (z.tickT <= 0) {
                z.tickT = F.tick;
                for (const e of w.inCircle(z.x, z.y, z.r)) w.hitEnemy(e, z.damage, { src: 'flame', hs: false, noCrit: true, kb: 0, stun: false });
            }
            if (z.t >= z.life) z.done = true;
        }
    }
    w.zones = w.zones.filter(z => !(z.done && (z.kind === 'flame' || z.t > z.life + 0.1)));
}
