CREATE TABLE IF NOT EXISTS briefs (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  email            text NOT NULL,
  company          text NOT NULL,
  needs            text NOT NULL,
  budget           text NOT NULL,
  timeline         date NOT NULL,
  pipeline_status  text NOT NULL DEFAULT 'new'
                   CHECK (pipeline_status IN ('new', 'contacted', 'proposal', 'won', 'lost')),
  ai_status        text NOT NULL DEFAULT 'pending'
                   CHECK (ai_status IN ('pending', 'processing', 'done', 'failed')),
  ai_result        jsonb,
  ai_error         text,
  ai_attempts      integer NOT NULL DEFAULT 0,
  ai_model         text,
  -- Copied out of ai_result so the list can filter and index on them.
  priority         text GENERATED ALWAYS AS (ai_result ->> 'priority') STORED,
  service_category text GENERATED ALWAYS AS (ai_result ->> 'service_category') STORED,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS briefs_created_at_idx ON briefs (created_at DESC);
CREATE INDEX IF NOT EXISTS briefs_priority_idx ON briefs (priority);
CREATE INDEX IF NOT EXISTS briefs_service_category_idx ON briefs (service_category);
