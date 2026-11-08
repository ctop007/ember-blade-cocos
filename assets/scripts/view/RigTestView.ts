/** Debug-only block rig, drawn through Cocos Graphics' triangle tessellator. Never replaces the hero. */
import { Node, Graphics, Color } from 'cc';
import { node, gfxNode, label, rect, hex } from './UiKit';
import { RigPlayer } from '../animation/RigPlayer';
import { testRig, testClips } from '../animation/TestRig';
import { TrailStrip } from '../animation/TrailStrip';
export class RigTestView {
    root: Node; player = new RigPlayer(testRig, testClips); trail = new TrailStrip();
    private g: Graphics; private clock = 0; frozen = false; eventCounts: { [key: string]: number } = {};
    constructor(parent: Node) {
        this.root = node('BlockRigTest', parent, 0, -60);
        rect(this.root, 560, 380, hex('#111422', 240));
        label('骨骼测试 · 方块 / 弹簧 / 枪尖条带', this.root, 0, 155, { size: 20 });
        this.g = gfxNode(this.root); this.player.play('idle');
    }
    update(dt: number) {
        if (this.frozen) return;
        this.clock += dt;
        const attack = this.clock % 2 > 1;
        this.player.play(attack ? 'attack1' : 'idle', attack ? { windup: .12, active: .16, recovery: .56 } : undefined);
        this.player.update(dt);
        for (const e of this.player.events) {
            this.eventCounts[e.name] = (this.eventCounts[e.name] || 0) + 1;
            if (e.name === 'trail_on') this.trail.enabled = true;
            if (e.name === 'trail_off') this.trail.enabled = false;
        }
        this.trail.update(dt, this.player.socket('spearTip'));
        const g = this.g; g.clear();
        const sizes: { [k: string]: number[] } = { body: [45, 65], head: [35, 35], arm: [50, 15], spear: [100, 6], smear: [110, 20], hair: [25, 10] };
        const colors: { [k: string]: string } = { body: '#cc5969', head: '#f6c494', arm: '#ef9550', spear: '#fff1ab', smear: '#ffffff', hair: '#6574ce' };
        const order = testRig.slots.slice().sort((a, b) => this.player.slots[a.name].z - this.player.slots[b.name].z);
        for (const slot of order) {
            const s = this.player.slots[slot.name], m = this.player.world[slot.bone], [w, h] = sizes[s.image];
            g.fillColor = hex(colors[s.image], s.alpha * 255);
            [[0, 0], [w, 0], [w, h], [0, h]].forEach(([x, y], i) => {
                x -= w * slot.pivot[0]; y -= h * slot.pivot[1];
                const xx = m.x + m.a * x + m.c * y, yy = -(m.y + m.b * x + m.d * y) - 60;
                if (!i) g.moveTo(xx, yy); else g.lineTo(xx, yy);
            }); g.close(); g.fill();
        }
        const v = this.trail.vertices, indices = this.trail.indices;
        for (let i = 0; i < indices.length; i += 3) {
            const a = v[indices[i]], b = v[indices[i + 1]], c = v[indices[i + 2]];
            g.fillColor = new Color(255, 180, 80, 160 * (a.alpha + b.alpha + c.alpha) / 3);
            g.moveTo(a.x, -a.y - 60); g.lineTo(b.x, -b.y - 60); g.lineTo(c.x, -c.y - 60); g.close(); g.fill();
        }
    }
}
