# 数字人秘书 — #3 VM claim 实测 & 语音伴侣接入：执行计划与所需

> 状态：2026-06-30。前置 #1~#4 已完成(#1 硬 gate 实测✅ / #2 GitHub 真实提交✅ / #3 代码+import✅ / #4 设计满足✅)。
> 本文档列出**剩余两项的执行计划**、**需要你(主人)做/确认的事**、以及我会做的步骤与风险。

---

## 0. 当前阻塞：L20 VM 可达性

- 实测：`150.5.135.24` 端口 22 与 18999 **均超时**(本会话早先可达)。你说 VM 在**启动中**——开机到 SSH 可用通常要几分钟。
- 验证命令(你给的形式，登录用户 **root**)：
  ```bash
  ssh -i "C:\work\digtal-human\dh-saas\dh-saas-hk-key.pem" root@150.5.135.24
  ```
  (注：本会话早先用过 `ubuntu@`，你最新指定 `root@`——VM 可能重建过，以 root 为准。)
- **两项实测都需要 VM 在线**：#3 要在 VM 上建/重挂容器；语音伴侣的 avatar/语音/MuseTalk 运行时都在 VM。
- 👉 **需要你**：确认 VM 完全起来(上面 ssh 能进、`sudo docker ps` 有响应),并告诉我。我会先恢复 `winclaw_lc`(数字人节点)与 Caddy(18999 入口)再继续。

---

## 1. #3 VM claim 实测

### 1.1 已完成(代码侧)
- `companion_orchestrator._maybe_bind_user_workspace`：`WINCLAW_DATA_BASE` 非空时,新 companion 的 workspace 绑定到 `/data/winclaw/<user_uuid>/<companion_uuid>`。
- `_recreate_container_for_user_workspace`：claim 时 **stop + provision_container** 用新路径**重挂**(gateway_port/token 复用→URL/token 不变、无 SSE 重连);失败回滚抛 `NodeProvisionError`→上层 `release_node`。
- `ResolvedVM.public_base_url` 已补:remote recreate 保留 Caddy HTTPS 入口(数字人 secure-context 不坏)。
- 只在 `WINCLAW_DATA_BASE` 非空时生效;为空则纯 `_pool` 流程零改动(可回滚)。

### 1.2 实测前置(需要你确认/我来设)
| 项 | 当前值 | 实测需要 | 谁做 |
|---|---|---|---|
| VM 在线 | ❌ 离线 | ✅ 在线 | **你启动** |
| `vm_hosts.workspace_base` | `/tmp/winclaw-workspaces` | **`/data/winclaw`**(持久盘 /dev/vdb) | 我改(SQL) |
| `WINCLAW_DATA_BASE`(后端 env) | `""`(关) | `/data/winclaw` | 我设(启动后端时) |
| VM 上 `/data/winclaw` 目录 | — | 存在+可写 | 我 mkdir(ssh) |
| **idle pool 节点** | ❌ 现有2个都 assigned | 至少 1 个 **idle** 节点供 claim | 我 adopt(见下) |
| **docker-over-ssh** | ❌ 本地 ssh config 未通 | 本地 `docker -H ssh://ubuntu@150.5.135.24 ps` 可用 | 我配 ssh + 测 |

### 1.3 我会做的步骤(VM 起来后)
1. **打通 docker-over-ssh**：本地 `~/.ssh/config` 加 host(IdentityFile=pem、PubkeyAcceptedAlgorithms +ssh-rsa),验证 `docker -H ssh://ubuntu@150.5.135.24 ps`。
2. **VM 准备**：`mkdir -p /data/winclaw`;把 `vm_hosts.workspace_base` 改 `/data/winclaw`;补 `vm_hosts.public_base_url=https://150.5.135.24:18999`。
3. **造 idle 节点**：用 ai-meta-poc 的 adopt/provision 在 VM 上起 1 个新 pool 容器(新端口,如 18903),状态置 idle。
4. **跑 claim**：后端带 `WINCLAW_DATA_BASE=/data/winclaw` 启动 → 调 `create_companion`(指定 L20 VM)→ claim 该 idle 节点 → 触发 `_maybe_bind` + **recreate**。
5. **验证**(成功判据)：
   - `docker inspect` 新容器 mount 源 = `/data/winclaw/<user>/<companion>`(不是 _pool);
   - gateway_port/token **未变**;
   - `https://<vm>:<port 或 caddy>/digital-human` 仍 HTTPS(public_base_url 生效);
   - 在该 workspace 跑一个任务 → 成果物落 `/data/winclaw/<user>/<companion>/sessions/...` → **VM 重启/换镜像后成果物仍在**(持久盘验证)。
6. **清理**：测试用的节点/容器测完移除,避免占用。

### 1.4 风险/需你授权
- 会在 VM 上**新建/删除测试容器**(不动现有 `winclaw_lc`)。**需要你授权我在 VM 上做容器操作**(早先你授权过 VM 部署,这次是 adopt/claim/recreate 测试容器)。
- `vm_hosts.workspace_base` 从 `/tmp` 改 `/data` 是**正向修复**(§3 持久化),但会影响后续所有该 VM 新节点的落盘位置——确认 OK。

---

## 2. 语音伴侣接入

### 2.1 目标
主人对**数字人 avatar 语音**说一个任务 → 这个任务变成 ai-meta-poc 的**受管任务**(出现在 /secretary 任务列表、产出成果物、done 时自动提交 GitHub),而不是只在 winclaw 内部跑一次就没了。即把"语音口令"接到已建好的 **上传→任务→成果物→GitHub** 管线上。

### 2.2 现状(两条独立路径,尚未汇合)
- **语音路径**：用户语音 → DH 插件 `tool-router`(`extensions/digital-human/src`)的 `task_run`/`ask_winclaw` → `chat.send` → winclaw gateway agent(**winclaw 内部**,ai-meta-poc 不知道)。
- **API 路径**(已做)：前端/后端 `POST /tasks` → WS `chat.send`(sessionKey `secretary:task:<id>`)→ winclaw → 成果物 scan + GitHub。
- 二者**没汇合**:语音发的任务不进 ai-meta-poc 的 tasks 表,无成果物管理、无 GitHub。

### 2.3 关键难点 = §13 连通性(容器 → 后端)
- 语音在 **VM 容器内**触发;要变成受管任务需让容器**回调 ai-meta-poc 后端 `POST /tasks`**。但 **容器→ai-meta-poc(本地 NAT)方向不通**(§13 已证)。
- **三种解法(需你选)**：
  1. **后端公网部署(推荐生产)**：ai-meta-poc 部署到有公网入口的主机 → 容器内 DH 可 `POST /tasks` 回调。一劳永逸,也解决多端同步。
  2. **后端轮询/反向拉取(本地可用)**：DH 把语音任务写成约定文件(如 workspace `inbox/<id>.json`),ai-meta-poc 经 ssh 轮询 VM 的 inbox → 建任务并接管派发/成果物/GitHub。不需要容器→后端方向,**现在(本地后端)就能用**,代价是轮询延迟。
  3. **DH 直接走 ai-meta-poc 的派发约定**:改 DH `task_run`,让它不自己 `chat.send`,而是把任务+slot 写进 ai-meta-poc 能读到的位置(同 2)。

### 2.3.1 ✅ 已实装(解法2,2026-06-30)
- **后端(ai-meta-poc)** — 已实装并**本地端到端验证**:
  - `services/task_service.create_and_dispatch_task` — 抽出共通管线(POST /tasks 行为不变)。
  - `services/secretary_inbox.py` — 轮询 `<SECRETARY_WORKSPACE_ROOT>/inbox/*.json`,按 `user_uuid` 归属用户 → 建受管任务 → 派发;文件移 `inbox/processed/`(成功)或 `inbox/failed/`(parse/user不存在/派发异常)。
  - `main.py` lifespan 启停轮询器;config `SECRETARY_INBOX_ENABLED=True` / `SECRETARY_INBOX_POLL_SEC=5`。
  - **实测**:放 `inbox/voicetask1.json`{prompt,user_uuid} → 轮询器建任务 31 → metacoder 执行 → huangshan.txt → done → **真实 GitHub commit**。文件移到 processed/。✅
- **DH 侧(winclaw-avatar)** — 代码已实装(tsc 干净),待 VM 恢复后随镜像重建+语音实测:
  - `extensions/digital-human/src/secretary-inbox.ts` — `writeSecretaryInbox(workspaceDir,prompt,opts)` 原子写 `inbox/<uuid>.json`。
  - `tool-router.ts` `handleTaskRun` **双写**(保留 chat.send 即时语音回应 + 额外登记 inbox 给后端接管);`workspaceDir` 经 `realtime-handler.ts` 注入。
  - user_uuid 取 `process.env.AIMETA_USER_UUID`。
- **待办(production)**:
  1. **provisioner 注入 `AIMETA_USER_UUID`**:spin up DH 容器时把该 companion 的 ai-meta user_uuid 作为 env 注入(否则语音任务无法归属 owner)。最佳落点 = #3 claim-time recreate 的 provision_container(已知 user)。
  2. DH 侧重建镜像(VM 恢复后)。
  3. 语音结果**回灌播报**:任务 done 后让 DH 语音播报摘要——需 backend→容器方向(§13),可用"结果写回 inbox/results/ 由 DH 轮询播报"对称机制(后续)。

### 2.4 我会做的(代码,不需 VM 在线即可写;实测需 VM)
- **DH 端(winclaw-avatar)**:在 `extensions/digital-human/src/tool-router.ts` 的 `task_run` 增加"把语音任务登记为秘书任务"的分支(按 2.3 选定的解法,默认**解法2**:写 `inbox/<uuid>.json`{prompt, slot_hint, ts})。
- **后端端(ai-meta-poc)**:加一个 `secretary_inbox` 轮询器(后台 task / 或 ssh 拉取 VM inbox)→ 对每条 new inbox 项调现有 `create_task` 逻辑(派发 + 成果物 scan + GitHub)。语音任务自此与 API 任务**同一管线**。
- **回灌**:任务 done + 成果物后,DH 经 `notify.dh` **语音播报**结果摘要(tool-router 已有 `scheduleLateDelivery`/`notify.dh` 机制)。
- **前端**:/secretary 任务列表自然显示语音发起的任务(同 GET /tasks)。

### 2.5 需要你定/提供
- **2.3 选哪种连通方案**(1 公网部署 / 2 轮询 / 3 约定文件)。**建议先解法2**(本地即可跑通),生产再上解法1。
- 语音实测需 VM 在线 + 数字人 18999 可用 + 你用麦克风对 avatar 说一句任务。

---

## 3. 一句话：需要你现在做的

1. **确认 L20 VM 完全起来**(ssh 能进)→ 告诉我 → 我恢复 winclaw_lc/Caddy。
2. **授权我在 VM 上做 claim 测试容器**(adopt/claim/recreate/删除测试容器,不动现有 winclaw_lc)。
3. **选语音伴侣的连通方案**(§2.3,建议解法2)。
4. (已给)有效 GitHub token 已在用;用完记得 rotate。

我这边:VM 起来后立即跑 #3 claim 实测;语音伴侣的代码我可现在就开始写(选定方案后),VM 起来一起实测。
