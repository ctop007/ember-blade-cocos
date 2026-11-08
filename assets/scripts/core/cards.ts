import { Rng } from './rng';
import { Mods } from './types';

export interface CardDef { id: string; name: string; rarity: 'common' | 'rare' | 'epic'; desc: string; effect: any; unique?: boolean; }

/** Draw `n` distinct cards, weighted by rarity, excluding unique cards already taken. */
export function drawCards(cards: CardDef[], weights: any, taken: string[], n: number, rng: Rng): CardDef[] {
    const pool = cards.filter(c => !(c.unique && taken.indexOf(c.id) >= 0));
    const out: CardDef[] = [];
    while (out.length < n && pool.length > 0) {
        let total = 0;
        for (const c of pool) total += weights[c.rarity] || 1;
        let r = rng.next() * total;
        let idx = 0;
        for (; idx < pool.length; idx++) { r -= weights[pool[idx].rarity] || 1; if (r <= 0) break; }
        idx = Math.min(idx, pool.length - 1);
        out.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return out;
}

/** Apply card effect to mods; returns immediate {maxHp, heal} for the hero. */
export function applyCard(mods: Mods, card: CardDef): { maxHp: number; heal: number } {
    const e = card.effect || {};
    const res = { maxHp: 0, heal: 0 };
    for (const k in e) {
        const v = e[k];
        switch (k) {
            case 'maxHp': res.maxHp += v; break;
            case 'heal': res.heal += v; break;
            case 'spearSplit': mods.spearSplit = !!v; break;
            case 'dodgeFlame': mods.dodgeFlame = !!v; break;
            case 'dodgeCrit': mods.dodgeCrit = !!v; break;
            default:
                if (typeof (mods as any)[k] === 'number') (mods as any)[k] += v;
        }
    }
    return res;
}
