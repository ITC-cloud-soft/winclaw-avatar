# 数字人 `/digital-human` 全语音控制 + 稳定性优化 —— 综合设计方案(待 review)

- 状态: **草案 / 待 review**(未实装)· **需与 ai-meta `docs/11` 联合实装**(视觉统一 + 集成边界)
- 日期: 2026-07-02(2026-07-02 增补:§4.4/4.5/4.6 视觉统一 + 响应式 + ai-meta 集成边界;§9 验证方案)
- 关联: `docs/dh-qwen35-function-calling-proposal.md`(工具/函数调用)、`docs/dh-brain-on-winclaw-musetalk-render-plan.md`(道B 架构)、`docs/dh-secretary-skill-creator-pipeline.md`(技能化)、**`ai-meta-poc/docs/11-client-admin-redesign-billing-mobile-plan.md`(品牌视觉正本 + 收费/配额)**、**`ai-meta-poc/docs/mockups/chat.html`(本页视觉 SSOT)**、memory `aimeta-dh-secretary-A` / `aimeta-commercial-redesign`
- 目标: **「通过语音控制一切」** —— `/digital-human` 上的所有显示与功能按钮都工具化,数字人可通过语音调用;同时保留按钮的手动操作(语音/按钮双通道等价)。**画面风格与 ai-meta 统一、PC/手机自适应**。附带解决当前任务执行的**不稳定**问题。

---

## 0. 背景

当前 `/digital-human`(节点 winclaw-avatar 控制台,道B MuseTalk + Qwen3.5-omni brain)已实现:
- Qwen 作为 brain,通过 6 个 function-calling 工具(`ask_winclaw` / `memory_search` / `memory_get` / `task_run` / `channel_send` / `internet_search`)驱动 winclaw。
- `task_run` 委托 winclaw 的 **metacoder agent lane**(glm-5.2 via z.ai)执行实际任务(生成 PDF / HTML / 演示等)。
- 右侧秘书面板(`secretary-panel`)显示对话/字幕、任务&成果物、资料 Slot。
- 底部控制条:麦克风、摄像头、数字人 ON/OFF、语音选择。

本方案在此基础上,回答 3 件事:
1. **确认**:英伟达 PDF 是否确由 winclaw 调用 metacoder 生成?
2. **稳定性**:任务执行为何不稳定?优化空间?
3. **全语音控制**:把所有 UI 显示/按钮工具化,语音可调用。

---

## 1. 确认:PDF 由 winclaw 调用 metacoder agent 生成 ✅

**是的。** 2026-07-02 08:06 的实测日志证据(节点 `winclaw_lc`):

```
[Qwen] function_call: task_run (call_31e1…) args={"taskName":"document.generate_pdf",
       "args":{"title":"英伟达投资价值分析报告","content":"…"}}
[DH] 🔧 Qwen→tool: task_run …
[GW:agent:main:main] ↗️ chat.send  msg="タスク実行: document.generate_pdf を実行してください。…"
[agent/embedded] [metacoder] routing coding turn through ported engine: runId=bbce31e9… model=glm-5.2
→ 生成 nvidia_report_cn.html(21KB) + generate_nvidia_pdf.js(playwright) → 英伟达投资分析报告.pdf(174KB)
```

链路: **用户语音 → Qwen(brain)决定调用 `task_run` → winclaw ToolRouter → GatewayBridge.chatSend → metacoder agent lane(glm-5.2 ported Claude Code engine)→ 实际写代码 + 执行 → 产出成果物**。Qwen 本身不写 PDF,只做意图识别 + 工具调用 + 语音播报。

---

## 2. 稳定性分析与优化方案

### 2.1 观测到的不稳定根源

| # | 现象 | 根因 | 严重度 |
|---|---|---|---|
| S1 | 首次英伟达任务「没执行」 | 部署时重建容器,用户 tab 的 WS 会话被切断 | 中(仅开发期) |
| S2 | 任务耗时长、耗时不定(英伟达 PDF 约 10.5 分) | metacoder **每次从零现写** HTML+脚本,还多次试错(观测到 `generate_nvidia_pdf_v2.py` / `.py` / `.js` 三个版本) | **高** |
| S3 | 完成后无语音通知 | 异步回执 `lateTimeoutMs=10分` < 任务耗时 → 通知被丢弃;且通知只发给发起时的 session,用户重连后收不到 | 高(**已修复**,见 2.3) |
| S4 | 成果物列表不自动刷新 | `secretary-panel` 的 `loadNodeFiles()` 仅挂载时 1 次 + 手动按钮 | 高(**已修复**,见 2.3) |
| S5 | metacoder 读取既有 PDF 崩溃 | coding-engine dist **缺 `pdf.worker.mjs`**(`Setting up fake worker failed`) | 中 |
| S6 | Qwen `response_idle_timeout`(300 秒无响应关闭) | 长任务期间 realtime 会话空转 | 中 |
| S7 | 单一 agent lane 串行 | `agent:main:main` 串行处理,PDF 任务排在 `internet_search` 之后 → 累计更久 | 中 |

### 2.2 已修复(2026-07-02,本次)

- **S3**: `lateTimeoutMs` 10 分 → **25 分**;`scheduleLateDelivery` 改为 **broadcast**(`notify.dh` 省略 sessionId → `dh-notify:broadcast`,重连也能收到);超时文案由「失败」改为「处理中,完成后会显示在成果物列表」。
- **S4**: `secretary-panel` 增加 `REFRESH_MS=5000` 的 `startRefresh()`,持续刷新任务 + 成果物;新成果物触发 `secretary-artifact-new` 事件。

### 2.3 优化方案(建议,待实装)

**★ O1 —— 常用任务技能化(最大收益,治 S2/S7)**
当前 `document.generate_pdf` 是「让 glm-5.2 现场即兴写代码」,导致:慢(10 分)、不确定(多次试错)、易崩(S5)。
**方案**:把高频任务类型固化为 winclaw **skill**(确定性流水线),而非每次现写:
- `document.generate_pdf`:固定模板(内容生成 → HTML 模板注入 → playwright 渲染),只让 LLM 产「内容 JSON」,渲染由固定脚本完成。
- `presentation.create` / `html.create_simulation` 同理。
- 与既有 `skill-creator` / 自我进化引擎(`docs/dh-secretary-skill-creator-pipeline.md`)对接:第一次现写成功后,自动沉淀为 skill,后续直接调用。
- **收益**:耗时从 ~10 分降到 ~1-2 分,消除试错版本,消除 S5(不再需要读参考 PDF)。

**O2 —— 进度心跳(治「等太久没反馈」的体感)**
metacoder 长任务中,每 N 秒经 `notify.dh`(broadcast)推一条进度:「正在收集资料…」「正在生成 PDF…」。数字人语音播报进度,用户不再干等。需要 metacoder engine 暴露 turn 级进度事件。

**O3 —— 补齐 `pdf.worker.mjs`(治 S5)**
coding-engine 打包时纳入 `pdf.worker.mjs`,或在 Read 工具遇到 PDF 时优雅降级(返回「无法解析该 PDF」而非抛错中断整个 turn)。

**O4 —— Qwen 会话保活(治 S6)**
长任务期间,DH 侧向 Qwen 注入静默保活(或在收到 `task_run` 回执后主动播一句「稍等,正在处理」),避免 300 秒 idle 关闭。

**O5 —— agent lane 并发/隔离(治 S7,可选)**
为 `task_run` 的重任务使用独立 lane(非 `agent:main:main`),避免串行阻塞对话与其它工具。需评估 metacoder 多 lane 成本。

**O6 —— 幂等 + 重试**
metacoder turn 失败时按可重试错误(网络/临时)自动重试 1 次;成果物写入用临时名 + 原子 rename,避免半成品。

> 优先级建议:**O1 > O3 > O2 > O4 > O6 > O5**。O1 是根治,其余是加固。

---

## 3. 「语音控制一切」架构设计

### 3.1 核心机制:UI 动作工具化(client 侧执行)

关键洞察:**`realtime-handler.ts:986` 已把每一次 Qwen 工具调用以 `{type:"tool_call", data:{name,args,callId}}` 转发给浏览器**(client `dh-websocket.ts` 当前只对 `task_run` 做处理)。

因此,**UI 控制类工具不需要经过 winclaw gateway / metacoder 往返**,而是:

```
用户语音「把英伟达PDF显示出来」
  → Qwen 调用 ui_action({target:"artifact", action:"show", name:"英伟达投资分析报告.pdf"})
  → 服务端 ToolRouter.handleUiAction()  立即返回 {status:"ok", user_message:"好的,正在显示"}(无 gateway 往返,快)
  → 同一 tool_call 被转发到浏览器(既有通道)
  → client 的 ui_action 分发器执行真正的 UI 变更(弹出 PDF 预览 popup)
```

这样:**低延迟**(纯前端执行)、**复用既有转发通道**、与 `task_run` 的服务端重任务解耦。

### 3.2 新增工具:`ui_action`(单一工具 + 枚举,保持工具列表精简)

realtime 模型对「工具个数」敏感,故**不拆成 6 个工具**,而用**单一 `ui_action`** + `target`/`action` 枚举:

```jsonc
{
  "type": "function",
  "name": "ui_action",
  "description": "Control the on-screen UI of the digital-human console by voice. Use when the owner asks to show/hide a panel, open an artifact, toggle mic/camera/avatar, or show/hide the control bar.",
  "parameters": {
    "type": "object",
    "properties": {
      "target": { "type": "string",
        "enum": ["artifact", "task_panel", "controls", "mic", "camera", "avatar"] },
      "action": { "type": "string",
        "enum": ["show", "hide", "toggle", "on", "off", "open", "close"] },
      "name":   { "type": "string",
        "description": "For target=artifact: the file name to open, e.g. 英伟达投资分析报告.pdf" }
    },
    "required": ["target", "action"]
  }
}
```

调用示例:
| 用户语音 | 工具调用 |
|---|---|
| 「把英伟达 PDF 显示出来」 | `ui_action(target=artifact, action=show, name="英伟达投资分析报告.pdf")` |
| 「显示/隐藏任务管理」 | `ui_action(target=task_panel, action=toggle)` |
| 「把控制按钮藏起来」 | `ui_action(target=controls, action=hide)` |
| 「关掉麦克风」 | `ui_action(target=mic, action=off)` |
| 「打开摄像头」 | `ui_action(target=camera, action=on)` |
| 「关掉数字人形象」 | `ui_action(target=avatar, action=hide)` |

由 `buildToolList(flags)` 增加 `uiControl: true` 时纳入(默认开启)。

### 3.3 服务端处理:`ToolRouter.handleUiAction`

```
case "ui_action": return this.handleUiAction(args);

handleUiAction(args):
  校验 target/action 合法 → 返回 {status:"ok", user_message:"<针对该动作的自然语反馈>"}
  例: target=artifact → "好的,正在为您显示。"
      target=task_panel/action=show → "好的,打开任务管理。"
  * 不做 gateway 往返;真正的 UI 变更由 client 执行(见 3.4)。
```

> 服务端**只需**返回给 Qwen 一句可播报的确认;因为 tool_call 已被自动转发到 client,client 会执行真实动作。无需新增 server→client 消息类型(复用既有 `tool_call` 转发)。
> 备选:若希望语义更清晰,可**新增专用 outbound** `{type:"ui_action", data:{target,action,name}}`,由 realtime-handler 在处理 `ui_action` 时显式下发。两方案二选一,推荐**复用 tool_call**(改动最小)。

### 3.4 client 侧 UI 动作分发器

`dh-websocket.ts` 的 `tool_call` case 扩展:

```ts
case 'tool_call': {
  const toolName = data.name;
  if (toolName === 'task_run') { /* 既有:secretary-voice-task */ }
  else if (toolName === 'ui_action') {
    const { target, action, name } = JSON.parse(data.args || '{}');
    window.dispatchEvent(new CustomEvent('dh-ui-action', { detail: { target, action, name } }));
  }
}
```

`app-render.ts` / `main-layout` 侧监听 `dh-ui-action`,按 target 分派到既有能力:
| target | client 动作(复用既有实现) |
|---|---|
| `artifact` | `secretary-panel.openPreviewNode(byName)` —— 复用现有成果物预览 popup |
| `task_panel` | 切换 `state.dhTaskPanelOpen`(见 §4.1) |
| `controls` | 切换 `state.dhControlsVisible`(见 §4.2) |
| `mic` | `ls.dhPanel.onToggleMic()`(现有) |
| `camera` | `ls.dhPanel.onToggleCamera()`(现有) |
| `avatar` | `controller.toggleAvatar()`(现有) |

**语音 = 按钮 双通道等价**:按钮点击与 `dh-ui-action` 事件最终都调用同一批 handler,天然一致。

---

## 4. UI 重构(响应式)

### 4.1 任务管理区:默认隐藏 + 切换

- **默认隐藏**,数字人形象占满。
- 屏幕上新增**任务管理切换按钮**(悬浮图标,右上角):点击 → 显示任务管理区。
- **PC / 大屏**:任务区作为**右侧栏**滑入(现有 `.panel-secretary` flex 布局,由 `flex:0 0 clamp(340px,26vw,440px)` ↔ `display:none` 切换 + `.panel-dh` 占满)。
- **手机 app**:以**翻转 / slide-over**形式覆盖显示(`transform: translateX/rotateY` 动画),再点即隐藏。
- 状态 `dhTaskPanelOpen`(app-view-state),按钮 + `ui_action(task_panel)` 双通道切换。

### 4.2 悬浮控制条(麦克风 / 摄像头 / 数字人)

- 从底部固定条改为**悬浮在数字人区域下方**(absolute/floating,半透明背景)。
- 可**显示/隐藏**:状态 `dhControlsVisible`;隐藏后完整显示数字人。
- 触发:悬浮小把手点击 + `ui_action(controls, show/hide/toggle)` + 语音。
- 内含:麦克风、摄像头、数字人 ON/OFF、语音选择 —— 均已可经 `ui_action(mic/camera/avatar)` 语音操作。

### 4.3 成果物 POPUP 预览(语音触发)

- 复用现有 `secretary-panel` 的预览 modal(html→iframe、pdf/image→blob、text→pre)。
- 新增按**文件名**打开的入口 `openPreviewNodeByName(name)`:在 `nodeFiles` 里模糊匹配(「英伟达PDF」→ `英伟达投资分析报告.pdf`),命中即弹窗。
- 语音:`ui_action(artifact, show, name)` → `dh-ui-action` → 该入口。

### 4.4 视觉一致性(与 ai-meta 品牌统一)★本次增补

`/digital-human` 是 ai-meta **明/暗分面策略中的「对话页 = 暗色沉浸面」**(见 `ai-meta-poc/docs/11` §3.4)。**视觉正本 SSOT = `ai-meta-poc/docs/mockups/chat.html`**。

- **两 codebase 不共享代码**(control-ui = Lit SPA / ai-meta = Next.js Tailwind),故在 control-ui 侧**复刻同一套 brand token(值必须一致)**,定义为 CSS 变量(`:root` 或各组件 host):
  ```css
  --brand-pink:#F0759B; --brand-coral:#FF8A65; --brand-lav:#8B78D6;
  --grad-warm:linear-gradient(135deg,#FF8A65,#F0759B 55%,#8B78D6);
  --ink:#0F0B15; --ink-2:#171120; --ink-3:#20182E; --ink-line:#332741;
  --gold:#C9962E; --live:#7CFFC0; --tx:#F6F1FB; --tx-mut:#B7AAC9; --r:14px;
  /* 字体:标题 Poppins、正文 Inter + Noto Sans SC */
  ```
- **stage(数字人区)**:`--ink` 暗底 + 顶部径向暖粉光晕(`radial-gradient(75% 60% at 50% 26%,rgba(247,168,196,.22),transparent)`);「ライブ中」在线徽标(`--live` 绿点呼吸 `pulse`);字幕为玻璃拟态浮层(`rgba(15,11,21,.66)+blur`)。
- **★ 秘书面板改暗色(主要改动)**:现状为白卡(memory `aimeta-dh-secretary-A` 的美化)——**与新分面冲突**。改为 `--ink-2/--ink-3` 暗卡 + `--grad-warm` 小方块图标 + `--tx/--tx-mut` 文字,状态/成果物 badge 用暗底安全色(在线绿/金/薰衣草),对齐 chat.html 右栏。
- **控制条**:悬浮玻璃拟态 pill,激活态(mic ON / 数字人 ON)用 `--grad-warm` 填充 + 深色文字,对齐 chat.html。
- **换肤落点**:`ui/src/ui/views/main-layout.ts` 的 `<style>`(shell/stage/控制条)+ `components/secretary-panel.ts` 的 shadow DOM CSS(白→暗)+ `views/digital-human.ts`(控制条),统一引用上述 CSS vars。**淘汰散落硬编码颜色**。

### 4.5 响应式 PC / 手机自适应 ★本次增补

| 断点 | stage(数字人) | 秘书面板 | 控制条 |
|---|---|---|---|
| **PC ≥1024** | 左,`flex:1` | 右侧栏,默认隐藏,`clamp(340px,26vw,440px)`,`ui_action(task_panel)`/按钮切换 | 悬浮 stage 底部居中 |
| **手机 <1024** | **全屏**(safe-area 适配刘海) | **底部 sheet / 全屏抽屉**(上滑或点任务按钮弹出,再点/下滑收起),不再右栏 | 悬浮下方(`safe-area-inset-bottom`),可显隐 |

- 手机范式对齐 ai-meta「底部 Tab / 抽屉」(`docs/11` §3.1);字幕与成果物 popup 全宽。
- `ui/index.html` 确认 `<meta viewport ... viewport-fit=cover>`;CSS 用 `env(safe-area-inset-*)`。
- 现状 `main-layout` 已有 portrait 竖分,但需升级为「**全屏 stage + 面板 sheet**」范式(而非上下均分),使数字人在手机上主视觉最大化。
- 键盘弹出(任务输入)时 sheet 上移避让,不遮输入框。

### 4.6 与 ai-meta 的集成边界(用量/配额 + 身份)★本次增补

`/digital-human` 以 iframe 嵌入 ai-meta `/companions/[id]/chat`。**明确职责边界**(身份桥 §14.5 已传 `aimeta_token`/`aimeta_api`):

| 由谁提供 | 内容 |
|---|---|
| **ai-meta(经身份桥)** | 伴侣名/关系(header「ハナ · 你的挚友」)、**今日剩余时长/配额 + 订阅档位徽标**(来自 billing `usage_ledger`/`plan`,`docs/11` §2.4)、0 分时的**升级 CTA** |
| **control-ui** | 数字人渲染、字幕、控制条、秘书面板(对话/任务/成果物/资料)、`ui_action` 语音控制 |

- **新增**:control-ui 顶部显示「今日剩余 X 时」+ 档位徽标(chat.html 顶部的 remaining/who),经 aimeta bridge 拉 `docs/11` 新增的 `/billing/usage` 接口;剩 10分/1分/0 的 banner + 语音提醒(`docs/11` §2.4 + §05 avatar 生命周期联动)。
- **计秒对齐(`docs/11` §8.1 #7)**:`usage_ledger` 依赖 DH heartbeat active-second;本方案的 avatar 按需生命周期(close/reopen,memory `aimeta-dh-secretary-A`)计秒口径需与 ai-meta usage 聚合一致(**断线不重复计、pause/idle 关闭不计**)。

---

## 5. 语音 ⇄ 按钮 双通道等价矩阵

| 功能 | 按钮(现有/新增) | 语音工具 |
|---|---|---|
| 打开成果物预览 | 成果物条目点击 | `ui_action(artifact,show,name)` |
| 任务管理 显示/隐藏 | **新增**切换按钮 | `ui_action(task_panel,toggle)` |
| 控制条 显示/隐藏 | **新增**悬浮把手 | `ui_action(controls,toggle)` |
| 麦克风 开/关 | 麦克风按钮(现有) | `ui_action(mic,on/off)` |
| 摄像头 开/关 | 摄像头按钮(现有) | `ui_action(camera,on/off)` |
| 数字人形象 起/停 | 数字人按钮(现有) | `ui_action(avatar,show/hide)` |
| 下达任务/生成成果物 | 任务输入框发布 | `task_run`(现有) |

---

## 6. 实施阶段与影响文件

**Phase 1 —— UI 重构 + 视觉统一 + 响应式(纯前端)**
- `ui/src/ui/app-view-state.ts`:加 `dhTaskPanelOpen` / `dhControlsVisible`。
- **视觉统一(§4.4)**:定义 brand CSS vars(复刻 ai-meta token);`main-layout.ts <style>`(stage 暗底+暖粉光晕、控制条悬浮 pill)、`components/secretary-panel.ts`(**白卡→暗卡**)、`digital-human.ts`(控制条激活态渐变)统一换肤。
- **响应式(§4.5)**:`main-layout.ts` 手机改「全屏 stage + 底部 sheet 面板」(替代上下均分);`ui/index.html` viewport-fit=cover + `env(safe-area-inset-*)`。
- 任务区默认隐藏 + 切换按钮;控制条悬浮化 + 显隐把手。
- **集成边界(§4.6)**:顶部「今日剩余 X 时 + 档位」经 aimeta bridge 拉 `/billing/usage`(依赖 ai-meta `docs/11` Phase B;未落地前占位/隐藏)。

**Phase 2 —— `ui_action` 工具链**
- `extensions/digital-human/src/tools/catalog.ts`:加 `ui_action` 定义 + `buildToolList` flag。
- `extensions/digital-human/src/tool-router.ts`:`handleUiAction`(返回可播报确认)。
- `ui/src/lib/dh-websocket.ts`:`tool_call` case 增 `ui_action` → `dh-ui-action` 事件。
- `ui/src/ui/app-render.ts`:监听 `dh-ui-action`,分派到既有 handler。
- `ui/src/ui/components/secretary-panel.ts`:`openPreviewNodeByName`。
- `instructions-builder.ts`:系统提示补充 `ui_action` 用法(何时用、别乱用)。

**Phase 3 —— 稳定性(§2.3)**
- O1 技能化(与 skill-creator 对接)、O3 `pdf.worker.mjs`、O2 进度心跳、O4 保活。

**部署**:control-ui `npx vite build` → overlay-secui 重建 `daoB-secui` → 重建 `winclaw_lc`(IP 172.17.0.3 复用,caddy 不变)→ DB `nodes.id=2 container_id` 校正。

---

## 7. 风险与待确认事项

1. **realtime 模型工具调用可靠性**:新增 `ui_action` 后工具达 7 个;需在系统提示里明确「UI 类动作用 `ui_action`,任务执行用 `task_run`」以免误调。建议保持单一 `ui_action` 而非拆多个。
2. **成果物按名匹配的歧义**:「显示那个PDF」无名时,client 需回问或默认最新一个。建议:无 `name` 时打开最新成果物。
3. **broadcast 通知的多租户**:当前单 companion/节点,broadcast 安全;若未来一节点多用户需回退为 session 定向 + 在线判断。
4. **手机翻转动画**:需确认目标是 PWA/H5 还是原生壳;本方案按 H5(CSS transform)设计。
5. **控制条悬浮的可发现性**:纯语音用户 OK,但新用户需要视觉提示(把手/首次引导)。
6. **`ui_action` 的 client 执行 vs 服务端确认时序**:client 收到 tool_call 即执行,Qwen 同时播报确认,二者并行,无强依赖;若某动作失败(如成果物名未命中),client 可经 `notify.dh` 或字幕回传失败提示。
7. **秘书面板 白→暗 的连带回归**(§4.4):暗底下需复核对比度/可读性、成果物 badge 与状态色(完成/进行中)在暗底的可辨识、预览 popup(尤其 html iframe / 白底 PDF)在暗壳内的边框处理。
8. **手机 iframe 内的 safe-area 与键盘**:底部 sheet + 悬浮控制条需处理刘海/底部 home indicator(`env(safe-area-inset-*)`)与软键盘弹出避让。
9. **用量/配额显示依赖 ai-meta `docs/11`**:`/billing/usage` 接口属 ai-meta Phase B;先落 ai-meta 再接 control-ui,未就绪时顶部用占位或隐藏,不阻塞本方案其余部分。
10. **双处 token 同步**:brand token 在 ai-meta(tailwind)与 control-ui(CSS vars)各存一份;改品牌色时**两处需同步**(建议注释标注来源 = `docs/11` §3.4,或后续抽公共 token 文件)。
11. **`ui_action` 无对应目标的鲁棒性**:如 `task_panel/artifact` 在某布局不存在时,client 静默忽略 + 字幕提示,勿抛错。

---

## 9. 验证方案(实装后逐项 E2E)

浏览器实测(Claude in Chrome / 真机),对照验收:

| 项 | 验证 |
|---|---|
| 视觉统一 | `/digital-human` 暗色 stage + 暗色秘书面板 + 悬浮控制条,与 `chat.html` 一致;无残留白卡/硬编码色 |
| 响应式 PC | ≥1024:左 stage + 右面板(可切),控制条悬浮居中 |
| 响应式 手机 | <1024:全屏 stage + 底部 sheet 面板 + safe-area;键盘不遮输入 |
| 语音控制 | 逐条说「显示英伟达PDF / 显示任务管理 / 藏起控制条 / 关麦克风 / 关数字人」→ 对应 UI 变更 + 数字人语音确认 |
| 按钮等价 | 每个 `ui_action` 对应的按钮点击,行为一致 |
| 成果物 popup | 语音「显示那个PDF」(无名)→ 打开最新;有名 → 模糊匹配命中 |
| 用量显示 | 顶部剩余时长/档位正确(需 ai-meta `/billing/usage`);剩 10/1/0 分提醒 + 升级 CTA |
| 稳定性 O1 | 技能化后 `document.generate_pdf` 耗时 <2 分、无试错版本、无 pdf.worker 崩溃 |
| 计秒对齐 | close→reopen avatar 不重复计秒;pause/idle 关闭不计入 usage_ledger |

---

## 10. 小结

- PDF **确由 winclaw→metacoder(glm-5.2)生成**;不稳定的根因是**每次现写代码**(S2)与通知/刷新缺陷(S3/S4,已修复)。根治靠**技能化(O1)**。
- 「全语音控制」的核心是:**UI 动作工具化 + 复用既有 tool_call 转发通道,由 client 执行**;新增单一 `ui_action` 工具,语音与按钮双通道等价。
- **视觉与 ai-meta 统一(§4.4)**:`/digital-human` = 暗色沉浸「对话页」,复刻 ai-meta brand token,**秘书面板由白改暗**(主要连带改动),视觉正本 = `docs/mockups/chat.html`。
- **PC/手机自适应(§4.5)**:PC 左 stage + 右侧栏面板;手机全屏 stage + 底部 sheet 面板 + safe-area。
- **集成边界(§4.6)**:身份/用量/配额由 ai-meta 经身份桥提供(顶部剩余时长 + 档位 + 升级 CTA),渲染/语音控制由 control-ui;**需与 ai-meta `docs/11` 联合实装**,计秒口径对齐。
- UI 重构:任务区默认隐藏、控制条悬浮可显隐、成果物 popup 可语音触发。
- 分 3 phase:Phase 1(UI 重构 + 视觉统一 + 响应式)+ Phase 2(`ui_action`)为前端 + 轻量服务端,Phase 3 为稳定性加固;§9 逐项 E2E 验证。

> 请 review。确认后按 Phase 顺序实装,并**与 ai-meta `docs/11` 协同**(视觉 token 同步、`/billing/usage` 用量接口、计秒对齐)。建议先 Phase 1(视觉统一 + 响应式 + UI 重构)让「风格一致 + PC/手机自适应」立即可见,Phase 2 `ui_action` 紧随,Phase 3 稳定性并行。
