/** Battle HUD: bars, combo, mission, pause, joystick, fan of action buttons. Built in code. */
import { Node, Sprite, Label, Graphics, Color, Vec2, view, sys, UIOpacity } from 'cc';
import { node, sprite, label, gfxNode, hex, size, opacity, roundRect } from './UiKit';
import { BtnRef, InputHost } from './TouchInput';
import type { World } from '../core/world';

interface SkillBtn { id: string; node: Node; r: number; icon: Sprite; cd: Graphics; cdLbl: Label; cost: Label | null; glow: Node | null; frameN: Node; base: number; }

export class Hud implements InputHost {
    root: Node;
    halfW = 640; halfH = 360; safeL = 0; safeR = 0;
    joyRadius = 90; joyDead = 0.15;
    private btns: SkillBtn[] = [];
    private btnMap: { [id: string]: SkillBtn } = {};
    private hpFill!: Graphics; private mpFill!: Graphics; private rageFill!: Graphics;
    private hpLbl!: Label; private mpLbl!: Label;
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
        this.joyRadius = cfg.ui.joystickRadius; this.joyDead = cfg.ui.joystickDeadzone;
        this.computeSafe(vs.width);
        this.build();
    }

    private computeSafe(vw: number) {
        try {
            const r = sys.getSafeAreaRect();
            this.safeL = Math.max(0, r.x); this.safeR = Math.max(0, vw - (r.x + r.width));
        } catch (e) { this.safeL = this.safeR = 0; }
        this.safeL = Math.min(60, this.safeL); this.safeR = Math.min(60, this.safeR);
    }

    get L() { return -this.halfW + 16 + this.safeL; }
    get R() { return this.halfW - 16 - this.safeR; }
    get T() { return this.halfH - 12; }
    get B() { return -this.halfH + 12; }

    private build() {
        const L = this.L, T = this.T, R = this.R, B = this.B;
        // ---- top-left: avatar + bars ----
        const av = sprite('ui/avatar', this.root, 84, 84); av.node.setPosition(L + 42, T - 44);
        const barX = L + 92;
        const mkBar = (y: number, w: number, h: number, col: string): [Graphics, Graphics] => {
            const bg = gfxNode(this.root, 'barbg'); bg.node.setPosition(barX, y);
            roundRect(bg, 0, -h / 2, w, h, h / 2, hex('#140a12', 220), hex('#1a0f14'), 3);
            const fill = gfxNode(this.root, 'bar'); fill.node.setPosition(barX + 3, y);
            (fill as any)._w = w - 6; (fill as any)._h = h - 6; (fill as any)._col = hex(col);
            return [bg, fill];
        };
        this.hpFill = mkBar(T - 26, 230, 22, '#e8443a')[1];
        this.mpFill = mkBar(T - 50, 190, 16, '#3a9aff')[1];
        this.hpLbl = label('', this.root, barX + 115, T - 26, { size: 16, outline: '#1a0f14', outlineW: 2 });
        this.mpLbl = label('', this.root, barX + 95, T - 50, { size: 13, outline: '#1a0f14', outlineW: 2 });
        // ---- combo ----
        this.comboN = node('combo', this.root, L + 30, T - 130);
        this.comboLbl = label('', this.comboN, 0, 0, { size: 40, color: '#ffd36a', outline: '#5a1a0a', outlineW: 4, align: 'left' });
        this.comboDmg = label('', this.comboN, 2, -32, { size: 15, color: '#ffe8c8', outline: '#1a0f14', outlineW: 2, align: 'left' });
        this.comboN.active = false;
        // ---- top-center: mission + wave ----
        this.mission = label('', this.root, 0, T - 22, { size: 22, color: '#fff0d0', outline: '#1a0f14', outlineW: 3 });
        this.waveLbl = label('', this.root, 0, T - 50, { size: 16, color: '#ffb46a', outline: '#1a0f14', outlineW: 2 });
        // ---- boss bar ----
        this.bossBar = node('bossbar', this.root, 0, T - 82);
        const bb = gfxNode(this.bossBar); roundRect(bb, -260, -9, 520, 18, 9, hex('#140a12', 230), hex('#ff7a3a'), 2);
        this.bossFill = gfxNode(this.bossBar);
        this.bossName = label('灰烬骑士', this.bossBar, 0, 20, { size: 15, color: '#ffcfa0', outline: '#1a0f14', outlineW: 2 });
        this.bossBar.active = false;
        // ---- pause ----
        this.pauseBtn = sprite('ui/btn_pause', this.root, 56, 56).node; this.pauseBtn.setPosition(R - 30, T - 32);
        // ---- joystick (dynamic) ----
        this.joyBase = sprite('ui/joystick_base', this.root, this.joyRadius * 2.2, this.joyRadius * 2.2).node;
        this.joyKnob = sprite('ui/joystick_knob', this.joyBase, 76, 76).node;
        this.joyIdle();
        // ---- action buttons ----
        const ax = R - 92, ay = B + 92;
        const sk = this.cfg.skills;
        this.addBtn('attack', 'ui/btn_attack', ax, ay, 76, null, false);
        this.addBtn('dodge', 'ui/btn_dodge', ax - 150, ay - 40, 40, null, false);
        this.addBtn('skill1', 'ui/icon_skill1', ax - 150, ay + 62, 42, sk.crescent.mp, true);
        this.addBtn('skill2', 'ui/icon_skill2', ax - 98, ay + 152, 42, sk.skyfall.mp, true);
        this.addBtn('skill3', 'ui/icon_skill3', ax - 4, ay + 192, 42, sk.meteorSpear.mp, true);
        this.addBtn('jump', 'ui/btn_jump', ax + 46, ay + 118, 36, null, false);
        this.addBtn('ult', 'ui/icon_ult', ax - 256, ay + 128, 50, null, true, true);
    }

    private addBtn(id: string, key: string, x: number, y: number, r: number, cost: number | null, framed: boolean, ult = false) {
        const n = node('btn_' + id, this.root, x, y);
        let glow: Node | null = null;
        if (ult) {
            const gs = sprite('fx/glow', n, r * 3.2, r * 3.2, { additive: true, color: hex('#ffb13a') });
            glow = gs.node; glow.active = false;
        }
        const ic = sprite(key, n, r * 2, r * 2);
        const cd = gfxNode(n, 'cd');
        let frameN = ic.node;
        if (framed) frameN = sprite(ult ? 'ui/btn_ult_frame' : 'ui/btn_frame', n, r * 2 + 10, r * 2 + 10).node;
        const cdLbl = label('', n, 0, 0, { size: Math.round(r * 0.6), outline: '#1a0f14', outlineW: 3 });
        let costL: Label | null = null;
        if (cost !== null) {
            const pill = gfxNode(n, 'pill'); roundRect(pill, -20, -r - 12, 40, 18, 9, hex('#10204a', 230), hex('#6ab0ff'), 2);
            costL = label(String(cost), n, 0, -r - 3, { size: 13, color: '#bfe0ff' });
        }
        if (ult) { this.ultPct = label('0%', n, 0, -r - 6, { size: 15, color: '#ffe08a', outline: '#1a0f14', outlineW: 2 }); }
        const b: SkillBtn = { id, node: n, r, icon: ic, cd, cdLbl, cost: costL, glow, frameN, base: 1 };
        this.btns.push(b); this.btnMap[id] = b;
    }

    // ---- InputHost ----
    buttons(): BtnRef[] { return this.btns; }
    toLocal(ux: number, uy: number): Vec2 { return new Vec2(ux - this.halfW, uy - this.halfH); }
    joyRegion(x: number, y: number): boolean { return x < 0 && y < this.T - 150; }
    joyShow(on: boolean, ox: number, oy: number, kx: number, ky: number) {
        if (!on) { this.joyIdle(); return; }
        opacity(this.joyBase, 255);
        this.joyBase.setPosition(ox, oy);
        this.joyKnob.setPosition(kx, ky);
    }
    private joyIdle() {
        const R = this.joyRadius;
        this.joyBase.setPosition(this.L + R + 40, this.B + R + 30);
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
            roundRect(this.bossFill, -257, -6, 514 * f, 12, 6, hex(boss.enraged ? '#ff2a1a' : '#ff8a3a'));
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
                b.cd.lineWidth = 5; b.cd.strokeColor = hex(full ? '#fff0a0' : '#ffb13a');
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
                b.cd.lineWidth = 6; b.cd.strokeColor = hex('#fff0a0');
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
