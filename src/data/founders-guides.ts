import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

export interface FoundersGuide {
  slug: string;
  title: string;
  subtitle: string;
  authorName: string;
  authorTitle: string;
  destination: string;
  readTime: string;
  coverImage: string;
  summary: string;
  content: string;
  datePublished: string;
  tags: string[];
}

export const foundersGuides: FoundersGuide[] = [
  {
    slug: 'london',
    title: "Founder's Guide: London",
    subtitle: 'What I actually did, where I actually ate, and what I\'d tell a friend.',
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'London',
    readTime: '8 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1513635269975-59663e0ac1ad'),
    summary: "London has my heart. Every time I go back it gets better. This isn't a list of top 10 things — it's what I actually did, where I actually ate, and what I'd tell a friend.",
    datePublished: '2026-03-15',
    tags: ['London', 'Food', 'Nightlife', 'Markets', 'UK'],
    content: `# Founder's Guide: London

London has my heart. Every time I go back it gets better. The food scene has completely transformed, the history hits you around every corner, and the city has this energy that makes you want to walk everywhere - even when your legs are begging you to stop.

This isn't a list of "top 10 things to do in London." This is what I actually did, where I actually ate, and what I'd tell a friend if they texted me tomorrow asking for recommendations.

## Getting In

**Heathrow Express** - take it. I love this thing. Fifteen minutes from Heathrow to Paddington, no stops, no dragging your luggage through the Tube. Book online in advance for cheaper fares. It runs every 15 minutes from 5am to midnight. When you land tired and just want to get to your room, this is the move.

## What to See

**Trafalgar Square** is the natural starting point for any London trip. Nelson's Column, the fountains, the National Gallery right there (free, by the way) - it's the center of everything. I love it as a meeting point and a launching pad. From there you can walk to Westminster, Covent Garden, or Soho in minutes.

**The British Museum** - free. Yes, yes, yes. The Rosetta Stone, the Egyptian mummies, the Parthenon sculptures - it's one of the best museums on earth and it costs you nothing. My advice: don't try to see everything. Pick three or four galleries and actually spend time in them. Go on a weekday morning if you can.

## Where to Eat

This is where London really shines. I have found spots here that I would fly back for.

**Gordon's Wine Bar** is the oldest wine bar in London, and walking in feels like stepping into another world. Underground, candlelit, newspapers peeling off the walls - you go down these stairs and suddenly you're in a cave that's been serving wine since 1890. It almost feels like you're in France. It's wonderful. It's honestly one of my favorite places in London. Grab a bottle and a cheese board. No reservations, so get there early. In summer, the outdoor terrace overlooking Embankment Gardens is the spot.

**Noble Rot** - delicious. Their wine list focuses on natural and biodynamic selections, and the food - seasonal British and European - is refined without being fussy. Let the sommelier pick for you. The space is small and intimate, so book ahead. Wine lovers, this is your spot.

**Flat Iron** - oh my God. One thing done perfectly: a flat iron steak with salad for about fifteen pounds. There's usually a queue, but it moves fast. They give you a miniature cleaver as a steak knife, which I love. Add the dripping fries. If you're on a budget and want food that's just good, this is it. Best steak value in London.

**Fatt Pundit** is amazing and something you won't find anywhere else. It's Indo-Chinese food - the cuisine from Kolkata's Chinese community. It's a real culinary tradition, not a gimmick. The chili chicken and Hakka noodles are the signatures. Small plates, meant for sharing. If you like bold flavors and unique food experiences, you need to try this.

**Yauatcha** is Michelin-starred dim sum in Soho, and I enjoyed it so much. Go for the dim sum lunch - same quality as dinner, better value. The venison puffs and prawn har gau are must-orders. They also have a patisserie downstairs with macarons that rival any in Paris.

**Sushi Kyu** is a counter-style sushi spot with very limited seats. The nigiri is the strength here. A great option when you want quality Japanese food without a two-hour tasting menu commitment.

**Laduree** - I'll say it, it's a little touristy. But you know what? It's worth it just for the experience. Grab a box of macarons or sit down for a hot chocolate and a dessert to share. Expensive, yes. But definitely a nice afternoon pitstop between museum visits. Rose and pistachio are the classics.

## Nightlife

**Ronnie Scott's Jazz Club** - I cannot say enough about this place. If I had to pick one thing you absolutely cannot miss in London, it's Ronnie Scott's. This venue has been hosting the greatest jazz musicians in the world since 1959. The room is intimate, the performances are electric, and you can feel the history in the walls. Book tickets in advance for weekend headliners. The late show after 11pm is cheaper and more spontaneous.

This is one of my top five experiences anywhere in the world. I love it.

## Markets

**Borough Market** is London's famous food market, and it's been going since the 13th century. Artisan vendors, street food stalls, fresh produce - there's so much to take in. Go on a Saturday morning for the full atmosphere. Go hungry. The raclette stand, the Turkish gozleme, and the Bread Ahead doughnuts are highlights, but honestly, just wander and eat what catches your eye.

## The Takeaway

London is a city built for people who love food, history, and walking. The dining scene alone makes it worth the flight. My standout moments are all tied to specific places - candlelight at Gordon's Wine Bar, live jazz at Ronnie Scott's, that first bite at Flat Iron. That's what makes London stick with you.

If you go, don't try to do everything. Pick a few neighborhoods, eat well, and let the city surprise you.

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
];

export function getFoundersGuides(): FoundersGuide[] {
  return foundersGuides;
}

export function getFoundersGuideBySlug(slug: string): FoundersGuide | undefined {
  return foundersGuides.find(g => g.slug === slug);
}
