/** Battle rendering: parallax bg, entity sprites (pose swap + procedural tween), y-sort, camera, shake, damage numbers. */
import { Node, Sprite, Label, Color, view, UIOpacity } from 'cc';
import { node, sprite, setFrame, label, opacity, hex, rect, gfxNode, anchor } from './UiKit';
import { Assets } from './Assets';
import { Fx, ny } from './Fx';
import type { World } from '../core/world';
import { Enemy, Hero } from '../core/types';

export class EntView {
    root: Node; body: Sprite; flash: Sprite; shadow: Node; hpBar: Node | null = null; hpG: any = null;
    pose = ''; who: string; ds: number; shadowW: number; lastX = 0; lastY = 0; moving = false; spawnT = 0;
    tintBase = hex('#ffffff'); hpShowT = 0; extra = 1; hitPop = 0;
    constructor(public v: BattleView, who: string, parent: Node, shadowParent: Node, idle: string) {
        this.who = who;
        this.root = node(who, parent);
        const key = `chars/${who}/${idle}`;
        this.ds = Assets.displayScale(key);
        const [w, h] = Assets.size(key);
        this.body = sprite(key, this.root, w * this.ds, h * this.ds);
        this.flash = sprite(key, this.body.node, w * this.ds, h * this.ds, { additive: true });
        this.flash.node.setPosition(0, 0); opacity(this.flash.node, 0);
        const sk = `chars/${who}/shadow`;
        const [sw, sh] = Assets.size(sk);
        this.shadowW = sw * this.ds;
        this.shadow = sprite(sk, shadowParent, sw * this.ds, sh * this.ds).node;
        this.pose = idle;
    }
    setPose(p: string) {
        if (p === this.pose) return;
        this.pose = p;
        const key = `chars/${this.who}/${p}`;
        setFrame(this.body, key); setFrame(this.flash, key);
    }
    destroy() { this.root.destroy(); this.shadow.destroy(); }
}

export class BattleView {
    root: Node; world: Node; overlay: Node;
    bgLayers: { n: Node; par: number; tiles: Node[]; tw: number; y: number }[] = [];
    groundFx: Node; shadows: Node; ents: Node; fxTop: Node; numbers: Node;
    fx: Fx;
    hero!: EntView;
    enemies: { [id: number]: EntView } = {};
    projs: { [id: number]: { n: Node; kind: string; data?: any } } = {};
    zoneViews: { [id: number]: any } = {};
    camX = 640; camY = 0; shakeT = 0; shakeA = 0; shakeX = 0; shakeY = 0;
    halfW = 640; halfH = 360;
    dim: Node; dimOp: UIOpacity; flashN: Node; flashOp: UIOpacity; flashA = 0; dimTarget = 0; dimA = 0;
    numPool: Label[] = []; nums: { l: Label; t: number; life: number; x: number; y: number; z: number; vz: number; big: number; op: UIOpacity }[] = [];
    heroTrail = 0;

    constructor(parent: Node, public cfg: any) {
        const vs = view.getVisibleSize();
        this.halfW = vs.width / 2; this.halfH = vs.height / 2;
        this.root = node('Battle', parent);
        this.world = node('World', this.root);
        // parallax bg
        this.addBg('bg/far', 0.15, 0); this.addBg('bg/mid', 0.45, 0); this.addBg('bg/ground', 1.0, 360);
        this.groundFx = node('groundFx', this.world);
        this.shadows = node('shadows', this.world);
        this.ents = node('ents', this.world);
        this.fxTop = node('fxTop', this.world);
        this.addBg('bg/foreground', 1.25, 520, 1, Assets.isReal('bg/foreground') ? 230 : 150);
        this.numbers = node('numbers', this.world);
        this.fx = new Fx(this.fxTop, this.groundFx);
        this.fx.max = cfg.combat.maxParticles || 260;
        this.overlay = node('Overlay', this.root);
        this.dim = rect(this.overlay, vs.width + 40, vs.height + 40, hex('#05030a')).node; this.dimOp = opacity(this.dim, 0);
        this.flashN = rect(this.overlay, vs.width + 40, vs.height + 40, hex('#ffffff')).node; this.flashOp = opacity(this.flashN, 0);
        this.hero = new EntView(this, 'hero', this.ents, this.shadows, 'idle');
    }

    private addBg(key: string, par: number, y: number, sc = 1, alpha = 255) {
        const [tw0, th] = Assets.size(key);
        const tw = tw0 * sc;
        const n = node(key, this.world);
        const tiles: Node[] = [];
        const need = Math.ceil((this.halfW * 2) / tw) + 1;
        for (let i = 0; i < need + 1; i++) {
            const s = sprite(key, n, tw, th * sc, { anchorKey: false });
            anchor(s.node, 0, 1);
            if (alpha < 255) opacity(s.node, alpha);
            tiles.push(s.node);
        }
        this.bgLayers.push({ n, par, tiles, tw, y });
    }

    reset() {
        for (const id in this.enemies) this.enemies[id].destroy();
        this.enemies = {};
        for (const id in this.projs) this.projs[id].n.destroy();
        this.projs = {};
        for (const id in this.zoneViews) { const z = this.zoneViews[id]; if (z && z.n && z.n.isValid) z.n.destroy(); }
        this.zoneViews = {};
        this.fx.clear();
        for (const n of this.nums) n.l.node.active = false;
        this.numPool.push(...this.nums.map(n => n.l)); this.nums = [];
        this.dimTarget = 0; this.dimA = 0; this.flashA = 0; this.shakeT = 0;
    }

    // ---------------- camera ----------------
    shake(a: number) {
        const m = this.cfg.combat.shakeMax;
        this.shakeA = Math.min(m, Math.max(this.shakeT > 0 ? this.shakeA : 0, a));
        this.shakeT = this.cfg.combat.shakeDecay;
    }
    flash(a: number) { this.flashA = Math.max(this.flashA, a); }
    setDim(a: number) { this.dimTarget = a; }

    updateCamera(w: World, dt: number) {
        const h = w.hero, W = this.cfg.world;
        let tx = h.x + h.face * (W.cameraLookAhead || 0);
        const lo = w.arenaL + this.halfW, hi = Math.max(lo, (w.phase === 'advance' ? w.targetR : w.arenaR) - this.halfW);
        if (hi - lo < 0) tx = (w.arenaL + w.arenaR) / 2; else tx = Math.max(lo, Math.min(hi, tx));
        if (w.arenaR - w.arenaL < this.halfW * 2) tx = (w.arenaL + w.arenaR) / 2;
        tx = Math.max(this.halfW, Math.min(W.length - this.halfW, tx));
        this.camX += (tx - this.camX) * Math.min(1, dt * (W.cameraLerp || 8));
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            const k = Math.max(0, this.shakeT / this.cfg.combat.shakeDecay);
            this.shakeX = (Math.random() * 2 - 1) * this.shakeA * k;
            this.shakeY = (Math.random() * 2 - 1) * this.shakeA * k;
        } else { this.shakeX = this.shakeY = 0; }
        // world node: node x = core x, node y = 360 - core y + z; screen = node + world offset
        this.world.setPosition(-this.camX + this.shakeX, this.shakeY, 0);
        for (const L of this.bgLayers) {
            const off = this.camX * (1 - L.par);         // layer moves slower: shift by camX*(1-par)
            L.n.setPosition(off, 0, 0);
            const left = this.camX - this.halfW - off;    // visible left edge in layer-local coords
            const start = Math.floor(left / L.tw) * L.tw;
            for (let i = 0; i < L.tiles.length; i++) L.tiles[i].setPosition(start + i * L.tw, ny(L.y), 0);
        }
        // overlays fade
        this.flashA = Math.max(0, this.flashA - dt * 3.2);
        this.flashOp.opacity = Math.min(255, this.flashA * 255);
        this.dimA += (this.dimTarget - this.dimA) * Math.min(1, dt * 8);
        this.dimOp.opacity = Math.min(255, this.dimA * 255);
    }

    /** World (x, y, z) → overlay/screen-centered coords. */
    toScreen(x: number, y: number, z = 0): [number, number] {
        return [x - this.camX + this.shakeX, ny(y, z) + this.shakeY];
    }

    // ---------------- entities ----------------
    sync(w: World, dt: number, frozen: boolean) {
        this.syncHero(w, w.hero, dt, frozen);
        const seen: { [id: number]: boolean } = {};
        for (const e of w.enemies) {
            seen[e.id] = true;
            let v = this.enemies[e.id];
            if (!v) {
                v = new EntView(this, e.type, this.ents, this.shadows, 'idle');
                v.lastX = e.x; v.lastY = e.y;
                if (e.type !== 'boss') { v.hpG = gfxNode(v.root, 'hp'); v.hpBar = v.hpG.node; }
                this.enemies[e.id] = v;
            }
            this.syncEnemy(w, e, v, dt, frozen);
        }
        for (const id in this.enemies) if (!seen[id as any]) { this.enemies[id].destroy(); delete this.enemies[id]; }
        this.ysort();
    }

    private ysort() {
        const ch = this.ents.children.slice();
        const ys = ch.map(n => (n as any)._sortY ?? 0);
        let sorted = true;
        for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1]) { sorted = false; break; }
        if (sorted) return;
        ch.sort((a, b) => ((a as any)._sortY ?? 0) - ((b as any)._sortY ?? 0));
        for (let i = 0; i < ch.length; i++) ch[i].setSiblingIndex(i);
    }

    private placeShadow(v: EntView, x: number, y: number, z: number) {
        const k = Math.max(0.45, 1 - z / 320);
        v.shadow.setPosition(x, ny(y), 0); v.shadow.setScale(k, k);
        opacity(v.shadow, 200 * k);
    }

    private syncHero(w: World, h: Hero, dt: number, frozen: boolean) {
        const v = this.hero, A = this.cfg.attack, t = w.t;
        let pose = 'idle', sx = 1, sy = 1, rot = 0, ox = 0, oz = 0;
        const st = h.st;
        switch (h.state) {
            case 'idle': pose = 'idle'; sy = 1 + Math.sin(t * 3) * 0.02; sx = 1 - Math.sin(t * 3) * 0.01; break;
            case 'run': pose = 'run'; oz = Math.abs(Math.sin(t * 14)) * 6; rot = -5; sy = 1 + Math.sin(t * 28) * 0.03; break;
            case 'attack': {
                const stp = A.steps[h.atkStep]; const u = st / stp.duration;
                pose = 'attack' + (h.atkStep + 1);
                if (st < stp.hitAt) { const k = st / stp.hitAt; sx = 1 - 0.08 * k; sy = 1 + 0.06 * k; ox = -6 * k; }
                else { const k = Math.max(0, 1 - (st - stp.hitAt) / 0.12); sx = 1 + 0.14 * k; sy = 1 - 0.08 * k; ox = 10 * k; }
                if (u > 0.85) pose = 'idle';
                break;
            }
            case 'charge': pose = 'charge'; sx = 0.94; sy = 1.04; ox = (Math.random() - 0.5) * 3; break;
            case 'thrust': pose = 'thrust'; sx = 1.25; sy = 0.86; break;
            case 'thrustRec': pose = 'thrust'; sx = 1.05; sy = 0.97; break;
            case 'dodge': pose = 'dodge'; sx = 1.12; sy = 0.82; rot = -8; break;
            case 'jump': pose = h.vz > 0 ? 'jump' : 'jump'; sy = h.vz > 300 ? 1.1 : 1; sx = h.vz > 300 ? 0.92 : 1; break;
            case 'slam': pose = 'slam'; sx = 0.85; sy = 1.2; break;
            case 'land': { pose = h.slamming ? 'slam' : 'idle'; const k = Math.max(0, 1 - st / 0.14); sx = 1 + 0.2 * k; sy = 1 - 0.18 * k; break; }
            case 'cast':
                if (h.castSkill === 'crescent') { pose = 'attack2'; sx = (Math.floor(st / 0.09) % 2) ? -1 : 1; }
                else pose = 'cast';
                break;
            case 'hurt': pose = 'hurt'; ox = -h.face * 4 * Math.max(0, 1 - st / 0.2); break;
            case 'dead': pose = 'dead'; break;
            case 'ult': pose = 'cast'; oz = Math.min(30, st * 60); break;
        }
        v.setPose(pose);
        if (frozen) ox += (Math.random() - 0.5) * 4;
        v.root.setPosition(h.x + ox * h.face, ny(h.y, h.z + oz), 0);
        v.body.node.setScale(sx * h.face, sy, 1);
        v.body.node.angle = rot * h.face;
        (v.root as any)._sortY = h.y;
        this.placeShadow(v, h.x, h.y, h.z);
        // hurt flash / invuln blink
        const fa = h.flashT > 0 ? 255 : 0;
        opacity(v.flash.node, fa);
        const blink = h.invuln > 0 && h.state !== 'dodge' && h.state !== 'ult' && h.state !== 'thrust' && Math.floor(t * 20) % 2 === 0;
        opacity(v.body.node, blink ? 120 : 255);
        v.body.color = h.state === 'charge' && st > 0.05 ? hex(Math.floor(t * 16) % 2 ? '#ffd0a0' : '#ffffff') : hex('#ffffff');
    }

    private syncEnemy(w: World, e: Enemy, v: EntView, dt: number, frozen: boolean) {
        const t = w.t;
        const dx = e.x - v.lastX, dy = e.y - v.lastY;
        v.moving = Math.hypot(dx, dy) > 0.5 * Math.max(dt * 60, 0.01);
        v.lastX = e.x; v.lastY = e.y;
        let pose = 'idle', sx = 1, sy = 1, rot = 0, ox = 0, oz = 0;
        const move = e.type === 'imp' ? 'run' : e.type === 'lantern' ? 'move' : 'walk';
        switch (e.state) {
            case 'spawn': case 'chase': case 'orbit': pose = v.moving ? move : 'idle'; break;
            case 'idle': pose = v.moving ? move : 'idle'; break;
            case 'windup':
                if (e.type === 'imp' || e.type === 'lantern' || e.type === 'brute') pose = 'windup';
                else pose = e.move === 'sweep' ? 'sweep_windup' : e.move === 'leap' ? 'leap' : 'summon';
                ox = (Math.random() - 0.5) * 3; sx = 0.95; sy = 1.05;
                break;
            case 'attack': pose = e.type === 'lantern' ? 'throw' : e.type === 'boss' ? 'sweep' : 'attack'; sx = 1.1; sy = 0.94; break;
            case 'charge': pose = 'charge'; sx = 1.12; sy = 0.92; rot = -6; break;
            case 'recover': pose = e.type === 'boss' ? (e.move === 'leap' ? 'slam' : e.move === 'sweep' ? 'sweep' : 'idle') : e.type === 'lantern' ? 'throw' : 'idle'; break;
            case 'leapAir': pose = 'leap'; break;
            case 'summon': pose = 'summon'; break;
            case 'intro': pose = 'idle'; break;
            case 'hurt': pose = 'hurt'; ox = -e.face * 3; break;
            case 'dead': pose = 'dead'; break;
        }
        if (e.type === 'lantern' && e.state !== 'dead') oz = 22 + Math.sin(t * 3 + e.id) * 8;
        if (v.moving && e.type === 'imp') oz += Math.abs(Math.sin(t * 16 + e.id)) * 4;
        if (v.moving && (e.type === 'brute' || e.type === 'boss')) sy *= 1 + Math.sin(t * 8 + e.id) * 0.02;
        v.setPose(pose);
        if (frozen && e.flashT > 0) ox += (Math.random() - 0.5) * 6;
        v.hitPop = Math.max(0, v.hitPop - dt * 6);
        const pop = 1 + v.hitPop * 0.12;
        v.root.setPosition(e.x + ox, ny(e.y, e.z + oz), 0);
        v.body.node.setScale(sx * e.face * pop, sy * pop, 1);
        v.body.node.angle = rot * e.face;
        (v.root as any)._sortY = e.y;
        this.placeShadow(v, e.x, e.y, e.z + (e.type === 'lantern' ? oz * 0.5 : 0));
        // flash white on hit
        opacity(v.flash.node, e.flashT > 0 ? 255 : 0);
        // tint
        let col = '#ffffff';
        if (e.type === 'boss' && e.enraged) col = Math.floor(t * 4) % 2 ? '#ff8a7a' : '#ff6a5a';
        if (e.state === 'windup') col = Math.floor(t * 18) % 2 ? '#ffb0a0' : col;
        v.body.color = hex(col);
        // fade in on spawn, fade out on death
        let a = 255;
        if (e.state === 'dead') a = Math.max(0, 255 * (1 - Math.max(0, e.deadT - 0.4) / 0.6));
        opacity(v.body.node, a);
        opacity(v.shadow, (e.state === 'dead' ? a / 255 : 1) * 200);
        if (e.state === 'dead') { v.body.node.angle = -e.face * Math.min(80, e.deadT * 400); }
        // hp bar
        if (v.hpBar) {
            const g = v.hpG; g.clear();
            if (e.hp < e.maxHp && e.state !== 'dead') {
                const [, h0] = Assets.size(`chars/${e.type}/idle`);
                const top = h0 * v.ds * 0.8 + 4;
                const W = e.type === 'brute' ? 70 : 50;
                g.fillColor = new Color(20, 10, 16, 200); g.rect(-W / 2 - 1, top - 1, W + 2, 7); g.fill();
                g.fillColor = hex('#ff4a3a'); g.rect(-W / 2, top, W * Math.max(0, e.hp / e.maxHp), 5); g.fill();
            }
        }
    }

    // ---------------- damage numbers ----------------
    number(x: number, y: number, z: number, text: string, kind: 'normal' | 'crit' | 'hurt' | 'heal' | 'info') {
        let l = this.numPool.pop();
        if (!l) {
            l = label('', this.numbers, 0, 0, { size: 30, outline: '#1a0f14', outlineW: 3 });
        } else l.node.active = true;
        l.string = text;
        const big = kind === 'crit' ? 1.5 : kind === 'info' ? 1.1 : 1;
        l.fontSize = kind === 'crit' ? 40 : kind === 'hurt' ? 32 : kind === 'info' ? 26 : 28;
        l.lineHeight = l.fontSize + 4;
        l.color = kind === 'crit' ? hex('#ffe23a') : kind === 'hurt' ? hex('#ff4a3a') : kind === 'heal' ? hex('#6aff8a') : kind === 'info' ? hex('#ffcf8a') : hex('#ffffff');
        l.outlineColor = kind === 'crit' ? hex('#8a1a0a') : hex('#1a0f14');
        l.outlineWidth = kind === 'crit' ? 4 : 3;
        if (this.nums.length > 40) { const old = this.nums.shift()!; old.l.node.active = false; this.numPool.push(old.l); }
        this.nums.push({ l, t: 0, life: kind === 'crit' ? 0.9 : 0.7, x: x + (Math.random() - 0.5) * 30, y, z: z + 70, vz: kind === 'crit' ? 140 : 110, big, op: opacity(l.node, 255) });
    }

    updateNumbers(dt: number) {
        for (let i = this.nums.length - 1; i >= 0; i--) {
            const n = this.nums[i];
            n.t += dt;
            if (n.t >= n.life) { n.l.node.active = false; this.numPool.push(n.l); this.nums.splice(i, 1); continue; }
            n.z += n.vz * dt; n.vz *= Math.pow(0.02, dt);
            const pop = n.t < 0.08 ? 0.6 + (n.t / 0.08) * 0.8 * n.big : n.big * (1 + Math.max(0, 0.15 - (n.t - 0.08)) * 2);
            n.l.node.setPosition(n.x, ny(n.y, n.z), 0);
            n.l.node.setScale(pop, pop);
            n.op.opacity = n.t > n.life * 0.6 ? 255 * (1 - (n.t - n.life * 0.6) / (n.life * 0.4)) : 255;
        }
    }
}

export type { Sprite };
