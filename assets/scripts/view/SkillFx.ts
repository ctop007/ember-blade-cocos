/** Maps core events → distinct VFX + SFX. Every skill has its own look (see DESIGN §5). */
import { Node, Color, UITransform } from 'cc';
import { sprite, opacity, hex, label, node } from './UiKit';
import { ny } from './Fx';
import { Sfx } from './Sfx';
import type { BattleView } from './BattleView';
import type { World } from '../core/world';
import { GameEvent, YR } from '../core/types';

const ORANGE = '#ff6a2a', GOLD = '#ffd36a', SKY = '#8fd8ff', EMBER = '#ffb13a', RED = '#ff3b2f';

export class SkillFx {
    private delayed: { t: number; f: () => void }[] = [];
    private projV: { [id: number]: { head: Node; trail: Node; shaft?: Node; kind: string } } = {};
    private zoneV: { [id: number]: Node[] } = {};
    onUltCutin: ((on: boolean, name: string) => void) | null = null;

    constructor(private v: BattleView) {}

    /** Make a world-space sprite fx that lives `dur` seconds. */
    private obj(key: string, x: number, y: number, z: number, w: number, h: number, color: string, dur: number,
        upd: (n: Node, u: number, dt: number) => void, o: { ground?: boolean; additive?: boolean; parent?: Node; anchor?: boolean } = {}): Node {
        const parent = o.parent || (o.ground ? this.v.groundFx : this.v.fxTop);
        const s = sprite(key, parent, w, h, { additive: o.additive !== false, color: hex(color), anchorKey: o.anchor !== false });
        s.node.setPosition(x, ny(y, z), 0);
        const op = opacity(s.node, 255);
        (s.node as any)._op = op;
        this.v.fx.add({ t: 0, dur, nodes: [s.node], upd: (dt, u) => upd(s.node, u, dt) });
        return s.node;
    }

    private later(t: number, f: () => void) { this.delayed.push({ t, f }); }

    update(dt: number, w: World) {
        for (let i = this.delayed.length - 1; i >= 0; i--) {
            const d = this.delayed[i]; d.t -= dt;
            if (d.t <= 0) { this.delayed.splice(i, 1); d.f(); }
        }
        this.syncProjs(w, dt);
        this.syncZones(w, dt);
        this.heroAura(w, dt);
    }

    reset() {
        this.delayed = [];
        for (const id in this.projV) { const p = this.projV[id]; p.head.destroy(); p.trail.destroy(); if (p.shaft) p.shaft.destroy(); }
        this.projV = {};
        for (const id in this.zoneV) for (const n of this.zoneV[id]) n.destroy();
        this.zoneV = {};
    }

    // ---------------- continuous visuals ----------------
    private auraAcc = 0;
    private heroAura(w: World, dt: number) {
        const h = w.hero, fx = this.v.fx;
        this.auraAcc += dt;
        if (h.state === 'charge' && this.auraAcc > 0.03) {
            this.auraAcc = 0;
            // embers converge to spear tip
            const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 40;
            const tx = h.x + h.face * 50, tz = 60;
            fx.spawn({ key: 'fx/ember', x: tx + Math.cos(a) * r, y: h.y, z: tz + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vz: -Math.sin(a) * r * 3, life: 0.3, s0: 0.35, s1: 0.1, color: EMBER });
            if (h.st > 0.15) fx.spawn({ key: 'fx/glow', x: tx, y: h.y, z: tz, life: 0.12, s0: 0.5 + Math.random() * 0.2, s1: 0.7, a0: 0.7, color: GOLD });
        }
        if (h.state === 'thrust' && this.auraAcc > 0.016) {
            this.auraAcc = 0;
            fx.spawn({ key: 'fx/spark', x: h.x - h.face * 20, y: h.y + (Math.random() - 0.5) * 20, z: 50 + (Math.random() - 0.5) * 30, vx: -h.face * 300, life: 0.2, s0: 1.2, s1: 0.4, color: GOLD });
        }
    }

    private syncProjs(w: World, dt: number) {
        const seen: { [id: number]: boolean } = {};
        for (const p of w.projs) {
            seen[p.id] = true;
            let pv = this.projV[p.id];
            if (!pv) {
                if (p.kind === 'spear') {
                    const trail = sprite('fx/comet_trail', this.v.fxTop, 300, 70, { additive: true, color: hex(ORANGE) }).node;
                    const shaft = sprite('fx/thrust_beam', this.v.fxTop, 150, 26, { additive: true, color: hex('#fff0c0') }).node;
                    const head = sprite('fx/comet_head', this.v.fxTop, 150, 76, { additive: true, color: hex(GOLD) }).node;
                    pv = { head, trail, shaft, kind: 'spear' };
                } else {
                    const trail = sprite('fx/smoke', this.v.fxTop, 60, 60, { additive: false, color: hex('#3a2a2a', 160) }).node;
                    const head = sprite('fx/fireball', this.v.fxTop, 64, 64, { additive: true, color: hex('#ff7a2a') }).node;
                    pv = { head, trail, kind: 'fireball' };
                }
                this.projV[p.id] = pv;
            }
            const X = p.x, Y = ny(p.y, p.z);
            if (pv.kind === 'spear') {
                const dir = p.vx >= 0 ? 1 : -1;
                const ang = Math.atan2(-p.vy * YR, p.vx) * 180 / Math.PI;
                const grow = Math.min(1, p.travelled / 200);
                pv.head.setPosition(X, Y); pv.head.angle = ang; pv.head.setScale(1 + Math.sin(w.t * 40) * 0.08, 1);
                pv.shaft!.setPosition(X - dir * 10, Y); pv.shaft!.angle = ang; pv.shaft!.setScale(1, 1);
                pv.trail.setPosition(X - dir * 150 * grow, Y); pv.trail.angle = ang; pv.trail.setScale(grow * 1.2, 1);
                if (Math.random() < 0.8) this.v.fx.spawn({ key: 'fx/ember', x: p.x - dir * 30, y: p.y, z: p.z + (Math.random() - 0.5) * 24, vx: -dir * 120 + (Math.random() - 0.5) * 60, vz: 40 + Math.random() * 60, life: 0.45, s0: 0.3, s1: 0.05, color: EMBER });
            } else {
                pv.head.setPosition(X, Y); pv.head.angle += dt * 400;
                pv.head.setScale(1 + Math.sin(w.t * 30) * 0.1, 1 + Math.sin(w.t * 30) * 0.1);
                if (Math.random() < 0.5) this.v.fx.spawn({ key: 'fx/ember', x: p.x, y: p.y, z: p.z, vz: 30, life: 0.35, s0: 0.35, s1: 0, color: '#ff8a3a' });
                pv.trail.active = false;
            }
        }
        for (const id in this.projV) if (!seen[id as any]) {
            const pv = this.projV[id];
            pv.head.destroy(); pv.trail.destroy(); if (pv.shaft) pv.shaft.destroy();
            delete this.projV[id];
        }
    }

    private syncZones(w: World, dt: number) {
        const seen: { [id: number]: boolean } = {};
        for (const z of w.zones) {
            if (z.kind !== 'flame') continue;
            seen[z.id] = true;
            let ns = this.zoneV[z.id];
            if (!ns) {
                const g = sprite('fx/glow', this.v.groundFx, z.r * 2.6, z.r * 1.3, { additive: true, color: hex(ORANGE) }).node;
                g.setPosition(z.x, ny(z.y));
                ns = this.zoneV[z.id] = [g];
            }
            const life = 1 - z.t / z.life;
            opacity(ns[0], 200 * Math.min(1, life * 2));
            if (Math.random() < dt * 14) this.v.fx.spawn({ key: 'fx/ember', x: z.x + (Math.random() - 0.5) * z.r, y: z.y, z: 0, vz: 80 + Math.random() * 80, life: 0.5, s0: 0.45, s1: 0, color: Math.random() < 0.5 ? ORANGE : EMBER });
        }
        for (const id in this.zoneV) if (!seen[id as any]) { for (const n of this.zoneV[id]) n.destroy(); delete this.zoneV[id]; }
    }

    // ---------------- events ----------------
    handle(e: GameEvent, w: World) {
        const v = this.v, fx = v.fx, h = w.hero;
        switch (e.type) {
            case 'hit': this.onHit(e, w); break;
            case 'swing': this.swing(e); break;
            case 'chargeReady':
                Sfx.play('charge_thrust', 0.5);
                fx.spawn({ key: 'fx/flash_star', x: e.x + e.face * 50, y: e.y, z: 60, life: 0.25, s0: 0.3, s1: 1.0, color: GOLD, rot: 45 });
                break;
            case 'thrust': this.thrust(e); break;
            case 'thrustEnd':
                fx.burst('fx/spark', e.x + e.face * 60, e.y, 50, 8, { speed: 300, color: GOLD, life: 0.25, size: 50, align: true });
                break;
            case 'dodge': this.dodge(e, w); break;
            case 'jump':
                Sfx.play('jump', 0.7);
                fx.burst('fx/smoke', e.x, e.y, 0, 5, { speed: 80, color: '#b09080', life: 0.4, size: 40, additive: false, s1: 1.2 / 64 * 40 });
                break;
            case 'slamStart':
                fx.spawn({ key: 'fx/spark', x: e.x, y: e.y, z: e.z + 40, vz: -900, life: 0.25, s0: 2, s1: 1, color: GOLD, rot: 90 });
                break;
            case 'slamLand': this.slamLand(e); break;
            case 'land':
                fx.burst('fx/smoke', e.x, e.y, 0, 4, { speed: 70, color: '#a08070', life: 0.35, size: 34, additive: false, s1: 0.8 });
                break;
            case 'heroHurt':
                Sfx.play('player_hurt');
                v.number(h.x, h.y, 90, '-' + e.dmg, 'hurt');
                v.shake(3);
                fx.burst('fx/spark', h.x, h.y, 70, 6, { speed: 260, color: RED, life: 0.25, size: 46, align: true });
                break;
            case 'heroDead': v.setDim(0.4); break;
            case 'crescent': this.crescent(e, w); break;
            case 'crescentTick': Sfx.play('swing3', 0.8); break;
            case 'skyfallWarn': this.skyfallWarn(e); break;
            case 'skyfallStrike': this.skyfallStrike(e); break;
            case 'spearWindup':
                fx.spawn({ key: 'fx/glow', x: e.x - e.face * 10, y: e.y, z: 110, life: 0.25, s0: 0.3, s1: 0.9, a0: 0.9, color: ORANGE });
                break;
            case 'spearThrow': Sfx.play('skill3_throw'); v.shake(1.5); break;
            case 'ember': this.groundEmber(e); break;
            case 'spearEnd':
                fx.burst('fx/ember', e.x, e.y, 60, 10, { speed: 220, color: EMBER, life: 0.45, size: 26, g: 300 });
                break;
            case 'ultStart': this.ultStart(e, w); break;
            case 'ultStrike': this.ultStrike(e); break;
            case 'ultFlash': v.flash(0.85); Sfx.play('ult_impact', 1); break;
            case 'ultEnd': v.setDim(0); break;
            case 'telegraph': this.telegraph(e, w); break;
            case 'enemyAttack': if (e.kind === 'claw') Sfx.play('swing1', 0.4); else if (e.kind === 'charge') Sfx.play('brute_charge', 0.8); break;
            case 'fireballWarn': this.warnCircle(e.x, e.y, e.r, e.t, '#ff5a2a'); break;
            case 'fireballLand':
                Sfx.play('fireball_land', 0.7);
                this.ring(e.x, e.y, e.r * 2.4, '#ff7a2a', 0.35);
                fx.burst('fx/ember', e.x, e.y, 10, 10, { speed: 200, color: '#ff8a3a', life: 0.5, size: 30, up: 120, g: 400 });
                fx.spawn({ key: 'fx/glow', x: e.x, y: e.y, z: 10, life: 0.25, s0: 1.2, s1: 2, a0: 0.8, color: '#ff6a2a' });
                v.shake(1.5);
                break;
            case 'chargeWarn': this.chargeWarn(e, w); break;
            case 'chargeStop': fx.burst('fx/smoke', e.x, e.y, 0, 5, { speed: 90, color: '#806050', life: 0.4, size: 50, additive: false, s1: 1.2 }); v.shake(2); break;
            case 'bossSweepWarn': this.sweepWarn(e, w); break;
            case 'bossSweep': this.bossSweep(e); break;
            case 'bossLeapWarn': this.warnCircle(e.x, e.y, e.r, e.t, RED); break;
            case 'bossLeap': fx.burst('fx/smoke', e.x, e.y, 0, 8, { speed: 120, color: '#6a5a5a', life: 0.5, size: 60, additive: false, s1: 1.5 }); Sfx.play('jump', 1); break;
            case 'bossSlam':
                Sfx.play('boss_slam'); v.shake(4);
                this.ring(e.x, e.y, e.r * 2.6, RED, 0.45); this.ring(e.x, e.y, e.r * 1.6, '#ffb07a', 0.3);
                this.debris(e.x, e.y, 12, '#7a6a6a');
                break;
            case 'bossEnrage':
                Sfx.play('boss_appear', 0.7); v.flash(0.3); v.shake(3);
                fx.spawn({ key: 'fx/shock_ring', x: e.x, y: e.y, z: 90, life: 0.6, s0: 0.5, s1: 3, a0: 0.9, color: RED, w: 256, h: 256 });
                v.number(e.x, e.y, 200, '狂暴!', 'info');
                break;
            case 'summonImp':
                fx.burst('fx/smoke', e.x, e.y, 10, 6, { speed: 80, color: '#5a3040', life: 0.5, size: 50, additive: false, s1: 1.4 });
                fx.spawn({ key: 'fx/glow', x: e.x, y: e.y, z: 20, life: 0.4, s0: 0.5, s1: 1.4, color: RED });
                break;
            case 'kill': this.kill(e); break;
            case 'bossDead':
                v.flash(0.6); v.shake(4); Sfx.play('ult_impact');
                for (let i = 0; i < 4; i++) this.later(i * 0.18, () => { this.ring(e.x + (Math.random() - 0.5) * 80, e.y, 300, ORANGE, 0.5); fx.burst('fx/ember', e.x, e.y, 80, 14, { speed: 300, color: EMBER, life: 0.7, size: 30, up: 100, g: 200 }); });
                break;
            case 'heal': v.number(e.x, e.y, 110, '+' + e.v, 'heal'); break;
            case 'rageFull': Sfx.play('card_rare', 0.6); break;
            case 'enemyLand': fx.burst('fx/smoke', e.x, e.y, 0, 3, { speed: 60, color: '#907060', life: 0.3, size: 34, additive: false, s1: 0.8 }); break;
            case 'castFail': break;
        }
    }

    private onHit(e: any, w: World) {
        const v = this.v, fx = v.fx;
        const show = () => {
            v.number(e.x, e.y, e.z, String(e.dmg), e.crit ? 'crit' : 'normal');
            const ev = v.enemies[e.id]; if (ev) ev.hitPop = 1;
        };
        if (e.src === 'ult') { this.later(0.12, show); return; }
        show();
        if (e.src === 'flame') return;
        const col = e.src === 'skyfall' ? SKY : e.src === 'crescent' ? ORANGE : e.src === 'spear' ? EMBER : e.crit ? GOLD : '#fff2c0';
        const z = e.z + 50;
        fx.spawn({ key: 'fx/hit_spark', x: e.x - e.kdir * 10, y: e.y, z, life: 0.16, s0: (e.crit ? 0.9 : 0.6) , s1: e.crit ? 1.4 : 1.0, rot: Math.random() * 360, color: col, w: 128, h: 128 });
        fx.burst('fx/spark', e.x, e.y, z, e.crit ? 7 : 4, { speed: e.crit ? 520 : 380, color: col, life: 0.18, size: 54, align: true });
        Sfx.play(e.crit ? 'hit_crit' : 'hit', 0.8);
        Sfx.play('enemy_hurt', 0.4);
        v.shake(Math.min(this.v.cfg.combat.shakeMax, (e.dmg >= 25 ? 3 : e.dmg >= 14 ? 2 : 1.2) + (e.crit ? 1 : 0)));
        void w;
    }

    private swing(e: any) {
        const fx = this.v.fx, step = e.step, f = e.face;
        Sfx.play('swing' + (step + 1), 0.9);
        if (step < 2) {
            // slash crescent sweep (different direction per step)
            const n = this.obj('fx/slash_trail', e.x + f * 60, e.y, 70, 200, 100, step === 0 ? '#ffe8b0' : '#ffd090', 0.16, (nd, u) => {
                nd.setScale(f * (0.8 + u * 0.4), step === 0 ? 1 : -1);
                nd.angle = f * (step === 0 ? (-30 + u * 50) : (40 - u * 60));
                (nd as any)._op.opacity = 230 * (1 - u);
            }, { anchor: false });
            void n;
        } else {
            this.obj('fx/thrust_beam', e.x + f * 20, e.y, 55, 200, 40, '#fff0c0', 0.16, (nd, u) => {
                nd.setScale(f * (0.4 + u * 0.9), 1 - u * 0.6);
                (nd as any)._op.opacity = 255 * (1 - u);
            });
            fx.spawn({ key: 'fx/flash_star', x: e.x + f * 150, y: e.y, z: 55, life: 0.14, s0: 0.4, s1: 1.0, color: GOLD });
        }
    }

    private thrust(e: any) {
        const f = e.face, d = e.dist;
        Sfx.play('charge_thrust');
        this.v.shake(2.5);
        // long piercing light ray along the path
        this.obj('fx/thrust_beam', e.x, e.y, 55, d + 120, 70, ORANGE, 0.32, (nd, u) => {
            const g = u < 0.3 ? u / 0.3 : 1;
            nd.setScale(f * g, u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7);
            (nd as any)._op.opacity = 255 * (1 - u * 0.8);
        });
        this.obj('fx/thrust_beam', e.x, e.y, 55, d + 140, 24, '#ffffff', 0.25, (nd, u) => {
            nd.setScale(f * Math.min(1, u / 0.25), 1 - u);
            (nd as any)._op.opacity = 255 * (1 - u);
        });
        // afterimages along the path
        for (let i = 0; i < 4; i++) this.later(i * 0.045, () => this.afterimage(this.v.hero.root.position.x, this.v.hero.root.position.y, f, GOLD, 0.22));
    }

    private afterimage(nx: number, nyv: number, f: number, col: string, dur: number) {
        const hv = this.v.hero;
        const key = `chars/hero/${hv.pose}`;
        const ut = hv.body.node.getComponent(UITransform)!;
        const s = sprite(key, this.v.ents, ut.width, ut.height, { additive: true, color: hex(col) });
        s.node.setPosition(nx, nyv);
        s.node.setScale(hv.body.node.scale.x, hv.body.node.scale.y);
        s.node.angle = hv.body.node.angle;
        (s.node as any)._sortY = -1;
        const op = opacity(s.node, 150);
        this.v.fx.add({ t: 0, dur, nodes: [s.node], upd: (dt, u) => { op.opacity = 150 * (1 - u); } });
        void f;
    }

    private dodge(e: any, w: World) {
        Sfx.play('dodge');
        const fx = this.v.fx;
        for (let i = 0; i < (this.v.cfg.dodge.afterimages || 4); i++) {
            this.later(i * 0.05, () => this.afterimage(this.v.hero.root.position.x, this.v.hero.root.position.y, e.face, w.mods.dodgeFlame ? ORANGE : '#9ad0ff', 0.25));
        }
        fx.burst('fx/smoke', e.x, e.y, 0, 4, { speed: 60, color: '#b0a0a0', life: 0.35, size: 40, additive: false, s1: 1 });
    }

    private slamLand(e: any) {
        const fx = this.v.fx;
        Sfx.play('land_slam'); this.v.shake(3.5);
        this.ring(e.x, e.y, e.r * 2.6, ORANGE, 0.4);
        this.ring(e.x, e.y, e.r * 1.4, '#fff0c0', 0.25);
        this.debris(e.x, e.y, 8, '#8a6a5a');
        fx.burst('fx/spark', e.x, e.y, 10, 10, { speed: 480, color: GOLD, life: 0.25, size: 60, align: true });
    }

    private ring(x: number, y: number, w: number, col: string, dur: number) {
        this.obj('fx/shock_ring', x, y, 0, w, w * YR, col, dur, (nd, u) => {
            const s = 0.25 + (1 - Math.pow(1 - u, 3)) * 0.85;
            nd.setScale(s, s);
            (nd as any)._op.opacity = 255 * (1 - u);
        }, { ground: true });
    }

    private debris(x: number, y: number, n: number, col: string) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            this.v.fx.spawn({ key: 'fx/rock_debris', x, y: y + Math.sin(a) * 20, z: 5, vx: Math.cos(a) * (150 + Math.random() * 200), vz: 380 + Math.random() * 380, g: 1800, life: 0.8, s0: 0.25 + Math.random() * 0.3, s1: 0.2, a0: 1, a1: 0.6, vr: (Math.random() - 0.5) * 900, color: col, additive: false, floor: true });
        }
    }

    private warnCircle(x: number, y: number, r: number, t: number, col: string) {
        // outer ring (fixed) + filling inner disk that grows to full when the hit lands
        this.obj('fx/warn_circle', x, y, 0, r * 2, r * 2 * YR, col, t, (nd, u) => { (nd as any)._op.opacity = 140 + 80 * Math.sin(u * 30); }, { ground: true, additive: false });
        this.obj('fx/warn_circle', x, y, 0, r * 2, r * 2 * YR, col, t, (nd, u) => { nd.setScale(u, u); (nd as any)._op.opacity = 120; }, { ground: true, additive: false });
    }

    private crescent(e: any, w: World) {
        const S = this.v.cfg.skills.crescent;
        const dur = e.spins * e.spinDur, R = e.r;
        Sfx.play('skill1_crescent');
        const h = w.hero;
        // ground glow ring following the hero
        this.obj('fx/fire_ring', h.x, h.y, 0, R * 2.3, R * 2.3 * YR, ORANGE, dur + 0.2, (nd, u) => {
            nd.setPosition(w.hero.x, ny(w.hero.y));
            const p = 1 + Math.sin(u * 40) * 0.04;
            nd.setScale(p, p);
            (nd as any)._op.opacity = 200 * Math.min(1, (1 - u) * 4) * Math.min(1, u * 8);
        }, { ground: true });
        // two counter-phased fire crescents orbiting with ghost trails (3 lagging copies)
        const arcs: Node[] = [];
        const make = (lag: number, a: number, col: string, k: number) => {
            const n = this.obj('fx/crescent_arc', h.x, h.y, 50, R * 1.5 * k, R * 1.5 * k * 0.62, col, dur, (nd, u) => {
                const ang = u * e.spins * 360 - lag;
                nd.setPosition(w.hero.x, ny(w.hero.y, 50));
                // flatten for ground-plane perspective: rotate then squash via parent scale trick
                nd.angle = -ang;
                (nd as any)._op.opacity = a * Math.min(1, (1 - u) * 5) * Math.min(1, u * 10);
            });
            arcs.push(n);
        };
        make(0, 235, '#ffb13a', 1); make(18, 150, ORANGE, 1); make(36, 90, '#c03a1a', 0.97); make(54, 50, '#801a0a', 0.94);
        make(180, 200, '#ff8a3a', 0.9); make(198, 110, ORANGE, 0.88);
        // ember sparks flung from the blade tips
        const tick = this.v.fx.add({ t: 0, dur, nodes: [], upd: (dt, u, o) => {
            if (!o.data) o.data = 0;
            o.data += dt;
            while (o.data > 0.02) {
                o.data -= 0.02;
                const ang = (u * e.spins * 360) * Math.PI / 180;
                for (const off of [0, Math.PI]) {
                    const a = -ang + off + Math.PI * 0.4;
                    const x = w.hero.x + Math.cos(a) * R * 0.75, z = 50 + Math.sin(a) * R * 0.75;
                    this.v.fx.spawn({ key: 'fx/ember', x, y: w.hero.y, z, vx: Math.cos(a + 1.57) * -200, vz: 60 + Math.random() * 100, life: 0.45, s0: 0.35, s1: 0, color: Math.random() < 0.5 ? EMBER : ORANGE });
                }
            }
        } });
        void tick; void S;
    }

    private skyfallWarn(e: any) {
        Sfx.play('skill2_charge');
        this.warnCircle(e.x, e.y, e.r, e.delay, SKY);
        // gathering light motes
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            this.v.fx.spawn({ key: 'fx/glow', x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r * YR, z: 0, vx: -Math.cos(a) * e.r / e.delay, vy: -Math.sin(a) * e.r * YR / e.delay, vz: 60, life: e.delay, s0: 0.2, s1: 0.05, color: SKY });
        }
    }

    private skyfallStrike(e: any) {
        const v = this.v, fx = v.fx, r = e.r;
        Sfx.play('skill2_strike'); v.shake(4); v.flash(0.35);
        // pillar from the top of the screen down to the ground point (anchor at bottom)
        const H = 900;
        this.obj('fx/light_pillar', e.x, e.y, 0, r * 1.5, H, SKY, 0.45, (nd, u) => {
            const sx = u < 0.12 ? 0.3 + u / 0.12 * 0.9 : 1.2 * (1 - (u - 0.12) / 0.88) + 0.05;
            nd.setScale(sx, u < 0.08 ? u / 0.08 : 1);
            (nd as any)._op.opacity = 235 * (1 - Math.max(0, u - 0.3) / 0.7);
        });
        this.obj('fx/light_pillar', e.x, e.y, 0, r * 0.5, H, '#ffffff', 0.3, (nd, u) => {
            nd.setScale(1 - u * 0.8, 1);
            (nd as any)._op.opacity = 255 * (1 - u);
        });
        this.ring(e.x, e.y, r * 3, SKY, 0.5);
        this.ring(e.x, e.y, r * 1.8, '#ffffff', 0.3);
        this.debris(e.x, e.y, 10, '#9aa0b0');
        fx.burst('fx/spark', e.x, e.y, 20, 12, { speed: 520, color: SKY, life: 0.3, size: 60, align: true, up: 200 });
        fx.spawn({ key: 'fx/glow', x: e.x, y: e.y, z: 10, life: 0.35, s0: 2, s1: 3.5, a0: 0.7, color: SKY, ground: true });
    }

    private groundEmber(e: any) {
        // smouldering ember left on the ground along the spear path
        const life = e.life;
        this.obj('fx/glow', e.x + (Math.random() - 0.5) * 20, e.y + (Math.random() - 0.5) * 12, 0, 54, 26, ORANGE, life, (nd, u) => {
            (nd as any)._op.opacity = 220 * (1 - u) * (0.75 + Math.random() * 0.25);
        }, { ground: true });
        if (Math.random() < 0.6) this.v.fx.spawn({ key: 'fx/ember', x: e.x, y: e.y, z: 0, vz: 60 + Math.random() * 50, vx: (Math.random() - 0.5) * 30, life: 0.7, s0: 0.3, s1: 0, color: EMBER });
    }

    private ultStart(e: any, w: World) {
        const v = this.v;
        v.setDim(this.v.cfg.skills.ultimate.dimAlpha || 0.6);
        Sfx.play('ult_start'); this.later(0.15, () => Sfx.play('ult_voice', 1));
        if (this.onUltCutin) this.onUltCutin(true, e.name);
        this.later(e.cutin, () => { if (this.onUltCutin) this.onUltCutin(false, e.name); });
        // hero rises in glow
        this.obj('fx/glow', w.hero.x, w.hero.y, 60, 260, 260, GOLD, e.cutin + 1.2, (nd, u) => {
            nd.setPosition(w.hero.x, ny(w.hero.y, 70)); (nd as any)._op.opacity = 200 * Math.sin(u * Math.PI);
        });
    }

    private ultStrike(e: any) {
        const v = this.v, fx = v.fx;
        for (const tg of e.targets) {
            const fall = 0.14, sx = tg.x + 260, sz = 700;
            // meteor falls diagonally
            this.obj('fx/meteor', sx, tg.y, sz, 220, 220, '#ffcf6a', fall, (nd, u) => {
                nd.setPosition(sx + (tg.x - sx) * u, ny(tg.y, sz * (1 - u)));
                nd.angle = 135 + 90;
            });
            this.later(fall, () => {
                Sfx.play('ult_impact', 0.8);
                v.shake(4);
                fx.spawn({ key: 'fx/glow', x: tg.x, y: tg.y, z: 20, life: 0.35, s0: 1.4, s1: 2.6, a0: 0.75, color: ORANGE });
                fx.spawn({ key: 'fx/flash_star', x: tg.x, y: tg.y, z: 30, life: 0.2, s0: 0.8, s1: 1.8, color: '#fff4c0', rot: Math.random() * 90 });
                this.ring(tg.x, tg.y, 320, GOLD, 0.4);
                fx.burst('fx/ember', tg.x, tg.y, 20, 8, { speed: 320, color: EMBER, life: 0.6, size: 28, up: 150, g: 500 });
                fx.burst('fx/smoke', tg.x, tg.y, 10, 3, { speed: 60, color: '#4a3030', life: 0.6, size: 70, additive: false, s1: 1.6 });
            });
        }
    }

    private telegraph(e: any, w: World) {
        const ev = this.v.enemies[e.id];
        if (!ev) return;
        if (e.kind === 'claw' || e.kind === 'throw' || e.kind === 'summon' || e.kind === 'leap' || e.kind === 'sweep') {
            // "!" mark above the head
            const [, hh] = [0, 0];
            void hh;
            const top = (e.kind === 'claw' || e.kind === 'throw') ? 120 : 260;
            const n = node('warn', this.v.fxTop);
            const l = label('!', n, 0, 0, { size: 44, color: '#ff4a2a', outline: '#1a0f14', outlineW: 4 });
            void l;
            const op = opacity(n, 255);
            this.v.fx.add({ t: 0, dur: e.t, nodes: [n], upd: (dt, u) => {
                const en = w.enemies.find(x => x.id === e.id);
                if (en) n.setPosition(en.x, ny(en.y, en.z + top));
                const s = 0.6 + Math.min(1, u * 4) * 0.6 + Math.sin(u * 40) * 0.05;
                n.setScale(s, s); op.opacity = 255;
            } });
        }
        if (e.kind === 'summon') Sfx.play('boss_appear', 0.4);
    }

    private chargeWarn(e: any, w: World) {
        const ang = Math.atan2(-e.dy * YR * 2, e.dx) * 180 / Math.PI;
        Sfx.play('brute_charge', 0.6);
        this.obj('fx/warn_bar', e.x, e.y, 0, e.len, e.w, RED, e.t + 0.3, (nd, u) => {
            nd.angle = ang;
            const fill = Math.min(1, u * 1.3);
            nd.setScale(fill, 1);
            (nd as any)._op.opacity = 120 + 100 * Math.abs(Math.sin(u * 20));
        }, { ground: true, additive: false });
        void w;
    }

    private sweepWarn(e: any, w: World) {
        const r = e.r, a = e.angle;
        const fanH = 2 * r * Math.sin(a / 2 * Math.PI / 180) * YR * 2;
        this.obj('fx/warn_fan', e.x, e.y, 0, r, Math.max(60, fanH), RED, e.t, (nd, u) => {
            const en = w.enemies.find(x => x.id === e.id);
            if (en) nd.setPosition(en.x, ny(en.y));
            nd.setScale(e.face * (0.3 + 0.7 * Math.min(1, u * 1.5)), 1);
            (nd as any)._op.opacity = 120 + 110 * Math.abs(Math.sin(u * 16));
        }, { ground: true, additive: false });
    }

    private bossSweep(e: any) {
        Sfx.play('swing3', 1); this.v.shake(3);
        this.obj('fx/slash_trail', e.x + e.face * e.r * 0.45, e.y, 90, e.r * 1.4, e.r * 0.7, '#ff7a5a', 0.25, (nd, u) => {
            nd.setScale(e.face * (0.7 + u * 0.4), -1);
            nd.angle = e.face * (50 - u * 90);
            (nd as any)._op.opacity = 240 * (1 - u);
        }, { anchor: false });
    }

    private kill(e: any) {
        const fx = this.v.fx;
        Sfx.play('enemy_die', 0.7);
        const big = e.type === 'brute' || e.type === 'boss';
        fx.burst('fx/ember', e.x, e.y, 40, big ? 16 : 9, { speed: big ? 260 : 200, color: EMBER, life: 0.6, size: 26, up: 120, g: 300 });
        fx.burst('fx/smoke', e.x, e.y, 20, big ? 6 : 3, { speed: 60, color: '#3a2a30', life: 0.6, size: big ? 90 : 60, additive: false, s1: 1.6 });
    }
}

export type { Color };
