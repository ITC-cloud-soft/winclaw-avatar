/**
 * Type definitions for the Meta Coder Infra Environment Manager.
 *
 * Implements the schema from INFRA_ENVIRONMENT_DESIGN.v2.2.md §3.5 and §4.
 * These types are shared across the loader, resolver, backends, and slash
 * commands.
 */

// ---------------------------------------------------------------------------
// Layer 1: environments.yaml — committed to git, defines envs
// ---------------------------------------------------------------------------

export type EnvironmentsFile = {
  version: 2
  default: string
  environments: Env[]
}

export type Env = {
  name: string
  tags?: string[]
  description?: string
  extends?: string                                // 親 env を継承
  cloud: CloudSpec
  database?: DatabaseSpec
  storage?: StorageSpec
  deploy?: DeploySpec
  safety: SafetySpec
  lifecycle?: { auto_destroy_after?: string }     // ephemeral env
}

// ─── cloud providers ───
export type CloudSpec =
  | AzureCloud
  | AwsCloud
  | GcpCloud
  | AliyunCloud
  | OnPremCloud

export type AzureCloud = {
  provider: 'azure'
  subscription: string                            // ${var:KEY} 解決前の文字列
  tenant?: string
  region: string
  resource_group: string
}

export type AwsCloud = {
  provider: 'aws'
  account?: string
  region: string
  profile?: string
}

export type GcpCloud = {
  provider: 'gcp'
  project: string
  region: string
}

export type AliyunCloud = {
  provider: 'aliyun'
  access_key_id: string
  access_key_secret: string
  region: string
  resource_group?: string
}

export type OnPremCloud = {
  provider: 'on-prem'
  host: string
  region?: string
}

// ─── database ───
export type DatabaseSpec = {
  primary: DbConn
  replicas?: DbConn[]
  analytics?: DbConn
}

export type DbConn = {
  type: 'mysql' | 'postgres' | 'mongodb' | 'sqlserver' | 'redis' | 'sqlite'
  host: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: 'disable' | 'prefer' | 'require'
  roles?: {
    write?: { user: string; password: string }
  }
}

// ─── storage ───
export type StorageSpec = {
  objects?: ObjectStore
  cache?: CacheStore
  queue?: QueueStore
}

export type ObjectStore = {
  type: 'azure-blob' | 's3' | 'aliyun-oss' | 'gcs'
  account?: string                                // azure-blob
  container?: string                              // azure-blob
  bucket?: string                                 // s3 / oss / gcs
  endpoint?: string
  readonly?: boolean
}

export type CacheStore = {
  type: 'redis'
  url: string
}

export type QueueStore = {
  type: 'azure-storage-queue' | 'sqs' | 'mns'
  name: string
}

// ─── deploy ───
export type DeploySkillName =
  | 'azure-cloud-deploy'
  | 'azure-appservice-node'
  | 'azure-appservice-static'
  | 'aliyun-deploy'
  | 'aliyun-cloud-deploy'
  | 'aws-cloud-deploy'
  | 'gcp-cloud-deploy'
  | 'kubernetes-rolling'
  | 'static-cdn'
  | 'manual'

export type DeploySpec = {
  skill: DeploySkillName
  tested: boolean                                  // §1.5.1 必須
  requires_explicit_confirmation?: boolean
  verified_state?: string                          // verified-state.yaml への相対パス
  strategy?: string
  app_name?: string
  registry?: string
  rollback?:
    | 'previous-revision'
    | 'kubectl-rollout-undo'
    | 'lambda-previous-alias'
    | 'manual'
  traffic_percent?: number
}

// ─── safety ───
export type SafetySpec = {
  destructive_ops: 'allow' | 'confirm' | 'deny'
  writes_require_approval?: boolean
  writes_two_phase_commit?: boolean
  audit_log?: string
  audit_log_retention?: '7d' | '30d' | '1y' | 'forever'
}

// ---------------------------------------------------------------------------
// Layer 1.5: verified-state.yaml — project-specific known state
// ---------------------------------------------------------------------------

export type VerifiedStateFile = {
  version: 1
  last_verified: string                            // ISO date
  last_verified_by: string
} & Record<string, VerifiedEnvState>                // env name → state

export type VerifiedEnvState = {
  cluster?: { type: string; id: string; region?: string; kubeconfig?: string }
  registry?: { type: string; url: string; instance?: string }
  database?: { rds_instance?: string; cluster?: string }
  ingress?: {
    type: string
    id?: string
    domain?: string
    dns_zone_provider?: string
    dns_zone_subscription?: string
  }
  network?: {
    vpc?: string
    subnets?: string[]
    alb_vswitches?: string[]
    eci_pod_vswitch?: string
  }
  known_pitfalls?: KnownPitfall[]
}

export type KnownPitfall = {
  id: string                                       // PIT-001 等
  summary: string
  mitigation: string
  ref?: string                                     // skill / doc 参照
}

// ---------------------------------------------------------------------------
// Layer 2: ~/.metacoder/projects/<id>/infra.yaml — credential resolution map
// ---------------------------------------------------------------------------

export type InfraFile = {
  version: 2
  vars?: Record<string, BackendSpec>
  secrets?: Record<string, BackendSpec>
  ci_mode?: {
    enabled_when?: string
    fallback_backend?: BackendName
    forbid_backends?: BackendName[]
  }
}

export type BackendName =
  | 'literal'
  | 'env'
  | 'windows-credman'
  | 'keychain'
  | 'libsecret'
  | 'az-cli'
  | 'aws-cli'
  | 'aliyun-cli'
  | '1password'
  | 'vault'
  | 'keyvault'

export type BackendSpec =
  | { backend: 'literal'; value: string }
  | { backend: 'env'; name: string }
  | { backend: 'windows-credman'; target: string; cache_ttl?: string }
  | { backend: 'keychain'; service: string; account: string; cache_ttl?: string }
  | { backend: 'libsecret'; attr: string; cache_ttl?: string }
  | { backend: 'az-cli'; query: string; cache_ttl?: string }
  | { backend: 'aws-cli'; profile?: string; key: string; cache_ttl?: string }
  | { backend: 'aliyun-cli'; profile?: string; cache_ttl?: string }
  | { backend: '1password'; item: string; field: string; cache_ttl?: string }
  | { backend: 'vault'; path: string; field: string; cache_ttl?: string }
  | { backend: 'keyvault'; vault: string; secret: string; cache_ttl?: string }

// ---------------------------------------------------------------------------
// Resolution / runtime types
// ---------------------------------------------------------------------------

/**
 * An environment whose ${var:KEY} placeholders have been resolved to actual
 * strings. ${secret:KEY} placeholders may either be resolved (at the moment of
 * a tool call) or left as opaque references.
 */
export type ResolvedEnv = Env & {
  /** Names of secret refs that exist. Values are NEVER exposed to AI. */
  secretRefs: string[]
  /** Resolved env vars suitable for passing to a child process. */
  envVars: Record<string, string>
}

export type ResolveResult =
  | { ok: true; value: string }
  | {
      ok: false
      key: string
      kind: 'var' | 'secret'
      reason: 'not-declared' | 'backend-failed' | 'unsupported-backend'
      detail?: string
    }

// ---------------------------------------------------------------------------
// Active env (session-wide state)
// ---------------------------------------------------------------------------

export type ActiveEnvState = {
  envName: string
  reason?: string                                  // /env use の reason
  readonly: boolean
  elevatedUntil?: number                           // epoch ms
  /** "for db, dev for storage" のような部分オーバーライド */
  partialOverrides?: PartialOverride[]
}

export type PartialOverride = {
  aspect: 'cloud' | 'database' | 'storage' | 'deploy'
  envName: string
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EnvManagerError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'parse-error'
      | 'schema-violation'
      | 'circular-extends'
      | 'unknown-env'
      | 'untested-skill-on-prod'
      | 'project-id-resolution-failed'
      | 'backend-resolution-failed',
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'EnvManagerError'
  }
}
