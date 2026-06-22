/**
 * skillCatalog.ts
 *
 * Hard-coded registry of deployment skills, mirroring §17 of v2.2 spec.
 *
 * This catalog is the *runtime mirror* of the individual SKILL.md files.
 * The AI invokes skills via the Skill tool; this module enforces policy
 * (tested gate, age warning, provider match, intent match) at dispatch time.
 *
 * Exported as a frozen object to prevent accidental mutation at runtime.
 */

import type { SkillCatalogEntry, SkillIntent } from './types.js'
import type { ProviderName } from './types.js'

// ---------------------------------------------------------------------------
// Internal catalog definition
// ---------------------------------------------------------------------------

const _SKILL_CATALOG: Record<string, SkillCatalogEntry> = {
  'aliyun-deploy': {
    name: 'aliyun-deploy',
    description: 'Project-specific Aliyun deployment runbook (Helios DH SaaS)',
    skillPath: '~/.claude/skills/aliyun-deploy/SKILL.md',
    tested: true,
    verifiedEnvs: ['Helios-DH-SaaS-prod'],
    lastVerified: '2026-04-15',
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify'],
      providers: ['aliyun'],
      deployTargets: ['ack-serverless', 'eci'],
    },
    knownPitfalls: [
      {
        id: 'PIT-001',
        summary: 'ACR token expires after ~1 hour',
        mitigation: 'Refresh via aliyun cr GetAuthorizationToken before each push',
      },
      {
        id: 'PIT-002',
        summary: 'Aliyun ALB only supports zones B,G,H,I,J,K in cn-hangzhou; zone F unsupported',
        mitigation: 'Verify with ALB DescribeZones before VSwitch creation',
      },
      {
        id: 'PIT-003',
        summary: 'Pod-level /app/storage/ is ephemeral on ECI',
        mitigation: 'All persistent data must go through OSS or DB',
      },
      {
        id: 'PIT-004',
        summary: 'Frontend build-args are compile-time; rebuild image when ConfigMap changes',
        mitigation: 'Rebuild and push image whenever any ConfigMap value changes',
      },
      {
        id: 'PIT-005',
        summary: 'Do not auto-deploy without explicit user confirmation',
        mitigation: 'Always pause and ask user to confirm before triggering any production push',
      },
      {
        id: 'PIT-006',
        summary: 'Deployed image tag may not match yaml; always re-set image after kubectl apply',
        mitigation: 'Run kubectl set image after every apply to guarantee the tag is correct',
      },
      {
        id: 'PIT-007',
        summary: 'ECI image pull is slow on first run (1.26 GB ~3-5 min)',
        mitigation: 'Wait for pod Running status before declaring deploy success; use readinessProbe',
      },
      {
        id: 'PIT-008',
        summary: 'Aliyun ACK has no ClusterDNS for arbitrary in-cluster service names; use FQDN',
        mitigation: 'Always use <svc>.<namespace>.svc.cluster.local for in-cluster DNS',
      },
      {
        id: 'PIT-009',
        summary: 'WebSocket and HTTP share the same ALB listener; no special config needed',
        mitigation: 'Do not add a separate ALB listener for WebSocket traffic',
      },
    ],
  },

  'azure-cloud-deploy': {
    name: 'azure-cloud-deploy',
    description: 'Generic Azure infrastructure deployment via Bicep / ARM templates',
    skillPath: '~/.claude/skills/azure-cloud-deploy/SKILL.md',
    tested: true,
    verifiedEnvs: [],
    lastVerified: '2026-03-10',
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify', 'destroy'],
      providers: ['azure'],
      deployTargets: ['arm', 'bicep', 'resource-group'],
    },
    knownPitfalls: [],
  },

  'azure-appservice-node': {
    name: 'azure-appservice-node',
    description: 'Deploy a Node.js application to Azure App Service via ZIP deploy',
    skillPath: '~/.claude/skills/azure-appservice-node/SKILL.md',
    tested: true,
    verifiedEnvs: [],
    lastVerified: '2026-03-15',
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify'],
      providers: ['azure'],
      deployTargets: ['app-service', 'linux-app-service'],
    },
    knownPitfalls: [
      {
        id: 'APP-001',
        summary: 'Oryx build needs SCM_DO_BUILD_DURING_DEPLOYMENT=true',
        mitigation: 'Set app setting SCM_DO_BUILD_DURING_DEPLOYMENT=true before ZIP deploy',
      },
      {
        id: 'APP-002',
        summary: 'ZIP path encoding — forward slashes only, CRLF safe',
        mitigation: 'Use forward slashes in all ZIP entry paths; avoid Windows-style backslashes',
      },
    ],
  },

  'azure-appservice-static': {
    name: 'azure-appservice-static',
    description: 'Deploy a static frontend to Azure Static Web Apps or App Service',
    skillPath: '~/.claude/skills/azure-appservice-static/SKILL.md',
    tested: true,
    verifiedEnvs: [],
    lastVerified: '2026-03-15',
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'verify'],
      providers: ['azure'],
      deployTargets: ['static-web-apps', 'app-service'],
    },
    knownPitfalls: [
      {
        id: 'APP-003',
        summary: 'Service Worker cache may serve stale UI; cache-bust at deploy',
        mitigation: 'Append build hash to asset filenames or bump service worker version on each deploy',
      },
    ],
  },

  'aliyun-cloud-deploy': {
    name: 'aliyun-cloud-deploy',
    description: 'Generic Aliyun cloud deployment (unverified; use aliyun-deploy for Helios DH SaaS)',
    skillPath: '~/.claude/skills/aliyun-cloud-deploy/SKILL.md',
    tested: false,
    verifiedEnvs: [],
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'verify'],
      providers: ['aliyun'],
      deployTargets: ['ecs', 'ack', 'eci', 'fc'],
    },
    knownPitfalls: [],
  },

  'aws-cloud-deploy': {
    name: 'aws-cloud-deploy',
    description: 'Generic AWS deployment via CloudFormation / CDK (unverified in org)',
    skillPath: '~/.claude/skills/aws-cloud-deploy/SKILL.md',
    tested: false,
    verifiedEnvs: [],
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify', 'destroy'],
      providers: ['aws'],
      deployTargets: ['cloudformation', 'cdk', 'ecs', 'lambda'],
    },
    knownPitfalls: [],
  },

  'kubernetes-rolling': {
    name: 'kubernetes-rolling',
    description: 'Generic Kubernetes rolling-update deployment (untested in org)',
    skillPath: '~/.claude/skills/kubernetes-rolling/SKILL.md',
    tested: false,
    verifiedEnvs: [],
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify'],
      providers: ['aliyun', 'aws', 'gcp', 'azure', 'on-prem'],
      deployTargets: ['k8s-deployment', 'k8s-statefulset'],
    },
    knownPitfalls: [],
  },

  'static-cdn': {
    name: 'static-cdn',
    description: 'Deploy static assets to a CDN (untested in org)',
    skillPath: '~/.claude/skills/static-cdn/SKILL.md',
    tested: false,
    verifiedEnvs: [],
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'verify'],
      providers: ['azure', 'aws', 'aliyun', 'gcp'],
      deployTargets: ['cdn', 'blob', 's3', 'oss'],
    },
    knownPitfalls: [],
  },

  'manual': {
    name: 'manual',
    description: 'Manual deployment — no automation; always allowed',
    skillPath: '~/.claude/skills/manual/SKILL.md',
    tested: true,
    verifiedEnvs: [],
    contractVersion: 1,
    supports: {
      intents: ['deploy', 'rollback', 'verify', 'destroy'],
      providers: ['azure', 'aws', 'aliyun', 'gcp', 'on-prem'],
      deployTargets: ['any'],
    },
    knownPitfalls: [],
  },
}

// ---------------------------------------------------------------------------
// Public: frozen catalog
// ---------------------------------------------------------------------------

/**
 * Read-only catalog of deployment skills.
 * Do NOT export the mutable `_SKILL_CATALOG`; use the public functions below.
 */
export const SKILL_CATALOG: Readonly<Record<string, SkillCatalogEntry>> = Object.freeze(_SKILL_CATALOG)

// ---------------------------------------------------------------------------
// Public helper functions
// ---------------------------------------------------------------------------

/**
 * Look up a single skill by name.
 * Returns null when the skill is not registered in the catalog.
 */
export function getCatalogEntry(name: string): SkillCatalogEntry | null {
  return _SKILL_CATALOG[name] ?? null
}

/**
 * Return all catalog entries as an array (insertion order).
 */
export function listCatalog(): SkillCatalogEntry[] {
  return Object.values(_SKILL_CATALOG)
}

/**
 * Return only the skills where `tested === true`.
 */
export function listTestedSkills(): SkillCatalogEntry[] {
  return Object.values(_SKILL_CATALOG).filter(e => e.tested)
}

/**
 * Check whether a given skill supports a specific intent + provider combination.
 *
 * Returns false when the skill is not in the catalog.
 */
export function isSkillSupported(
  name: string,
  intent: SkillIntent,
  provider: ProviderName,
): boolean {
  const entry = _SKILL_CATALOG[name]
  if (!entry) return false
  return (
    entry.supports.intents.includes(intent) &&
    entry.supports.providers.includes(provider)
  )
}
