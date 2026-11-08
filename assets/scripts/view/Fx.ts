/** Particle pool + timed FX objects. Positions in world coords (x, ground y, z) → node (x, 360 - y + z). */
import { Node, Sprite, Color, UIOpacity, UITransform } from 'cc';
import { sprite, setFrame, opacity, hex } from './UiKit';

export const GY = 360; // world y that maps to node y = 0
export function ny(y: number, z = 0) { return GY - y + z; }

export interface POpt {
    key: string; x: number; y: number; z?: number;
    vx?: number; vz?: number; vy?: number; g?: number; drag?: number;
    life: number; s0: number; s1?: number; a0?: number; a1?: number;
    rot?: number; vr?: number; color?: Color | string; w?: number; h?: number;
    ground?: boolean; additive?: boolean; floor?: boolean; alignVel?: boolean;
}

interface P {
    n: Node; sp: Sprite; op: UIOpacity; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; drag: number;
    t: number; life: number; s0: number; s1: number; a0: number; a1: number; rot: number; vr: number; floor: boolean; alignVel: boolean; on: boolean;
}

export interface FxObj { t: number; dur: number; nodes: Node[]; upd: (dt: number, u: number, o: FxObj) => void; end?: () => void; data?: any; }

export class Fx {
    private pools: { [k: string]: P[] } = {};
    private live: P[] = [];
    objs: FxObj[] = [];
    max = 260;

    constructor(public top: Node, public ground: Node) {}

    count() { return this.live.length; }

    spawn(o: POpt): boolean {
        if (this.live.length >= this.max) return false;
        const pk = (o.ground ? 'g' : 't') + (o.additive === false ? 'n' : 'a');
        const pool = this.pools[pk] || (this.pools[pk] = []);
        let p = pool.pop();
        if (!p) {
            const sp = sprite(o.key, o.ground ? this.ground : this.top, 64, 64, { anchorKey: false, additive: o.additive !== false });
            p = { n: sp.node, sp, op: opacity(sp.node), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, t: 0, life: 1, s0: 1, s1: 1, a0: 1, a1: 0, rot: 0, vr: 0, floor: false, alignVel: false, on: true };
            (p as any).pk = pk;
        } else { p.n.active = true; }
        setFrame(p.sp, o.key);
        const w = o.w ?? 64, h = o.h ?? w;
        p.n.getComponent(UITransform)!.setContentSize(w, h);
        p.sp.color = typeof o.color === 'string' ? hex(o.color) : (o.color || Color.WHITE);
        p.x = o.x; p.y = o.y; p.z = o.z ?? 0; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0; p.g = o.g ?? 0; p.drag = o.drag ?? 0;
        p.t = 0; p.life = o.life; p.s0 = o.s0; p.s1 = o.s1 ?? o.s0; p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
        p.rot = o.rot ?? 0; p.vr = o.vr ?? 0; p.floor = !!o.floor; p.alignVel = !!o.alignVel; p.on = true;
        p.n.setSiblingIndex(p.n.parent!.children.length - 1);
        this.live.push(p);
        this.apply(p, 0);
        return true;
    }

    private apply(p: P, u: number) {
        const s = p.s0 + (p.s1 - p.s0) * u;
        p.n.setPosition(p.x, ny(p.y, p.z), 0);
        p.n.setScale(s, s, 1);
        if (p.alignVel) p.rot = Math.atan2(p.vz, p.vx) * 180 / Math.PI;
        p.n.angle = p.rot;
        const a = p.a0 + (p.a1 - p.a0) * u;
        p.op.opacity = Math.max(0, Math.min(255, a * 255));
    }

    add(o: FxObj) { this.objs.push(o); o.upd(0, 0, o); return o; }

    update(dt: number) {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const p = this.live[i];
            p.t += dt;
            if (p.t >= p.life) {
                p.n.active = false; p.on = false;
                this.live.splice(i, 1);
                this.pools[(p as any).pk].push(p);
                continue;
            }
            if (p.drag) { const k = Math.pow(1 - Math.min(0.99, p.drag), dt * 60); p.vx *= k; p.vz *= k; p.vy *= k; }
            p.vz -= p.g * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.floor && p.z < 0) { p.z = 0; p.vz = -p.vz * 0.3; p.vx *= 0.6; p.vr *= 0.5; }
            p.rot += p.vr * dt;
            this.apply(p, p.t / p.life);
        }
        for (let i = this.objs.length - 1; i >= 0; i--) {
            const o = this.objs[i];
            o.t += dt;
            const u = Math.min(1, o.t / o.dur);
            o.upd(dt, u, o);
            if (o.t >= o.dur) {
                if (o.end) o.end();
                for (const n of o.nodes) if (n.isValid) n.destroy();
                this.objs.splice(i, 1);
            }
        }
    }

    clear() {
        for (const p of this.live) { p.n.active = false; this.pools[(p as any).pk].push(p); }
        this.live = [];
        for (const o of this.objs) for (const n of o.nodes) if (n.isValid) n.destroy();
        this.objs = [];
    }

    // ------------- common bursts -------------
    burst(key: string, x: number, y: number, z: number, n: number, o: { speed: number; color: string; life: number; size: number; g?: number; up?: number; spread?: number; ground?: boolean; additive?: boolean; floor?: boolean; vr?: number; align?: boolean; s1?: number }) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = o.speed * (0.4 + Math.random() * 0.8);
            this.spawn({
                key, x, y: y + (Math.random() - 0.5) * (o.spread ?? 0), z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * 0.8 + (o.up ?? 0),
                g: o.g ?? 0, drag: 0.04, life: o.life * (0.6 + Math.random() * 0.6), s0: o.size * (0.7 + Math.random() * 0.6) / 64, s1: o.s1 ?? 0,
                color: o.color, ground: o.ground, additive: o.additive, floor: o.floor, rot: Math.random() * 360, vr: o.vr ?? 0, alignVel: o.align,
            });
        }
    }
}

export type { Sprite };
