INSERT INTO users (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@careeriq.local', 'Demo User')
ON CONFLICT DO NOTHING;
