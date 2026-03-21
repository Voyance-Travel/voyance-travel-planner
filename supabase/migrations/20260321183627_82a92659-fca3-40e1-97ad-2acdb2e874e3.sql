ALTER TABLE trip_payments DROP CONSTRAINT IF EXISTS trip_payments_trip_id_item_type_item_id_key;
ALTER TABLE trip_payments DROP CONSTRAINT IF EXISTS trip_payments_unique_item;
ALTER TABLE trip_payments ADD CONSTRAINT trip_payments_unique_item_member 
  UNIQUE (trip_id, item_type, item_id, assigned_member_id);