-- application_comments table for Sprint 5-5
CREATE TABLE IF NOT EXISTS application_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES employees(id),
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_application ON application_comments(application_id);
CREATE INDEX idx_comments_author ON application_comments(author_id);

-- Grant access
GRANT ALL ON application_comments TO authenticated;
GRANT ALL ON application_comments TO anon;

-- Enable RLS
ALTER TABLE application_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for application_comments" ON application_comments FOR ALL USING (true) WITH CHECK (true);
