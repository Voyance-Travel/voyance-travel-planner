-- Create a table for customer reviews
CREATE TABLE public.customer_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  trip_destination TEXT,
  archetype TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  photo_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can submit a review (insert)
CREATE POLICY "Anyone can submit a review"
ON public.customer_reviews
FOR INSERT
WITH CHECK (true);

-- Policy: Only approved reviews are publicly visible
CREATE POLICY "Approved reviews are publicly visible"
ON public.customer_reviews
FOR SELECT
USING (is_approved = true);

-- Policy: Users can view their own reviews (even if not approved)
CREATE POLICY "Users can view their own reviews"
ON public.customer_reviews
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
ON public.customer_reviews
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_customer_reviews_approved ON public.customer_reviews(is_approved) WHERE is_approved = true;
CREATE INDEX idx_customer_reviews_featured ON public.customer_reviews(is_featured) WHERE is_featured = true;
CREATE INDEX idx_customer_reviews_user ON public.customer_reviews(user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_customer_reviews_updated_at
BEFORE UPDATE ON public.customer_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();