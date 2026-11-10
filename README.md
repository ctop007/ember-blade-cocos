# 烬刃 · Cocos Creator 3.8.8 版

横版 2.5D 动作试玩（手机横屏）。代码优先：一个场景 `assets/Main.scene`、一个入口组件 `GameLaunch`，所有 UI 和实体都在 TS 里生成。主角与 4 类敌人（小鬼、灯笼怪、重甲、Boss）全部使用 `_shared/rigs/` 的骨骼动画（`?rig=0` 可切回旧单图对比）。

## 本地运行 Web 版（端口 8942）

```bash
python3 -m http.server 8942 -d build/web-mobile
```

打开 <http://127.0.0.1:8942/>（手机横屏，或在桌面浏览器里开设备模拟）。加上 `?debug` 会挂载 `window.__AI_BRIDGE__`，供自动化测试使用。

## 构建

先关掉本项目的 Cocos 编辑器。

```bash
# Web（成功时退出码为 36）
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project "$PWD" --build "platform=web-mobile"
# Android 调试 APK（arm64-v8a，用 debug keystore 签名）
./tools/build-android.sh
```

## 目录

- `assets/scripts/core/`：纯逻辑（不 import cc），包括世界、主角、敌人、投射物、抽卡。可以用 `tools/sim.ts` 无头跑。
- `assets/scripts/animation/`：引擎无关的骨骼播放器（`RigPlayer`）、刀光条带（`TrailStrip`）和主角动状态适配（`HeroAnimation`）。
- `assets/scripts/view/`：表现层，包括战斗视图、骨骼渲染（`SkelView`）、特效、技能特效、HUD、触摸输入、各个界面、占位图。
- `assets/resources/`：从 `_shared/` 同步来的配置和资源，用 `node tools/sync-assets.mjs` 同步。
- `tools/`：Playwright 测试和工具。`play.mjs` 用真实多点触控打完整局，`perf.mjs` 测性能，`smoke.mjs` 是冒烟测试，`sim.ts` 是无头逻辑测试。

## 测试

```bash
cd tools && npm i
node play.mjs 844 390          # 真实触摸打完整局（WIN=1 时开无敌，用来走通胜利流程）
node perf.mjs 844 390          # 首屏、FPS（含 4× CPU 节流下大招 + 20 敌）
node bench_unified.mjs --url=http://127.0.0.1:8942/index.html --rig=0 --out=tools/shots/bench-cocos-sprite.json
node bench_unified.mjs --url=http://127.0.0.1:8942/index.html --rig=1 --out=tools/shots/bench-cocos-skel.json
# 统一口径性能基准（与 demo_godot/tools/bench_unified.mjs 相同）：844×390、20 敌人、按住普攻、god、
# 每档 CPU 节流 10 秒，同时记录 rAF 回调内 busy 与帧间隔 gap 的 p50/p95
```
