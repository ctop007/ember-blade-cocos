import { Hero } from '../core/types';
import { RigPlayer, Phases } from './RigPlayer';
import { TrailStrip } from './TrailStrip';
/** View-side adapter ready for delivered art. Call once per frame with DELTA WORLD TIME, not wall time.
 * core owns damage and state changes. Animation hit events are presentation-only. */
export class HeroAnimation {
    trail = new TrailStrip(); private stateKey = ''; private lastStateTime = -1;
    constructor(public player: RigPlayer, public cfg: any) {}
    update(hero: Hero, simulationDt: number, face = hero.face) {
        if (simulationDt <= 0) return; // freezes crossfade, springs, events and ribbon during hitstop/pause
        const h = hero, c = this.cfg;
        const names: { [key: string]: string } = { attack: 'attack' + (h.atkStep + 1), jump: h.vz > 0 ? 'jump_up' : 'jump_fall', cast: h.castSkill === 'crescent' ? 'cast_crescent' : h.castSkill === 'skyfall' ? 'cast_skyfall' : 'cast_meteor', thrustRec: 'thrust' };
        const name = names[h.state] || h.state;
        const key = h.state + ':' + name;
        const clip = this.player.clips[name]; if (!clip) return;
        if (key !== this.stateKey || h.st < this.lastStateTime) {
            let duration = clip.duration, hit = -1;
            if (h.state === 'attack') { const s = c.attack.steps[h.atkStep]; duration = s.duration; hit = s.hitAt; }
            else if (h.state === 'cast') duration = h.castDur;
            else if (h.state === 'thrust') duration = c.attack.chargedThrust.duration;
            else if (h.state === 'dodge') duration = c.dodge.duration;
            else if (h.state === 'land') duration = c.jump.landRecovery + (h.slamming ? .1 : 0);
            else if (h.state === 'hurt') duration = c.combat.playerHurtStun;
            let target: Phases | undefined;
            if (clip.phases) {
                const p = clip.phases, ratio = duration / p.recovery;
                const active = hit >= 0 ? hit : p.active * ratio;
                target = { windup: p.active > 0 ? active * p.windup / p.active : 0, active, recovery: duration };
            }
            this.player.play(name, target, h.state === 'dodge' || h.state === 'hurt' ? .06 : .1, true);
            this.trail.clear(); this.stateKey = key;
        }
        this.lastStateTime = h.st;
        this.player.update(simulationDt);
        for (const e of this.player.events) {
            if (e.name === 'trail_on') this.trail.enabled = true;
            else if (e.name === 'trail_off') this.trail.enabled = false;
        }
        const tip = this.player.socket('spearTip'), scale = (this.player.rig.displayScale ?? .6) * (this.player.rig.unitsPerPixel ?? 1);
        this.trail.update(simulationDt, tip ? { x: h.x + tip.x * face * scale, y: h.y - h.z + tip.y * scale } : null);
    }
}
