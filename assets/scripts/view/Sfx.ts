/** Audio: real clips from resources/audio (mp3) when ready, otherwise a small WebAudio synth fallback. */
import { AudioSource, Node } from 'cc';
import { Assets } from './Assets';

type Recipe = { kind: 'noise' | 'tone' | 'sweep' | 'boom'; f0?: number; f1?: number; dur: number; vol: number; type?: OscillatorType; q?: number; delay?: number }[];

const R: { [k: string]: Recipe } = {
    swing1: [{ kind: 'noise', f0: 2400, f1: 800, dur: 0.12, vol: 0.25, q: 1.2 }],
    swing2: [{ kind: 'noise', f0: 2800, f1: 900, dur: 0.13, vol: 0.25, q: 1.2 }],
    swing3: [{ kind: 'noise', f0: 1800, f1: 500, dur: 0.18, vol: 0.32, q: 1.5 }],
    charge_thrust: [{ kind: 'noise', f0: 600, f1: 3500, dur: 0.22, vol: 0.32, q: 2 }, { kind: 'tone', f0: 220, f1: 660, dur: 0.2, vol: 0.12, type: 'sawtooth' }],
    hit: [{ kind: 'boom', f0: 180, f1: 60, dur: 0.09, vol: 0.4 }, { kind: 'noise', f0: 3000, f1: 1200, dur: 0.05, vol: 0.2 }],
    hit_crit: [{ kind: 'boom', f0: 220, f1: 50, dur: 0.14, vol: 0.5 }, { kind: 'tone', f0: 1400, f1: 900, dur: 0.12, vol: 0.12, type: 'square' }],
    dodge: [{ kind: 'noise', f0: 900, f1: 2600, dur: 0.18, vol: 0.18, q: 0.8 }],
    jump: [{ kind: 'tone', f0: 300, f1: 520, dur: 0.1, vol: 0.12, type: 'triangle' }],
    land_slam: [{ kind: 'boom', f0: 120, f1: 30, dur: 0.3, vol: 0.6 }, { kind: 'noise', f0: 600, f1: 200, dur: 0.25, vol: 0.3 }],
    player_hurt: [{ kind: 'tone', f0: 420, f1: 180, dur: 0.18, vol: 0.2, type: 'sawtooth' }],
    enemy_hurt: [{ kind: 'tone', f0: 300, f1: 160, dur: 0.08, vol: 0.12, type: 'square' }],
    enemy_die: [{ kind: 'noise', f0: 1200, f1: 200, dur: 0.3, vol: 0.25 }, { kind: 'tone', f0: 260, f1: 80, dur: 0.3, vol: 0.12, type: 'sawtooth' }],
    skill1_crescent: [{ kind: 'noise', f0: 500, f1: 2400, dur: 0.5, vol: 0.32, q: 0.7 }, { kind: 'noise', f0: 3000, f1: 1000, dur: 0.15, vol: 0.3, delay: 0.1 }],
    skill2_charge: [{ kind: 'tone', f0: 200, f1: 900, dur: 0.4, vol: 0.18, type: 'sawtooth' }, { kind: 'tone', f0: 400, f1: 1800, dur: 0.4, vol: 0.08, type: 'sine' }],
    skill2_strike: [{ kind: 'noise', f0: 6000, f1: 800, dur: 0.12, vol: 0.5 }, { kind: 'boom', f0: 140, f1: 30, dur: 0.6, vol: 0.6 }],
    skill3_throw: [{ kind: 'noise', f0: 800, f1: 4000, dur: 0.25, vol: 0.3, q: 2.5 }, { kind: 'noise', f0: 400, f1: 300, dur: 0.6, vol: 0.12, delay: 0.1 }],
    ult_voice: [{ kind: 'tone', f0: 520, f1: 880, dur: 0.35, vol: 0.18, type: 'triangle' }, { kind: 'tone', f0: 660, f1: 1100, dur: 0.4, vol: 0.12, type: 'sine', delay: 0.2 }],
    ult_start: [{ kind: 'tone', f0: 80, f1: 220, dur: 0.8, vol: 0.3, type: 'sawtooth' }, { kind: 'noise', f0: 200, f1: 2000, dur: 0.8, vol: 0.15 }],
    ult_impact: [{ kind: 'boom', f0: 150, f1: 25, dur: 0.45, vol: 0.55 }, { kind: 'noise', f0: 2500, f1: 300, dur: 0.3, vol: 0.3 }],
    fireball_land: [{ kind: 'boom', f0: 160, f1: 50, dur: 0.25, vol: 0.35 }, { kind: 'noise', f0: 1500, f1: 400, dur: 0.25, vol: 0.18 }],
    brute_charge: [{ kind: 'tone', f0: 90, f1: 60, dur: 0.5, vol: 0.3, type: 'sawtooth' }],
    boss_appear: [{ kind: 'boom', f0: 70, f1: 30, dur: 1.2, vol: 0.6 }, { kind: 'tone', f0: 110, f1: 104, dur: 1.4, vol: 0.2, type: 'sawtooth' }],
    boss_slam: [{ kind: 'boom', f0: 110, f1: 25, dur: 0.6, vol: 0.7 }, { kind: 'noise', f0: 900, f1: 150, dur: 0.4, vol: 0.35 }],
    ui_click: [{ kind: 'tone', f0: 880, f1: 660, dur: 0.06, vol: 0.12, type: 'triangle' }],
    card_flip: [{ kind: 'noise', f0: 3000, f1: 1500, dur: 0.07, vol: 0.18 }],
    card_rare: [{ kind: 'tone', f0: 880, f1: 880, dur: 0.15, vol: 0.12, type: 'triangle' }, { kind: 'tone', f0: 1320, f1: 1320, dur: 0.3, vol: 0.12, type: 'triangle', delay: 0.1 }],
    victory: [{ kind: 'tone', f0: 523, f1: 523, dur: 0.2, vol: 0.15, type: 'triangle' }, { kind: 'tone', f0: 659, f1: 659, dur: 0.2, vol: 0.15, type: 'triangle', delay: 0.18 }, { kind: 'tone', f0: 784, f1: 784, dur: 0.5, vol: 0.15, type: 'triangle', delay: 0.36 }],
    defeat: [{ kind: 'tone', f0: 392, f1: 196, dur: 0.9, vol: 0.18, type: 'sawtooth' }],
};

export class Sfx {
    static src: AudioSource | null = null;
    static bgm: AudioSource | null = null;
    static ctx: AudioContext | null = null;
    static last: { [k: string]: number } = {};
    static muted = false;
    static volume = 0.8;
    static stats: { [k: string]: { clip: number; synth: number } } = {};

    static init(root: Node) {
        const n = new Node('audio'); root.addChild(n);
        this.src = n.addComponent(AudioSource);
        const b = new Node('bgm'); root.addChild(b);
        this.bgm = b.addComponent(AudioSource);
        this.bgm.loop = true; this.bgm.volume = 0.35;
    }

    /** Must be called from a user gesture on web. */
    static unlock() {
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (e) { /* ignore */ }
    }

    static play(name: string, vol = 1) {
        if (this.muted) return;
        const now = performance.now();
        if (this.last[name] && now - this.last[name] < 45) return;
        this.last[name] = now;
        const clip = Assets.clip('audio/sfx/' + name);
        const st = this.stats[name] || (this.stats[name] = { clip: 0, synth: 0 });
        if (clip && this.src) { st.clip++; this.src.playOneShot(clip, vol * this.volume); return; }
        st.synth++;
        this.synth(name, vol);
    }

    static playBgm() {
        const clip = Assets.clip('audio/bgm/battle_loop');
        if (clip && this.bgm) { if (this.bgm.clip !== clip) this.bgm.clip = clip; if (!this.bgm.playing) this.bgm.play(); }
    }
    static stopBgm() { if (this.bgm && this.bgm.playing) this.bgm.stop(); }
    static pauseBgm(p: boolean) { if (!this.bgm || !this.bgm.clip) return; if (p) this.bgm.pause(); else this.bgm.play(); }

    private static synth(name: string, vol: number) {
        const r = R[name]; if (!r) return;
        const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
        const t0 = ctx.currentTime;
        for (const p of r) {
            const t = t0 + (p.delay || 0);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(p.vol * vol * this.volume, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
            g.connect(ctx.destination);
            if (p.kind === 'noise') {
                const len = Math.ceil(ctx.sampleRate * p.dur);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                const s = ctx.createBufferSource(); s.buffer = buf;
                const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = p.q ?? 1;
                f.frequency.setValueAtTime(p.f0!, t); f.frequency.exponentialRampToValueAtTime(p.f1!, t + p.dur);
                s.connect(f); f.connect(g); s.start(t); s.stop(t + p.dur);
            } else {
                const o = ctx.createOscillator();
                o.type = p.kind === 'boom' ? 'sine' : (p.type || 'sine');
                o.frequency.setValueAtTime(p.f0!, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, p.f1!), t + p.dur);
                o.connect(g); o.start(t); o.stop(t + p.dur);
            }
        }
    }
}
