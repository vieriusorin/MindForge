-- MF-0016: Spot the Cuckoo. A cuckoo is its own item kind in the registry (reviewed, hashed, playable
-- like every item), so private.items.item_type gains 'cuckoo'. Its answer key shares
-- private.question_keys (correct_options = ['<flawLine>']) and is graded by the unchanged
-- private.record_attempt. No grants change: private.items stays unreadable by clients.

alter table private.items
  drop constraint items_item_type_check,
  add constraint items_item_type_check
    check (item_type in ('question', 'card', 'diagram', 'cuckoo'));
