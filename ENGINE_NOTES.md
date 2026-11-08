# ENGINE_NOTES：Cocos Creator 3.8.8

## 运行方式

- Web：`python3 -m http.server 8942 -d build/web-mobile`，然后打开 <http://127.0.0.1:8942/>（加 `?debug` 会挂载 `window.__AI_BRIDGE__`）。
- 构建：先关掉本项目的编辑器，再运行 `CocosCreator --project "$PWD" --build "platform=web-mobile"`。成功时退出码是 **36**，不是 0。每次构建大约 12 秒。
- APK：运行 `./tools/build-android.sh`，详见文末“APK 打包体验”。

## 实测数据

测试环境：Playwright 驱动 Chrome（macOS，`isMobile` + `hasTouch`，DPR 2），本地 http.server。

| 项目 | 数值 |
|---|---|
| Web 产物大小 | `build/web-mobile` 共 10 MB。其中 assets 6.9 MB（主要是角色、背景、特效的 PNG），引擎和脚本约 3 MB |
| 首屏传输 | 157 个请求，约 9.2 MB（所有 ready 资源都在启动时预加载） |
| 首屏加载时间 | 从 goto 到首页可点击：2.2–2.5 s（本地，未节流） |
| 普通战斗 FPS（1×） | 60（p95 帧间隔 16.8 ms） |
| 21 只敌人 + 普攻，CPU 节流 4× | 59.2 FPS（p95 16.7 ms，最差 33 ms） |
| 21 只敌人 + 大招，CPU 节流 4× | **59.1 FPS**（p95 16.7 ms，最差 33 ms），大招结束后剩余粒子 108 个 |
| JS 堆 | 约 33 MB（`performance.memory`） |

完整一局的回归测试用 `tools/play.mjs`，全程真实触摸（CDP `Input.dispatchTouchEvent` 支持多指）：

- 视口 844×390 和 667×375 都 **ALL PASS**。覆盖的操作：摇杆、三段普攻、长按蓄力突刺、按住摇杆的同时点闪避、跳跃接下劈、三个技能、大招、三次抽卡（发牌动画期间点击被正确忽略）、Boss 标题、结算、再来一局。
- 机器人不会躲技能，正常打一般死在 Boss 手上，用时 61–79 s。`WIN=1` 时开无敌，走通胜利流程，用时约 96 s。
- 核心逻辑的无头模拟 `tools/sim.ts` 跑了 3 个种子，2 胜 1 负，单局 65–85 s。

## 实现差异

- **输入和多点触控**：全屏只有一个输入层节点，通过 `TOUCH_START/MOVE/END` 拿到 `touch.getID()`，自己按 ID 追踪每根手指。摇杆是动态的（左半屏任意位置按下即出现），按钮按距离判定（半径 +12px）。Cocos 的事件已经正确区分了多指，没有遇到吞事件的问题。键盘（WASD/JKL/UIOP）只给桌面调试用，UI 上不显示按键提示。
- **粒子与特效**：没用 ParticleSystem2D，而是自己写了一个 Sprite 对象池（上限 260），按“地面层/上层 × 普通/加法混合”分 4 组，尽量保留合批。加法混合是 clone 一份 `ui-sprite-material`，改 blend 为 SRC_ALPHA/ONE，全局共享一个实例。特效贴图都是白色，用 `Sprite.color` 染色。
- **补间**：UI 动画（抽卡飞入/翻牌、横幅、Boss 标题、结算面板）用 `tween()`；战斗内的特效全部在 `Fx.update(dt)` 里手动推进，这样能统一受顿帧和暂停控制。
- **y 排序**：核心层用 x / y（纵深）/ z（高度）三个坐标，视图层 y = 360 − y + z。每帧按脚底 y 对实体节点排序，用的是 `setSiblingIndex`，只在顺序变化时才调用。
- **顿帧和震屏**：顿帧放在核心层（`world.hitstop`，冻结 `step()`），保证逻辑和表现一致。震屏只在视图层做，幅度 ≤ 4px，0.1 s 内衰减。
- **音频**：`AudioSource.playOneShot` 加同名 45 ms 节流。音频还没交付，目前全部用 WebAudio 合成音兜底，等 mp3 就绪后自动切换。只加载 mp3：ogg 和 mp3 同名，同时放进 resources 会冲突。
- **Web 导出的坑**：
  1. **`Graphics` 不受 `UIOpacity` 影响**。顶点色是绘制时烘焙进去的，导致全屏遮罩的渐隐失效：抽卡遮罩变成纯黑，大招压暗直接黑屏。现在改成在白色贴图的 Sprite 上染色。
  2. 用 canvas 画的占位图如果在 manifest 加载之前就生成并缓存，会按 128×128 的兜底尺寸画，显示时被放大裁切（首页 logo 就是这样坏的）。
  3. 构建成功的退出码是 36。编辑器开着时 CLI 构建会和它抢项目锁。
  4. TS 的 target 不含 ES2017 的 `padStart`。
  5. 唯一的 404 是浏览器自动请求的 `favicon.ico`，无害。

## AI 开发体验

- **顺畅的部分**：Code-First 写法（一个场景、一个入口组件）让几乎所有工作都能在 TS 里完成，不用碰编辑器。CLI 构建稳定，大约 12 秒。core/ 是纯 TS，可以脱离引擎用 tsc + node 做无头模拟，调数值、查逻辑 bug 很快。Playwright 加 `?debug` 桥接（`buttonPos`、`cardPos`、事件计数）能直接断言每个动作都真的触发了。
- **需要人工介入的部分**：MCP 扩展第一次需要人在编辑器里启用。会话里的 MCP 工具在启动时没连上，后来改用 curl 调 JSON-RPC。场景和 `.meta` 只能通过编辑器或 MCP 生成，不能手写 UUID。
- **报错定位**：TS 编译报错很好定位。渲染类问题（Graphics 透明度、占位图缓存）不报任何错，只能靠截图发现，所以每个界面都要截图核对。

## 未完成项和已知问题

- 音频（BGM 和音效）、大招立绘、大招横幅、UI 美术还没交付。目前分别用合成音和 canvas 占位，资源就绪后运行 `node tools/sync-assets.mjs` 再重新构建即可替换。
- 本地对共享配置做了两处覆盖（`tools/config-overrides.json`），已同步给负责人：
  - `world.groundTop` 改为 440，按新背景的可走区域。
  - `boss.moves.sweep.range` 改为 200，原值 220。Boss 横扫帧里刀尖距中心约 188px（640 画布 × 0.6），原值比美术长了约 30px。
- 所有资源在启动时一次性预加载，首屏约 9 MB。如果要上线，应该改成按波次分包，PNG 转 webp 或压缩纹理。

<!-- APK -->
