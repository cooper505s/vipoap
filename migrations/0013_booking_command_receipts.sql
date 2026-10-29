-- Staged only. Legacy mutation receipts remain readable with a null command record.
ALTER TABLE booking_mutations ADD COLUMN command_json TEXT
  CHECK(command_json IS NULL OR (json_valid(command_json) AND length(command_json)<=1024));
