/** Engine independent ANIMATION.md v1 player. Coordinates: pixels, y down, clockwise degrees. */
export interface Pose { x: number; y: number; rot: number; sx: number; sy: number; alpha: number; z: number; }
export interface Key extends Partial<Pose> { t: number; ease?: string; image?: string; }
export interface Bone extends Partial<Pose> { name: string; parent: string | null; length?: number; }
export interface Slot { name: string; bone: string; image: string; pivot: number[]; z: number; alpha?: number; }
export interface Rig { version: number; unitsPerPixel?: number; displayScale?: number; keyMode?: 'absolute'; bones: Bone[]; slots: Slot[]; springs?: { bones: string[]; stiffness: number; damping: number; gravity: number }[]; sockets?: { [key: string]: { bone: string; x: number; y: number } }; }
export interface Phases { windup: number; active: number; recovery: number; }
export interface Clip { duration: number; loop: boolean; phases?: Phases; bones?: { [key: string]: Key[] }; slots?: { [key: string]: Key[] }; events?: { t: number; name: string; arg?: string }[]; }
export interface Matrix { a: number; b: number; c: number; d: number; x: number; y: number; }
const props = ['x', 'y', 'rot', 'sx', 'sy', 'alpha', 'z'] as (keyof Pose)[];
const setup = (b: Partial<Pose>): Pose => ({ x: b.x || 0, y: b.y || 0, rot: b.rot || 0, sx: b.sx ?? 1, sy: b.sy ?? 1, alpha: b.alpha ?? 1, z: b.z || 0 });
export function ease(name: string, u: number): number {
    switch (name) {
        case 'quadIn': return u * u;
        case 'quadOut': return 1 - (1 - u) ** 2;
        case 'quadInOut': return u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        case 'cubicIn': return u ** 3;
        case 'cubicOut': return 1 - (1 - u) ** 3;
        case 'expoOut': return u === 1 ? 1 : 1 - 2 ** (-10 * u);
        case 'backOut': return 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;
        case 'sineInOut': return -(Math.cos(Math.PI * u) - 1) / 2;
        case 'step': return u < 1 ? 0 : 1;
        default: return u;
    }
}
/** Independent sparse property tracks. Implicit setup key at zero; ease belongs to destination. */
function sample(keys: Key[], p: keyof Pose, t: number, base: number): number {
    let prev = { t: 0, value: base };
    for (const k of keys) {
        if (k[p] === undefined) continue;
        if (k.t > t) { const u = Math.max(0, (t - prev.t) / (k.t - prev.t)); return prev.value + (k[p]! - prev.value) * ease(k.ease || 'linear', u); }
        prev = { t: k.t, value: k[p]! };
    }
    return prev.value;
}
export class RigPlayer {
    pose: { [key: string]: Pose } = {}; world: { [key: string]: Matrix } = {};
    slots: { [key: string]: { image: string; alpha: number; z: number } } = {};
    name = ''; time = 0; duration = 0; events: { t: number; name: string; arg?: string }[] = [];
    private order: Bone[] = []; private from: { [key: string]: Pose } = {};
    private blend = 0; private blendTime = 0; private target?: Phases;
    private initialEvents = true; private spring: { [key: string]: { angle: number; velocity: number } } = {};
    constructor(public rig: Rig, public clips: { [key: string]: Clip }) {
        if (rig.version !== 1) throw new Error('Unsupported rig version');
        const pending = rig.bones.slice(), names = new Set<string>();
        while (pending.length) {
            const i = pending.findIndex(b => !b.parent || names.has(b.parent));
            if (i < 0) throw new Error('Missing parent or cyclic bone hierarchy');
            const b = pending.splice(i, 1)[0];
            if (names.has(b.name)) throw new Error('Duplicate bone ' + b.name);
            names.add(b.name); this.order.push(b); this.pose[b.name] = setup(b);
        }
        for (const s of rig.slots) if (!names.has(s.bone)) throw new Error('Unknown slot bone ' + s.bone);
        for (const name in clips) {
            const c = clips[name];
            if (!(c.duration > 0)) throw new Error('Invalid clip duration ' + name);
            for (const tracks of [c.bones, c.slots]) for (const k in tracks || {}) tracks![k].sort((a, b) => a.t - b.t);
            c.events?.sort((a, b) => a.t - b.t);
        }
        this.compose(0);
    }
    play(name: string, target?: Phases, blend = .08, restart = false) {
        if (this.name === name && !restart) return;
        const c = this.clips[name]; if (!c) throw new Error('Missing animation ' + name);
        // Boundary times are clamped rather than rejected: clips where active == recovery would otherwise yield an
        // empty segment as soon as gameplay timing squeezes them onto the same instant.
        if (target) {
            if (!(target.recovery > 0)) throw new Error('Invalid target phases');
            target = { recovery: target.recovery, active: Math.max(0, Math.min(target.active, target.recovery * .98)), windup: 0 };
            target.windup = Math.max(0, Math.min(target.active, target.windup));
        }
        this.from = {}; for (const b of this.order) this.from[b.name] = { ...this.pose[b.name] };
        this.blend = this.name ? Math.max(.06, Math.min(.12, blend)) : 0; this.blendTime = 0;
        this.name = name; this.time = 0; this.target = target;
        this.duration = target ? target.recovery : c.duration; this.initialEvents = true; this.events = [];
        this.evaluate(0); this.compose(0);
    }
    /** Piecewise inverse warp. Both phases objects contain boundary times, not segment durations. */
    sourceTime(t: number): number {
        const c = this.clips[this.name]; if (!this.target || !c.phases) return t * c.duration / this.duration;
        const src = [0, c.phases.windup, c.phases.active, c.phases.recovery];
        const dst = [0, this.target.windup, this.target.active, this.target.recovery];
        for (let i = 1; i < 4; i++) if (t <= dst[i] && dst[i] > dst[i - 1]) return src[i - 1] + (src[i] - src[i - 1]) * (t - dst[i - 1]) / (dst[i] - dst[i - 1]);
        return c.duration;
    }
    update(dt: number, frozen = false) {
        this.events = []; if (frozen || dt <= 0 || !this.name) return;
        const c = this.clips[this.name]; this.blendTime += dt;
        // Dispatch crossed events even for multiple loops or a large frame. Events at t=0 fire once per loop.
        let remaining = dt;
        while (remaining > 0) {
            const end = Math.min(this.duration, this.time + remaining), a = this.sourceTime(this.time), b = this.sourceTime(end);
            for (const e of c.events || []) if ((e.t > a || (this.initialEvents && e.t === 0)) && e.t <= b) this.events.push(e);
            this.initialEvents = false;
            remaining -= end - this.time; this.time = end;
            if (end >= this.duration) { if (!c.loop) break; this.time = 0; this.initialEvents = true; }
            else break;
        }
        this.evaluate(this.sourceTime(this.time)); this.compose(dt);
    }
    private evaluate(t: number) {
        const c = this.clips[this.name]; const mix = this.blend ? Math.min(1, this.blendTime / this.blend) : 1;
        for (const b of this.order) {
            const base = setup(b), out = setup(b), track = c.bones?.[b.name] || [];
            for (const p of props) {
                const absolute = this.rig.keyMode === 'absolute' || p === 'alpha' || p === 'z';
                const mult = p === 'sx' || p === 'sy';
                const v = sample(track, p, t, absolute ? base[p] : mult ? 1 : 0);
                out[p] = absolute ? v : mult ? base[p] * v : base[p] + v;
                if (this.from[b.name] && p !== 'z') out[p] = this.from[b.name][p] + (out[p] - this.from[b.name][p]) * mix;
            }
            this.pose[b.name] = out;
        }
        for (const s of this.rig.slots) {
            const keys = c.slots?.[s.name] || []; let image = s.image;
            for (const k of keys) if (k.t <= t && k.image !== undefined) image = k.image;
            // z is discrete to avoid unstable crossing order; slot track overrides the bone z offset.
            let z = s.z + this.pose[s.bone].z;
            for (const k of keys) if (k.t <= t && k.z !== undefined) z = k.z;
            this.slots[s.name] = { image, alpha: sample(keys, 'alpha', t, s.alpha ?? 1) * this.pose[s.bone].alpha, z };
        }
    }
    private compose(dt: number) {
        for (const b of this.order) {
            const p = this.pose[b.name], parent = b.parent ? this.world[b.parent] : null;
            let rot = p.rot;
            const group = this.rig.springs?.find(s => s.bones.indexOf(b.name) >= 0);
            if (group) {
                const parentAngle = parent ? Math.atan2(parent.b, parent.a) * 180 / Math.PI : 0;
                const target = parentAngle + rot;
                const state = this.spring[b.name] || (this.spring[b.name] = { angle: target, velocity: 0 });
                // World-angle inertia reacts to a rotating parent; fixed substeps prevent stiff springs exploding.
                const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
                const idx = group.bones.indexOf(b.name), next = this.rig.bones.find(n => n.name === group.bones[idx + 1]);
                const length = b.length || (next ? Math.hypot(next.x || 0, next.y || 0) : Math.hypot(b.x || 0, b.y || 0)) || 30;
                for (let i = 0; i < steps; i++) {
                    const delta = ((target - state.angle + 540) % 360 + 360) % 360 - 180;
                    const gravity = group.gravity * Math.cos(state.angle * Math.PI / 180) / length;
                    state.velocity += (group.stiffness * delta - group.damping * state.velocity + gravity) * h;
                    state.angle += state.velocity * h;
                }
                rot = state.angle - parentAngle;
            }
            const r = rot * Math.PI / 180, a = Math.cos(r) * p.sx, b0 = Math.sin(r) * p.sx, cc = -Math.sin(r) * p.sy, d = Math.cos(r) * p.sy;
            this.world[b.name] = parent ? { a: parent.a * a + parent.c * b0, b: parent.b * a + parent.d * b0, c: parent.a * cc + parent.c * d, d: parent.b * cc + parent.d * d, x: parent.x + parent.a * p.x + parent.c * p.y, y: parent.y + parent.b * p.x + parent.d * p.y } : { a, b: b0, c: cc, d, x: p.x, y: p.y };
        }
    }
    socket(name: string): { x: number; y: number } | null {
        const s = this.rig.sockets?.[name]; if (!s) return null;
        const m = this.world[s.bone]; if (!m) return null;
        return { x: m.x + m.a * s.x + m.c * s.y, y: m.y + m.b * s.x + m.d * s.y };
    }
}
