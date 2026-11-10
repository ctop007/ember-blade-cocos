/** Spear-tip ribbon geometry. Independent of engine; vertices are emitted as a triangle strip. */
export class TrailStrip {
    points: { x: number; y: number; age: number }[] = [];
    vertices: { x: number; y: number; alpha: number }[] = [];
    indices: number[] = [];
    enabled = false;
    constructor(public width = 14, public life = .14, public capacity = 24) {}
    clear() { this.points = []; this.vertices = []; this.indices = []; this.enabled = false; }
    update(dt: number, tip: { x: number; y: number } | null, frozen = false) {
        if (frozen || dt <= 0) return;
        this.points.forEach(p => p.age += dt); this.points = this.points.filter(p => p.age < this.life);
        if (this.enabled && tip) {
            const last = this.points[this.points.length - 1];
            if (!last || Math.hypot(tip.x - last.x, tip.y - last.y) > .5) this.points.push({ ...tip, age: 0 });
        }
        if (this.points.length > this.capacity) this.points.splice(0, this.points.length - this.capacity);
        this.vertices = []; this.indices = [];
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i], a = this.points[Math.max(0, i - 1)], b = this.points[Math.min(this.points.length - 1, i + 1)];
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, fade = Math.max(0, 1 - p.age / this.life);
            const nx = -(b.y - a.y) / len * this.width * fade / 2, ny = (b.x - a.x) / len * this.width * fade / 2;
            this.vertices.push({ x: p.x + nx, y: p.y + ny, alpha: fade }, { x: p.x - nx, y: p.y - ny, alpha: fade });
            if (i) { const j = i * 2; this.indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
        }
    }
}
