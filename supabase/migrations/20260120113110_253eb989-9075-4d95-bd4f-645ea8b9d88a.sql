-- Create documents storage bucket for agency files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agency-documents', 'agency-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for agency documents bucket
-- Agents can view their own uploaded documents
CREATE POLICY "Agents can view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'agency-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can upload documents to their own folder
CREATE POLICY "Agents can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agency-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can update their own documents
CREATE POLICY "Agents can update own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agency-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can delete their own documents
CREATE POLICY "Agents can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agency-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);