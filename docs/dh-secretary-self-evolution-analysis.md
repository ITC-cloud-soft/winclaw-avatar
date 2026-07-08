# 数字人秘书"自我进化"分析:skill-creator 之后还差什么

> 问题:装了 skill-creator,winclaw 会**自己主动**创建 skill(自我进化)吗?不能的话要做哪些改进?
> 结论(先说):**不会**。skill-creator 是"能力(手)",但缺"驱动(主动去用的决策)"+"感知(知道该建什么)"+"自治闭环(建完→审核→用上→再迭代)"。下面逐层分析 + 给出可实装的方案,供 review。

---

## 0. 现状:为什么"不会主动"

skill 在 metacoder/Claude-Code 里是**被触发**才用的:模型看到用户请求与某 skill 的 description 匹配,才调用它。所以:
- ✅ 你**显式说**"帮我把季度对账做成 skill" → 会用 skill-creator 创建(已验证)。
- ❌ 你只是**第 5 次**让它做季度对账 → 它**不会**自己想到"我该把这个固化成 skill"。

**核查到的现状:**
- winclaw **有** `cron-tool` + `heartbeat`(自主调度的"心跳"具备)——但**没人用它来做自我进化**。
- AGENTS.md 模板**零**"反思/复盘/自建 skill"指令(grep=0)——agent 完成任务后不会反思"这值得固化吗"。
- ai-meta-poc `tasks` 表有任务历史(prompt/status…)——**有数据可分析**,但**没有分析→提议建 skill 的环节**。

→ 三个齿轮缺失:**触发(drive)、感知(awareness)、闭环(autonomy)**。

---

## 1. 自我进化需要的三层(+ 每层缺口与做法)

### 层 A — 触发/驱动(最大缺口):让 agent **主动想到**该建 skill
两种触发,建议都要:

**A1. 任务内反思(轻量,即时)** — 改 AGENTS.md
- 加铁律:"完成任务后,若这是**可复用/会重复**的模式,且现有 skill 未覆盖 → 用 skill-creator 把它固化为 skill 并 package 到 skill-outbox/(默认进待审核,不自动启用)。"
- 优点:零新基础设施,立刻生效。缺点:**依赖模型自觉 + 单任务视角**(看不到跨任务的重复),glm-5.2 执行率不稳。

**A2. 周期性自省循环(核心,跨任务)** — 新建一个 cron/heartbeat 驱动的 self-review
- 用 winclaw `cron-tool`(或 ai-meta-poc 后台 job)定期(如每日)触发一个"自省任务":
  1. 拉取近期 tasks(ai-meta-poc tasks 表)。
  2. **聚类找重复模式**(prompt 语义聚类 / 或 LLM 归纳"哪些任务类型反复出现")。
  3. 对超过阈值的簇(如同类 ≥3 次)且无对应 skill → **派发一个"创建该 skill"的任务**(走 skill-creator)。
- 这才是真正的"**主动**进化":系统自己发现重复 → 自己提议 → 自己创建。

### 层 B — 感知/awareness:知道"建什么 + 是否已有"
- **任务历史分析**:tasks 表已有数据。需一个分析器(embedding 聚类 用现有 gemini-embedding,或 LLM 归纳)产出"候选 skill 主题 + 频次"。
- **去重(防 skill 泛滥)**:创建前必须检索"是否已有相似 skill"(skills 表 + 语义相似)。否则自我进化会制造大量重叠 skill → prompt 膨胀。skill_publisher 现在只按 slug 撞名 bump 版本,**语义去重缺失**。

### 层 C — 自治闭环:建完 → 审核 → 用上 → 再迭代
- **建→存**:已通(skill-creator → skill-outbox → skill_publisher → skills 表 disabled)。✅
- **审核(自治 vs 安全的平衡)**:现在一律 disabled 等**人工审核**=**不算自治**。要自我进化需**分级自动批准**:
  - 纯文本 SKILL.md(无 scripts/、无危险命令)→ **可自动 active**(低风险,允许秘书自主长出"业务 playbook"类 skill)。
  - 含 scripts/ 或命中危险扫描 → **强制人工审核**(代码=供应链风险,绝不自动启用)。
- **用上**:skill active 后,skill 发现机制(description 匹配)会让 agent 下次自动用它 → 闭环。✅(前提 description 写得好,skill-creator 已保证)
- **迭代/质量**:skill-creator 的 eval/优化子集在 winclaw 不可用(无 claude CLI)。自我进化产出的 skill **质量无自动把关**。需:① 简化版"拿 1~2 个历史任务回测新 skill"的检查;或 ② 改 `run_loop.py` 用 metacoder 代替 `claude -p`(中等改造)。

---

## 2. 风险(为什么不建议"全自治无人监督")
1. **skill 泛滥** → prompt 膨胀、skill 选择稀释。**必须**配 `skills.dynamicFilter` + 语义去重 + 数量上限。
2. **质量漂移** → 自动产出的 skill 可能低质/重叠/误触发。需质量门 + 去重。
3. **安全** → 自动批准带 scripts 的 skill = 让 agent 自写自启代码,**禁止**。只自动批准纯文本低风险。
4. **成本** → 自省循环 = 周期性 LLM 调用(聚类/归纳/创建)。需频率/配额控制。
5. **跑偏放大** → 错误的"重复模式"判断会催生没用的 skill。阈值要保守 + 人工可回收。

---

## 3. 推荐方案:**半自治自我进化(MVP)**,可 review

不做"全无人进化",做"**系统主动提议 + 分级批准**":

| 改造 | 内容 | 工作量 | 价值 |
|---|---|---|---|
| **① AGENTS 反思铁律**(A1) | 模板加"完成可复用任务→提议固化为 skill(进待审核)" | 小(改模板+刷DB) | 即时,但靠模型自觉 |
| **② 自省循环**(A2,核心) | ai-meta-poc 后台 job(日频):分析 tasks 表→聚类重复→对 ≥N 次的簇派发"创建 skill"任务 | 中 | **真·主动进化** |
| **③ 语义去重**(B) | 创建/入库前检索相似 skill(gemini-embedding + skills 表),重叠则跳过/合并 | 中 | 防泛滥 |
| **④ 分级自动批准**(C) | skill_publisher:纯文本无脚本→自动 active;有脚本/危险→pending 人工审 | 小 | 让秘书自主长出业务 playbook,代码仍人工把关 |
| **⑤ 质量门**(C) | 新 skill 用 1~2 历史任务回测(成果物是否合理)再批准 | 中 | 防低质 |
| **⑥ dynamicFilter + 上限**(风险1) | winclaw.json 开 skills.dynamicFilter,设 maxSkillsInPrompt | 小 | 防 prompt 膨胀 |

**最小可行起步(建议先做 ①+④)**:加反思铁律 + 纯文本 skill 自动批准 → 秘书就能在你让它做事的过程中,**自主把可复用的业务流程固化成可用 skill**(低风险、立竿见影)。验证有效后再上 ②自省循环(真正的周期性主动进化)+ ③去重 + ⑤质量门。

---

## 4. 一句话给你 review
- **现在**:skill-creator = 被动的"手",winclaw **不会自发进化**。
- **要自我进化**:补 **触发(反思铁律 + 自省循环)+ 去重 + 分级自动批准 + 质量门 + 防泛滥**。
- **推荐**:**半自治**(系统主动提议、纯文本自动启用、代码人工审核),不做全无人。先做 ①反思铁律 + ④分级自动批准(小改、立竿见影),再上 ②自省循环。
- **决策点(你定)**:做到哪一档?(A=只反思铁律 / B=加分级自动批准 / C=加自省循环真主动 / D=全套含去重+质量门)
