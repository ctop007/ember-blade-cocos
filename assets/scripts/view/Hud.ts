/** Battle HUD: bars, combo, mission, pause, joystick, fan of action buttons. Built in code. */
import { Node, Sprite, Label, Graphics, Color, Vec2, view, sys, UIOpacity } from 'cc';
import { node, sprite, label, gfxNode, hex, size, opacity, roundRect } from './UiKit';
import { BtnRef, InputHost } from './TouchInput';
import type { World } from '../core/world';

interface SkillBtn { id: string; node: Node; r: number; hitR: number; icon: Sprite; cd: Graphics; cdLbl: Label; cost: Label | null; glow: Node | null; frameN: Node; base: number; }

/** Layout spec: _shared/UI_LAYOUT.md (CSS px, top-left origin). Design space = CSS * k, k = 720 / CSS height. */
export class Hud implements InputHost {
    root: Node;
    halfW = 640; halfH = 360; safeL = 0; safeR = 0;
    joyRadius = 90; joyDead = 0.15;
    k = 1; Wc = 844; Hc = 390; insL = 0; insR = 0; insT = 0; insB = 0;
    private btns: SkillBtn[] = [];
    private btnMap: { [id: string]: SkillBtn } = {};
    private hpFill!: Graphics; private mpFill!: Graphics; private rageFill!: Graphics;
    private hpLbl!: Label; private mpLbl!: Label; private demoLbl!: Label;
    private comboN!: Node; private comboLbl!: Label; private comboDmg!: Label; private comboPop = 0; private comboShown = 0;
    private mission!: Label; private waveLbl!: Label;
    private bossBar!: Node; private bossFill!: Graphics; private bossName!: Label;
    private joyBase!: Node; private joyKnob!: Node;
    pauseBtn!: Node;
    private ultPct!: Label;
    private hpShown = 1; private hpLag = 1;

    constructor(parent: Node, private cfg: any) {
        this.root = node('Hud', parent);
        const vs = view.getVisibleSize();
        this.halfW = vs.width / 2; this.halfH = vs.height / 2;
        this.computeSafe(vs);
        this.joyRadius = this.S(44); this.joyDead = cfg.ui.joystickDeadzone;
        this.build();
    }

    /** CSS px -> design units (sizes) or centered-screen coords (positions). */
    S(v: number) { return v * this.k; }
    X(x: number) { return x * this.k - this.halfW; }
    Y(y: number) { return this.halfH - y * this.k; }

    get Lc() { return Math.max(12, this.insL); }
    get Rc() { return this.Wc - Math.max(12, this.insR); }
    get Tc() { return Math.max(10, this.insT); }
    get Bc() { return this.Hc - Math.max(10, this.insB); }

    private computeSafe(vs: any) {
        try {
            const fs = view.getFrameSize();
            this.Wc = fs.width > 1 ? fs.width : vs.width; this.Hc = fs.height > 1 ? fs.height : vs.height;
        } catch (e) { this.Wc = vs.width; this.Hc = vs.height; }
        this.k = 720 / Math.max(1, this.Hc);
        try {
            const r = sys.getSafeAreaRect(); // design units
            this.insL = Math.max(0, r.x) / this.k; this.insR = Math.max(0, vs.width - r.x - r.width) / this.k;
            this.insT = Math.max(0, r.y) / this.k; this.insB = Math.max(0, vs.height - r.y - r.height) / this.k;
        } catch (e) { this.insL = this.insR = this.insT = this.insB = 0; }
        this.safeL = this.S(Math.max(12, this.insL)); this.safeR = this.S(Math.max(12, this.insR));
    }

    get L() { return this.X(this.Lc); }
    get R() { return this.X(this.Rc); }
    get T() { return this.Y(this.Tc); }
    get B() { return this.Y(this.Bc); }

    private build() {
        const Lc = this.Lc, Tc = this.Tc, Rc = this.Rc, Bc = this.Bc;
        // ---- top-left: full avatar + compact HP/MP ----
        const av = sprite('ui/avatar', this.root, this.S(44), this.S(44)); av.node.setPosition(this.X(Lc + 22), this.Y(Tc + 22));
        const mkBar = (x: number, y: number, w: number, h: number, col: string): [Graphics, Graphics] => {
            const bx = this.X(x), by = this.Y(y), bw = this.S(w), bh = this.S(h);
            // frame art first (nine-slice, 24px sides per asset spec), then dark inset, then tintable fill
            const fr = sprite('ui/bar_frame', this.root, bw + this.S(4), bh + this.S(4));
            fr.node.setPosition(bx + bw / 2, by);
            try { const f = fr.spriteFrame!; if (f.insetLeft === 0) { f.insetLeft = 24; f.insetRight = 24; f.insetTop = 16; f.insetBottom = 16; } fr.type = Sprite.Type.SLICED; } catch (e) { /* keep CUSTOM */ }
            const bg = gfxNode(this.root, 'barbg'); bg.node.setPosition(bx, by);
            roundRect(bg, 0, -bh / 2, bw, bh, bh / 2, hex('#140a12', 220));
            const fill = gfxNode(this.root, 'bar'); fill.node.setPosition(bx + this.S(2), by);
            (fill as any)._w = bw - this.S(4); (fill as any)._h = Math.max(2, bh - this.S(4)); (fill as any)._col = hex(col);
            return [bg, fill];
        };
        this.hpFill = mkBar(Lc + 52, Tc + 14, 125, 12, '#e8443a')[1];
        this.mpFill = mkBar(Lc + 52, Tc + 30, 110, 10, '#3a9aff')[1];
        this.hpLbl = label('', this.root, this.X(Lc + 52 + 62), this.Y(Tc + 14), { size: this.S(10), outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)) });
        this.mpLbl = label('', this.root, this.X(Lc + 52 + 55), this.Y(Tc + 30), { size: this.S(9), outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)) });
        // ---- combo ----
        this.comboN = node('combo', this.root, this.X(Lc + 10), this.Y(Tc + 68));
        this.comboLbl = label('', this.comboN, 0, 0, { size: this.S(26), color: '#ffd36a', outline: '#5a1a0a', outlineW: Math.max(2, this.S(3)), align: 'left' });
        this.comboDmg = label('', this.comboN, this.S(2), -this.S(20), { size: this.S(11), color: '#ffe8c8', outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)), align: 'left' });
        this.comboN.active = false;
        // ---- top-center: mission + wave ----
        this.mission = label('', this.root, 0, this.Y(Tc + 12), { size: this.S(13), color: '#fff0d0', outline: '#1a0f14', outlineW: Math.max(1, this.S(2)) });
        this.waveLbl = label('', this.root, 0, this.Y(Tc + 28), { size: this.S(10), color: '#ffb46a', outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)) });
        // ---- boss bar ----
        this.bossBar = node('bossbar', this.root, 0, this.Y(Tc + 46));
        const bb = gfxNode(this.bossBar); const bw = this.S(260), bh = this.S(10);
        roundRect(bb, -bw / 2, -bh / 2, bw, bh, bh / 2, hex('#140a12', 230), hex('#ff7a3a'), Math.max(1, this.S(1.5)));
        this.bossFill = gfxNode(this.bossBar);
        this.bossName = label('灰烬骑士', this.bossBar, 0, this.S(12), { size: this.S(10), color: '#ffcfa0', outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)) });
        this.bossBar.active = false;
        // ---- top-right: pause + fixed brand text ----
        this.pauseBtn = node('pause', this.root, this.X(Rc - 22), this.Y(Tc + 22));
        size(this.pauseBtn, this.S(44), this.S(44));
        sprite('ui/btn_pause', this.pauseBtn, this.S(32), this.S(32));
        this.demoLbl = label('乃秀游戏 Demo', this.root, this.X(Rc - 46), this.Y(Tc + 22), { size: this.S(12), color: '#ffe6c8', outline: '#1a0f14', outlineW: Math.max(1, this.S(2)), align: 'right' });
        void this.demoLbl;
        // ---- joystick (dynamic) ----
        this.joyBase = sprite('ui/joystick_base', this.root, this.S(92), this.S(92)).node;
        this.joyKnob = sprite('ui/joystick_knob', this.joyBase, this.S(38), this.S(38)).node;
        this.joyIdle();
        // ---- action buttons (UI_LAYOUT.md §2) ----
        const sk = this.cfg.skills;
        this.addBtn('attack', 'ui/btn_attack', Rc - 40, Bc - 40, 34, 36, null, false);
        this.addBtn('dodge', 'ui/btn_dodge', Rc - 122, Bc - 27, 21, 23, null, false);
        this.addBtn('jump', 'ui/btn_jump', Rc - 28, Bc - 119, 21, 23, null, false);
        this.addBtn('skill1', 'ui/icon_skill1', Rc - 110, Bc - 85, 22, 23, sk.crescent.mp, true);
        this.addBtn('skill2', 'ui/icon_skill2', Rc - 88, Bc - 142, 22, 23, sk.skyfall.mp, true);
        this.addBtn('skill3', 'ui/icon_skill3', Rc - 30, Bc - 179, 22, 23, sk.meteorSpear.mp, true);
        this.addBtn('ult', 'ui/icon_ult', Rc - 176, Bc - 95, 25, 26, null, true, true);
    }

    private addBtn(id: string, key: string, xc: number, yc: number, rc: number, hitC: number, cost: number | null, framed: boolean, ult = false) {
        const r = this.S(rc), hitR = this.S(hitC);
        const n = node('btn_' + id, this.root, this.X(xc), this.Y(yc));
        size(n, hitR * 2, hitR * 2);
        let glow: Node | null = null;
        if (ult) {
            const gs = sprite('fx/glow', n, r * 2.8, r * 2.8, { additive: true, color: hex('#ffb13a') });
            glow = gs.node; glow.active = false;
        }
        const ic = sprite(key, n, r * 2, r * 2);
        const cd = gfxNode(n, 'cd');
        let frameN = ic.node;
        if (framed) frameN = sprite(ult ? 'ui/btn_ult_frame' : 'ui/btn_frame', n, r * 2 + this.S(10), r * 2 + this.S(10)).node;
        const cdLbl = label('', n, 0, 0, { size: Math.round(r * 0.62), outline: '#1a0f14', outlineW: Math.max(2, this.S(2)) });
        let costL: Label | null = null;
        if (cost !== null) {
            // inside the dial: pills outside collided with the neighbouring button at 667x375
            const pill = gfxNode(n, 'pill'); const pw = this.S(21), ph = this.S(10);
            roundRect(pill, -pw / 2, -r * 0.72 - ph / 2, pw, ph, ph / 2, hex('#10204a', 235), hex('#6ab0ff'), Math.max(1, this.S(1)));
            costL = label(String(cost), n, 0, -r * 0.72, { size: this.S(8), color: '#bfe0ff' });
        }
        if (ult) { this.ultPct = label('0%', n, 0, -r - this.S(7), { size: this.S(9), color: '#ffe08a', outline: '#1a0f14', outlineW: Math.max(1, this.S(1.5)) }); }
        const b: SkillBtn = { id, node: n, r, hitR, icon: ic, cd, cdLbl, cost: costL, glow, frameN, base: 1 };
        this.btns.push(b); this.btnMap[id] = b;
    }

    // ---- InputHost ----
    buttons(): BtnRef[] { return this.btns; }
    toLocal(ux: number, uy: number): Vec2 { return new Vec2(ux - this.halfW, uy - this.halfH); }
    joyRegion(x: number, y: number): boolean { return x < 0 && y < this.Y(this.Tc + 60); }
    joyShow(on: boolean, ox: number, oy: number, kx: number, ky: number) {
        if (!on) { this.joyIdle(); return; }
        opacity(this.joyBase, 255);
        this.joyBase.setPosition(ox, oy);
        this.joyKnob.setPosition(kx, ky);
    }
    private joyIdle() {
        this.joyBase.setPosition(this.X(this.Lc + 58), this.Y(this.Bc - 58));
        this.joyKnob.setPosition(0, 0);
        opacity(this.joyBase, 110);
    }
    btnVisual(id: string, down: boolean) {
        const b = this.btnMap[id]; if (!b) return;
        b.base = down ? 0.88 : 1;
        b.node.setScale(b.base, b.base);
    }
    button(id: string): Node | null { return this.btnMap[id] ? this.btnMap[id].node : null; }

    // ---- per-frame ----
    private drawBar(g: Graphics, frac: number, col?: Color) {
        const w = (g as any)._w, h = (g as any)._h;
        g.clear();
        if (frac <= 0) return;
        roundRect(g, 0, -h / 2, Math.max(h, w * frac), h, h / 2, col || (g as any)._col);
        g.fillColor = new Color(255, 255, 255, 60); g.roundRect(0, 0, Math.max(h, w * frac), h / 2 - 1, h / 4); g.fill();
    }

    update(w: World, dt: number, t: number) {
        const h = w.hero;
        const hf = Math.max(0, h.hp / h.maxHp);
        this.hpShown = hf;
        this.hpLag = this.hpLag > hf ? Math.max(hf, this.hpLag - dt * 0.5) : hf;
        this.drawBar(this.hpFill, this.hpLag, hex('#ffe0a0'));
        // draw actual hp on top
        const g = this.hpFill, W = (g as any)._w, H = (g as any)._h;
        roundRect(g, 0, -H / 2, Math.max(H, W * hf), H, H / 2, hex(hf < 0.3 ? '#ff2a2a' : '#e8443a'));
        this.drawBar(this.mpFill, h.mp / h.maxMp);
        this.hpLbl.string = `${Math.ceil(h.hp)}/${h.maxHp}`;
        this.mpLbl.string = `${Math.floor(h.mp)}/${h.maxMp}`;
        // combo
        if (w.combo > 0) {
            this.comboN.active = true;
            if (w.combo !== this.comboShown) { this.comboShown = w.combo; this.comboPop = 1; }
            this.comboLbl.string = `${w.combo} 连击`;
            this.comboDmg.string = `伤害 ${w.comboDmg}`;
            this.comboPop = Math.max(0, this.comboPop - dt * 6);
            const big = w.combo >= this.cfg.ui.comboBigAt;
            const s = (big ? 1.25 : 1) + this.comboPop * (big ? 0.45 : 0.25);
            this.comboLbl.node.setScale(s, s);
            const sh = big ? this.comboPop * 4 : 0;
            this.comboLbl.node.setPosition((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
            this.comboLbl.color = big ? hex('#ffef8a') : hex('#ffd36a');
            opacity(this.comboN, Math.min(255, 120 + w.comboT * 200));
        } else { this.comboN.active = false; this.comboShown = 0; }
        // boss
        const boss = w.enemies.find(e => e.type === 'boss' && e.state !== 'dead');
        this.bossBar.active = !!boss && w.phase !== 'bossIntro';
        if (boss) {
            const f = Math.max(0, boss.hp / boss.maxHp);
            this.bossFill.clear();
            roundRect(this.bossFill, -this.S(258), -this.S(3), Math.max(0, this.S(256) * f), this.S(6), this.S(3), hex(boss.enraged ? '#ff2a1a' : '#ff8a3a'));
            this.bossName.string = boss.enraged ? '灰烬骑士 · 狂暴' : '灰烬骑士';
        }
        // buttons
        const sk: any = { skill1: 'crescent', skill2: 'skyfall', skill3: 'meteorSpear' };
        for (const b of this.btns) {
            const name = sk[b.id];
            b.cd.clear(); b.cdLbl.string = '';
            if (name) {
                const S = this.cfg.skills[name];
                const cdMax = S.cooldown * Math.max(0.3, 1 + w.mods.cooldownMul);
                const cd = h.cds[name];
                const noMp = h.mp < S.mp;
                b.icon.color = noMp ? hex('#6a6a7a') : hex('#ffffff');
                if (b.cost) b.cost.color = noMp ? hex('#ff6a6a') : hex('#bfe0ff');
                if (cd > 0) {
                    const f = cd / cdMax;
                    b.cd.fillColor = new Color(10, 6, 14, 170);
                    b.cd.moveTo(0, 0);
                    b.cd.arc(0, 0, b.r, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * f, true);
                    b.cd.close(); b.cd.fill();
                    b.cdLbl.string = cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1);
                }
            } else if (b.id === 'ult') {
                const max = this.cfg.player.maxRage, f = h.rage / max;
                const full = f >= 1;
                this.ultPct.string = full ? '就绪' : `${Math.floor(f * 100)}%`;
                b.icon.color = full ? hex('#ffffff') : hex('#8a7a6a');
                if (!full) {
                    b.cd.fillColor = new Color(10, 6, 14, 150);
                    b.cd.moveTo(0, 0); b.cd.arc(0, 0, b.r, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * (1 - f), true); b.cd.close(); b.cd.fill();
                }
                b.cd.lineWidth = Math.max(2, this.S(2.5)); b.cd.strokeColor = hex(full ? '#fff0a0' : '#ffb13a');
                b.cd.arc(0, 0, b.r + 3, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * f, true); b.cd.stroke();
                if (b.glow) {
                    b.glow.active = full;
                    if (full) { const p = 1 + Math.sin(t * 6) * 0.12; b.glow.setScale(p, p); opacity(b.glow, 170 + Math.sin(t * 6) * 60); b.node.setScale(b.base * (1 + Math.sin(t * 6) * 0.04), b.base * (1 + Math.sin(t * 6) * 0.04)); }
                }
            } else if (b.id === 'dodge' && h.dodgeCd > 0) {
                const f = h.dodgeCd / (this.cfg.dodge.cooldown + this.cfg.dodge.duration);
                b.cd.fillColor = new Color(10, 6, 14, 150);
                b.cd.moveTo(0, 0); b.cd.arc(0, 0, b.r, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * f, true); b.cd.close(); b.cd.fill();
            } else if (b.id === 'attack' && (h.state === 'charge')) {
                b.cd.lineWidth = Math.max(2, this.S(3)); b.cd.strokeColor = hex('#fff0a0');
                b.cd.circle(0, 0, b.r + 4 + Math.sin(t * 20) * 2); b.cd.stroke();
            }
        }
    }

    setMission(text: string, wave: string) { this.mission.string = text; this.waveLbl.string = wave; }

    setVisible(on: boolean) { this.root.active = on; }

    flashButton(id: string) {
        const b = this.btnMap[id]; if (!b) return;
        b.node.setScale(1.12, 1.12);
    }
    tickButtons(dt: number) {
        for (const b of this.btns) {
            const s = b.node.scale.x;
            if (b.id !== 'ult' && Math.abs(s - b.base) > 0.001) { const ns = s + (b.base - s) * Math.min(1, dt * 14); b.node.setScale(ns, ns); }
        }
    }
}

export type { UIOpacity };
void size;
