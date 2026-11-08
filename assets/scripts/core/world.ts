/** Game simulation. Pure TS, no engine imports. Time only via step(dt). */
import { Rng } from './rng';
import { Enemy, EnemyType, GameEvent, Hero, InputFrame, Mods, Proj, Zone, defaultMods, emptyInput, inEllipse } from './types';
import { CardDef, applyCard, drawCards } from './cards';
import { createHero, updateHero } from './hero';
import { createEnemy, updateEnemies, killEnemy } from './enemies';
import { updateProjs, updateZones, newProj, newZone } from './projectiles';

export interface HitOpts {
    src: string; stun?: boolean; kb?: number; kdir?: number; launch?: number; hs?: boolean; rage?: boolean; noCrit?: boolean; raw?: boolean;
}

export class World {
    cfg: any; rng: Rng; seed: number;
    t = 0; events: GameEvent[] = [];
    hero!: Hero; mods!: Mods;
    enemies: Enemy[] = []; projs: Proj[] = []; zones: Zone[] = [];
    nextId = 1;
    phase = 'ready'; phaseT = 0; wave = -1;
    spawnQueue: EnemyType[] = []; spawnT = 0; spawnSide = 1;
    arenaL = 0; arenaR = 1280; targetR = 1280;
    hitstop = 0; hsFrame = false; timeScale = 1; god = false;
    takenCards: string[] = []; draftChoices: CardDef[] = []; draftReturn: string | null = null;
    combo = 0; comboDmg = 0; comboT = 0;
    stats = { damage: 0, kills: 0, maxCombo: 0, hits: 0, time: 0, cards: 0 };
    ult: { phase: string; t: number; n: number } | null = null;
    endT = 0;
    private pending: InputFrame = emptyInput();

    constructor(cfg: any, seed?: number) {
        this.cfg = cfg;
        this.seed = seed ?? cfg.seed ?? 1;
        this.rng = new Rng(this.seed);
        this.reset();
    }

    reset() {
        this.rng = new Rng(this.seed);
        this.t = 0; this.events = []; this.enemies = []; this.projs = []; this.zones = [];
        this.mods = defaultMods(); this.hero = createHero(this.cfg);
        this.phase = 'ready'; this.wave = -1; this.spawnQueue = []; this.hitstop = 0; this.ult = null;
        this.takenCards = []; this.draftChoices = []; this.draftReturn = null;
        this.combo = 0; this.comboDmg = 0; this.comboT = 0; this.endT = 0;
        this.stats = { damage: 0, kills: 0, maxCombo: 0, hits: 0, time: 0, cards: 0 };
        const a = this.arenaFor(0); this.arenaL = a[0]; this.arenaR = a[1]; this.targetR = a[1];
    }

    start() { this.reset(); this.beginWave(0); }

    emit(type: string, p: any = {}) { p.type = type; this.events.push(p as GameEvent); }
    drain(): GameEvent[] { const e = this.events; this.events = []; return e; }

    get groundTop(): number { return this.cfg.world.groundTop; }
    get groundBottom(): number { return this.cfg.world.groundBottom; }

    arenaFor(i: number): [number, number] {
        const L = this.cfg.world.length, vw = this.cfg.display.width;
        const n = Math.max(1, this.cfg.waves.length - 1);
        const c = vw / 2 + Math.min(i, n) * ((L - vw) / n);
        return [c - vw / 2, c + vw / 2];
    }

    alive(): Enemy[] { return this.enemies.filter(e => e.state !== 'dead'); }

    // ---------------- main step ----------------
    step(dtReal: number, inp: InputFrame) {
        const dt = Math.min(dtReal, 0.05) * this.timeScale;
        this.mergeInput(inp);
        if (this.phase === 'draft' || this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'ready') {
            this.pending = emptyInput();
            return;
        }
        if (this.hitstop > 0) { this.hitstop -= dt; return; }
        const input = this.pending; this.pending = emptyInput();
        this.t += dt; this.stats.time += dt; this.hsFrame = false;
        this.updatePhase(dt);
        if (this.ult) { this.updateUlt(dt); return; }
        updateHero(this, dt, input);
        updateEnemies(this, dt);
        updateProjs(this, dt);
        updateZones(this, dt);
        if (this.combo > 0) {
            this.comboT -= dt;
            if (this.comboT <= 0) { this.emit('comboEnd', { combo: this.combo, dmg: this.comboDmg }); this.combo = 0; this.comboDmg = 0; }
        }
        this.enemies = this.enemies.filter(e => !(e.state === 'dead' && e.deadT > 1.0));
    }

    private mergeInput(i: InputFrame) {
        const p = this.pending;
        p.mx = i.mx; p.my = i.my; p.attackHeld = i.attackHeld;
        p.attackPressed = p.attackPressed || i.attackPressed; p.jumpPressed = p.jumpPressed || i.jumpPressed;
        p.dodgePressed = p.dodgePressed || i.dodgePressed; p.skill1 = p.skill1 || i.skill1;
        p.skill2 = p.skill2 || i.skill2; p.skill3 = p.skill3 || i.skill3; p.ult = p.ult || i.ult;
    }

    // ---------------- waves ----------------
    beginWave(i: number) {
        this.wave = i;
        const w = this.cfg.waves[i];
        const a = this.arenaFor(i); this.arenaL = a[0]; this.arenaR = a[1]; this.targetR = a[1];
        this.spawnQueue = [];
        if (w.boss) {
            this.phase = 'bossIntro'; this.phaseT = this.cfg.enemies.boss.titleCardTime;
            const b = this.spawnEnemy('boss', this.arenaR - 260, (this.groundTop + this.groundBottom) / 2);
            b.state = 'intro'; b.st = 0; b.entered = true;
            this.emit('bossIntro', { name: this.cfg.enemies.boss.name, wave: i + 1, tip: w.tip, title: w.title, t: this.phaseT });
        } else {
            const list: EnemyType[] = [];
            for (const s of w.spawns) for (let k = 0; k < s.count; k++) list.push(s.type);
            for (let k = list.length - 1; k > 0; k--) { const j = this.rng.int(0, k); const t = list[k]; list[k] = list[j]; list[j] = t; }
            this.spawnQueue = list; this.spawnT = 0.6;
            this.phase = 'waveIntro'; this.phaseT = 1.0;
            this.emit('waveStart', { wave: i + 1, total: this.cfg.waves.length, title: w.title, tip: w.tip });
        }
    }

    private updatePhase(dt: number) {
        this.phaseT -= dt;
        const w = this.cfg.waves[this.wave];
        if (this.spawnQueue.length > 0) {
            this.spawnT -= dt;
            if (this.spawnT <= 0) { this.spawnT = w.spawnInterval || 0.4; this.spawnEdge(this.spawnQueue.shift()!); }
        }
        if (this.hero.state === 'dead') {
            this.endT += dt;
            if (this.endT > 1.4 && this.phase !== 'defeat') { this.phase = 'defeat'; this.emit('defeat', { stats: this.stats }); }
            return;
        }
        switch (this.phase) {
            case 'waveIntro': if (this.phaseT <= 0) this.phase = 'fight'; break;
            case 'bossIntro': if (this.phaseT <= 0) this.phase = 'fight'; break;
            case 'fight':
                if (this.spawnQueue.length === 0 && this.alive().length === 0) {
                    if (w.boss) { this.phase = 'clear'; this.phaseT = 1.6; }
                    else { this.phase = 'clear'; this.phaseT = this.cfg.waveIntermission ?? 1.2; this.emit('waveClear', { wave: this.wave + 1 }); }
                }
                break;
            case 'clear':
                if (this.phaseT <= 0) {
                    if (w.boss) { this.phase = 'victory'; this.emit('victory', { stats: this.stats }); }
                    else if ((this.cfg.draftAfterWaves || []).indexOf(this.wave + 1) >= 0) this.openDraft(null);
                    else this.beginAdvance();
                }
                break;
            case 'advance': {
                const na = this.arenaFor(this.wave + 1);
                this.targetR = na[1];
                this.arenaR = Math.min(na[1], this.arenaR + 900 * dt);
                if (this.hero.x >= na[0] + 360) this.beginWave(this.wave + 1);
                break;
            }
        }
    }

    beginAdvance() {
        if (this.wave + 1 >= this.cfg.waves.length) return;
        this.phase = 'advance';
        this.emit('advance', { wave: this.wave + 1 });
    }

    openDraft(ret: string | null) {
        this.draftChoices = drawCards(this.cfg.cards, this.cfg.draft.rarityWeights, this.takenCards, this.cfg.draft.choices || 3, this.rng);
        this.draftReturn = ret;
        this.phase = 'draft';
        this.emit('draft', { cards: this.draftChoices });
    }

    pickCard(i: number): CardDef | null {
        if (this.phase !== 'draft') return null;
        const c = this.draftChoices[i]; if (!c) return null;
        const r = applyCard(this.mods, c);
        const h = this.hero;
        h.maxHp += r.maxHp; h.hp = Math.min(h.maxHp, h.hp + r.heal);
        this.takenCards.push(c.id); this.stats.cards++;
        this.draftChoices = [];
        this.emit('cardPicked', { card: c });
        if (this.draftReturn) { this.phase = this.draftReturn; this.draftReturn = null; }
        else this.beginAdvance();
        return c;
    }

    // ---------------- spawning ----------------
    spawnEnemy(type: EnemyType, x: number, y: number): Enemy {
        const e = createEnemy(this, type, x, y);
        this.enemies.push(e);
        return e;
    }

    spawnEdge(type: EnemyType): Enemy {
        this.spawnSide = -this.spawnSide;
        const x = this.spawnSide > 0 ? this.arenaR + 80 : this.arenaL - 80;
        const y = this.rng.range(this.groundTop + 10, this.groundBottom - 10);
        const e = this.spawnEnemy(type, x, y);
        this.emit('spawn', { id: e.id, type, x, y });
        return e;
    }

    addSpear(x: number, y: number, vx: number, vy: number, range: number) {
        const p = newProj(this, 'spear'); p.x = x; p.y = y; p.z = 60; p.vx = vx; p.vy = vy; p.range = range;
        this.projs.push(p); return p;
    }

    addFireball(x: number, y: number, z: number, tx: number, ty: number, flight: number, arc: number) {
        const p = newProj(this, 'fireball'); p.fx = p.x = x; p.fy = p.y = y; p.z = z; p.tx = tx; p.ty = ty; p.flight = flight; p.arc = arc;
        this.projs.push(p); return p;
    }

    addZone(kind: Zone['kind'], x: number, y: number, r: number, life: number, damage: number) {
        const z = newZone(this, kind, x, y, r, life, damage); this.zones.push(z); return z;
    }

    // ---------------- combat ----------------
    hitEnemy(e: Enemy, base: number, o: HitOpts): number {
        if (e.state === 'dead' || e.state === 'intro') return 0;
        const C = this.cfg.combat, P = this.cfg.player;
        let dmg = base;
        let crit = false;
        if (!o.raw) {
            dmg *= (P.attack || 1) * (1 + this.mods.attackMul);
            dmg *= 1 + this.rng.range(-C.damageVariance, C.damageVariance);
            if (!o.noCrit && (this.hero.nextCrit || this.rng.chance(P.critChance + this.mods.critChance))) {
                crit = true; dmg *= P.critMul; this.hero.nextCrit = false;
            }
        }
        dmg = Math.max(1, Math.round(dmg));
        e.hp -= dmg;
        e.flashT = C.hitFlash;
        const ec = this.cfg.enemies[e.type];
        const resist = ec.knockbackResist || 0;
        const kdir = o.kdir ?? (e.x >= this.hero.x ? 1 : -1);
        if (o.kb) e.kx += kdir * o.kb * 6 * (1 - resist);
        if (o.launch && !ec.superArmor) e.vz = Math.max(e.vz, o.launch);
        if (!ec.superArmor && o.stun !== false) {
            e.state = 'hurt'; e.st = 0; e.stDur = C.enemyHurtStun; e.token = false;
        }
        // stats / combo / rage
        this.stats.damage += dmg; this.stats.hits++;
        this.combo++; this.comboDmg += dmg; this.comboT = C.comboTimeout;
        if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
        if (o.rage !== false) this.addRage(Math.min(C.rageMaxPerHit, dmg * C.ragePerHitMul));
        this.hero.mp = Math.min(this.hero.maxMp, this.hero.mp + 0.5);
        if (o.hs !== false && !this.hsFrame) {
            this.hsFrame = true;
            const heavy = crit || dmg >= C.hitstopHeavyThreshold;
            this.hitstop = Math.max(this.hitstop, heavy ? C.hitstopMax : C.hitstopMin);
        }
        this.emit('hit', { id: e.id, x: e.x, y: e.y, z: e.z, dmg, crit, src: o.src, kdir, combo: this.combo, comboDmg: this.comboDmg, etype: e.type });
        if (e.hp <= 0) killEnemy(this, e);
        return dmg;
    }

    addRage(v: number) {
        const max = this.cfg.player.maxRage;
        const before = this.hero.rage;
        this.hero.rage = Math.min(max, this.hero.rage + v * (1 + this.mods.rageMul));
        if (before < max && this.hero.rage >= max) this.emit('rageFull', {});
    }

    damageHero(dmg: number, fromX: number, src: string): boolean {
        const h = this.hero, C = this.cfg.combat;
        if (h.invuln > 0 || h.state === 'dead' || h.state === 'ult' || this.ult) return false;
        if (h.state === 'dodge' && h.st < this.cfg.dodge.iframe) return false;
        if (!this.god) h.hp -= dmg;
        h.flashT = C.hitFlash; h.invuln = C.playerHurtIframe;
        const dir = h.x >= fromX ? 1 : -1;
        h.kx = dir * C.playerKnockback * 5;
        this.emit('heroHurt', { dmg, x: h.x, y: h.y, src });
        if (h.hp <= 0) {
            h.hp = 0; h.state = 'dead'; h.st = 0; this.endT = 0;
            this.emit('heroDead', {});
        } else if (h.z <= 0) {
            h.state = 'hurt'; h.st = 0;
        }
        return true;
    }

    // ---------------- ultimate ----------------
    startUlt(): boolean {
        const h = this.hero, U = this.cfg.skills.ultimate;
        if (this.ult || h.rage < U.rage || h.state === 'dead') return false;
        h.rage = 0; h.state = 'ult'; h.st = 0; h.z = 0; h.vz = 0; h.slamming = false;
        this.ult = { phase: 'cutin', t: 0, n: 0 };
        this.emit('ultStart', { cutin: U.cutinTime, x: h.x, y: h.y, name: U.name });
        return true;
    }

    private updateUlt(dt: number) {
        const u = this.ult!, U = this.cfg.skills.ultimate, h = this.hero;
        u.t += dt;
        h.flashT = Math.max(0, h.flashT - dt);
        for (const e of this.enemies) { e.flashT = Math.max(0, e.flashT - dt); if (e.state === 'dead') e.deadT += dt; }
        if (u.phase === 'cutin') {
            if (u.t >= U.cutinTime) { u.phase = 'strikes'; u.t = U.strikeInterval; }
        } else if (u.phase === 'strikes') {
            while (u.t >= U.strikeInterval && u.n < U.strikes) {
                u.t -= U.strikeInterval;
                const al = this.alive();
                const targets: { x: number; y: number }[] = [];
                if (al.length === 0) {
                    targets.push({ x: this.rng.range(this.arenaL + 150, this.arenaR - 150), y: this.rng.range(this.groundTop, this.groundBottom) });
                } else {
                    // cycle through enemies so each strike lands on different ones
                    const k = Math.min(al.length, 4);
                    for (let j = 0; j < k; j++) { const e = al[(u.n * k + j) % al.length]; targets.push({ x: e.x, y: e.y }); }
                }
                const per = U.totalDamage / U.strikes;
                for (const e of al) this.hitEnemy(e, per, { src: 'ult', hs: false, rage: false, noCrit: true, raw: true, kb: 10 });
                this.emit('ultStrike', { idx: u.n, targets, last: u.n === U.strikes - 1 });
                u.n++;
            }
            if (u.n >= U.strikes) { u.phase = 'outro'; u.t = 0; this.emit('ultFlash', {}); }
        } else if (u.t >= 0.45) {
            this.ult = null; h.state = 'idle'; h.st = 0; h.invuln = 0.3;
            this.emit('ultEnd', {});
        }
    }

    // ---------------- debug ----------------
    forceCast(name: string): boolean {
        const h = this.hero;
        if (name === 'ult' || name === 'ultimate') { h.rage = this.cfg.player.maxRage; return this.startUlt(); }
        const map: any = { skill1: 'crescent', skill2: 'skyfall', skill3: 'meteorSpear' };
        const sk = map[name] || name;
        h.cds[sk] = 0; h.mp = h.maxMp;
        if (h.state !== 'dead') { h.state = 'idle'; h.z = 0; }
        const inp = emptyInput();
        if (sk === 'crescent') inp.skill1 = true; else if (sk === 'skyfall') inp.skill2 = true; else if (sk === 'meteorSpear') inp.skill3 = true; else return false;
        this.mergeInput(inp);
        return true;
    }

    setWave(n: number) {
        for (const e of this.enemies) e.state = 'dead';
        this.enemies = []; this.projs = []; this.zones = []; this.ult = null;
        const i = Math.max(0, Math.min(this.cfg.waves.length - 1, n - 1));
        const a = this.arenaFor(i);
        this.hero.x = a[0] + 300; this.hero.state = 'idle'; this.hero.hp = Math.max(1, this.hero.hp);
        this.beginWave(i);
    }

    nearestEnemy(x: number, y: number, maxD: number): Enemy | null {
        let best: Enemy | null = null, bd = maxD * maxD;
        for (const e of this.enemies) {
            if (e.state === 'dead' || e.state === 'intro') continue;
            const dx = e.x - x, dy = (e.y - y) * 2, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    inCircle(x: number, y: number, r: number): Enemy[] {
        return this.enemies.filter(e => e.state !== 'dead' && e.state !== 'intro' && inEllipse(e.x - x, e.y - y, r + this.cfg.enemies[e.type].radius));
    }
}
