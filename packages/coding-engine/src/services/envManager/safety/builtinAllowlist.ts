/**
 * Built-in destructive CLI patterns — Phase 4 §7.2.
 *
 * These are the default rules baked into Meta Coder. User
 * `.metacoder/cli-allowlist.yaml` can append additional rules on top.
 *
 * Matching semantics (enforced by classifyCli):
 *   For a rule to fire, EVERY string in `args_match` must appear in the actual
 *   args array — either as an exact element or as a substring of an element.
 *   Example: args_match ['resource','delete'] fires on
 *            args ['resource','delete','--name','foo'].
 */

import type { AllowlistRule } from './types.js'

// ---------------------------------------------------------------------------
// Cloud — Azure (az CLI)
// ---------------------------------------------------------------------------

const AZURE_RULES: AllowlistRule[] = [
  {
    command: 'az',
    args_match: ['resource', 'delete'],
    description: 'Delete an Azure resource',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['group', 'delete'],
    description: 'Delete an Azure resource group (removes all contained resources)',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['containerapp', 'delete'],
    description: 'Delete an Azure Container App',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['webapp', 'delete'],
    description: 'Delete an Azure Web App',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['vm', 'delete'],
    description: 'Delete an Azure Virtual Machine',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['aks', 'delete'],
    description: 'Delete an Azure Kubernetes Service cluster',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['keyvault', 'delete'],
    description: 'Delete an Azure Key Vault',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['storage', 'account', 'delete'],
    description: 'Delete an Azure Storage Account',
    severity: 'destructive',
  },
  {
    command: 'az',
    args_match: ['network', 'nsg', 'delete'],
    description: 'Delete an Azure Network Security Group',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Cloud — AWS (aws CLI)
// ---------------------------------------------------------------------------

const AWS_RULES: AllowlistRule[] = [
  {
    command: 'aws',
    args_match: ['ec2', 'terminate-instances'],
    description: 'Terminate EC2 instances',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['ec2', 'delete-vpc'],
    description: 'Delete an AWS VPC',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['s3', 'rb', '--force'],
    description: 'Force-remove an S3 bucket and all its contents',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['s3', 'rm', '--recursive'],
    description: 'Recursively remove S3 objects',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['rds', 'delete-db-instance'],
    description: 'Delete an RDS database instance',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['rds', 'delete-db-cluster'],
    description: 'Delete an RDS database cluster',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['lambda', 'delete-function'],
    description: 'Delete an AWS Lambda function',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['ecs', 'delete-service'],
    description: 'Delete an ECS service',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['iam', 'delete-user'],
    description: 'Delete an IAM user',
    severity: 'destructive',
  },
  {
    command: 'aws',
    args_match: ['cloudformation', 'delete-stack'],
    description: 'Delete a CloudFormation stack',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Cloud — Aliyun (Alibaba Cloud CLI)
// ---------------------------------------------------------------------------

const ALIYUN_RULES: AllowlistRule[] = [
  {
    command: 'aliyun',
    args_match: ['ecs', 'DeleteInstance'],
    description: 'Delete an Alibaba Cloud ECS instance',
    severity: 'destructive',
  },
  {
    command: 'aliyun',
    args_match: ['rds', 'DeleteDBInstance'],
    description: 'Delete an Alibaba Cloud RDS database instance',
    severity: 'destructive',
  },
  {
    command: 'aliyun',
    args_match: ['cs', 'DELETE'],
    description: 'Delete an Alibaba Cloud ACK (Container Service) cluster',
    severity: 'destructive',
  },
  {
    command: 'aliyun',
    args_match: ['oss', 'rm', '--recursive'],
    description: 'Recursively remove OSS objects',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Cloud — GCP (gcloud CLI)
// ---------------------------------------------------------------------------

const GCP_RULES: AllowlistRule[] = [
  {
    command: 'gcloud',
    args_match: ['compute', 'instances', 'delete'],
    description: 'Delete a GCP Compute Engine instance',
    severity: 'destructive',
  },
  {
    command: 'gcloud',
    args_match: ['sql', 'instances', 'delete'],
    description: 'Delete a GCP Cloud SQL instance',
    severity: 'destructive',
  },
  {
    command: 'gcloud',
    args_match: ['projects', 'delete'],
    description: 'Delete a GCP project (removes all resources)',
    severity: 'destructive',
  },
  {
    command: 'gcloud',
    args_match: ['container', 'clusters', 'delete'],
    description: 'Delete a GCP GKE cluster',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Kubernetes
// ---------------------------------------------------------------------------

const KUBERNETES_RULES: AllowlistRule[] = [
  {
    command: 'kubectl',
    args_match: ['delete'],
    description: 'Delete any Kubernetes resource',
    severity: 'destructive',
  },
  {
    command: 'kubectl',
    args_match: ['drain'],
    description: 'Drain a Kubernetes node (evicts all pods)',
    severity: 'destructive',
  },
  {
    command: 'kubectl',
    args_match: ['rollout', 'undo'],
    description: 'Roll back a Kubernetes deployment',
    severity: 'risky',
  },
  {
    command: 'helm',
    args_match: ['uninstall'],
    description: 'Uninstall a Helm release',
    severity: 'destructive',
  },
  {
    command: 'helm',
    args_match: ['delete'],
    description: 'Delete a Helm release (alias for uninstall)',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Database CLIs
// ---------------------------------------------------------------------------

const DATABASE_RULES: AllowlistRule[] = [
  {
    command: 'mysql',
    args_match: ['-e', 'DROP'],
    description: 'Execute a DROP statement via mysql CLI',
    severity: 'destructive',
  },
  {
    command: 'psql',
    args_match: ['-c', 'DROP'],
    description: 'Execute a DROP statement via psql CLI',
    severity: 'destructive',
  },
  {
    command: 'mongosh',
    args_match: ['--eval', 'drop'],
    description: 'Execute a drop() call via mongosh',
    severity: 'destructive',
  },
  {
    command: 'redis-cli',
    args_match: ['FLUSHDB'],
    description: 'Flush the current Redis database',
    severity: 'destructive',
  },
  {
    command: 'redis-cli',
    args_match: ['FLUSHALL'],
    description: 'Flush all Redis databases',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

const FILESYSTEM_RULES: AllowlistRule[] = [
  {
    command: 'rm',
    args_match: ['-rf'],
    description: 'Recursively force-delete files/directories',
    severity: 'destructive',
  },
  {
    command: 'rm',
    args_match: ['-fr'],
    description: 'Recursively force-delete files/directories (flags reversed)',
    severity: 'destructive',
  },
  {
    command: 'rm',
    args_match: ['-Rf'],
    description: 'Recursively force-delete files/directories (capital R)',
    severity: 'destructive',
  },
  {
    command: 'rm',
    args_match: ['-r', '-f'],
    description: 'Recursively force-delete files/directories (split flags)',
    severity: 'destructive',
  },
  {
    command: 'del',
    args_match: ['/s', '/q'],
    description: 'Windows: silently delete files in subdirectories',
    severity: 'destructive',
  },
  {
    command: 'Remove-Item',
    args_match: ['-Recurse', '-Force'],
    description: 'PowerShell: recursively force-remove items',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Git (severity: risky — reversible in theory but dangerous)
// ---------------------------------------------------------------------------

const GIT_RULES: AllowlistRule[] = [
  {
    command: 'git',
    args_match: ['push', '--force'],
    description: 'Force-push to a remote (can overwrite history)',
    severity: 'risky',
  },
  {
    command: 'git',
    args_match: ['push', '-f'],
    description: 'Force-push shorthand (can overwrite history)',
    severity: 'risky',
  },
  {
    command: 'git',
    args_match: ['reset', '--hard'],
    description: 'Hard reset — discards all uncommitted changes',
    severity: 'risky',
  },
  {
    command: 'git',
    args_match: ['branch', '-D'],
    description: 'Force-delete a local branch',
    severity: 'risky',
  },
  {
    command: 'git',
    args_match: ['clean', '-fdx'],
    description: 'Remove untracked files, directories, and ignored files',
    severity: 'risky',
  },
  {
    command: 'git',
    args_match: ['clean', '-fxd'],
    description: 'Remove untracked files (flags reordered)',
    severity: 'risky',
  },
]

// ---------------------------------------------------------------------------
// Container (Docker)
// ---------------------------------------------------------------------------

const CONTAINER_RULES: AllowlistRule[] = [
  {
    command: 'docker',
    args_match: ['rmi', '--force'],
    description: 'Force-remove Docker image(s)',
    severity: 'destructive',
  },
  {
    command: 'docker',
    args_match: ['rmi', '-f'],
    description: 'Force-remove Docker image(s) (short flag)',
    severity: 'destructive',
  },
  {
    command: 'docker',
    args_match: ['volume', 'rm'],
    description: 'Remove a Docker volume',
    severity: 'destructive',
  },
  {
    command: 'docker',
    args_match: ['system', 'prune', '--all', '--volumes'],
    description: 'Prune all Docker objects including volumes',
    severity: 'destructive',
  },
  {
    command: 'docker',
    args_match: ['system', 'prune', '--all', '--force'],
    description: 'Force-prune all unused Docker objects',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Package managers (severity: risky — recoverable but disruptive)
// ---------------------------------------------------------------------------

const PACKAGE_RULES: AllowlistRule[] = [
  {
    command: 'npm',
    args_match: ['uninstall', '--save'],
    description: 'Uninstall and remove npm package from package.json',
    severity: 'risky',
  },
  {
    command: 'bun',
    args_match: ['remove'],
    description: 'Remove a Bun package dependency',
    severity: 'risky',
  },
  {
    command: 'pip',
    args_match: ['uninstall', '-y'],
    description: 'Silently uninstall a Python package',
    severity: 'risky',
  },
  {
    command: 'yarn',
    args_match: ['remove'],
    description: 'Remove a Yarn package dependency',
    severity: 'risky',
  },
]

// ---------------------------------------------------------------------------
// Terraform / Infrastructure-as-Code
// ---------------------------------------------------------------------------

const TERRAFORM_RULES: AllowlistRule[] = [
  {
    command: 'terraform',
    args_match: ['destroy'],
    description: 'Destroy all Terraform-managed infrastructure',
    severity: 'destructive',
  },
  {
    command: 'terraform',
    args_match: ['apply', '-destroy'],
    description: 'Terraform apply with destroy flag',
    severity: 'destructive',
  },
]

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

export const BUILTIN_DESTRUCTIVE_RULES: AllowlistRule[] = [
  ...AZURE_RULES,
  ...AWS_RULES,
  ...ALIYUN_RULES,
  ...GCP_RULES,
  ...KUBERNETES_RULES,
  ...DATABASE_RULES,
  ...FILESYSTEM_RULES,
  ...GIT_RULES,
  ...CONTAINER_RULES,
  ...PACKAGE_RULES,
  ...TERRAFORM_RULES,
]
