import { Rig, Clip } from './RigPlayer';
/** Intentionally plain blocks: validates articulation without depending on production art. */
export const testRig: Rig = {
    version: 1, unitsPerPixel: 1,
    bones: [
        { name: 'root', parent: null }, { name: 'hip', parent: 'root', y: -60 },
        { name: 'chest', parent: 'hip', y: -50 }, { name: 'head', parent: 'chest', y: -40 },
        { name: 'arm', parent: 'chest', x: 8 }, { name: 'spear', parent: 'arm', x: 50 },
        { name: 'hair1', parent: 'head', x: -15, rot: 100, length: 25 },
        { name: 'hair2', parent: 'hair1', x: 25, length: 25 }
    ],
    slots: [
        { name: 'body', bone: 'chest', image: 'body', pivot: [.5, 0], z: 1 },
        { name: 'head', bone: 'head', image: 'head', pivot: [.5, .5], z: 2 },
        { name: 'arm', bone: 'arm', image: 'arm', pivot: [0, .5], z: 3 },
        { name: 'spear', bone: 'spear', image: 'spear', pivot: [0, .5], z: 4 },
        { name: 'hair1', bone: 'hair1', image: 'hair', pivot: [0, .5], z: 0 },
        { name: 'hair2', bone: 'hair2', image: 'hair', pivot: [0, .5], z: 0 }
    ], springs: [{ bones: ['hair1', 'hair2'], stiffness: 120, damping: 12, gravity: 10 }],
    sockets: { spearTip: { bone: 'spear', x: 100, y: 0 } }
};
export const testClips: { [key: string]: Clip } = {
    idle: { duration: 2.4, loop: true, bones: { chest: [{ t: 0, sy: 1 }, { t: 1.2, sy: 1.02, ease: 'sineInOut' }, { t: 2.4, sy: 1, ease: 'sineInOut' }] } },
    attack1: { duration: .28, loop: false, phases: { windup: .06, active: .08, recovery: .28 },
        bones: { arm: [{ t: 0, rot: -30 }, { t: .06, rot: -110, ease: 'quadOut' }, { t: .10, rot: 60, ease: 'expoOut' }, { t: .28, rot: 10, ease: 'sineInOut' }], chest: [{ t: .06, rot: -15 }, { t: .12, rot: 15 }, { t: .28, rot: 0 }] },
        slots: { spear: [{ t: .1, image: 'smear', z: 6 }, { t: .13, image: 'spear', z: 4 }] },
        events: [{ t: .06, name: 'trail_on' }, { t: .08, name: 'hit' }, { t: .14, name: 'trail_off' }, { t: .06, name: 'sfx', arg: 'swing1' }] }
};
