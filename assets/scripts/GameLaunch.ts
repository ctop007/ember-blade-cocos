import { _decorator, Component, Node, view, ResolutionPolicy, game, Game, director, UITransform } from 'cc';
import { World } from './core/world';
import { Assets } from './view/Assets';
import { Sfx } from './view/Sfx';
import { node, size, opacity, hex, label } from './view/UiKit';
import { BattleView } from './view/BattleView';
import { SkillFx } from './view/SkillFx';
import { Hud } from './view/Hud';
import { TouchInput } from './view/TouchInput';
import { Screens, onTap } from './view/Screens';
const { ccclass } = _decorator;

/** 唯一入口：所有 UI 与实体在代码里生成。core/ 只做逻辑，view/ 只做表现。 */
@ccclass('GameLaunch')
export class GameLaunch extends Component {
    private cfg: any;
    private world: World | null = null;
    private bv: BattleView | null = null;
    private sfx: SkillFx | null = null;
    private hud: Hud | null = null;
    private inp: TouchInput | null = null;
    private screens!: Screens;
    private gameRoot!: Node; private uiRoot!: Node; private inputLayer: Node | null = null;
    private homeN: Node | null = null; private draftN: Node | null = null; private pauseN: Node | null = null; private resultN: Node | null = null;
    private paused = false; private inBattle = false;
    private fps = 60; private fpsAcc = 0; private fpsN = 0;
    private advArrow: Node | null = null;
    private timeScale = 1;
    private evCount: { [k: string]: number } = {};

    async start() {
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT);
        const vs = view.getVisibleSize();
        this.node.getComponent(UITransform)?.setContentSize(vs.width, vs.height);
        this.gameRoot = node('Game', this.node);
        this.uiRoot = node('UI', this.node);
        this.screens = new Screens(this.uiRoot, vs.width / 2, vs.height / 2);
        Sfx.init(this.node);
        const ld = this.screens.loading();
        await Assets.init((p, l) => ld.set(p, l));
        this.cfg = Assets.cfg;
        ld.close();
        this.mountBridge();
        this.showHome();
        game.on(Game.EVENT_HIDE, () => { if (this.inBattle && !this.paused && this.world && this.world.phase !== 'draft') this.openPause(); });
        view.setResizeCallback(() => this.onResize());
    }

    private onResize() {
        // Rebuild layout-dependent UI on orientation / size change.
        const vs = view.getVisibleSize();
        this.node.getComponent(UITransform)?.setContentSize(vs.width, vs.height);
        this.screens.halfW = vs.width / 2; this.screens.halfH = vs.height / 2;
        if (this.inBattle && this.world) {
            this.buildBattleView(true);
        } else if (this.homeN) { this.showHome(); }
    }

    // ---------------- flow ----------------
    private showHome() {
        this.inBattle = false;
        if (this.homeN) this.homeN.destroy();
        this.homeN = this.screens.home(this.cfg.ui.versionLabel + ' · Cocos Creator 3.8.8', () => this.startBattle());
    }

    private startBattle() {
        Sfx.unlock();
        if (this.homeN) { this.homeN.destroy(); this.homeN = null; }
        if (!this.world) this.world = new World(this.cfg);
        this.world.start();
        this.buildBattleView(false);
        this.inBattle = true; this.paused = false;
        Sfx.playBgm();
    }

    private buildBattleView(keepState: boolean) {
        if (this.bv) { this.bv.root.destroy(); this.bv = null; }
        if (this.hud) { this.hud.root.destroy(); this.hud = null; }
        if (this.inp) { this.inp.destroy(); this.inp = null; }
        if (this.inputLayer) { this.inputLayer.destroy(); this.inputLayer = null; }
        this.bv = new BattleView(this.gameRoot, this.cfg);
        this.sfx = new SkillFx(this.bv);
        this.sfx.onUltCutin = (on, name) => { if (on) this.screens.ultCutin(name, this.cfg.skills.ultimate.cutinTime + 0.1); };
        const vs = view.getVisibleSize();
        this.inputLayer = node('InputLayer', this.gameRoot);
        size(this.inputLayer, vs.width, vs.height);
        this.hud = new Hud(this.gameRoot, this.cfg);
        this.inp = new TouchInput(this.inputLayer, this.hud);
        onTap(this.hud.pauseBtn, () => this.openPause());
        this.bv.camX = this.world!.hero.x;
        if (!keepState) this.hud.setMission('', '');
        this.updateMission();
    }

    private updateMission() {
        const w = this.world; if (!w || !this.hud) return;
        const wv = w.cfg.waves[Math.max(0, w.wave)];
        const n = w.cfg.waves.length;
        let tip = wv ? wv.tip : '';
        if (w.phase === 'advance') tip = '向前推进 →';
        const waveTxt = wv ? (wv.boss ? 'BOSS 战' : `第 ${w.wave + 1}/${n - 1} 波 · 剩余 ${w.alive().length + w.spawnQueue.length}`) : '';
        this.hud.setMission(tip, waveTxt);
    }

    private openPause() {
        if (this.paused || !this.inBattle) return;
        this.paused = true; this.inp?.reset(); Sfx.pauseBgm(true);
        this.pauseN = this.screens.pause(
            () => { this.paused = false; Sfx.pauseBgm(false); },
            () => { this.closeModals(); this.restart(); },
            () => { this.closeModals(); this.toHome(); });
    }

    private closeModals() {
        for (const n of [this.draftN, this.pauseN, this.resultN]) if (n && n.isValid) n.destroy();
        this.draftN = this.pauseN = this.resultN = null;
    }

    private restart() {
        this.paused = false;
        this.world!.start();
        this.buildBattleView(false);
        this.inBattle = true;
        Sfx.playBgm();
    }

    private toHome() {
        this.paused = false; this.inBattle = false;
        Sfx.stopBgm();
        if (this.bv) { this.bv.root.destroy(); this.bv = null; }
        if (this.hud) { this.hud.root.destroy(); this.hud = null; }
        if (this.inp) { this.inp.destroy(); this.inp = null; }
        if (this.inputLayer) { this.inputLayer.destroy(); this.inputLayer = null; }
        this.showHome();
    }

    // ---------------- loop ----------------
    update(dtReal: number) {
        this.fpsAcc += dtReal; this.fpsN++;
        if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
        if (!this.inBattle || !this.world || !this.bv || !this.hud || !this.inp) return;
        const w = this.world;
        const dt = Math.min(dtReal, 0.05) * this.timeScale;
        const frame = this.inp.frame();
        if (!this.paused) {
            w.timeScale = this.timeScale;
            w.step(dtReal, frame);
            for (const e of w.drain()) this.onEvent(e);
        }
        const vdt = this.paused ? 0 : dt;
        const frozen = w.hitstop > 0;
        this.bv.sync(w, vdt, frozen);
        this.sfx!.update(vdt, w);
        this.bv.fx.update(vdt);
        this.bv.updateNumbers(vdt);
        this.bv.updateCamera(w, vdt);
        this.hud.update(w, vdt, w.t);
        this.hud.tickButtons(dtReal);
        this.inp.enabled = !this.paused && w.phase !== 'draft' && w.phase !== 'victory' && w.phase !== 'defeat';
        // advance arrow
        if (w.phase === 'advance') {
            if (!this.advArrow) {
                this.advArrow = node('adv', this.hud.root, this.hud.R - 80, 40);
                const l = this.makeArrow(this.advArrow); void l;
            }
            this.advArrow.setPosition(this.hud.R - 90 + Math.sin(w.t * 6) * 10, 40);
        } else if (this.advArrow) { this.advArrow.destroy(); this.advArrow = null; }
    }

    private makeArrow(n: Node) {
        return label('前进 ▶▶', n, 0, 0, { size: 34, color: '#ffd36a', outline: '#1a0f14', outlineW: 4 });
    }

    private onEvent(e: any) {
        const w = this.world!;
        this.sfx!.handle(e, w);
        const ek = e.type === 'swing' ? 'swing' + e.step : e.type; this.evCount[ek] = (this.evCount[ek] || 0) + 1;
        switch (e.type) {
            case 'waveStart': this.screens.banner(e.title, e.tip); this.updateMission(); break;
            case 'spawn': case 'kill': case 'advance': case 'waveClear': this.updateMission(); break;
            case 'bossIntro': this.screens.bossTitle(e.name, e.t); Sfx.play('boss_appear'); this.updateMission(); break;
            case 'draft':
                this.inp!.reset();
                this.draftN = this.screens.draft(e.cards, this.cfg, (i) => { this.draftN = null; w.pickCard(i); this.updateMission(); });
                break;
            case 'victory': case 'defeat':
                this.inp!.reset();
                this.resultN = this.screens.result(e.type === 'victory', e.stats, () => { this.resultN = null; this.restart(); }, () => { this.resultN = null; this.toHome(); });
                break;
        }
    }

    // ---------------- AI bridge (?debug) ----------------
    private mountBridge() {
        const win: any = (globalThis as any).window;
        if (!win || !/[?&]debug/.test(win.location?.search || '')) return;
        const self = this;
        const canvasPt = (x: number, y: number) => {
            const c = win.document.querySelector('canvas');
            const r = c.getBoundingClientRect();
            const vs = view.getVisibleSize();
            return { x: r.left + (x + vs.width / 2) / vs.width * r.width, y: r.top + (1 - (y + vs.height / 2) / vs.height) * r.height };
        };
        win.__AI_BRIDGE__ = {
            state() {
                const w = self.world;
                if (!w) return { phase: 'home', fps: Math.round(self.fps) };
                const h = w.hero;
                return {
                    hp: Math.round(h.hp), maxHp: h.maxHp, mp: Math.round(h.mp), rage: Math.round(h.rage), combo: w.combo, wave: w.wave + 1,
                    phase: self.inBattle ? w.phase : 'home', heroState: h.state, x: Math.round(h.x), y: Math.round(h.y), face: h.face, cds: h.cds, ultReady: h.rage >= self.cfg.player.maxRage,
                    enemies: w.enemies.filter(e => e.state !== 'dead').map(e => ({ type: e.type, hp: e.hp, x: Math.round(e.x), y: Math.round(e.y), state: e.state })),
                    fps: Math.round(self.fps), particles: self.bv ? self.bv.fx.count() : 0, stats: w.stats, cards: w.takenCards, paused: self.paused,
                    draftReady: !!(self.draftN && (self.draftN as any)._ready),
                };
            },
            events() { return self.evCount; },
            audio() { const fmt: any = {}; for (const k in Assets.clipFmt) fmt[Assets.clipFmt[k]] = (fmt[Assets.clipFmt[k]] || 0) + 1; return { sfx: Sfx.stats, formats: fmt, bgm: !!(Sfx.bgm && Sfx.bgm.playing) }; },
            cast(name: string) { return self.world ? self.world.forceCast(name) : false; },
            spawn(type: string, n = 1) { const w = self.world; if (!w) return 0; for (let i = 0; i < n; i++) w.spawnEdge(type as any); return n; },
            setWave(n: number) { self.world?.setWave(n); self.updateMission(); },
            draft() { const w = self.world; if (!w || w.phase === 'draft') return false; w.openDraft(w.phase); return true; },
            timeScale(x: number) { self.timeScale = x; },
            fillRage() { if (self.world) self.world.hero.rage = self.cfg.player.maxRage; },
            god(on: boolean) { if (self.world) self.world.god = !!on; },
            // helpers for Playwright real-touch tests: client pixel position of UI elements
            buttonPos(id: string) {
                if (!self.hud) return null;
                const n = id === 'pause' ? self.hud.pauseBtn : self.hud.button(id);
                if (!n) return null;
                return canvasPt(n.position.x, n.position.y);
            },
            cardPos(i: number) {
                const cs = self.draftN && (self.draftN as any)._cards; if (!cs || !cs[i]) return null;
                return canvasPt(cs[i].position.x, cs[i].position.y);
            },
            uiPos(x: number, y: number) { return canvasPt(x, y); },
            heroScreen() {
                const w = self.world, bv = self.bv; if (!w || !bv) return null;
                const [x, y] = bv.toScreen(w.hero.x, w.hero.y); return canvasPt(x, y);
            },
        };
        void hex; void opacity; void director;
    }
}
