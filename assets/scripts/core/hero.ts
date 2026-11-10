/** Hero controller logic. Pure TS. */
import type { World } from './world';
import { Hero, InputFrame, SkillName, Enemy, inEllipse } from './types';

export function createHero(cfg: any): Hero {
    const P = cfg.player;
    return {
        x: P.spawnX, y: P.spawnY, z: 0, vz: 0, face: 1,
        hp: P.maxHp, maxHp: P.maxHp, mp: P.maxMp, maxMp: P.maxMp, rage: 0,
        state: 'idle', st: 0, atkStep: 0, atkHitDone: false, comboWindowT: 0, chainQueued: false, holdT: 0, lungeLeft: 0,
        attackBuffer: 0, dodgeBuffer: 0,
        dodgeCd: 0, dodgeDx: 1, dodgeDy: 0, dodgeFlameAcc: 0, invuln: 0, flashT: 0, kx: 0,
        castSkill: null, castDur: 0, castStep: 0, cds: { crescent: 0, skyfall: 0, meteorSpear: 0 },
        nextCrit: false, slamming: false, hitSet: {}, thrustFromX: 0, moving: false,
    };
}

/** Active hit must complete before recovery may be cancelled. Optional per-step tuning stays in config. */
export function attackCancelAt(step: any): number { return Math.max(step.hitAt, step.cancelAt ?? step.hitAt + .06); }
export function travelCurve(u: number): number { return 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3); }
let DT = 0;
function setState(h: Hero, s: Hero['state']) { h.state = s; h.st = 0; }

function cdOf(w: World, sk: SkillName): number {
    return w.cfg.skills[sk].cooldown * Math.max(0.3, 1 + w.mods.cooldownMul);
}

/** Melee box test in front of hero. */
function inFront(w: World, h: Hero, e: Enemy, range: number, back = 20): boolean {
    const r = w.cfg.enemies[e.type].radius;
    const f = (e.x - h.x) * h.face;
    return f >= -back - r && f <= range + r && Math.abs(e.y - h.y) <= w.cfg.combat.depthTolerance + r * 0.5 && e.z < 140;
}

export function updateHero(w: World, dt: number, inp: InputFrame) {
    const h = w.hero, cfg = w.cfg, P = cfg.player, A = cfg.attack, J = cfg.jump;
    DT = dt;
    h.st += dt;
    h.invuln = Math.max(0, h.invuln - dt);
    h.flashT = Math.max(0, h.flashT - dt);
    h.dodgeCd = Math.max(0, h.dodgeCd - dt);
    for (const k in h.cds) h.cds[k] = Math.max(0, h.cds[k] - dt);
    h.mp = Math.min(h.maxMp, h.mp + P.mpRegen * (1 + w.mods.mpRegenMul) * dt);
    if (h.comboWindowT > 0) { h.comboWindowT -= dt; if (h.comboWindowT <= 0) h.atkStep = 0; }
    // knockback slide
    if (h.kx !== 0) {
        h.x += h.kx * dt; h.kx *= Math.pow(0.0005, dt);
        if (Math.abs(h.kx) < 5) h.kx = 0;
    }
    if (h.state === 'dead') { clampHero(w); return; }

    const mlen = Math.hypot(inp.mx, inp.my);
    h.moving = mlen > 0.05;
    const s = h.state;
    const grounded = h.z <= 0 && s !== 'jump' && s !== 'slam';
    const free = s === 'idle' || s === 'run';
    // ------- hold tracking -------
    if (inp.attackHeld) h.holdT += dt; else if (!(s === 'charge')) h.holdT = 0;

    // Timers advance only with simulation time (so hitstop preserves queued input).
    h.attackBuffer = inp.attackPressed ? A.chainBuffer : Math.max(0, h.attackBuffer - dt);
    h.dodgeBuffer = inp.dodgePressed ? A.chainBuffer : Math.max(0, h.dodgeBuffer - dt);
    const recovering = s === 'attack' && h.atkHitDone && h.st >= attackCancelAt(A.steps[h.atkStep]);
    // ------- actions with priority -------
    const canCancel = free || recovering || s === 'land' || s === 'thrustRec' || s === 'charge' || (s === 'cast' && h.st > h.castDur * 0.85);
    if (h.dodgeBuffer > 0 && h.dodgeCd <= 0 && (canCancel || s === 'hurt') && grounded) { h.dodgeBuffer = h.attackBuffer = 0; startDodge(w, h, inp); }
    else if (inp.ult && (free || s === 'attack' || s === 'land' || s === 'jump') && h.rage >= cfg.skills.ultimate.rage) { w.startUlt(); return; }
    else if ((inp.skill1 || inp.skill2 || inp.skill3) && grounded && (free || s === 'attack' || s === 'land' || s === 'thrustRec')) {
        const sk: SkillName = inp.skill1 ? 'crescent' : inp.skill2 ? 'skyfall' : 'meteorSpear';
        tryCast(w, h, sk, inp);
    }
    else if (inp.jumpPressed && grounded && (free || s === 'attack' || s === 'land')) {
        setState(h, 'jump'); h.vz = J.velocity; h.slamming = false;
        w.emit('jump', { x: h.x, y: h.y });
    }
    else if (h.attackBuffer > 0) {
        if (h.state === 'jump' && h.z > 30) { h.attackBuffer = 0; setState(h, 'slam'); h.slamming = true; h.vz = -J.slamVelocity; w.emit('slamStart', { x: h.x, y: h.y, z: h.z }); }
        else if (free || s === 'land') startAttack(w, h, inp, h.comboWindowT > 0 ? h.atkStep : 0);
        else if (recovering) startAttack(w, h, inp, (h.atkStep + 1) % A.steps.length);
    }

    // ------- state update -------
    switch (h.state) {
        case 'idle': case 'run': {
            move(w, h, inp, 1);
            h.state = h.moving ? 'run' : 'idle';
            if (inp.attackHeld && h.holdT >= A.chargeTime) enterCharge(w, h);
            break;
        }
        case 'attack': updateAttack(w, h, inp, dt); break;
        case 'charge': {
            move(w, h, inp, 0.15);
            if (!inp.attackHeld) startThrust(w, h);
            break;
        }
        case 'thrust': updateThrust(w, h, dt); break;
        case 'thrustRec': if (h.st >= A.chargedThrust.recovery) setState(h, 'idle'); break;
        case 'dodge': updateDodge(w, h, dt); break;
        case 'jump': case 'slam': updateAir(w, h, inp, dt); break;
        case 'land': if (h.st >= (h.slamming ? J.landRecovery + 0.1 : J.landRecovery)) { h.slamming = false; setState(h, 'idle'); } break;
        case 'hurt': if (h.st >= cfg.combat.playerHurtStun) setState(h, 'idle'); break;
        case 'cast': updateCast(w, h, inp, dt); break;
    }
    clampHero(w);
}

function clampHero(w: World) {
    const h = w.hero, pad = w.cfg.world.edgePadding;
    h.x = Math.max(w.arenaL + pad, Math.min(w.arenaR - pad, h.x));
    h.y = Math.max(w.groundTop, Math.min(w.groundBottom, h.y));
}

function move(w: World, h: Hero, inp: InputFrame, scale: number) {
    const P = w.cfg.player;
    const sp = P.moveSpeed * scale;
    h.x += inp.mx * sp * DT;
    h.y += inp.my * sp * P.moveSpeedYScale * DT;
    if (Math.abs(inp.mx) > 0.15 && scale > 0.1) h.face = inp.mx > 0 ? 1 : -1;
}

function enterCharge(w: World, h: Hero) {
    setState(h, 'charge'); h.atkStep = 0; h.comboWindowT = 0;
    w.emit('chargeReady', { x: h.x, y: h.y, face: h.face });
}

function startAttack(w: World, h: Hero, inp: InputFrame, step: number) {
    if (Math.abs(inp.mx) > 0.2) h.face = inp.mx > 0 ? 1 : -1;
    h.atkStep = step;
    const stp = w.cfg.attack.steps[h.atkStep];
    setState(h, 'attack'); h.attackBuffer = 0; h.atkHitDone = false; h.chainQueued = false; h.lungeLeft = stp.lunge; h.comboWindowT = 0;
    w.emit('swing', { step: h.atkStep, x: h.x, y: h.y, face: h.face });
}

function updateAttack(w: World, h: Hero, inp: InputFrame, dt: number) {
    const A = w.cfg.attack, stp = A.steps[h.atkStep];
    move(w, h, inp, A.moveWhileAttackingScale);
    // Integrate displacement, rather than speed, so distance is invariant across frame rates.
    const desired = stp.lunge * travelCurve(h.st / (stp.duration * .4));
    const d = Math.min(h.lungeLeft, Math.max(0, desired - (stp.lunge - h.lungeLeft)));
    h.x += d * h.face; h.lungeLeft -= d;
    if (!h.atkHitDone && h.st >= stp.hitAt) {
        h.atkHitDone = true;
        for (const e of w.enemies) {
            if (e.state === 'dead' || e.state === 'intro') continue;
            if (inFront(w, h, e, stp.range)) w.hitEnemy(e, stp.damage, { src: 'atk' + (h.atkStep + 1), kb: stp.knockback, kdir: h.face });
        }
    }
    // hold → charge (only out of the first swing, after the hit frame)
    if (inp.attackHeld && h.holdT >= A.chargeTime && h.atkHitDone && h.atkStep === 0) { enterCharge(w, h); return; }
    if (h.st >= stp.duration) {
        const next = (h.atkStep + 1) % A.steps.length;
        if (h.attackBuffer > 0) startAttack(w, h, inp, next);
        else { h.atkStep = next; h.comboWindowT = next === 0 ? 0 : A.comboWindow; setState(h, 'idle'); }
    }
}

function startThrust(w: World, h: Hero) {
    setState(h, 'thrust'); h.hitSet = {}; h.thrustFromX = h.x; h.invuln = Math.max(h.invuln, w.cfg.attack.chargedThrust.duration);
    w.emit('thrust', { x: h.x, y: h.y, face: h.face, dist: w.cfg.attack.chargedThrust.distance });
}

function updateThrust(w: World, h: Hero, dt: number) {
    const T = w.cfg.attack.chargedThrust;
    h.x += T.distance * h.face * (travelCurve(h.st / T.duration) - travelCurve((h.st - dt) / T.duration));
    for (const e of w.enemies) {
        if (e.state === 'dead' || h.hitSet[e.id]) continue;
        const r = w.cfg.enemies[e.type].radius;
        const f = (e.x - h.x) * h.face;
        if (f > -T.distance && f < 70 + r && Math.abs(e.y - h.y) <= T.width * 0.5 + r * 0.6 && e.z < 140 && (e.x - h.thrustFromX) * h.face > -30) {
            h.hitSet[e.id] = true;
            w.hitEnemy(e, T.damage, { src: 'thrust', kb: T.knockback, kdir: h.face });
        }
    }
    if (h.st >= T.duration) { setState(h, 'thrustRec'); w.emit('thrustEnd', { x: h.x, y: h.y, fromX: h.thrustFromX, face: h.face }); }
}

function startDodge(w: World, h: Hero, inp: InputFrame) {
    const D = w.cfg.dodge;
    let dx = inp.mx, dy = inp.my;
    const l = Math.hypot(dx, dy);
    if (l < 0.2) { dx = h.face; dy = 0; } else { dx /= l; dy /= l; }
    h.dodgeDx = dx; h.dodgeDy = dy; h.dodgeCd = D.cooldown + D.duration; h.dodgeFlameAcc = 0;
    if (Math.abs(dx) > 0.2) h.face = dx > 0 ? 1 : -1;
    h.kx = 0;
    setState(h, 'dodge');
    if (w.mods.dodgeCrit) h.nextCrit = true;
    w.emit('dodge', { x: h.x, y: h.y, dx, dy, face: h.face });
}

function updateDodge(w: World, h: Hero, dt: number) {
    const D = w.cfg.dodge;
    // ease-out: speed proportional to (1 - t)
    const u0 = Math.min(1, (h.st - dt) / D.duration), u1 = Math.min(1, h.st / D.duration);
    const ease = (u: number) => 1 - (1 - u) * (1 - u);
    const d = (ease(u1) - ease(Math.max(0, u0))) * D.distance;
    h.x += h.dodgeDx * d; h.y += h.dodgeDy * d * 0.7;
    if (w.mods.dodgeFlame) {
        h.dodgeFlameAcc += d;
        const F = w.cfg.dodgeFlame;
        if (h.dodgeFlameAcc >= F.spacing || h.st <= dt) { h.dodgeFlameAcc = 0; w.addZone('flame', h.x, h.y, F.radius, F.life, F.damage); }
    }
    if (h.st >= D.duration) setState(h, 'idle');
}

function updateAir(w: World, h: Hero, inp: InputFrame, dt: number) {
    const J = w.cfg.jump, g = w.cfg.world.gravity;
    if (h.state === 'jump') move(w, h, inp, J.airControl);
    h.vz -= g * dt * (h.state === 'slam' ? 1.5 : 1);
    h.z += h.vz * dt;
    if (h.z <= 0) {
        h.z = 0; h.vz = 0;
        if (h.state === 'slam') {
            const hits = w.inCircle(h.x, h.y, J.slamRadius);
            for (const e of hits) w.hitEnemy(e, J.slamDamage, { src: 'slam', kb: J.slamKnockback, launch: 300 });
            w.emit('slamLand', { x: h.x, y: h.y, r: J.slamRadius });
            setState(h, 'land'); h.slamming = true;
        } else {
            w.emit('land', { x: h.x, y: h.y });
            setState(h, 'land'); h.slamming = false;
        }
    }
}

function tryCast(w: World, h: Hero, sk: SkillName, inp: InputFrame): boolean {
    const S = w.cfg.skills[sk];
    if (h.cds[sk] > 0 || h.mp < S.mp) { w.emit('castFail', { skill: sk, reason: h.cds[sk] > 0 ? 'cd' : 'mp' }); return false; }
    h.mp -= S.mp; h.cds[sk] = cdOf(w, sk);
    if (Math.abs(inp.mx) > 0.2) h.face = inp.mx > 0 ? 1 : -1;
    setState(h, 'cast'); h.castSkill = sk; h.castStep = 0; h.hitSet = {};
    if (sk === 'crescent') {
        const spins = S.spins + w.mods.crescentSpins;
        h.castDur = spins * S.spinDuration;
        w.emit('crescent', { x: h.x, y: h.y, spins, spinDur: S.spinDuration, r: S.radius });
    } else if (sk === 'skyfall') {
        h.castDur = 0.32;
        const r = S.radius * (1 + w.mods.skyfallRadiusMul);
        const tx = Math.max(w.arenaL + 40, Math.min(w.arenaR - 40, h.x + h.face * S.offset));
        w.addZone('skyfall', tx, h.y, r, S.delay, S.damage * (1 + w.mods.skyfallDamageMul));
        w.emit('skyfallWarn', { x: tx, y: h.y, r, delay: S.delay });
    } else {
        h.castDur = 0.3;
        w.emit('spearWindup', { x: h.x, y: h.y, face: h.face });
    }
    return true;
}

function updateCast(w: World, h: Hero, inp: InputFrame, dt: number) {
    const sk = h.castSkill!, S = w.cfg.skills[sk];
    if (sk === 'crescent') {
        move(w, h, inp, 0.45);
        // a hit tick in the middle of each spin
        const spinIdx = Math.floor(h.st / S.spinDuration);
        const mid = (h.st % S.spinDuration) >= S.spinDuration * 0.4;
        if (mid && h.castStep <= spinIdx && spinIdx * S.spinDuration < h.castDur) {
            h.castStep = spinIdx + 1;
            for (const e of w.inCircle(h.x, h.y, S.radius)) w.hitEnemy(e, S.damagePerSpin, { src: 'crescent', kb: S.knockback });
            w.emit('crescentTick', { x: h.x, y: h.y, idx: spinIdx });
        }
    } else if (sk === 'meteorSpear') {
        if (h.castStep === 0 && h.st >= 0.12) {
            h.castStep = 1;
            const n = w.mods.spearSplit ? S.splitCount : 1;
            for (let i = 0; i < n; i++) {
                const off = n === 1 ? 0 : (i - (n - 1) / 2);
                const vy = off * S.splitSpread / (S.range / S.speed);
                w.addSpear(h.x + h.face * 40, h.y, h.face * S.speed, vy, S.range);
            }
            w.emit('spearThrow', { x: h.x, y: h.y, face: h.face, n });
        }
    }
    if (h.st >= h.castDur) { h.castSkill = null; setState(h, 'idle'); }
}

export { inEllipse };
