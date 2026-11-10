/** Multi-touch input on one full-screen layer: dynamic joystick (left) + HUD buttons (manual hit-test, no stealing). Keyboard for desktop debug. */
import { Node, EventTouch, input, Input, EventKeyboard, KeyCode, Vec2 } from 'cc';
import { InputFrame, emptyInput } from '../core/types';

export interface BtnRef { id: string; node: Node; r: number; hitR?: number; }

export interface InputHost {
    buttons(): BtnRef[];
    toLocal(ux: number, uy: number): Vec2;     // UI location -> centered screen coords
    joyRegion(x: number, y: number): boolean;
    joyShow(on: boolean, ox: number, oy: number, kx: number, ky: number): void;
    btnVisual(id: string, down: boolean): void;
    joyRadius: number; joyDead: number;
}

export class TouchInput {
    enabled = true;
    private joyId = -1; private ox = 0; private oy = 0; private jx = 0; private jy = 0;
    private touchBtn: { [id: number]: string } = {};
    private held: { [b: string]: number } = {};
    private pressed: { [b: string]: boolean } = {};
    private keys: { [k: number]: boolean } = {};

    constructor(private layer: Node, private host: InputHost) {
        layer.on(Node.EventType.TOUCH_START, this.onStart, this);
        layer.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        layer.on(Node.EventType.TOUCH_END, this.onEnd, this);
        layer.on(Node.EventType.TOUCH_CANCEL, this.onEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.onKey, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    destroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKey, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    reset() {
        this.joyId = -1; this.jx = this.jy = 0; this.touchBtn = {}; this.held = {}; this.pressed = {};
        this.host.joyShow(false, 0, 0, 0, 0);
        for (const b of this.host.buttons()) this.host.btnVisual(b.id, false);
    }

    private hitBtn(x: number, y: number): string | null {
        let best: string | null = null, bd = 1e9;
        for (const b of this.host.buttons()) {
            if (!b.node.activeInHierarchy) continue;
            const p = b.node.position;
            const d = Math.hypot(p.x - x, p.y - y);
            if (d <= (b.hitR ?? b.r + 12) && d < bd) { bd = d; best = b.id; }
        }
        return best;
    }

    private onStart(e: EventTouch) {
        if (!this.enabled) return;
        const t = e.touch!; const id = t.getID();
        const u = t.getUILocation(); const p = this.host.toLocal(u.x, u.y);
        const b = this.hitBtn(p.x, p.y);
        if (b) {
            // one finger owns a button: a second finger on the same button is ignored (releasing it must not release the owner)
            if ((this.held[b] || 0) > 0) return;
            this.touchBtn[id] = b;
            this.held[b] = 1;
            this.pressed[b] = true;
            this.host.btnVisual(b, true);
            return;
        }
        if (this.joyId < 0 && this.host.joyRegion(p.x, p.y)) {
            this.joyId = id; this.ox = p.x; this.oy = p.y; this.jx = this.jy = 0;
            this.host.joyShow(true, this.ox, this.oy, 0, 0);
        }
    }

    private onMove(e: EventTouch) {
        const t = e.touch!; const id = t.getID();
        if (id !== this.joyId) return;
        const u = t.getUILocation(); const p = this.host.toLocal(u.x, u.y);
        let dx = p.x - this.ox, dy = p.y - this.oy;
        const R = this.host.joyRadius, d = Math.hypot(dx, dy);
        if (d > R) {
            // drag the base along so the stick stays responsive
            const over = d - R;
            this.ox += dx / d * over; this.oy += dy / d * over;
            dx = p.x - this.ox; dy = p.y - this.oy;
        }
        this.jx = dx / R; this.jy = dy / R;
        this.host.joyShow(true, this.ox, this.oy, dx, dy);
    }

    private onEnd(e: EventTouch) {
        const t = e.touch!; const id = t.getID();
        if (id === this.joyId) { this.joyId = -1; this.jx = this.jy = 0; this.host.joyShow(false, 0, 0, 0, 0); }
        const b = this.touchBtn[id];
        if (b) {
            delete this.touchBtn[id];
            this.held[b] = 0;
            this.host.btnVisual(b, false);
        }
    }

    private static KEYMAP: { [k: number]: string } = {
        [KeyCode.KEY_J]: 'attack', [KeyCode.KEY_K]: 'jump', [KeyCode.KEY_L]: 'dodge',
        [KeyCode.KEY_U]: 'skill1', [KeyCode.KEY_I]: 'skill2', [KeyCode.KEY_O]: 'skill3', [KeyCode.KEY_P]: 'ult',
    };

    private onKey(e: EventKeyboard) {
        if (this.keys[e.keyCode]) return;
        this.keys[e.keyCode] = true;
        const b = TouchInput.KEYMAP[e.keyCode];
        if (b && this.enabled) { this.pressed[b] = true; this.held[b] = (this.held[b] || 0) + 1; this.host.btnVisual(b, true); }
    }

    private onKeyUp(e: EventKeyboard) {
        this.keys[e.keyCode] = false;
        const b = TouchInput.KEYMAP[e.keyCode];
        if (b) { this.held[b] = Math.max(0, (this.held[b] || 0) - 1); if (!this.held[b]) this.host.btnVisual(b, false); }
    }

    /** Build one input frame and clear edge-triggered presses. Core y is down, screen y is up. */
    frame(): InputFrame {
        const f = emptyInput();
        let mx = this.jx, my = -this.jy;
        const K = this.keys;
        if (K[KeyCode.KEY_A] || K[KeyCode.ARROW_LEFT]) mx -= 1;
        if (K[KeyCode.KEY_D] || K[KeyCode.ARROW_RIGHT]) mx += 1;
        if (K[KeyCode.KEY_W] || K[KeyCode.ARROW_UP]) my -= 1;
        if (K[KeyCode.KEY_S] || K[KeyCode.ARROW_DOWN]) my += 1;
        const l = Math.hypot(mx, my);
        if (l > 1) { mx /= l; my /= l; }
        if (l < this.host.joyDead) { mx = 0; my = 0; }
        f.mx = mx; f.my = my;
        if (this.enabled) {
            f.attackHeld = (this.held['attack'] || 0) > 0;
            f.attackPressed = !!this.pressed['attack'];
            f.jumpPressed = !!this.pressed['jump'];
            f.dodgePressed = !!this.pressed['dodge'];
            f.skill1 = !!this.pressed['skill1']; f.skill2 = !!this.pressed['skill2']; f.skill3 = !!this.pressed['skill3'];
            f.ult = !!this.pressed['ult'];
        }
        this.pressed = {};
        return f;
    }
}
