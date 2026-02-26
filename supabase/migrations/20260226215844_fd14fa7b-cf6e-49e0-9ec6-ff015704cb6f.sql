-- Make trip-memories bucket private so direct URLs no longer work
UPDATE storage.buckets SET public = false WHERE id = 'trip-memories';