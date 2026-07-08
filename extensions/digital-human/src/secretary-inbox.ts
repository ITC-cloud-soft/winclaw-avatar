/**
 * @fileoverview Secretary inbox writer — registers voice-originated tasks as
 * managed tasks for the ai-meta-poc backend.
 *
 * ## Why
 *
 * When the owner speaks a task to the DH avatar, the {@link ToolRouter}'s
 * `task_run` handler dispatches it through the Winclaw gateway agent (in-VM
 * execution). That path is ephemeral — no deliverable, no GitHub artifact.
 *
 * To turn a *voice* task into a *managed* task (deliverable + GitHub), we
 * ALSO drop a small JSON "inbox" file into `<workspaceDir>/inbox/`. The
 * ai-meta-poc backend polls this directory and claims each file as a managed
 * task. This is the "voice task → managed task" hand-off point.
 *
 * See `docs/dh-secretary-vm-claim-and-voice-plan.md` §2.
 *
 * ## Reliability contract
 *
 * Writing the inbox file is BEST-EFFORT. It must NEVER break the existing
 * `task_run` dispatch. Every failure is swallowed and logged as a warning.
 * Writes are atomic (write `.tmp`, then `rename`) so the poller never reads a
 * half-written file.
 *
 * ## provisioner requirement
 *
 * The `user_uuid` field is sourced from `process.env.AIMETA_USER_UUID`. The
 * provisioner that spins up this DH VM MUST inject `AIMETA_USER_UUID` into the
 * container/process environment so the backend can attribute the managed task
 * to the right owner. When it is absent we still write the inbox file (with an
 * empty `user_uuid`); the backend may move such a file to `failed` if it
 * cannot resolve the owner — that is acceptable and intentionally non-fatal
 * here.
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

/** Optional fields for {@link writeSecretaryInbox}. */
export interface SecretaryInboxOpts {
  /** Slot id this task belongs to, if known. @default null */
  slotId?: string | null;
  /** Origin of the task. @default "voice" */
  source?: string;
}

/** Shape of the JSON file the ai-meta-poc poller consumes. */
export interface SecretaryInboxRecord {
  prompt: string;
  /** Owner uuid from `AIMETA_USER_UUID`; empty string when unset. */
  user_uuid: string;
  slot_id: string | null;
  source: string;
  ts: number;
}

/**
 * Write a secretary inbox file registering `prompt` as a managed task.
 *
 * Best-effort and non-throwing: on any error it logs a warning and resolves
 * with `null` so the caller's primary flow (e.g. `task_run` gateway dispatch)
 * is never disrupted.
 *
 * @param workspaceDir Absolute path to the DH workspace. `<workspaceDir>/inbox`
 *   is created if missing.
 * @param prompt The natural-language task text spoken by the owner.
 * @param opts Optional slot id / source overrides.
 * @returns The absolute path of the written inbox file, or `null` on failure.
 */
export async function writeSecretaryInbox(
  workspaceDir: string,
  prompt: string,
  opts: SecretaryInboxOpts = {},
): Promise<string | null> {
  try {
    const trimmed = (prompt ?? "").trim();
    if (!workspaceDir || !trimmed) {
      console.warn(
        "[secretary-inbox] skipped: missing workspaceDir or empty prompt",
      );
      return null;
    }

    const inboxDir = join(workspaceDir, "inbox");
    await mkdir(inboxDir, { recursive: true });

    const record: SecretaryInboxRecord = {
      prompt: trimmed,
      // provisioner MUST inject AIMETA_USER_UUID (see file header). When unset
      // we write "" — the backend may move the file to `failed`, acceptable.
      user_uuid: process.env.AIMETA_USER_UUID ?? "",
      slot_id: opts.slotId ?? null,
      source: opts.source ?? "voice",
      ts: Date.now(),
    };

    const id = randomUUID();
    const finalPath = join(inboxDir, `${id}.json`);
    const tmpPath = `${finalPath}.tmp`;
    const json = JSON.stringify(record);

    // Atomic write: full content to `.tmp`, then rename into place so the
    // poller never observes a partially written file.
    await writeFile(tmpPath, json, "utf8");
    await rename(tmpPath, finalPath);

    console.info(
      `[secretary-inbox] ✅ registered managed task ${id}.json (source=${record.source}, user=${record.user_uuid || "<unset>"})`,
    );
    return finalPath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[secretary-inbox] ⚠️ failed to write inbox file: ${msg}`);
    return null;
  }
}
