/** Character rendered from a shared skeletal rig (ANIMATION.md v1). Rig space is y-down, clockwise degrees. */
import { Node, Sprite, Graphics, Color, UITransform } from 'cc';
import { node, gfxNode, hex, opacity } from './UiKit';
import { Assets } from './Assets';
import { RigPlayer, Rig, Phases } from '../animation/RigPlayer';
import { HeroAnimation } from '../animation/HeroAnimation';
import type { Hero, Enemy } from '../core/types';

interface SlotView { name: string; bone: string; n: Node; sp: Sprite; op: any; img: string; z: number; }
const TRAIL_META: { [k: string]: { socket: string; width: number; rgb: [number, number, number] } } = {
    hero: { socket: 'spearTip', width: 26, rgb: [255, 214, 150] },
    imp: { socket: 'clawTip', width: 18, rgb: [255, 140, 80] },
    brute: { socket: 'chargeFront', width: 24, rgb: [255, 180, 110] },
    boss: { socket: 'swordTip', width: 32, rgb: [255, 110, 90] },
};

export class SkelView {
    static enabled = true;
    root: Node; player: RigPlayer; anim: HeroAnimation; trailG: Graphics; ds: number; rootOp: any;
    slots: SlotView[] = [];
    parts: { [k: string]: any };
    private order = '';
    private stateKey = ''; private lastStateTime = -1; private enragedSeen = false; private enrageT = 0;
    private trailSocket = 'spearTip'; private trailRgb: [number, number, number] = [255, 214, 150];
    constructor(parent: Node, public cfg: any, public who = 'hero') {
        this.root = node(who + 'Rig', parent);
        const rd = Assets.rigs[who] || { rig: Assets.heroRig, anims: Assets.heroAnims, parts: Assets.heroParts };
        const rig = rd.rig as Rig;
        this.parts = rd.parts || {};
        this.player = new RigPlayer(rig, rd.anims);
        this.anim = new HeroAnimation(this.player, cfg);
        this.ds = rig.displayScale ?? .6;
        this.root.setScale(this.ds, this.ds, 1);
        const tm = TRAIL_META[who];
        this.trailSocket = tm ? tm.socket : '';
        this.trailRgb = tm ? tm.rgb : [255, 214, 150];
        this.anim.trail.width = tm ? tm.width : 20;
        this.rootOp = opacity(this.root, 255);
        for (const sl of rig.slots) {
            const n = node(sl.name, this.root);
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.trim = false;
            const key = String(sl.image).replace(/\.png$/, ''), f = this.parts[key];
            if (f) sp.spriteFrame = f;
            const ut = n.getComponent(UITransform)!;
            ut.setContentSize(f ? f.rect.width : 32, f ? f.rect.height : 32);
            ut.setAnchorPoint(sl.pivot[0], 1 - sl.pivot[1]);
            this.slots.push({ name: sl.name, bone: sl.bone, n, sp, op: opacity(n, 255), img: key, z: sl.z });
        }
        this.trailG = gfxNode(this.root, 'trail');
        const first = rd.anims.idle ? 'idle' : rd.anims.float ? 'float' : Object.keys(rd.anims)[0];
        if (first) {
            this.player.play(first);
            if (who !== 'hero') this.player.update((Math.random() * 0.7) + 0.01); // desync enemy loops
        }
    }
    private P(x: number, y: number): [number, number] { return [x, -y]; }
    update(h: Hero, dt: number, frozen: boolean) {
        if (dt > 0 && !frozen) this.anim.update(h, dt, h.face, true);
        this.syncNodes(h.face, 1, h.flashT > 0 ? '#ffd0d0' : '#ffffff');
    }
    updateEnemy(e: Enemy, moving: boolean, dt: number, frozen: boolean, tint = '#ffffff', pop = 1) {
        if (dt > 0 && !frozen) {
            const c = this.cfg.enemies[e.type];
            if (e.type === 'boss' && e.enraged && !this.enragedSeen) { this.enragedSeen = true; this.enrageT = 1.0; }
            if (this.enrageT > 0) this.enrageT = Math.max(0, this.enrageT - dt);
            let name = e.type === 'lantern' ? 'float' : 'idle', key: string = e.state, dur = 0, hit = -1;
            if (e.state === 'dead') { name = 'dead'; }
            else if (e.state === 'hurt') { name = 'hurt'; dur = e.stDur || 0.25; }
            else if (e.type === 'imp') {
                if (e.state === 'windup') { name = 'windup'; dur = e.stDur || c.windup; }
                else if (e.state === 'attack') { name = 'claw'; dur = e.stDur || c.attackDuration; hit = dur * 0.35; }
                else if (e.state === 'recover') { name = 'idle'; }
                else { name = moving ? 'run' : 'idle'; key = 'move:' + name; }
            } else if (e.type === 'lantern') {
                if (e.state === 'windup') { name = 'windup'; dur = e.stDur || c.windup; }
                else if (e.state === 'attack' || e.state === 'recover') { name = 'throw'; dur = e.stDur || 0.4; }
                else { name = 'float'; key = 'float'; }
            } else if (e.type === 'brute') {
                if (e.state === 'windup') { name = 'charge_windup'; dur = e.stDur || c.chargeWindup; }
                else if (e.state === 'charge') { name = 'charge'; }
                else if (e.state === 'recover') { name = 'stagger'; dur = e.stDur || c.recover; }
                else { name = moving ? 'walk' : 'idle'; key = 'move:' + name; }
            } else if (e.type === 'boss') {
                const cdm = e.enraged ? c.enrageCooldownMul : 1, M = c.moves;
                if (e.state === 'windup') {
                    if (e.move === 'sweep') { name = 'sweep_windup'; dur = e.stDur || M.sweep.windup * cdm; }
                    else if (e.move === 'leap') { name = 'leap'; key = 'boss_leap'; dur = (M.leap.windup * cdm) + M.leap.airTime; hit = M.leap.windup * cdm; }
                    else { name = 'summon'; key = 'boss_summon'; dur = (M.summon.windup * cdm) + 0.5; hit = M.summon.windup * cdm; }
                } else if (e.state === 'leapAir') {
                    name = 'leap'; key = 'boss_leap'; dur = (M.leap.windup * cdm) + M.leap.airTime; hit = M.leap.windup * cdm;
                } else if (e.state === 'summon') {
                    name = 'summon'; key = 'boss_summon'; dur = (M.summon.windup * cdm) + 0.5; hit = M.summon.windup * cdm;
                } else if (e.state === 'attack') {
                    name = 'sweep'; key = 'boss_sweep'; dur = (e.stDur || 0.35) + 0.25 * cdm;
                } else if (e.state === 'recover') {
                    if (e.move === 'leap') { name = 'land'; dur = e.stDur || 0.7 * cdm; }
                    else if (e.move === 'sweep' && this.player.name === 'sweep' && this.player.time < this.player.duration) { name = 'sweep'; key = 'boss_sweep'; }
                    else { name = 'idle'; }
                } else if (this.enrageT > 0 && this.player.clips.enrage) {
                    name = 'enrage'; key = 'enrage'; dur = 1.0;
                } else {
                    name = moving ? 'walk' : 'idle'; key = 'move:' + name;
                }
            }
            const clip = this.player.clips[name];
            if (clip) {
                const fullKey = key + ':' + name;
                const sameMultiPhase = key === 'boss_leap' || key === 'boss_summon' || key === 'boss_sweep';
                if (fullKey !== this.stateKey || (!sameMultiPhase && e.st < this.lastStateTime)) {
                    const d = dur > 0 ? dur : clip.duration;
                    let target: Phases | undefined;
                    if (clip.phases && dur > 0) {
                        const p = clip.phases, ratio = d / p.recovery;
                        const active = hit >= 0 ? hit : p.active * ratio;
                        target = { windup: p.active > 0 ? active * p.windup / p.active : 0, active, recovery: d };
                    }
                    this.player.play(name, target, e.state === 'hurt' || e.state === 'attack' ? .06 : .09, true);
                    this.anim.trail.clear();
                    this.stateKey = fullKey;
                }
                this.lastStateTime = e.st;
                this.player.update(dt);
                for (const ev of this.player.events) {
                    if (ev.name === 'trail_on') this.anim.trail.enabled = true;
                    else if (ev.name === 'trail_off') this.anim.trail.enabled = false;
                }
                const tip = this.trailSocket ? this.player.socket(this.trailSocket) : null;
                this.anim.trail.update(dt, tip ? { x: tip.x, y: tip.y } : null);
            }
        }
        this.syncNodes(e.face, pop, e.flashT > 0 ? '#ffd0d0' : tint);
    }
    private syncNodes(face: number, pop: number, colorHex: string) {
        this.root.setScale(this.ds * face * pop, this.ds * pop, 1);
        const col = hex(colorHex);
        for (const sv of this.slots) {
            const m = this.player.world[sv.bone], st = this.player.slots[sv.name];
            if (!m) continue;
            if (st && st.image !== sv.img) {
                const key = String(st.image).replace(/\.png$/, ''), f = this.parts[key];
                if (f) { sv.img = key; sv.sp.spriteFrame = f; const ut = sv.n.getComponent(UITransform)!; ut.setContentSize(f.rect.width, f.rect.height); }
            }
            const [px, py] = this.P(m.x, m.y);
            sv.n.setPosition(px, py, 0);
            sv.n.angle = -Math.atan2(m.b, m.a) * 180 / Math.PI;
            const sx = Math.hypot(m.a, m.b) || 1e-4, det = m.a * m.d - m.b * m.c;
            sv.n.setScale(sx, (Math.hypot(m.c, m.d) || 1e-4) * (det < 0 ? -1 : 1), 1);
            sv.op.opacity = Math.max(0, Math.min(255, (st ? st.alpha : 1) * 255));
            sv.z = st ? st.z : sv.z;
            sv.sp.color = col;
        }
        const sorted = this.slots.slice().sort((a, b) => a.z - b.z);
        const key = sorted.map(s => s.name).join(',');
        if (key !== this.order) { this.order = key; this.slots = sorted; for (let i = 0; i < sorted.length; i++) sorted[i].n.setSiblingIndex(i); }
        this.trailG.node.setSiblingIndex(this.slots.length);
        const g = this.trailG; g.clear();
        const v = this.anim.trail.vertices, idx = this.anim.trail.indices, [cr, cg, cb] = this.trailRgb;
        for (let i = 0; i < idx.length; i += 3) {
            const a = v[idx[i]], b = v[idx[i + 1]], c = v[idx[i + 2]];
            g.fillColor = new Color(cr, cg, cb, 170 * (a.alpha + b.alpha + c.alpha) / 3);
            g.moveTo(...this.P(a.x, a.y)); g.lineTo(...this.P(b.x, b.y)); g.lineTo(...this.P(c.x, c.y));
            g.close(); g.fill();
        }
    }
}
