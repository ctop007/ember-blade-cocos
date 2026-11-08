/** Node factories: sprites, labels, graphics, buttons. All UI is code-built. */
import { Node, Sprite, Label, UITransform, Color, Graphics, Layers, Material, builtinResMgr, gfx, SpriteFrame, ImageAsset, UIOpacity, HorizontalTextAlignment, VerticalTextAlignment, Vec3 } from 'cc';
import { Assets } from './Assets';

export const UI_LAYER = Layers.Enum.UI_2D;

export function hex(s: string, a = 255): Color {
    const c = new Color(); Color.fromHEX(c, s); c.a = a; return c;
}

export function node(name: string, parent?: Node | null, x = 0, y = 0): Node {
    const n = new Node(name);
    n.layer = UI_LAYER;
    n.addComponent(UITransform);
    if (parent) parent.addChild(n);
    n.setPosition(x, y, 0);
    return n;
}

export function size(n: Node, w: number, h: number) { n.getComponent(UITransform)!.setContentSize(w, h); }
export function anchor(n: Node, ax: number, ay: number) { n.getComponent(UITransform)!.setAnchorPoint(ax, ay); }

let addMat: Material | null = null;
/** Shared additive material (one instance so sprites still batch). */
export function additiveMaterial(): Material | null {
    if (addMat) return addMat;
    try {
        const base = builtinResMgr.get<Material>('ui-sprite-material');
        const m = new Material();
        m.initialize({
            effectAsset: base.effectAsset!, defines: { USE_TEXTURE: true },
            states: { blendState: { targets: [{ blend: true, blendSrc: gfx.BlendFactor.SRC_ALPHA, blendDst: gfx.BlendFactor.ONE, blendSrcAlpha: gfx.BlendFactor.SRC_ALPHA, blendDstAlpha: gfx.BlendFactor.ONE }] } },
        });
        addMat = m;
    } catch (e) { console.warn('additive material failed', e); }
    return addMat;
}

/** Sprite from manifest key; w/h default to manifest size * scale. */
export function sprite(key: string, parent: Node | null, w?: number, h?: number, opt: { anchorKey?: boolean; additive?: boolean; color?: Color } = {}): Sprite {
    const n = node(key.split('/').pop() || 'spr', parent);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.trim = false;
    sp.spriteFrame = Assets.frame(key);
    const [mw, mh] = Assets.size(key);
    size(n, w ?? mw, h ?? mh);
    if (opt.anchorKey !== false) { const a = Assets.anchor(key); anchor(n, a[0], a[1]); }
    if (opt.additive) { const m = additiveMaterial(); if (m) sp.customMaterial = m; }
    if (opt.color) sp.color = opt.color;
    return sp;
}

export function setFrame(sp: Sprite, key: string) {
    const f = Assets.frame(key);
    if (sp.spriteFrame !== f) sp.spriteFrame = f;
}

export interface LabelOpt { size?: number; color?: Color | string; outline?: Color | string; outlineW?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; w?: number; h?: number; wrap?: boolean; lh?: number; cache?: boolean; }

export function label(text: string, parent: Node | null, x = 0, y = 0, o: LabelOpt = {}): Label {
    const n = node('lbl', parent, x, y);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = o.size ?? 24;
    l.lineHeight = o.lh ?? Math.round((o.size ?? 24) * 1.25);
    l.color = typeof o.color === 'string' ? hex(o.color) : (o.color ?? hex('#ffffff'));
    l.isBold = o.bold ?? true;
    l.horizontalAlign = o.align === 'left' ? HorizontalTextAlignment.LEFT : o.align === 'right' ? HorizontalTextAlignment.RIGHT : HorizontalTextAlignment.CENTER;
    l.verticalAlign = VerticalTextAlignment.CENTER;
    if (o.w) {
        l.overflow = o.wrap ? Label.Overflow.RESIZE_HEIGHT : Label.Overflow.SHRINK;
        l.enableWrapText = !!o.wrap;
        size(n, o.w, o.h ?? l.lineHeight);
    }
    if (o.align === 'left') anchor(n, 0, 0.5); else if (o.align === 'right') anchor(n, 1, 0.5);
    if (o.outline !== undefined || o.outlineW) {
        l.enableOutline = true;
        l.outlineColor = typeof o.outline === 'string' ? hex(o.outline) : (o.outline ?? hex('#1a0f14'));
        l.outlineWidth = o.outlineW ?? 3;
    }
    if (o.cache) l.cacheMode = Label.CacheMode.CHAR;
    return l;
}

export function gfxNode(parent: Node | null, name = 'gfx'): Graphics {
    const n = node(name, parent);
    return n.addComponent(Graphics);
}

export function opacity(n: Node, a?: number): UIOpacity {
    let o = n.getComponent(UIOpacity);
    if (!o) o = n.addComponent(UIOpacity);
    if (a !== undefined) o.opacity = a;
    return o;
}

/** Full-rect filled Graphics (for masks / dim). */
/** Solid rect as a Sprite on a white texture. (Graphics bakes vertex colour and ignores UIOpacity, so fades need a Sprite.) */
let _white: SpriteFrame | null = null;
export function rect(parent: Node, w: number, h: number, c: Color, name = 'rect'): Sprite {
    if (!_white) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 4;
        const cx = cv.getContext('2d')!; cx.fillStyle = '#fff'; cx.fillRect(0, 0, 4, 4);
        _white = SpriteFrame.createWithImage(new ImageAsset(cv as any)); _white.packable = false;
    }
    const n = node(name, parent);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.trim = false; sp.spriteFrame = _white;
    size(n, w, h); sp.color = c;
    return sp;
}

export function roundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill?: Color, stroke?: Color, lw = 3) {
    g.roundRect(x, y, w, h, r);
    if (fill) { g.fillColor = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeColor = stroke; g.stroke(); }
}

export function contains(n: Node, x: number, y: number, pad = 0): boolean {
    // x,y in the coordinate space of n.parent
    const t = n.getComponent(UITransform)!;
    const p = n.position, s = n.scale;
    const w = t.width * Math.abs(s.x), h = t.height * Math.abs(s.y);
    const l = p.x - w * t.anchorX - pad, b = p.y - h * t.anchorY - pad;
    return x >= l && x <= l + w + pad * 2 && y >= b && y <= b + h + pad * 2;
}

export const V3 = new Vec3();
export type { SpriteFrame };
