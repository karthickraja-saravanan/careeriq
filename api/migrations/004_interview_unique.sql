-- One interview prep per resume and job; regenerating replaces it.
DELETE FROM interview_preps a USING interview_preps b
  WHERE a.resume_id = b.resume_id AND a.job_id = b.job_id AND a.created_at < b.created_at;
ALTER TABLE interview_preps ADD CONSTRAINT interview_preps_resume_job_key UNIQUE (resume_id, job_id);
