-- Text extraction now ends in 'extracted'; parsing (M3) moves it on to 'parsing' and 'ready'.
ALTER TABLE documents DROP CONSTRAINT documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('uploaded','extracting','extracted','parsing','embedding','ready','failed'));
