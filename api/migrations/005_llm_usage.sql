-- One row per LLM call, so token spend and latency can be inspected per user, feature and model.
CREATE TABLE llm_usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose           text NOT NULL,
  model             text NOT NULL,
  tier              text NOT NULL,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  estimated         boolean NOT NULL DEFAULT false,
  latency_ms        integer NOT NULL DEFAULT 0,
  status            text NOT NULL CHECK (status IN ('ok', 'error', 'cancelled')),
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_usage_user_created ON llm_usage (user_id, created_at DESC);
