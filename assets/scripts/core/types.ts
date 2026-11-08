/** Core data types. Pure TS, no engine imports. Coordinates: x right, y = ground depth (down = front), z = height. */

export type HeroState = 'idle' | 'run' | 'attack' | 'charge' | 'thrust' | 'thrustRec' | 'dodge' | 'jump' | 'slam' | 'land'
    | 'cast' | 'hurt' | 'dead' | 'ult';

export type EnemyType = 'imp' | 'lantern' | 'brute' | 'boss';

export type EnemyState = 'spawn' | 'chase' | 'orbit' | 'windup' | 'attack' | 'charge' | 'recover' | 'hurt' | 'dead'
    | 'intro' | 'idle' | 'leapAir' | 'summon';

export type SkillName = 'crescent' | 'skyfall' | 'meteorSpear' | 'ultimate';

export interface InputFrame {
    mx: number; my: number;          // move vector, |v| <= 1
    attackHeld: boolean;
    attackPressed: boolean;
    jumpPressed: boolean;
    dodgePressed: boolean;
    skill1: boolean; skill2: boolean; skill3: boolean; ult: boolean;
}

export function emptyInput(): InputFrame {
    return { mx: 0, my: 0, attackHeld: false, attackPressed: false, jumpPressed: false, dodgePressed: false,
        skill1: false, skill2: false, skill3: false, ult: false };
}

export interface Mods {
    attackMul: number; critChance: number; mpRegenMul: number; rageMul: number; cooldownMul: number;
    crescentSpins: number; spearSplit: boolean; dodgeFlame: boolean; dodgeCrit: boolean;
    skyfallRadiusMul: number; skyfallDamageMul: number; killHeal: number;
}

export function defaultMods(): Mods {
    return { attackMul: 0, critChance: 0, mpRegenMul: 0, rageMul: 0, cooldownMul: 0, crescentSpins: 0,
        spearSplit: false, dodgeFlame: false, dodgeCrit: false, skyfallRadiusMul: 0, skyfallDamageMul: 0, killHeal: 0 };
}

export interface Hero {
    x: number; y: number; z: number; vz: number; face: number;
    hp: number; maxHp: number; mp: number; maxMp: number; rage: number;
    state: HeroState; st: number;
    atkStep: number; atkHitDone: boolean; comboWindowT: number; chainQueued: boolean; holdT: number;
    lungeLeft: number;
    attackBuffer: number; dodgeBuffer: number;
    dodgeCd: number; dodgeDx: number; dodgeDy: number; dodgeFlameAcc: number;
    invuln: number; flashT: number; kx: number;
    castSkill: SkillName | null; castDur: number; castStep: number;
    cds: { [k: string]: number };
    nextCrit: boolean; slamming: boolean;
    hitSet: { [id: number]: boolean };
    thrustFromX: number;
    moving: boolean;
}

export interface Enemy {
    id: number; type: EnemyType; x: number; y: number; z: number; vz: number; face: number;
    hp: number; maxHp: number; state: EnemyState; st: number; stDur: number;
    kx: number; ky: number; atkCd: number; token: boolean; orbitA: number;
    flashT: number; hitDone: boolean; deadT: number;
    // charge / leap data
    tx: number; ty: number; dirX: number; dirY: number; travelled: number; fromX: number; fromY: number;
    move: string; enraged: boolean; entered: boolean;
}

export type ProjKind = 'spear' | 'fireball';

export interface Proj {
    id: number; kind: ProjKind; x: number; y: number; z: number;
    vx: number; vy: number; travelled: number; range: number;
    hitSet: { [id: number]: boolean }; emberAcc: number;
    // fireball: parabolic from (fx,fy) to (tx,ty)
    fx: number; fy: number; tx: number; ty: number; t: number; flight: number; arc: number; dead: boolean;
}

export type ZoneKind = 'skyfall' | 'flame';

export interface Zone {
    id: number; kind: ZoneKind; x: number; y: number; r: number; t: number; life: number; tickT: number;
    damage: number; done: boolean;
}

/** Events consumed by view for FX/audio. Free-form payload keyed by type. */
export interface GameEvent { type: string; [k: string]: any; }

export type Phase = 'ready' | 'waveIntro' | 'fight' | 'advance' | 'draft' | 'bossIntro' | 'victory' | 'defeat';

/** Ellipse ratio for ground-plane circles (y compressed). */
export const YR = 0.5;

export function inEllipse(dx: number, dy: number, r: number): boolean {
    const ey = dy / YR;
    return dx * dx + ey * ey <= r * r;
}
