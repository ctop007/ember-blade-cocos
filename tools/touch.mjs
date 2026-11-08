// Multi-touch helper over CDP Input.dispatchTouchEvent (real browser touch events, several fingers at once).
export class Touch {
    constructor(page, cdp) { this.page = page; this.cdp = cdp; this.pts = new Map(); this.nextId = 1; }
    list() { return [...this.pts.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 6, radiusY: 6, force: 1 })); }
    async down(x, y) {
        const id = this.nextId++;
        this.pts.set(id, { x, y });
        await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.list() });
        return id;
    }
    async move(id, x, y) {
        if (!this.pts.has(id)) return;
        this.pts.set(id, { x, y });
        await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.list() });
    }
    async up(id) {
        if (!this.pts.has(id)) return;
        this.pts.delete(id);
        if (this.pts.size === 0) await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.list() });
    }
    async tap(x, y, hold = 60) { const id = await this.down(x, y); await this.page.waitForTimeout(hold); await this.up(id); }
    async releaseAll() { this.pts.clear(); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
}
