-- MF-0024: an id belongs to the pack whose slug it starts with (`<pack>.<skill>.<name>`).
-- A slug has no dot, so distinct packs can never claim one id, and the global keys
-- question_keys(question_id) / items(item_id) stay correct without a composite key.
-- The sync's validator refuses the same rule first (scripts/lib/validate-packs.mjs); this is the
-- database's own guard against any other writer.
--
-- Deliberately VALID (not `not valid`): a mismatched existing row must abort the migration loudly.
-- Hosted pre-check (must return 0 rows):
--   select question_id, pack_slug from private.question_keys where split_part(question_id, '.', 1) <> pack_slug
--   union all
--   select item_id, pack_slug from private.items where split_part(item_id, '.', 1) <> pack_slug;

alter table private.question_keys
  add constraint question_keys_id_prefix_check
  check (split_part(question_id, '.', 1) = pack_slug);

alter table private.items
  add constraint items_id_prefix_check
  check (split_part(item_id, '.', 1) = pack_slug);
