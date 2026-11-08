# ENGINE_NOTES：Cocos Creator 3.8.8

## 运行方式

- Web：`python3 -m http.server 8942 -d build/web-mobile`，然后打开 <http://127.0.0.1:8942/>（加 `?debug` 会挂载 `window.__AI_BRIDGE__`）。
- 构建：先关掉本项目的编辑器，再运行 `CocosCreator --project "$PWD" --build "platform=web-mobile"`。成功时退出码是 **36**，不是 0。每次构建大约 12 秒。
- APK：运行 `./tools/build-android.sh`，详见文末“APK 打包体验”。

## 实测数据

测试环境：Playwright 驱动 Chrome（macOS，`isMobile` + `hasTouch`，DPR 2），本地 http.server。

| 项目 | 数值 |
|---|---|
| Web 产物大小 | `build/web-mobile` 共约 22 MB（加入骨骼部件与重制 HUD 后）（10 MB 时尚无首页背景、Logo、大招立绘/横幅；新增约 4 MB，另有 0.65 MB 预烘焙占位图），其中 resources 15 MB，引擎和脚本约 3 MB |
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

## 骨骼动画实现对比

- **数据**：直接播放 `_shared/rigs/hero/` 的 `rig.json` + `anims.json`，按 ANIMATION.md 4.1 实现。关键帧是相对 setup pose 的增量，每个属性单独插值，ease 写在目标帧上；`keyMode:absolute` 也支持。`phases` 按玩法时长拉伸：attack 的 active 对齐 `hitAt`、recovery 对齐 `duration`，其他状态对齐 core 的状态时长。边界会收敛到同一实例，避免 active==recovery 时出现空段。
- **渲染**：纯 TS 的 `RigPlayer` 计算骨骼世界矩阵，Cocos 里每个 slot 一个 Sprite，按 z 稳定排序，pivot 转成锚点。部件换图和换层走 slot 轨道，alpha 走 `UIOpacity`。y 轴和旋转方向在这里取反一次。
- **弹簧骨**：发髻 2 节、左右衣摆、枪缨各一组。按世界角度做弹簧，受父骨转动和重力的切向分量驱动，固定 1/120s 子步防止刚性弹簧发散。所以跑动、急停和转身时，发髻和衣摆会甩出去再回弹。
- **手感层**（视图侧，core 不受影响）：
  - 状态切换时快照当前姿势，0.06–0.12s 内交叉淡入，不再硬切。
  - 输入缓冲 0.2s（`attack.chainBuffer`）：闪避和攻击按下后，在不可行动状态里也会记住，条件满足立即执行。
  - 后摇取消：普攻命中 0.06s 后就能被下一段普攻或闪避取消，不必等完整 duration。
  - 前冲和蓄力突进改成位移曲线积分，起点快、末段慢，总距离和帧率无关。
  - 刀光改成跟随 `spearTip` 插槽轨迹的条带网格，由动画里的 `trail_on/trail_off` 事件开关。
  - 顿帧时 `HeroAnimation` 不推进，姿势、弹簧和拖尾都停住；`h.st` 本身不前进，所以不会补帧跳变。
- **对比开关**：默认骨骼。`?rig=0` 用旧单图，`?rig=1` 用骨骼，运行时也可以用桥接 `rigMode(false/true)` 切换。
- **性能**（20 只敌人 + 持续普攻，每帧主线程耗时，两版同一构建）：
  | 节流 | 旧单图 | 骨骼 |
  |---|---:|---:|
  | 1× | 1.0–1.4 ms | 1.3 ms |
  | 4× | 4.5–4.6 ms | 4.6–4.8 ms |
  | 6× | 5.2–6.8 ms | 5.1–5.7 ms |
  FPS 两边都是 60。骨骼新增约 0.1–0.3 ms/帧，没有明显下降。

## 实现差异

- **输入和多点触控**：全屏只有一个输入层节点，通过 `TOUCH_START/MOVE/END` 拿到 `touch.getID()`，自己按 ID 追踪每根手指。摇杆是动态的（左半屏任意位置按下即出现），按钮按距离判定（半径 +12px）。Cocos 的事件已经正确区分了多指，没有遇到吞事件的问题。键盘（WASD/JKL/UIOP）只给桌面调试用，UI 上不显示按键提示。
- **粒子与特效**：没用 ParticleSystem2D，而是自己写了一个 Sprite 对象池（上限 260），按“地面层/上层 × 普通/加法混合”分 4 组，尽量保留合批。加法混合是 clone 一份 `ui-sprite-material`，改 blend 为 SRC_ALPHA/ONE，全局共享一个实例。特效贴图都是白色，用 `Sprite.color` 染色。
- **补间**：UI 动画（抽卡飞入/翻牌、横幅、Boss 标题、结算面板）用 `tween()`；战斗内的特效全部在 `Fx.update(dt)` 里手动推进，这样能统一受顿帧和暂停控制。
- **y 排序**：核心层用 x / y（纵深）/ z（高度）三个坐标，视图层 y = 360 − y + z。每帧按脚底 y 对实体节点排序，用的是 `setSiblingIndex`，只在顺序变化时才调用。
- **顿帧和震屏**：顿帧放在核心层（`world.hitstop`，冻结 `step()`），保证逻辑和表现一致。震屏只在视图层做，幅度 ≤ 4px，0.1 s 内衰减。
- **音频**：`AudioSource.playOneShot` 加同名 45 ms 节流。ogg 放 `resources/ogg/`、mp3 放 `resources/`（同名同目录会冲突），能解码 ogg 时优先 ogg，否则 mp3；缺失时 WebAudio 合成音兜底。实测 28 个音频全部走真实 ogg。
- **无人物语音**：按负责人要求，游戏里不放任何人物台词配音（包括大招 `ult_voice`），也不使用 TTS 替代。`sync-assets.mjs` 会过滤掉所有名字含 voice 的音频，本地 manifest 副本里也删掉这些条目。播放调用和合成兜底已经删除，Web 和 APK 产物里都查不到 voice 文件或引用。大招只保留技能名文字、立绘、`ult_start` 起手音和 `ult_impact` 爆炸音。
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

- UI 与特效素材已全部到货，预烘焙占位图机制保留作为缺图兜底（`tools/bake-placeholders.mjs`）。
- 战斗 HUD 按 `_shared/UI_LAYOUT.md` 以 CSS 像素实现：主攻 34/36、闪跳 21/23、技能 22/23、大招 25/26（视觉/热区半径），触区互不交叠；同一按钮的第二根手指会被忽略。右上暂停旁常显「乃秀游戏 Demo」。
- 敌人（小鬼、灯笼怪、重甲、Boss）仍是单图姿势，等 t3k 的 rig 到货后按同一播放器接入。
- 共享配置直接使用，不再有本地覆盖。groundTop=440 和 sweep.range=200 已经合进共享的 game.json。
- 所有资源在启动时一次性预加载，首屏约 9 MB。如果要上线，应该改成按波次分包，PNG 转 webp 或压缩纹理。

## APK 打包体验

- **产物**：`_deliverables/ember-cocos.apk`，39.6 MB（versionCode 2，versionName 1.1，debug，只含 arm64-v8a；已包含主角骨骼部件与重制 HUD 全部 125 项正式素材）。其中 `libcocos.so` 解压后 73 MB，是体积的大头。
- **aapt2 核对**：package `com.yuen7.ember.cocos`，versionCode 2（versionName 1.1），label `烬刃·Cocos版`，minSdk 21，targetSdk 34，compileSdk 36，native-code 只有 `arm64-v8a`。主 Activity 的 `screenOrientation=6`（sensorLandscape），声明了 `android.hardware.screen.landscape`，带 roundIcon。apksigner 显示签名证书是 `CN=Android Debug`（`~/.android/debug.keystore`）。
- **配置**：`tools/build/android.json` 通过 `--build "configPath=..."` 传入。字段包括 packageName、横屏的 orientation（landscapeLeft/Right）、apiLevel 34、appABIs `["arm64-v8a"]`、keystore 四项、sdkPath、ndkPath（27.1.12297006）、javaHome（JBR 17）、渲染后端 gles3、`debug: false`（关掉左下角的统计面板）。
- **图标**：放在 `native/engine/android/res`，这个目录要提交，构建时会拷进工程。各 density 的 `ic_launcher`、`ic_launcher_round`、`ic_launcher_foreground`（按 108dp 画布内缩到 84dp）都由 `_shared/assets/ui/app-icon.png` 生成，另有 `mipmap-anydpi-v26` 的 adaptive XML，背景色 #2a1630。AndroidManifest 里手动补了 `android:roundIcon`。
- **坑**：
  1. CLI 的 android 构建只生成 `build/android/proj`，不出 APK，退出码同样是 36。要再进 proj 运行 `./gradlew assembleDebug`，`tools/build-android.sh` 把这两步串起来了。第一次构建会下载 gradle 8.11.1，再编译 C++，大约 10 分钟。之后增量构建不到 1 分钟。
  2. **原生端没有完整的 Canvas 2D**：`getContext('2d')` 返回 null。第一版 APK 在首页画占位图时抛出 `addColorStop of null`，结果黑屏，只有 1 个 draw call。修法：白色贴图改用原始 RGBA 像素生成 `ImageAsset`。还没到货的图先在 Web 上用 `tools/bake-placeholders.mjs` 烘焙成 PNG，放进 `resources/placeholders/`。运行时如果还缺图，就退回一张纯色贴图。
  3. 用 `window.setTimeout` 移除的输入锁和抽卡回调，统一改成 `tween().delay().call()`，由引擎调度，Web 和原生端行为一致。
  4. adb 冒烟时点不到按钮，其实是我把屏幕坐标算错了，触摸本身正常。加了一行 `input.on(TOUCH_START)` 日志才确认触摸已经进到引擎。另外 zsh 不会把 `$D` 拆成多个参数，`adb -s $D` 会失败，要用函数包一层。
- **真机冒烟**：Samsung SM-G9980（Android 15，3200×1440），`adb install -r` 成功。启动后是横屏（ROTATION_90），首页 60 fps，进战斗后摇杆、普攻连击和炎月斩都正常，失败结算和“再来一局”也正常，logcat 里没有 JS 报错。只操作了本包，没动其他 App。
- **无人物语音**：APK 解包后，没有任何文件名含 voice，也搜不到 `ult_voice` 或台词文本。包内共 56 个音频文件，即 28 个音效/BGM 各有 ogg 和 mp3 两份。
