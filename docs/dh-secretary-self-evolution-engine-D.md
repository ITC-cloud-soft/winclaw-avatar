# 数字人秘书 自我进化引擎(方案 D 全套) — 架构与实装规格

> 目标:**保证真正实现自我进化** —— 系统能**自发**从任务历史发现重复模式 → **自动创建** skill → **去重/质量/安全**把关 → **自动启用(低风险)/人工审核(代码)** → 下次任务**自动用上** → 持续迭代。
> 范围:本地可验证的自治闭环现在建+测;跨节点分发待 VM(明天续费)。

---

## 0. 自我进化闭环(6 环,全)

```
                    ┌──────────────── 自省循环(②,cron/heartbeat 日频)─────────────┐
                    ▼                                                              │
  ai-meta-poc tasks 历史 ──(B 感知)──► 语义聚类找"重复任务模式"(③去重 同源)        │
                    │  对 ≥N 次 且 无覆盖 skill 的簇                                 │
                    ▼                                                              │
   ③ 去重: 该模式是否已有相似 skill?(gemini-embedding × skills 表)               │
                    │ 无 → 派发"创建 skill"任务(带该簇样例任务作上下文)            │
                    ▼                                                              │
   winclaw metacoder + skill-creator(①AGENTS 反思铁律也会在普通任务里触发创建)     │
                    │ 创建 .claude/skills/<slug>/ → package → skill-outbox/         │
                    ▼                                                              │
   ④ skill_publisher: 安全扫描 + ⑤质量门(用簇内 1~2 历史任务回测新 skill)         │
                    │ 纯文本无脚本+质量过 → 自动 status=active                       │
                    │ 含脚本/危险/质量存疑 → status=pending 人工审                   │
                    ▼                                                              │
   active skill → (provision/分发到节点) → skill 发现(description 匹配)           │
                    │ 下次同类任务 agent 自动用它 → 更快/更稳                        │
                    └────────────── 形成正反馈,持续进化 ───────────────────────────┘
   ⑥ 防泛滥: winclaw skills.dynamicFilter + maxSkillsInPrompt(skill 多了也不撑爆 prompt)
```

**"保证实现"的关键 = ②自省循环(自发触发)+ ④自动启用(低风险免人工=真自治)+ 用上(skill 发现闭环)**。①反思只是辅助;③⑤⑥是质量/安全/规模护栏。

---

## 1. 组件规格(逐个,含验收)

### ① AGENTS 反思铁律(ai-meta-poc seed_personas 模板)
- 加一节"自我进化":完成任务后,若可复用且无覆盖 skill → 用 skill-creator 固化(进 skill-outbox 待审核流程)。**不**让它在任务里乱建(只对"明显可复用"的)。
- 验收:模板刷进 DB(seed_personas updated≥1)。

### ② 自省循环 self_evolution.py(核心,ai-meta-poc 后台 job)
- `evolve_once(session_factory)`:
  1. 拉 `tasks` 表 status=done、近 `SELF_EVO_LOOKBACK_DAYS` 天、按 user 分组(每用户独立进化)。
  2. **聚类**:用 gemini-embedding(已配 memorySearch.provider=gemini)对 prompt 向量化 → 阈值聚类(cosine ≥ `SELF_EVO_SIM`);无 embedding 退化为关键词/LLM 归纳。
  3. 对每簇 size ≥ `SELF_EVO_MIN_CLUSTER`(默认 3) 且 ③去重判定"无相似 skill" → 生成一个"创建 skill"请求:写 `<workspace>/inbox/<id>.json`{prompt=「请用 skill-creator 为这类重复任务创建 skill:<簇主题>。样例:<簇内 prompt 列表>。创建到 .claude/skills/<slug>/ 并 package 到 skill-outbox/」, user_uuid, source:"self-evolution"}。
  4. 复用**已有 inbox 轮询器**派发(语音/自省共用 inbox)→ winclaw 用 skill-creator 创建 → skill-outbox → skill_publisher。
  5. 去重防重复提议:记录已提议的簇签名(避免每天重复派发同一簇)。
- `self_evolution_loop(app)`:cron/间隔 `SELF_EVO_INTERVAL_SEC`(测试用短间隔,生产日频);enabled 开关;异常 catch+log+continue。
- 验收(本地):tasks 表已有重复任务(我会造几条同类)→ 跑一次 evolve_once → **自动**在 inbox 生成"创建 skill"请求 → 轮询器派发 → skill-creator 创建 → skills 表出现新 skill。**全程无人工**。

### ③ 语义去重 skill_dedup.py(ai-meta-poc)
- `is_covered(prompt_or_topic, user) -> Optional[Skill]`:把候选主题 embed,与 skills 表(该用户可见 + 全局)的 name+description embedding 比 cosine,≥ `SELF_EVO_DEDUP_SIM`(默认 0.85)视为已覆盖 → 跳过创建。
- 被自省循环(创建前)和 skill_publisher(入库前)两处调用。
- 验收:对一个与现有 skill 高度相似的主题,is_covered 返回该 skill(不重复造)。

### ④ 分级自动批准(改 skill_publisher.py)
- 入库时:① 安全扫描(已有,危险脚本→needs_review)② 是否含 scripts/(有脚本=非纯文本)。
- 判定:**纯文本 SKILL.md(无 scripts/、无危险命令)且 ⑤质量门通过 → status=ACTIVE(自动启用)**;否则 status=DISABLED(pending 人工审)。
- 自动 active 的 skill,若有归属 companion → 自动 assign(走现有 companion-skill 分配),使其进入分发。
- 验收:放一个纯文本 skill → 自动 active;放一个带 scripts/curl 的 → disabled。

### ⑤ 质量门 skill_quality.py(ai-meta-poc)
- `passes_quality(skill_dir, sample_prompts) -> (bool, reason)`:轻量校验:① SKILL.md frontmatter 完整(name/description 合理长度、有触发语)② body 非空、有"步骤/流程"结构 ③(可选)对 1 个样例 prompt 让 metacoder 试跑判断 skill 是否被正确触发——**winclaw 无 claude CLI,试跑走现有 winclaw_dispatch 即可,但为控成本默认只做静态校验,试跑作为可选开关**。
- 被 ④ 在"自动 active"前调用;质量不过 → 降级 pending 人工审。
- 验收:残缺 SKILL.md(无 description/无 body)→ 不通过 → pending。

### ⑥ 防泛滥(winclaw entrypoint winclaw.json)
- `skills.dynamicFilter.mode` 开(按相关性动态选 skill 进 prompt)+ `skills.limits.maxSkillsInPrompt`/`maxSkillsPromptChars` 设上限。
- 验收:skill 数量增多时 prompt 不超限(配置生效,镜像重建后确认)。

---

## 2. 新增配置(config.py 一次性)
```
SELF_EVO_ENABLED: bool = True
SELF_EVO_INTERVAL_SEC: float = 3600        # 测试可调小(如 60)
SELF_EVO_LOOKBACK_DAYS: int = 7
SELF_EVO_MIN_CLUSTER: int = 3              # 同类任务≥3 次才固化
SELF_EVO_SIM: float = 0.82                 # 聚类相似度阈值
SELF_EVO_DEDUP_SIM: float = 0.85           # 去重相似度阈值
SELF_EVO_AUTO_APPROVE_TEXT_ONLY: bool = True  # 纯文本自动 active
SELF_EVO_QUALITY_TRYRUN: bool = False      # 质量门是否试跑(成本)
```

## 3. 实装顺序 & 验证(本地 now / VM tomorrow)
- **本地 now**:②自省循环 + ③去重 + ④分级批准 + ⑤质量门 + ①反思模板 + ⑥配置。**端到端本地验证**:造重复任务 → 自省自动发现 → 自动创建 skill → 纯文本自动 active → 出现在 skills 表 active + 分发到 local workspace → 下次同类任务能命中。
- **VM tomorrow**:跨节点分发(active skill → 其它节点 provision 注入)、多用户隔离、规模/prompt 实测。

## 4. 安全红线(不可破)
- **带脚本/代码的 skill 永远人工审核**(绝不自动启用,供应链/自启代码风险)。
- 自省循环有**频率+配额**控制(防 LLM 成本/跑偏放大)。
- 去重 + 质量门 + 数量上限 = 防 skill 泛滥/漂移。
- 自动启用仅限**纯文本 SKILL.md**(业务 playbook 类),且仍经质量门。

## 5. "保证实现自我进化"的判定标准(验收用)
本地必须能演示这条**全自动**链(无任何人工介入):
1. 系统检测到"季度对账"类任务出现 ≥3 次。
2. 自省循环自动派发创建任务。
3. skill-creator 自动创建 `quarterly-recon` skill(纯文本)。
4. skill_publisher 安全扫描 + 质量门通过 → **自动 active**。
5. skills 表出现 active 的 quarterly-recon,且解到 workspace/skills/。
6. 下一个"季度对账"任务,agent 自动命中该 skill。
→ 6 步全自动跑通 = 自我进化达成。
