/**
 * Editorial Content types — shared between renderer, preview modal, and edge function
 */

export interface EditorialRating {
  name: string;
  rating: number;
}

export interface EditorialSection {
  theme: 'food_drink' | 'culture_sights' | 'must_do' | 'must_see' | 'the_vibe';
  heading: string;
  intro: string;
  narrative: string;
  pullQuote?: string | null;
  activityRefs: string[];
  ratings: EditorialRating[];
}

export interface QuickRefItem {
  name: string;
  category: string;
  rating: number;
  oneLiner: string;
}

export interface EditorialContent {
  title: string;
  lede: string;
  sections: EditorialSection[];
  signOff: string;
  quickReference: QuickRefItem[];
}
