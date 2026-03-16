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
  {
    slug: 'paris',
    title: "Founder's Guide: Paris",
    subtitle: "I'm a Paris girly. I'll just say it.",
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'Paris',
    readTime: '6 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1502602898657-3e91760cbb34'),
    summary: "Paris doesn't need me to tell you it's beautiful. What I can tell you is what actually stood out - the meals I still think about, the moments that caught me off guard, and the stuff that no amount of Instagram research prepared me for.",
    datePublished: '2026-03-16',
    tags: ['Paris', 'Food', 'Art', 'Walking', 'France'],
    content: `# Founder's Guide: Paris

I'm a Paris girly. I'll just say it. Paris doesn't need me to tell you it's beautiful - you already know that. What I can tell you is what actually stood out when I was there - the meals I still think about, the moments that caught me off guard, and the stuff that no amount of Instagram research prepared me for.

## What to See

**The Louvre** is my favorite place in the world. I get lost in there every time. I always wish I had more time in Paris so I could dedicate more time to the Louvre. The building itself is as impressive as the art inside. My advice: buy tickets online to skip the main line, and enter through the Carrousel du Louvre entrance underground - way shorter wait. Pick two or three sections max. If you try to see everything, you'll burn out and remember nothing.

**Sacre-Coeur** sitting on top of Montmartre - the view from those steps at sunset is one of the best things I've ever seen in any city. One of the most magical nights I can think of was walking up the hill, looking over the entire city, and then walking back down through all those hidden neighborhoods tucked behind the main area. Just sit on the steps. Take it in. The artists in Place du Tertre nearby are worth a wander afterward.

**The Seine at golden hour** might be the single most beautiful walk you can do in any city on earth. Start from Notre-Dame and walk toward the Eiffel Tower along the Left Bank. The bridges alone are worth it - Pont Alexandre III is the most photogenic. And you have to do the little boats that serve drinks on the river. They're fabulous.

## Where to Eat

Paris is the city where even a simple meal feels like an event. Here's where I'd send you.

**Angelina** is famous for the hot chocolate, and I know it feels like it's overhyped - but it's actually delicious. This isn't hot cocoa - it's essentially a cup of melted chocolate with all the whipped cream. Rich, thick, almost too much. The Mont-Blanc pastry is the other must-order. The tearoom itself is gorgeous Belle Epoque, open since 1903. Lines can be long, so go early or try the location at Versailles.

**Le Relais de l'Entrecote** - you have to try this. There is no menu. You sit down, they bring you a walnut salad, and then they bring you steak frites in their legendary secret herb butter sauce. That's it. You get seconds automatically. No reservations - just show up and queue. Go for lunch to avoid the worst of the lines. It's one of the most genius restaurant concepts I've ever seen. Everything served on a wooden block. So good.

**Sacre Fleur** is the tiny steak spot I fell in love with near Montmartre. This whole restaurant has less than 20 people. The menu is very limited - steak, fries, and I had the steak tartare, which was delicious. It's tucked behind the main area near Sacre-Coeur - you have to go up the hill and around to find it. It's not in the touristy part. That's what makes it special.

**Petit Bon** - I love the tea finger sandwiches at Petit Bon. Little crustless finger sandwiches, beautifully done. It's the kind of casual neighborhood spot that reminds you why French food has the reputation it does. No fuss, no pretense - just well-done French classics in a warm room.

## The Takeaway

Paris rewards you for slowing down. The best moments aren't about checking off landmarks - they're about sitting on the steps of Sacre-Coeur watching the sun go down, or eating steak frites at a restaurant that's been doing the same thing perfectly for decades, or getting lost in the Louvre for the third time and still finding something new.

Don't overschedule Paris. Walk the river. Eat well. Let the city set the pace.

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
  {
    slug: 'barcelona',
    title: "Founder's Guide: Barcelona",
    subtitle: "Barcelona is the city that has everything.",
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'Barcelona',
    readTime: '5 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1583422409516-2895a77efded'),
    summary: "Barcelona is the city that has everything - incredible architecture, world-class food, beaches, nightlife, and a vibe that makes you immediately start thinking about when you can come back.",
    datePublished: '2026-03-16',
    tags: ['Barcelona', 'Food', 'Architecture', 'Beaches', 'Spain'],
    content: `# Founder's Guide: Barcelona

Barcelona is the city that has everything - incredible architecture, world-class food, beaches, nightlife, and a vibe that makes you immediately start thinking about when you can come back. I already want to go back. Specifically, I want to go back and spend an entire day in the food market. That's how much I loved it.

## What to See

**Sagrada Familia** is the reason most people go to Barcelona, and it should be. I've seen a lot of churches and cathedrals around the world. This one is different. When you walk inside and the light pours through those stained glass windows - blues and greens on one side, reds and oranges on the other - it takes your breath away. Gaudi started this in 1882 and it's still not finished. Book tickets online weeks in advance because they sell out. Pay extra for tower access. Go in the morning when the east-facing stained glass catches the sunlight.

**Piscina Municipal de Montjuic** - go up to the Olympic swimming pool, have a drink, and see the city. It's the pool from the 1992 Games, open to the public, and you're swimming with a panoramic view of the entire city and the Mediterranean below you. One of the most unique things you can do in any European city. Then walk back down and explore the palace area. Check opening hours because they vary by season.

## Where to Eat and Drink

**La Boqueria** - this food market is one of my favorite places in the world. I'm not exaggerating. It's been operating on La Rambla since 1217. Hundreds of stalls - fresh seafood, jamon, fruit juices, tapas, everything. Walk past the front stalls near the entrance (those are tourist traps with higher prices) and go deeper into the market for better quality and better prices. Get there before 11am on a weekday before the cruise ship crowds arrive. Fresh juice is a must. I want to go back to Barcelona just to spend time here. It was wonderful.

**Bar Canete** is where I had some of the best tapas of the trip. It's legendary - really hard to get into, and it absolutely lived up to the hype. It's on a side street off La Rambla with a marble bar counter and an open kitchen. Sit at the counter if you can and watch them work. The razor clams, jamon croquettes, and grilled prawns are the must-orders. Seafood-focused, intimate, not a ton of space. Arrive early for dinner or expect a wait.

**Dow Jones Bar** is one of the most fun bar concepts I've ever seen. Cocktail prices fluctuate in real-time based on demand, displayed on stock ticker screens around the bar. When the "market crashes," everything gets cheap. It's a little grungy, I'll be honest, but it's a genuinely fun experience, especially with a group. Great for a pre-dinner drink or late-night stop.

## The Takeaway

Barcelona is the rare city that delivers on every front. The architecture is world-class. The food scene is deep. The beaches are right there. And the nightlife goes until sunrise if you want it to.

My top Barcelona moments: standing inside Sagrada Familia when the light hit, swimming at the Montjuic pool overlooking the city, spending hours grazing through La Boqueria, and eating razor clams at the counter at Bar Canete. That's a full day, and it's one of the best days you'll have anywhere.

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
];

export function getFoundersGuides(): FoundersGuide[] {
  return foundersGuides;
}

export function getFoundersGuideBySlug(slug: string): FoundersGuide | undefined {
  return foundersGuides.find(g => g.slug === slug);
}
