-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'invited');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'developer', 'viewer');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'completed', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('timeout', 'rate_limit', 'context_overflow', 'budget_exceeded', 'tool_error', 'permission_denied', 'unknown');

-- CreateEnum
CREATE TYPE "StepErrorHandler" AS ENUM ('fail', 'skip', 'fallback', 'continue_next');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('manual', 'cron', 'webhook_inbound', 'event', 'git_push');

-- CreateEnum
CREATE TYPE "OveragePolicy" AS ENUM ('block', 'warn', 'allow');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('mcp_server', 'skill', 'agent', 'rule', 'hook', 'plugin', 'workflow');

-- CreateEnum
CREATE TYPE "ExecutionStateStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "ExecutionAggregateStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ScheduledExecutionStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExecutionLogEventType" AS ENUM ('step_start', 'step_complete', 'step_fail', 'step_error', 'step_skip', 'workflow_start', 'workflow_complete', 'workflow_fail', 'retry', 'pause', 'resume', 'cancel');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "TraceResultStatus" AS ENUM ('success', 'error', 'timeout', 'cancelled', 'needs_input', 'interrupted');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "role" "UserRole" NOT NULL DEFAULT 'developer',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "last_login_at" TIMESTAMP(3),
    "max_concurrent_executions" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "rate_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "ip_whitelist" JSONB NOT NULL DEFAULT '[]',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'sequential',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'active',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "last_executed_at" TIMESTAMP(3),
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "system_prompt" TEXT,
    "use_base_prompt" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "max_retries" INTEGER NOT NULL DEFAULT 0,
    "depends_on" JSONB NOT NULL DEFAULT '[]',
    "validators" JSONB NOT NULL DEFAULT '[]',
    "template_id" TEXT,
    "output_variables" JSONB NOT NULL DEFAULT '[]',
    "input_variables" JSONB NOT NULL DEFAULT '[]',
    "backend" TEXT NOT NULL DEFAULT 'claude',
    "model" TEXT,
    "timeout" INTEGER DEFAULT 300000,
    "error_handler" "StepErrorHandler" NOT NULL DEFAULT 'fail',
    "skip_condition" TEXT,
    "sub_workflow_id" TEXT,
    "output_schema" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "changelog" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflow_id" TEXT NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "project_path" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION,
    "last_message_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "current_step_id" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "selected_for_context" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "token_count" INTEGER,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,
    "step_id" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_feedbacks" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,

    CONSTRAINT "message_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "project_path" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" TEXT NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "claude_session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_memories" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,

    CONSTRAINT "step_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_state" (
    "id" TEXT NOT NULL,
    "state" "ExecutionStateStatus" NOT NULL DEFAULT 'queued',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "retry_counts" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,

    CONSTRAINT "execution_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "event_type" "ExecutionLogEventType" NOT NULL,
    "step_id" TEXT,
    "step_name" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'http',
    "uri" TEXT,
    "command" TEXT,
    "args" JSONB NOT NULL DEFAULT '[]',
    "env_vars" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "tools_cache" JSONB,
    "last_test_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "plugin_id" TEXT,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frontmatter" JSONB NOT NULL DEFAULT '{}',
    "body" TEXT NOT NULL DEFAULT '',
    "allowed_tools" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "repo_url" TEXT,
    "project_path" TEXT,
    "repo_owner" TEXT,
    "repo_name" TEXT,
    "repo_branch" TEXT DEFAULT 'main',
    "repo_path" TEXT,
    "file_manifest" JSONB NOT NULL DEFAULT '[]',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "plugin_id" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "disallowed_tools" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "permission_mode" TEXT NOT NULL DEFAULT 'default',
    "max_turns" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "repo_url" TEXT,
    "project_path" TEXT,
    "repo_owner" TEXT,
    "repo_name" TEXT,
    "repo_branch" TEXT DEFAULT 'main',
    "repo_path" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "plugin_id" TEXT,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "repo_url" TEXT,
    "project_path" TEXT,
    "repo_owner" TEXT,
    "repo_name" TEXT,
    "repo_branch" TEXT DEFAULT 'main',
    "repo_path" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT,
    "plugin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "author" TEXT,
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "repo_url" TEXT,
    "project_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_traces" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "command_line" TEXT NOT NULL,
    "env_snapshot" JSONB NOT NULL DEFAULT '{}',
    "message_length" INTEGER NOT NULL,
    "system_prompt_preview" TEXT,
    "resume_token" TEXT,
    "model" TEXT,
    "project_path" TEXT NOT NULL,
    "pid" INTEGER,
    "stdout_raw" TEXT NOT NULL DEFAULT '',
    "stderr_raw" TEXT NOT NULL DEFAULT '',
    "parsed_events" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3) NOT NULL,
    "first_byte_at" TIMESTAMP(3),
    "first_content_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "exit_code" INTEGER,
    "signal" TEXT,
    "result_status" "TraceResultStatus" NOT NULL,
    "error_message" TEXT,
    "error_category" "ErrorCategory",
    "error_code" TEXT,
    "content_length" INTEGER NOT NULL DEFAULT 0,
    "actions_count" INTEGER NOT NULL DEFAULT 0,
    "resume_token_out" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_creation_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "web_search_requests" INTEGER NOT NULL DEFAULT 0,
    "web_fetch_requests" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION,
    "duration_api_ms" INTEGER,
    "num_turns" INTEGER NOT NULL DEFAULT 0,
    "stop_reason" TEXT,
    "claude_code_version" TEXT,
    "output_style" TEXT,
    "fast_mode_state" TEXT,
    "permission_mode" TEXT,
    "session_id" TEXT,
    "service_tier" TEXT,
    "inference_geo" TEXT,
    "iterations" JSONB NOT NULL DEFAULT '[]',
    "model_usage" JSONB NOT NULL DEFAULT '{}',
    "permission_denials" JSONB NOT NULL DEFAULT '[]',
    "cache_creation" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prompt_version_id" TEXT,

    CONSTRAINT "execution_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_tool_calls" (
    "id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" TEXT NOT NULL,

    CONSTRAINT "execution_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_aggregates" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "completed_steps" INTEGER NOT NULL DEFAULT 0,
    "failed_steps" INTEGER NOT NULL DEFAULT 0,
    "skipped_steps" INTEGER NOT NULL DEFAULT 0,
    "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION,
    "total_duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "final_status" "ExecutionAggregateStatus" NOT NULL DEFAULT 'running',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_execution_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_executions" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_duration_ms" DOUBLE PRECISION,
    "p50_duration_ms" DOUBLE PRECISION,
    "p95_duration_ms" DOUBLE PRECISION,
    "unique_workflows" INTEGER NOT NULL DEFAULT 0,
    "unique_users" INTEGER NOT NULL DEFAULT 0,
    "error_breakdown" JSONB NOT NULL DEFAULT '{}',
    "model_breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_execution_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL,
    "matcher" TEXT,
    "handler_type" TEXT NOT NULL DEFAULT 'command',
    "command" TEXT,
    "prompt" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 60000,
    "is_async" BOOLEAN NOT NULL DEFAULT false,
    "status_message" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "project_path" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_token_budgets" (
    "id" TEXT NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 5000000,
    "monthly_limit" INTEGER NOT NULL DEFAULT 100000000,
    "current_daily_usage" INTEGER NOT NULL DEFAULT 0,
    "current_monthly_usage" INTEGER NOT NULL DEFAULT 0,
    "last_daily_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_monthly_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daily_cost_limit_usd" DOUBLE PRECISION,
    "monthly_cost_limit_usd" DOUBLE PRECISION,
    "overage_policy" "OveragePolicy" NOT NULL DEFAULT 'block',
    "user_id" TEXT NOT NULL,

    CONSTRAINT "user_token_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_usage_history" (
    "id" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_cost_usd" DOUBLE PRECISION,
    "model" TEXT,
    "execution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "token_usage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_url" TEXT NOT NULL DEFAULT '',
    "system_prompt" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "resource_ids" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "step_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "diff" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response_code" INTEGER,
    "response_body" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "webhook_id" TEXT NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" TEXT NOT NULL,
    "type" "TriggerType" NOT NULL DEFAULT 'manual',
    "cron_expr" TEXT,
    "cron_timezone" TEXT,
    "webhook_secret" TEXT,
    "event_name" TEXT,
    "event_filter" JSONB,
    "rate_limit" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflow_id" TEXT NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_executions" (
    "id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "status" "ScheduledExecutionStatus" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger_id" TEXT NOT NULL,

    CONSTRAINT "scheduled_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_name" TEXT,
    "diff" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_tags" (
    "id" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "resource_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_dependencies" (
    "id" TEXT NOT NULL,
    "source_type" "ResourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "dependency_type" "ResourceType" NOT NULL,
    "dependency_id" TEXT NOT NULL,
    "dependency_name" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_mcp_servers" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_skills" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_agents" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_rules" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_hooks" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "hook_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "git_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_git_mappings" (
    "id" TEXT NOT NULL,
    "project_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "git_account_id" TEXT NOT NULL,

    CONSTRAINT "project_git_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hourly_token_usage" (
    "id" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "hourly_token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_performance_metrics" (
    "id" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'daily',
    "period_start" TIMESTAMP(3) NOT NULL,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_ms" DOUBLE PRECISION,
    "p95_duration_ms" DOUBLE PRECISION,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_quality_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_ratings" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "execution_id" TEXT NOT NULL,
    "step_id" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "execution_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_sources" (
    "id" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "repo_branch" TEXT NOT NULL DEFAULT 'main',
    "repo_path" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "workflows_user_id_idx" ON "workflows"("user_id");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_type_idx" ON "workflows"("type");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_id_idx" ON "workflow_steps"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_id_step_order_idx" ON "workflow_steps"("workflow_id", "step_order");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_key" ON "workflow_versions"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_workflow_id_idx" ON "conversations"("workflow_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversations_parent_id_idx" ON "conversations"("parent_id");

-- CreateIndex
CREATE INDEX "conversations_is_archived_idx" ON "conversations"("is_archived");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_step_id_idx" ON "messages"("conversation_id", "step_id");

-- CreateIndex
CREATE INDEX "messages_step_id_idx" ON "messages"("step_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "message_feedbacks_message_id_idx" ON "message_feedbacks"("message_id");

-- CreateIndex
CREATE INDEX "message_feedbacks_conversation_id_idx" ON "message_feedbacks"("conversation_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "conversation_sessions_conversation_id_step_id_idx" ON "conversation_sessions"("conversation_id", "step_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_sessions_conversation_id_step_id_key" ON "conversation_sessions"("conversation_id", "step_id");

-- CreateIndex
CREATE INDEX "step_memories_conversation_id_step_id_idx" ON "step_memories"("conversation_id", "step_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_memories_conversation_id_step_id_key" ON "step_memories"("conversation_id", "step_id");

-- CreateIndex
CREATE INDEX "execution_state_conversation_id_idx" ON "execution_state"("conversation_id");

-- CreateIndex
CREATE INDEX "execution_state_state_idx" ON "execution_state"("state");

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_idx" ON "execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "execution_logs_execution_id_event_type_idx" ON "execution_logs"("execution_id", "event_type");

-- CreateIndex
CREATE INDEX "execution_logs_conversation_id_idx" ON "execution_logs"("conversation_id");

-- CreateIndex
CREATE INDEX "mcp_servers_user_id_idx" ON "mcp_servers"("user_id");

-- CreateIndex
CREATE INDEX "mcp_servers_enabled_idx" ON "mcp_servers"("enabled");

-- CreateIndex
CREATE INDEX "mcp_servers_plugin_id_idx" ON "mcp_servers"("plugin_id");

-- CreateIndex
CREATE INDEX "skills_user_id_idx" ON "skills"("user_id");

-- CreateIndex
CREATE INDEX "skills_enabled_idx" ON "skills"("enabled");

-- CreateIndex
CREATE INDEX "skills_plugin_id_idx" ON "skills"("plugin_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_user_id_key" ON "skills"("name", "user_id");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_enabled_idx" ON "agents"("enabled");

-- CreateIndex
CREATE INDEX "agents_plugin_id_idx" ON "agents"("plugin_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_user_id_key" ON "agents"("name", "user_id");

-- CreateIndex
CREATE INDEX "rules_user_id_idx" ON "rules"("user_id");

-- CreateIndex
CREATE INDEX "rules_enabled_idx" ON "rules"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "rules_name_user_id_key" ON "rules"("name", "user_id");

-- CreateIndex
CREATE INDEX "plugins_user_id_idx" ON "plugins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugins_name_user_id_key" ON "plugins"("name", "user_id");

-- CreateIndex
CREATE INDEX "execution_traces_execution_id_idx" ON "execution_traces"("execution_id");

-- CreateIndex
CREATE INDEX "execution_traces_conversation_id_idx" ON "execution_traces"("conversation_id");

-- CreateIndex
CREATE INDEX "execution_traces_step_id_idx" ON "execution_traces"("step_id");

-- CreateIndex
CREATE INDEX "execution_traces_created_at_idx" ON "execution_traces"("created_at");

-- CreateIndex
CREATE INDEX "execution_traces_result_status_idx" ON "execution_traces"("result_status");

-- CreateIndex
CREATE INDEX "execution_traces_model_idx" ON "execution_traces"("model");

-- CreateIndex
CREATE INDEX "execution_tool_calls_trace_id_idx" ON "execution_tool_calls"("trace_id");

-- CreateIndex
CREATE INDEX "execution_tool_calls_tool_name_idx" ON "execution_tool_calls"("tool_name");

-- CreateIndex
CREATE UNIQUE INDEX "execution_aggregates_execution_id_key" ON "execution_aggregates"("execution_id");

-- CreateIndex
CREATE INDEX "execution_aggregates_conversation_id_idx" ON "execution_aggregates"("conversation_id");

-- CreateIndex
CREATE INDEX "execution_aggregates_workflow_id_idx" ON "execution_aggregates"("workflow_id");

-- CreateIndex
CREATE INDEX "execution_aggregates_started_at_idx" ON "execution_aggregates"("started_at");

-- CreateIndex
CREATE INDEX "daily_execution_metrics_date_idx" ON "daily_execution_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_execution_metrics_date_key" ON "daily_execution_metrics"("date");

-- CreateIndex
CREATE INDEX "hooks_user_id_idx" ON "hooks"("user_id");

-- CreateIndex
CREATE INDEX "hooks_event_type_idx" ON "hooks"("event_type");

-- CreateIndex
CREATE INDEX "hooks_enabled_idx" ON "hooks"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "user_token_budgets_user_id_key" ON "user_token_budgets"("user_id");

-- CreateIndex
CREATE INDEX "token_usage_history_user_id_idx" ON "token_usage_history"("user_id");

-- CreateIndex
CREATE INDEX "token_usage_history_created_at_idx" ON "token_usage_history"("created_at");

-- CreateIndex
CREATE INDEX "token_usage_history_execution_id_idx" ON "token_usage_history"("execution_id");

-- CreateIndex
CREATE INDEX "step_templates_user_id_idx" ON "step_templates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_templates_name_user_id_key" ON "step_templates"("name", "user_id");

-- CreateIndex
CREATE INDEX "prompt_versions_step_id_idx" ON "prompt_versions"("step_id");

-- CreateIndex
CREATE INDEX "webhooks_user_id_idx" ON "webhooks"("user_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_created_at_idx" ON "webhook_deliveries"("created_at");

-- CreateIndex
CREATE INDEX "workflow_triggers_workflow_id_idx" ON "workflow_triggers"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_triggers_type_idx" ON "workflow_triggers"("type");

-- CreateIndex
CREATE INDEX "scheduled_executions_trigger_id_idx" ON "scheduled_executions"("trigger_id");

-- CreateIndex
CREATE INDEX "scheduled_executions_scheduled_at_idx" ON "scheduled_executions"("scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_executions_status_idx" ON "scheduled_executions"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "tags_user_id_idx" ON "tags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_user_id_key" ON "tags"("name", "user_id");

-- CreateIndex
CREATE INDEX "resource_tags_resource_type_resource_id_idx" ON "resource_tags"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_tags_tag_id_resource_type_resource_id_key" ON "resource_tags"("tag_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "resource_dependencies_source_type_source_id_idx" ON "resource_dependencies"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "resource_dependencies_dependency_type_dependency_id_idx" ON "resource_dependencies"("dependency_type", "dependency_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_dependencies_source_type_source_id_dependency_type_key" ON "resource_dependencies"("source_type", "source_id", "dependency_type", "dependency_id");

-- CreateIndex
CREATE INDEX "workflow_step_mcp_servers_server_id_idx" ON "workflow_step_mcp_servers"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_mcp_servers_step_id_server_id_key" ON "workflow_step_mcp_servers"("step_id", "server_id");

-- CreateIndex
CREATE INDEX "workflow_step_skills_skill_id_idx" ON "workflow_step_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_skills_step_id_skill_id_key" ON "workflow_step_skills"("step_id", "skill_id");

-- CreateIndex
CREATE INDEX "workflow_step_agents_agent_id_idx" ON "workflow_step_agents"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_agents_step_id_agent_id_key" ON "workflow_step_agents"("step_id", "agent_id");

-- CreateIndex
CREATE INDEX "workflow_step_rules_rule_id_idx" ON "workflow_step_rules"("rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_rules_step_id_rule_id_key" ON "workflow_step_rules"("step_id", "rule_id");

-- CreateIndex
CREATE INDEX "workflow_step_hooks_hook_id_idx" ON "workflow_step_hooks"("hook_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_hooks_step_id_hook_id_key" ON "workflow_step_hooks"("step_id", "hook_id");

-- CreateIndex
CREATE INDEX "git_accounts_user_id_idx" ON "git_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "git_accounts_label_user_id_key" ON "git_accounts"("label", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_git_mappings_project_path_key" ON "project_git_mappings"("project_path");

-- CreateIndex
CREATE INDEX "project_git_mappings_git_account_id_idx" ON "project_git_mappings"("git_account_id");

-- CreateIndex
CREATE INDEX "hourly_token_usage_user_id_idx" ON "hourly_token_usage"("user_id");

-- CreateIndex
CREATE INDEX "hourly_token_usage_hour_idx" ON "hourly_token_usage"("hour");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_token_usage_hour_user_id_model_key" ON "hourly_token_usage"("hour", "user_id", "model");

-- CreateIndex
CREATE INDEX "resource_performance_metrics_resource_type_resource_id_idx" ON "resource_performance_metrics"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_performance_metrics_resource_type_resource_id_peri_key" ON "resource_performance_metrics"("resource_type", "resource_id", "period", "period_start");

-- CreateIndex
CREATE INDEX "execution_ratings_execution_id_idx" ON "execution_ratings"("execution_id");

-- CreateIndex
CREATE INDEX "execution_ratings_user_id_idx" ON "execution_ratings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_ratings_execution_id_step_id_user_id_key" ON "execution_ratings"("execution_id", "step_id", "user_id");

-- CreateIndex
CREATE INDEX "git_sources_resource_type_resource_id_idx" ON "git_sources"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "git_sources_resource_type_resource_id_key" ON "git_sources"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "agent_skills_agent_id_idx" ON "agent_skills"("agent_id");

-- CreateIndex
CREATE INDEX "agent_skills_skill_id_idx" ON "agent_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_agent_id_skill_id_key" ON "agent_skills"("agent_id", "skill_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "step_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_sub_workflow_id_fkey" FOREIGN KEY ("sub_workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_feedbacks" ADD CONSTRAINT "message_feedbacks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_feedbacks" ADD CONSTRAINT "message_feedbacks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_memories" ADD CONSTRAINT "step_memories_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_memories" ADD CONSTRAINT "step_memories_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_state" ADD CONSTRAINT "execution_state_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_traces" ADD CONSTRAINT "execution_traces_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_traces" ADD CONSTRAINT "execution_traces_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_tool_calls" ADD CONSTRAINT "execution_tool_calls_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "execution_traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hooks" ADD CONSTRAINT "hooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_token_budgets" ADD CONSTRAINT "user_token_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage_history" ADD CONSTRAINT "token_usage_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_templates" ADD CONSTRAINT "step_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_executions" ADD CONSTRAINT "scheduled_executions_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "workflow_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_mcp_servers" ADD CONSTRAINT "workflow_step_mcp_servers_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_mcp_servers" ADD CONSTRAINT "workflow_step_mcp_servers_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_skills" ADD CONSTRAINT "workflow_step_skills_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_skills" ADD CONSTRAINT "workflow_step_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_agents" ADD CONSTRAINT "workflow_step_agents_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_agents" ADD CONSTRAINT "workflow_step_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_rules" ADD CONSTRAINT "workflow_step_rules_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_rules" ADD CONSTRAINT "workflow_step_rules_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_hooks" ADD CONSTRAINT "workflow_step_hooks_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_hooks" ADD CONSTRAINT "workflow_step_hooks_hook_id_fkey" FOREIGN KEY ("hook_id") REFERENCES "hooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_accounts" ADD CONSTRAINT "git_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_git_mappings" ADD CONSTRAINT "project_git_mappings_git_account_id_fkey" FOREIGN KEY ("git_account_id") REFERENCES "git_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_token_usage" ADD CONSTRAINT "hourly_token_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_ratings" ADD CONSTRAINT "execution_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

