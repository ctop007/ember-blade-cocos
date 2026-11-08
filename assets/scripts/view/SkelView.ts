/** Hero rendered from the shared skeletal rig (ANIMATION.md v1). Rig space is y-down, clockwise degrees. */
import { Node, Sprite, Graphics, Color, UITransform } from 'cc';
import { node, gfxNode, hex, opacity } from './UiKit';
import { Assets } from './Assets';
import { RigPlayer, Rig } from '../animation/RigPlayer';
import { HeroAnimation } from '../animation/HeroAnimation';
import type { Hero } from '../core/types';

interface SlotView { name: string; bone: string; n: Node; sp: Sprite; op: any; img: string; z: number; }

export class SkelView {
    static enabled = true;
    root: Node; player: RigPlayer; anim: HeroAnimation; trailG: Graphics; ds: number; rootOp: any;
    slots: SlotView[] = [];
    private order = '';
    constructor(parent: Node, cfg: any) {
        this.root = node('HeroRig', parent);
        const rig = Assets.heroRig as Rig;
        this.player = new RigPlayer(rig, Assets.heroAnims);
        this.anim = new HeroAnimation(this.player, cfg);
        this.ds = rig.displayScale ?? .6;
        this.root.setScale(this.ds, this.ds, 1);
        this.anim.trail.width = 26;
        this.rootOp = opacity(this.root, 255);
        for (const sl of rig.slots) {
            const n = node(sl.name, this.root);
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.trim = false;
            const key = String(sl.image).replace(/\.png$/, ''), f = Assets.heroParts[key];
            if (f) sp.spriteFrame = f;
            const ut = n.getComponent(UITransform)!;
            ut.setContentSize(f ? f.rect.width : 32, f ? f.rect.height : 32);
            ut.setAnchorPoint(sl.pivot[0], 1 - sl.pivot[1]);
            this.slots.push({ name: sl.name, bone: sl.bone, n, sp, op: opacity(n, 255), img: key, z: sl.z });
        }
        this.trailG = gfxNode(this.root, 'trail');
        this.player.play('idle');
    }
    private P(x: number, y: number): [number, number] { return [x, -y]; }
    update(h: Hero, dt: number, frozen: boolean) {
        if (dt > 0 && !frozen) this.anim.update(h, dt, h.face, true);
        this.root.setScale(this.ds * h.face, this.ds, 1); // dt=0 on hitstop: pose, springs and ribbon all hold
        for (const sv of this.slots) {
            const m = this.player.world[sv.bone], st = this.player.slots[sv.name];
            if (!m) continue;
            if (st && st.image !== sv.img) {
                const key = String(st.image).replace(/\.png$/, ''), f = Assets.heroParts[key];
                if (f) { sv.img = key; sv.sp.spriteFrame = f; const ut = sv.n.getComponent(UITransform)!; ut.setContentSize(f.rect.width, f.rect.height); }
            }
            const [px, py] = this.P(m.x, m.y);
            sv.n.setPosition(px, py, 0);
            sv.n.angle = -Math.atan2(m.b, m.a) * 180 / Math.PI;
            const sx = Math.hypot(m.a, m.b) || 1e-4, det = m.a * m.d - m.b * m.c;
            sv.n.setScale(sx, (Math.hypot(m.c, m.d) || 1e-4) * (det < 0 ? -1 : 1), 1);
            sv.op.opacity = Math.max(0, Math.min(255, (st ? st.alpha : 1) * 255));
            sv.z = st ? st.z : sv.z;
            sv.sp.color = h.flashT > 0 ? hex('#ffd0d0') : hex('#ffffff');
        }
        const sorted = this.slots.slice().sort((a, b) => a.z - b.z);
        const key = sorted.map(s => s.name).join(',');
        if (key !== this.order) { this.order = key; this.slots = sorted; for (let i = 0; i < sorted.length; i++) sorted[i].n.setSiblingIndex(i); }
        this.trailG.node.setSiblingIndex(this.slots.length);
        const g = this.trailG; g.clear();
        const v = this.anim.trail.vertices, idx = this.anim.trail.indices;
        for (let i = 0; i < idx.length; i += 3) {
            const a = v[idx[i]], b = v[idx[i + 1]], c = v[idx[i + 2]];
            g.fillColor = new Color(255, 214, 150, 170 * (a.alpha + b.alpha + c.alpha) / 3);
            g.moveTo(...this.P(a.x, a.y)); g.lineTo(...this.P(b.x, b.y)); g.lineTo(...this.P(c.x, c.y));
            g.close(); g.fill();
        }
    }
}
