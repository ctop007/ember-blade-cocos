/** Promise-based resource loading. Real assets from resources/ (listed in config/available.json), canvas placeholders otherwise. */
import { resources, JsonAsset, SpriteFrame, ImageAsset, AudioClip, Asset, Texture2D } from 'cc';
import { drawPlaceholder } from './PlaceholdersFx';

function load<T extends Asset>(path: string, type: any): Promise<T | null> {
    return new Promise(res => resources.load(path, type, (err: any, a: T) => res(err ? null : a)));
}

interface ManItem { path: string; type: string; size?: number[]; anchor?: number[]; status?: string; displayScale?: number; }

/** ImageAsset from raw RGBA pixels (works on every platform, no canvas needed). */
export function solidImage(w: number, h: number, rgba: number[]): ImageAsset {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
    return new ImageAsset({ _data: data, _compressed: false, width: w, height: h, format: Texture2D.PixelFormat.RGBA8888 } as any);
}

export class Assets {
    static cfg: any;
    static manifest: { [key: string]: ManItem } = {};
    static frames: { [key: string]: SpriteFrame } = {};
    static real: { [key: string]: boolean } = {};
    static clips: { [key: string]: AudioClip } = {};
    static avail = { images: [] as string[], audio: [] as string[], ogg: [] as string[], mp3: [] as string[] };

    /** Load config + manifest + all ready assets. onProgress(0..1). */
    static async init(onProgress: (p: number, label: string) => void) {
        onProgress(0.02, '读取配置');
        const cfg = await load<JsonAsset>('config/game', JsonAsset);
        this.cfg = cfg ? cfg.json : null;
        const man = await load<JsonAsset>('config/manifest', JsonAsset);
        if (man) for (const it of (man.json as any).assets) this.manifest[it.path.replace(/\.png$/, '')] = it;
        const av = await load<JsonAsset>('config/available', JsonAsset);
        if (av) this.avail = av.json as any;
        // pre-baked placeholder PNGs (tools/bake-placeholders.mjs) for art that isn't delivered yet; native has no full Canvas 2D
        const pb = await load<JsonAsset>('config/placeholders', JsonAsset);
        const realSet: { [k: string]: boolean } = {}; for (const k of this.avail.images || []) realSet[k] = true;
        const baked = pb ? ((pb.json as any).keys as string[]).filter(k => !realSet[k]) : [];
        const imgs = (this.avail.images || []).concat(['ui/qr/qr-group', 'ui/qr/qr-author']), auds = this.avail.audio || [];
        const total = imgs.length + baked.length + auds.length + 1;
        let done = 0;
        const tick = (label: string) => { done++; onProgress(0.05 + 0.9 * done / total, label); };
        // load in small parallel batches
        const jobs: (() => Promise<void>)[] = [];
        for (const k of imgs) jobs.push(async () => {
            const f = await load<SpriteFrame>(k + '/spriteFrame', SpriteFrame);
            if (f) { this.frames[k] = f; this.real[k] = true; }
            tick('加载美术');
        });
        for (const k of baked) jobs.push(async () => {
            const f = await load<SpriteFrame>('placeholders/' + k + '/spriteFrame', SpriteFrame);
            if (f) this.frames[k] = f;
            tick('加载美术');
        });
        // ogg first where the platform can decode it (Safari/iOS can't reliably), mp3 as fallback
        const oggOk = Assets.canOgg();
        const oggSet: { [k: string]: boolean } = {}; for (const k of this.avail.ogg || []) oggSet[k] = true;
        const mp3Set: { [k: string]: boolean } = {}; for (const k of this.avail.mp3 || auds) mp3Set[k] = true;
        for (const k of auds) jobs.push(async () => {
            let c: AudioClip | null = null;
            if (oggOk && oggSet[k]) c = await load<AudioClip>('ogg/' + k, AudioClip);
            if (!c && mp3Set[k]) c = await load<AudioClip>(k, AudioClip);
            if (c) { this.clips[k] = c; this.clipFmt[k] = (oggOk && oggSet[k] && c.nativeUrl.indexOf('.ogg') >= 0) ? 'ogg' : 'mp3'; }
            tick('加载音效');
        });
        let i = 0;
        const worker = async () => { while (i < jobs.length) { const j = jobs[i++]; await j(); } };
        await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
        tick('准备场景');
        onProgress(1, '完成');
    }

    static size(key: string): [number, number] {
        const it = this.manifest[key];
        if (it && it.size) return [it.size[0], it.size[1]];
        return [128, 128];
    }

    /** Anchor in Cocos convention (0,0 = bottom-left). Manifest uses top-left origin. */
    static anchor(key: string): [number, number] {
        const it = this.manifest[key];
        if (it && it.anchor) return [it.anchor[0], 1 - it.anchor[1]];
        return [0.5, 0.5];
    }

    /** Recommended display scale from manifest (chars). */
    static displayScale(key: string): number {
        const it = this.manifest[key];
        return it && it.displayScale ? it.displayScale : 1;
    }

    static isReal(key: string): boolean { return !!this.real[key]; }

    static frame(key: string): SpriteFrame {
        let f = this.frames[key];
        if (f) return f;
        const [w, h] = this.size(key);
        // keep placeholder textures modest
        const s = Math.min(1, 1024 / Math.max(w, h));
        const cw = Math.max(4, Math.round(w * s)), ch = Math.max(4, Math.round(h * s));
        let img: ImageAsset;
        try { img = new ImageAsset(drawPlaceholder(key, cw, ch) as any); }
        catch (e) { img = solidImage(4, 4, [200, 200, 200, 160]); } // e.g. native: partial Canvas 2D
        f = SpriteFrame.createWithImage(img);
        f.packable = false;
        (f as any)._placeholderScale = 1 / s;
        if (this.manifest[key]) this.frames[key] = f; // don't cache fallback-size frames made before the manifest loads
        return f;
    }

    static clipFmt: { [k: string]: string } = {};
    static canOgg(): boolean {
        try {
            const doc = (globalThis as any).document; if (!doc) return true; // native: engine decodes ogg
            const a = doc.createElement('audio');
            return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
        } catch (e) { return false; }
    }

    static clip(key: string): AudioClip | null { return this.clips[key] || null; }
}
