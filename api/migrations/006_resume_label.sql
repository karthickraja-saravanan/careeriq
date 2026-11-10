-- Short, stable badge per resume (CV1, CV2, ...) so a resume can be named in chat with @CV1.
ALTER TABLE resumes ADD COLUMN label text;
UPDATE resumes r SET label = 'CV' || x.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn FROM resumes) x
  WHERE x.id = r.id;
ALTER TABLE resumes ALTER COLUMN label SET NOT NULL;
CREATE UNIQUE INDEX resumes_user_label ON resumes (user_id, label);
