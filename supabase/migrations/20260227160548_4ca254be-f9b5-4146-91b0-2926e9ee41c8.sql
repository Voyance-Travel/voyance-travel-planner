
-- Create storage bucket for boarding passes / flight documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('boarding-passes', 'boarding-passes', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload boarding passes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'boarding-passes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Only the owner can read their boarding passes
CREATE POLICY "Users can read own boarding passes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'boarding-passes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Only the owner can delete their boarding passes
CREATE POLICY "Users can delete own boarding passes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'boarding-passes' AND auth.uid()::text = (storage.foldername(name))[1]);
