-- Rate limiting table for pre-auth endpoint protection
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL
);

-- Composite index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (ip_address, endpoint, created_at DESC);

-- No RLS needed - this table is only accessed by edge functions with service role

-- Static destination fallbacks for when rate limited
CREATE TABLE public.destination_fallbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_key TEXT NOT NULL UNIQUE, -- normalized: "tokyo, japan" -> "tokyo-japan"
  display_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  preview_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_destination_fallbacks_key ON public.destination_fallbacks (destination_key);

-- Seed top destinations with static fallback content
INSERT INTO public.destination_fallbacks (destination_key, display_name, tagline, description, preview_days) VALUES
('tokyo-japan', 'Tokyo, Japan', 'Where tradition meets tomorrow', 'One of Asia''s most dynamic cities. 5,000+ restaurants. Ancient temples alongside neon-lit streets.', '[{"dayNumber":1,"headline":"Temples and Ramen in Asakusa","description":"Start slow with incense and noodles in Tokyo''s historic heart."},{"dayNumber":2,"headline":"Get Lost in Shimokitazawa","description":"Vintage shops, tiny cafes, and zero tourists. A local''s Tokyo."},{"dayNumber":3,"headline":"Tsukiji to Ginza on Foot","description":"Morning fish market energy into afternoon department store calm."}]'),
('paris-france', 'Paris, France', 'The city that invented flânerie', 'Art, architecture, and the world''s best bakeries. Every arrondissement tells a different story.', '[{"dayNumber":1,"headline":"Le Marais Without the Crowds","description":"Jewish bakeries, hidden courtyards, and the Places des Vosges at golden hour."},{"dayNumber":2,"headline":"Left Bank Literary Walk","description":"Shakespeare & Co to Café de Flore. Retrace Hemingway''s footsteps."},{"dayNumber":3,"headline":"Montmartre Before Noon","description":"Sacré-Cœur without selfie sticks. Artists'' studios still open."}]'),
('barcelona-spain', 'Barcelona, Spain', 'Mediterranean soul, Catalan pride', 'Gaudí''s curves, Gothic lanes, and beaches that feel earned. A city that rewards the curious.', '[{"dayNumber":1,"headline":"Gothic Quarter Slow Wander","description":"Medieval alleys, hidden plazas, and the cathedral at dusk."},{"dayNumber":2,"headline":"Gràcia Like a Local","description":"Skip Park Güell crowds for the neighborhood''s real plazas and vermut bars."},{"dayNumber":3,"headline":"Barceloneta Beach Day Done Right","description":"Morning swim, seafood lunch, sunset chiringuito. The Barcelona rhythm."}]'),
('new-york-usa', 'New York, USA', 'Eight million stories, choose yours', 'The city that never sleeps but knows the best places to nap. Every block a new world.', '[{"dayNumber":1,"headline":"West Village Breakfast to Bookshops","description":"Croissants, cobblestones, and the city''s best browsing."},{"dayNumber":2,"headline":"Brooklyn Heights to DUMBO","description":"Promenade views, pizza pilgrimage, and Manhattan from across the river."},{"dayNumber":3,"headline":"Central Park Without a Map","description":"Get deliberately lost. Find the Ramble. Skip the zoo."}]'),
('london-uk', 'London, UK', 'History with excellent coffee', 'Museums are free. The pubs are warm. The neighborhoods couldn''t be more different.', '[{"dayNumber":1,"headline":"South Bank Art Walk","description":"Tate Modern to Borough Market. Culture then cheese."},{"dayNumber":2,"headline":"Notting Hill Beyond the Movie","description":"Portobello Road antiques, hidden mews, and the gate to Kensington Gardens."},{"dayNumber":3,"headline":"East London Creative Crawl","description":"Brick Lane to Broadway Market. Street art, vintage, and the best coffee."}]'),
('rome-italy', 'Rome, Italy', 'Three thousand years of dinner reservations', 'Every corner a ruin, every ruin a story. The eternal city earns the name.', '[{"dayNumber":1,"headline":"Trastevere Golden Hour","description":"Cross the Tiber as the light turns amber. Stay for dinner."},{"dayNumber":2,"headline":"Ancient Rome Before 9am","description":"Forum at dawn, Colosseum shadows, then espresso standing up."},{"dayNumber":3,"headline":"Villa Borghese Escape","description":"Bernini sculptures, garden strolls, and the city below."}]'),
('amsterdam-netherlands', 'Amsterdam, Netherlands', 'Bikes, boats, and brown cafes', 'Canals that double as mirrors. A city built on water and tolerance.', '[{"dayNumber":1,"headline":"Jordaan Canal Wander","description":"Nine Streets shopping, hidden hofjes, and lunch by the water."},{"dayNumber":2,"headline":"Museumplein Art Day","description":"Van Gogh to Vermeer, then Vondelpark for recovery."},{"dayNumber":3,"headline":"De Pijp Market Morning","description":"Albert Cuyp chaos, then the quieter streets beyond."}]'),
('lisbon-portugal', 'Lisbon, Portugal', 'Seven hills, infinite miradores', 'Tiles, trams, and pastel de nata. A city that rewards the climb.', '[{"dayNumber":1,"headline":"Alfama Labyrinth","description":"Get lost in the oldest neighborhood. Find fado at night."},{"dayNumber":2,"headline":"Belém Monuments and Pastries","description":"Tower, monastery, and the original custard tarts."},{"dayNumber":3,"headline":"LX Factory to Time Out","description":"Creative reuse, then the market that got it right."}]'),
('bangkok-thailand', 'Bangkok, Thailand', 'Chaos theory as urban planning', 'Temples next to malls next to street food empires. Overwhelming in the best way.', '[{"dayNumber":1,"headline":"Old Town Temple Trio","description":"Wat Pho, Wat Arun, and the Grand Palace. Start early, beat the heat."},{"dayNumber":2,"headline":"Chinatown After Dark","description":"Skip the day crowds. Yaowarat lights up at sunset."},{"dayNumber":3,"headline":"Chatuchak Weekend Mission","description":"15,000 stalls. Pick a section. Commit to getting lost."}]'),
('sydney-australia', 'Sydney, Australia', 'Beaches, bays, and boundless brunch', 'Harbor views from every angle. A city that lives outdoors.', '[{"dayNumber":1,"headline":"Bondi to Bronte Coastal Walk","description":"Ocean pools, cliff views, and coffee earned."},{"dayNumber":2,"headline":"The Rocks and Opera House","description":"Convict history meets architectural icon. Sunset drinks at Opera Bar."},{"dayNumber":3,"headline":"Ferry to Manly","description":"The best commute in the world, with beach at the end."}]')
ON CONFLICT (destination_key) DO NOTHING;