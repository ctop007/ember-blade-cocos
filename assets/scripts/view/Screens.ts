/** Code-built screens: loading, home, QR, draft (3-pick), pause, result, banners, ult cut-in. */
import { Node, Label, tween, Vec3, BlockInputEvents, UIOpacity, Color } from 'cc';
import { node, sprite, label, opacity, hex, rect, size, gfxNode, roundRect } from './UiKit';
import { Sfx } from './Sfx';
import type { CardDef } from '../core/cards';

/** Tap handler with press feedback. */
export function onTap(n: Node, cb: () => void) {
    const base = n.scale.x;
    n.on(Node.EventType.TOUCH_START, () => n.setScale(base * 0.92, base * 0.92));
    n.on(Node.EventType.TOUCH_CANCEL, () => n.setScale(base, base));
    n.on(Node.EventType.TOUCH_END, () => { n.setScale(base, base); Sfx.unlock(); Sfx.play('ui_click'); cb(); });
}

export function button(parent: Node, text: string, x: number, y: number, w = 300, h = 96, fs = 34): Node {
    const n = node('btn', parent, x, y);
    size(n, w, h);
    sprite('ui/btn_primary', n, w, h);
    label(text, n, 0, 2, { size: fs, color: '#fff6e0', outline: '#5a1a0a', outlineW: 4 });
    return n;
}

function fade(n: Node, from: number, to: number, t: number, delay = 0): UIOpacity {
    const op = opacity(n, from);
    tween(op).delay(delay).to(t, { opacity: to }).start();
    return op;
}

export class Screens {
    constructor(public root: Node, public halfW: number, public halfH: number) {}

    // ---------------- loading ----------------
    loading(): { set: (p: number, l: string) => void; close: () => void } {
        const n = node('Loading', this.root);
        rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#0c0812'));
        const logo = sprite('ui/logo', n, 560, 210); logo.node.setPosition(0, 70);
        const W = 520;
        const bar = gfxNode(n); roundRect(bar, -W / 2, -150, W, 22, 11, hex('#1a1020'), hex('#e0a060'), 2);
        const fill = gfxNode(n);
        const lbl = label('加载中 0%', n, 0, -186, { size: 20, color: '#ffd8b0' });
        return {
            set: (p, l) => {
                fill.clear(); roundRect(fill, -W / 2 + 3, -147, Math.max(16, (W - 6) * p), 16, 8, hex('#ff8a3a'));
                lbl.string = `${l}  ${Math.round(p * 100)}%`;
            },
            close: () => n.destroy(),
        };
    }

    // ---------------- home ----------------
    home(version: string, onStart: () => void): Node {
        const n = node('Home', this.root);
        const bg = sprite('ui/home_bg', n, Math.max(this.halfW * 2, 1280), Math.max(this.halfH * 2, 720)); void bg;
        rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#000000', 70));
        const logo = sprite('ui/logo', n, 620, 232); logo.node.setPosition(0, 130);
        tween(logo.node).repeatForever(tween().to(1.6, { position: new Vec3(0, 140, 0) }, { easing: 'sineInOut' }).to(1.6, { position: new Vec3(0, 130, 0) }, { easing: 'sineInOut' })).start();
        label('火焰与星光的长枪少女，踏入余烬森林', n, 0, 6, { size: 22, color: '#ffe0c0', outline: '#1a0f14', outlineW: 3 });
        const start = button(n, '开始战斗', 0, -88, 320, 104, 38);
        const join = button(n, '加入交流群', 0, -192, 240, 70, 26);
        // AI notice + version (bottom)
        label('本游戏由 AI 开发，当前为试玩版。欢迎加群提意见！', n, 0, -this.halfH + 46, { size: 17, color: '#d8c0b0', outline: '#1a0f14', outlineW: 2 });
        label(version, n, this.halfW - 20, -this.halfH + 20, { size: 15, color: '#a89080', align: 'right' });
        // input lock briefly so the loading tap can't fall through
        const lock = node('lock', n); size(lock, this.halfW * 2, this.halfH * 2); lock.addComponent(BlockInputEvents);
        setTimeout(() => { if (lock.isValid) lock.destroy(); }, 350);
        onTap(start, onStart);
        onTap(join, () => this.qr());
        fade(n, 0, 255, 0.3);
        return n;
    }

    qr() {
        const n = node('QR', this.root);
        const m = rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#000000', 190)).node; m.addComponent(BlockInputEvents);
        sprite('ui/panel', n, 640, 440);
        label('加入交流群', n, 0, 180, { size: 30, color: '#ffe0b0', outline: '#1a0f14', outlineW: 3 });
        const a = sprite('ui/qr/qr-group', n, 220, 212, { anchorKey: false }); a.node.setPosition(-130, 30);
        const b = sprite('ui/qr/qr-author', n, 220, 216, { anchorKey: false }); b.node.setPosition(130, 30);
        label('交流群', n, -130, -96, { size: 18, color: '#ffd8b0' });
        label('作者微信', n, 130, -96, { size: 18, color: '#ffd8b0' });
        const ok = button(n, '知道了', 0, -160, 220, 72, 28);
        onTap(ok, () => n.destroy());
        n.setScale(0.8, 0.8);
        tween(n).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    // ---------------- banners ----------------
    banner(text: string, sub: string, color = '#ffd36a', dur = 1.4) {
        const n = node('Banner', this.root, 0, 90);
        const bg = sprite('ui/boss_title', n, 900, 140); bg.color = hex('#3a1a0a');
        const t = label(text, n, 0, 10, { size: 52, color, outline: '#1a0f14', outlineW: 5 });
        if (sub) label(sub, n, 0, -36, { size: 22, color: '#ffe8d0', outline: '#1a0f14', outlineW: 3 });
        void t;
        n.setScale(1.4, 1.4);
        const op = opacity(n, 0);
        tween(op).to(0.15, { opacity: 255 }).delay(dur).to(0.3, { opacity: 0 }).call(() => n.destroy()).start();
        tween(n).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    bossTitle(name: string, dur: number) {
        const n = node('BossTitle', this.root);
        const dim = rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#000000')).node; fade(dim, 0, 150, 0.3);
        const band = node('band', n, 0, 40);
        sprite('ui/boss_title', band, this.halfW * 2 + 40, 220);
        const t = label(name, band, 0, 18, { size: 78, color: '#ff8a5a', outline: '#2a0805', outlineW: 6 });
        label('— 余烬森林的守墓者 —', band, 0, -50, { size: 24, color: '#ffd0b0', outline: '#1a0f14', outlineW: 3 });
        band.setPosition(-this.halfW * 2, 40);
        tween(band).to(0.35, { position: new Vec3(0, 40, 0) }, { easing: 'cubicOut' }).delay(Math.max(0.5, dur - 0.8)).to(0.3, { position: new Vec3(this.halfW * 2, 40, 0) }, { easing: 'cubicIn' }).start();
        t.node.setScale(1.3, 1.3); tween(t.node).delay(0.3).to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        const op = opacity(n, 255);
        tween(op).delay(dur - 0.2).to(0.3, { opacity: 0 }).call(() => n.destroy()).start();
    }

    ultCutin(name: string, dur: number) {
        const n = node('UltCutin', this.root);
        const band = sprite('fx/ult_banner', n, this.halfW * 2 + 200, 220, { color: hex('#ff8a3a'), additive: false });
        band.node.setPosition(0, -30);
        const bop = opacity(band.node, 0);
        tween(bop).to(0.12, { opacity: 220 }).start();
        band.node.setScale(0.1, 1); tween(band.node).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' }).start();
        const pt = sprite('fx/ult_portrait', n, 560, 560, { anchorKey: false });
        pt.node.setPosition(-this.halfW - 300, 0);
        tween(pt.node).to(0.22, { position: new Vec3(-this.halfW + 290, 10, 0) }, { easing: 'cubicOut' })
            .to(dur - 0.42, { position: new Vec3(-this.halfW + 320, 10, 0) })
            .to(0.2, { position: new Vec3(-this.halfW - 300, 10, 0) }, { easing: 'cubicIn' }).start();
        const nm = label(name, n, 120, -20, { size: 76, color: '#fff0b0', outline: '#8a2a0a', outlineW: 6 });
        nm.node.setScale(2, 2); const nop = opacity(nm.node, 0);
        tween(nop).delay(0.12).to(0.1, { opacity: 255 }).start();
        tween(nm.node).delay(0.12).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        label('烬刃·灯', n, 120, -88, { size: 26, color: '#ffd8b0', outline: '#1a0f14', outlineW: 3 });
        const op = opacity(n, 255);
        tween(op).delay(dur - 0.15).to(0.2, { opacity: 0 }).call(() => n.destroy()).start();
    }

    // ---------------- draft (3 pick) ----------------
    draft(cards: CardDef[], cfg: any, onPick: (i: number) => void): Node {
        const D = cfg.draft;
        const n = node('Draft', this.root);
        const mask = rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#05030a')).node;
        fade(mask, 0, 200, D.maskFade);
        mask.addComponent(BlockInputEvents);
        const title = label('选择一项强化', n, 0, this.halfH - 52, { size: 34, color: '#ffe0a0', outline: '#1a0f14', outlineW: 4 });
        fade(title.node, 0, 255, 0.25, D.maskFade * 0.5);
        // click-blocking layer during the deal animation
        const lock = node('dealLock', n); size(lock, this.halfW * 2 + 20, this.halfH * 2 + 20); lock.addComponent(BlockInputEvents);
        const CW = Math.min(280, (this.halfW * 2 - 120) / 3), CH = Math.min(392, this.halfH * 2 - 150);
        const gap = CW + Math.min(36, (this.halfW * 2 - CW * 3) / 4);
        const rarName: any = { common: '普通', rare: '稀有', epic: '史诗' };
        const rarCol: any = { common: '#c8d4e8', rare: '#7ab0ff', epic: '#ffcf5a' };
        let tcur = D.maskFade;
        let picked = false;
        const views: Node[] = [];
        cards.forEach((c, i) => {
            const x = (i - (cards.length - 1) / 2) * gap, y = -14;
            const card = node('card' + i, n, x, -this.halfH - CH);
            size(card, CW, CH);
            const back = sprite('ui/card_back', card, CW, CH).node;
            const front = node('front', card);
            const rare = c.rarity !== 'common';
            let glow: Node | null = null;
            if (rare) { glow = sprite('fx/glow', front, CW * 1.7, CH * 1.4, { additive: true, color: hex(rarCol[c.rarity]) }).node; opacity(glow, 0); }
            sprite('ui/card_' + c.rarity, front, CW, CH);
            const tag = gfxNode(front); roundRect(tag, -46, CH / 2 - 62, 92, 30, 15, hex('#140a12', 220), hex(rarCol[c.rarity]), 2);
            label(rarName[c.rarity], front, 0, CH / 2 - 47, { size: 18, color: rarCol[c.rarity] });
            label(c.name, front, 0, CH * 0.12, { size: Math.round(CW * 0.12), color: '#fff4e0', outline: '#1a0f14', outlineW: 4, w: CW - 30, h: 50 });
            label(c.desc, front, 0, -CH * 0.2, { size: Math.round(CW * 0.075), color: '#ffe8d0', outline: '#1a0f14', outlineW: 2, w: CW - 56, h: CH * 0.32, wrap: true, lh: Math.round(CW * 0.1) });
            front.active = false;
            views.push(card);
            // fly in
            tween(card).delay(tcur).to(D.cardFlyIn, { position: new Vec3(x, y, 0) }, { easing: 'backOut' }).start();
            tcur += D.cardStagger;
            void back;
            (card as any)._front = front; (card as any)._back = back; (card as any)._rare = rare; (card as any)._glow = glow;
        });
        // flips start after all have landed
        tcur += D.cardFlyIn - D.cardStagger;
        cards.forEach((c, i) => {
            const card = views[i];
            const rare = (card as any)._rare;
            const ft = tcur;
            tween(card).delay(ft).call(() => Sfx.play('card_flip')).to(D.cardFlip / 2, { scale: new Vec3(0, 1.05, 1) })
                .call(() => { (card as any)._back.active = false; (card as any)._front.active = true; if (rare) Sfx.play('card_rare'); })
                .to(D.cardFlip / 2, { scale: new Vec3(rare ? 1.08 : 1, rare ? 1.08 : 1, 1) }, { easing: 'backOut' })
                .delay(rare ? D.rarePause : 0).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
            const g = (card as any)._glow;
            if (g) {
                const op = opacity(g, 0);
                tween(op).delay(ft + D.cardFlip / 2).to(0.15, { opacity: 230 }).call(() => {
                    tween(op).repeatForever(tween().to(0.7, { opacity: 120 }).to(0.7, { opacity: 230 })).start();
                }).start();
            }
            tcur += D.cardFlip + (rare ? D.rarePause : 0) + 0.04;
        });
        // unlock after the last card settles
        tween(lock).delay(tcur + 0.12).call(() => { lock.destroy(); (n as any)._ready = true; }).start();
        views.forEach((card, i) => {
            card.on(Node.EventType.TOUCH_END, () => {
                if (picked || !(n as any)._ready) return;
                picked = true;
                Sfx.play('ui_click');
                tween(card).to(0.12, { scale: new Vec3(1.12, 1.12, 1) }).start();
                views.forEach((o, j) => { if (j !== i) tween(opacity(o)).to(0.15, { opacity: 60 }).start(); });
                tween(opacity(n)).delay(0.25).to(0.18, { opacity: 0 }).call(() => n.destroy()).start();
                setTimeout(() => onPick(i), 260);
            });
        });
        (n as any)._cards = views;
        return n;
    }

    // ---------------- pause / result ----------------
    pause(onResume: () => void, onRestart: () => void, onHome: () => void): Node {
        const n = node('Pause', this.root);
        const m = rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#000000', 170)).node; m.addComponent(BlockInputEvents);
        sprite('ui/panel', n, 420, 420);
        label('暂停', n, 0, 150, { size: 40, color: '#ffe0b0', outline: '#1a0f14', outlineW: 4 });
        const a = button(n, '继续', 0, 50, 260, 78, 30);
        const b = button(n, '重新开始', 0, -42, 260, 78, 30);
        const c = button(n, '返回首页', 0, -134, 260, 78, 30);
        onTap(a, () => { n.destroy(); onResume(); });
        onTap(b, () => { n.destroy(); onRestart(); });
        onTap(c, () => { n.destroy(); onHome(); });
        return n;
    }

    result(win: boolean, stats: any, onAgain: () => void, onHome: () => void): Node {
        const n = node('Result', this.root);
        const m = rect(n, this.halfW * 2 + 20, this.halfH * 2 + 20, hex('#000000', 0)).node; m.addComponent(BlockInputEvents);
        fade(m, 0, 190, 0.4);
        const panel = node('panel', n);
        sprite('ui/panel', panel, 560, 470);
        label(win ? '胜 利' : '败 北', panel, 0, 182, { size: 62, color: win ? '#ffd36a' : '#ff6a5a', outline: '#1a0f14', outlineW: 6 });
        label(win ? '灰烬骑士已被击败，余烬森林重归宁静' : '火光熄灭了……再试一次吧', panel, 0, 122, { size: 20, color: '#ffe0c8' });
        const rows: [string, string][] = [
            ['用时', `${Math.floor(stats.time / 60)}:${('0' + Math.floor(stats.time % 60)).slice(-2)}`],
            ['总伤害', String(stats.damage)], ['击杀', String(stats.kills)], ['最高连击', String(stats.maxCombo)], ['强化卡', String(stats.cards)],
        ];
        rows.forEach((r, i) => {
            label(r[0], panel, -150, 64 - i * 38, { size: 22, color: '#d8c0b0', align: 'left' });
            label(r[1], panel, 150, 64 - i * 38, { size: 24, color: '#fff4e0', align: 'right' });
        });
        const a = button(panel, '再来一局', -120, -178, 220, 78, 28);
        const b = button(panel, '返回首页', 120, -178, 220, 78, 28);
        panel.setScale(0.6, 0.6);
        tween(panel).delay(0.2).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        const lock = node('lock', n); size(lock, this.halfW * 2, this.halfH * 2); lock.addComponent(BlockInputEvents);
        setTimeout(() => { if (lock.isValid) lock.destroy(); }, 700);
        onTap(a, () => { n.destroy(); onAgain(); });
        onTap(b, () => { n.destroy(); onHome(); });
        Sfx.play(win ? 'victory' : 'defeat');
        return n;
    }
}

export type { Label, Color };
