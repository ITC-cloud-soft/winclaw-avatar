# skill-creator 接入 + 「创建 → 持久化」流水线设计

> 目标：让数字人秘书能用 **skill-creator**(Anthropic 官方元 skill)**创建新 skill**,并通过一条流水线让创建的 skill **持久化、可分发、跨容器/镜像不丢**,从而秘书能随业务**自我成长**。
> 状态：2026-06-30。skill-creator 已 vendor 进 `winclaw-avatar/skills/skill-creator/`(18 文件完整版)。

---

## 0. 关键前提：复用 ai-meta-poc 已有 skill 基础设施(不从零造)

ai-meta-poc **已有**成熟的 skill 存储+分发(无需重建):
- `models/skill.py` — `skills` 表:slug/name/description/version/category/**tarball storage**/status。
- `api/v1/admin/skills.py` — upload(multipart tarball)/CRUD/download/**分发到 companion**。
- **provision 时**把分配给 companion 的 active skills 的 tarball **解到 `workspace/skills/<slug>`**。
- companion↔skill 分配关系已存在。

→ "持久化 + 分发"直接复用这套。流水线主要是**把"创建侧(容器内 skill-creator)"接到"存储侧(ai-meta-poc skills 表)"**,并解决 §13 连通性(容器→后端 NAT 不通)。

---

## 1. skill-creator 在 winclaw 的适配(能用什么、不能用什么)

skill-creator 18 文件 = `SKILL.md`(创建指南)+ `scripts/`(package_skill/quick_validate/run_eval/run_loop/improve_description…)+ `agents/`(analyzer/comparator/grader)+ `eval-viewer/`(浏览器评测 UI)。

| 能力 | winclaw 可用? | 说明 |
|---|---|---|
| **核心创建流**(访谈意图→写 SKILL.md→`quick_validate.py` 校验→`package_skill.py` 打包) | ✅ **可用** | 纯 python + 模型驱动,metacoder 直接跑。**这是秘书需要的部分。** |
| eval/benchmark(`run_eval.py`/`run_loop.py`/`improve_description.py`) | ❌ **不可用** | 依赖 `claude` CLI(`-p` flag)——winclaw 用 glm-5.2/metacoder,**没有 claude CLI**。 |
| eval-viewer(浏览器评测 UI) | ❌ **被 #1 gate 拦** | 需 browser(secure-context),被秘书能力白名单拒绝。 |
| 子代理并行评测 | ⚠️ 部分 | winclaw 有 sessions_spawn,但评测链整体依赖上面两项。 |

**结论**:winclaw 用 skill-creator 的**创建+校验+打包**子集即可达成"造新 skill";评测/优化子集禁用(或后续改造 `run_loop.py` 用 metacoder 代替 claude CLI——非本轮)。已在 skill 里加 winclaw 适配说明(§3)。

---

## 2. 流水线:创建 → 持久化(4 层)

```
[容器内·秘书会话]                         [ai-meta-poc·后端]              [节点分发]
 用户: "帮我把'季度对账'做成一个 skill"
   │ skill-creator 引导
   ▼
(L1 创建) 写 <workspace>/.claude/skills/<slug>/SKILL.md(+scripts)
   │ metacoder 立即读 .claude/skills → **本会话即可用**
   ▼
(L1.5 校验+打包) python skill-creator/scripts/quick_validate.py + package_skill.py
   │ 输出 tarball → <workspace>/skill-outbox/<slug>.tar.gz + <slug>.json(manifest)
   ▼ (§13 安全方向:容器只写文件,不回调后端)
(L2 持久化·per-user) <workspace> 在 /data/winclaw/<user>/<companion>(§3)
   │ → 该用户节点重启/换镜像 skill 不丢
   ▼
(L3 发布·跨节点)  ai-meta-poc **skill_publisher 轮询器**(复用 inbox 模式)
   │ ssh/本地扫 skill-outbox/ → 读 tarball → 校验(SKILL.md frontmatter + 安全扫描)
   │ → 存入 skills 表(slug/version/tarball)→ 分配给该 companion
   ▼
(L4 分发)  现有 provision-time 提取:把分配的 skill tarball 解到节点
            workspace/skills/<slug>(+需确保进 metacoder 读取目录,见 §4 待办)
   │ → 用户的**其它/未来节点**都获得该 skill
   ▼
(可选 L5 GitHub 版本化) 复用 github_service:把 skill 提交到 user 分支 skills/<slug>/
(可选 L6 入镜像) 管理员审核后把 skill 升级进 winclaw 镜像 bundled skills/(组织级,所有节点)
```

### 安全/审核(重要)
- **L3 发布默认需审核**:秘书自建 skill = agent 生成代码,**不可无条件分发**(供应链/注入风险)。skill_publisher 默认把新 skill 置 `status=pending`,**管理员审核(admin/skills)通过后才 active 分发**。可对"只含 SKILL.md 文本、无脚本"的低风险 skill 设自动通过策略。
- quick_validate.py + 后端二次校验:frontmatter 合法、无危险脚本(scripts/ 里的 curl/rm/exec 等扫描)、slug path-safe。

---

## 3. 本轮实装

### 3.1 winclaw 侧(需镜像重建,本地 winclaw_local 可测)
- ✅ vendor `skills/skill-creator/`(18 文件)。`package.json` 的 `files` 已含 `skills/` → 自动进 tgz。
- ⬜ **entrypoint** 把 skill-creator provision 到 `~/.metacoder/skills` + `<workspace>/.claude/skills`(扩展现有 doc-extract/research 的 provision 列表)。
- ⬜ skill-creator 加 **winclaw 适配 addendum**(SKILL.md 末尾 or 同目录 `WINCLAW.md`):①创建目标目录 = `<workspace>/.claude/skills/<slug>/`;②创建+校验后,**打包发布**:`python .claude/skills/skill-creator/scripts/package_skill.py <slug-dir> --output <workspace>/skill-outbox/`;③评测/优化子集在 winclaw 不可用,跳过。

### 3.2 ai-meta-poc 侧(本地可测)
- ⬜ **skill_publisher 轮询器**(复用 secretary_inbox 模式):扫 `<SECRETARY_WORKSPACE_ROOT>/skill-outbox/*.tar.gz` → 读 manifest → 调现有 skill 存储逻辑(admin/skills 的 upload/storage 复用)→ 存 skills 表(status=pending)→ 关联 user/companion。处理后移 `skill-outbox/processed|failed/`。
- ⬜ 审核:沿用 admin/skills 的 status 流转;pending→active 后进入分发。

### 3.3 验证(本地)
- winclaw_local 重建后:确认 metacoder 能列出/调用 skill-creator(让 agent "创建一个示例 skill" → 落 .claude/skills/ + skill-outbox/)。
- 后端:放一个 skill tarball 进 skill-outbox/ → skill_publisher 入库(pending)→ admin 审核 active。

---

## 4. 待办 / 风险

1. **metacoder 读取分发 skill 的目录对齐**:现有 admin 分发解到 `workspace/skills/<slug>`,但 metacoder 读 `.claude/skills` + `.metacoder/skills`(entrypoint 的 `skills.load.extraDirs`)。**需把 `workspace/skills` 加入 metacoder 的 skill 加载目录**(改 entrypoint 的 winclaw.json `skills.load.extraDirs`),否则分发的 skill 不被引擎看见。
2. **AIMETA_USER_UUID / companion 归属**:skill-outbox 的 manifest 需带 user/companion 归属(同语音 inbox 的 user_uuid 机制),provisioner 注入(已为语音做了 AIMETA_USER_UUID,可复用)。
3. **审核策略**:自建 skill 默认 pending+人工审核;低风险(纯文本 SKILL.md)可自动通过——需定策略。
4. **eval/优化子集**:winclaw 无 claude CLI → 评测链不可用。若要,改 `run_loop.py`/`improve_description.py` 用 metacoder 引擎代替 `claude -p`(中等改造,后续)。
5. **VM**:跨节点分发的真实验证需 VM 在线(现到期关停,待续费)。本地 winclaw_local + 本地后端可验证创建+发布入库+审核,分发到"另一个节点"需多节点环境。
6. **prompt 预算**:skill-creator 的 SKILL.md 33KB,较大;+ 未来自建 skill 增多 → 开 winclaw `skills.dynamicFilter` 动态过滤,避免 prompt 膨胀。

---

## 5. 一句话
- skill-creator 的**创建子集**接入 winclaw 即可让秘书"造新 skill";**持久化复用 ai-meta-poc 现有 skills 表+分发**,创建侧→存储侧用 **skill-outbox 轮询器**(§13 安全方向)桥接,**默认人工审核后分发**。本轮做:winclaw vendor+entrypoint+适配、后端 skill_publisher;真实跨节点分发待 VM。
