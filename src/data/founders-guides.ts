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
  {
    slug: 'japan',
    title: "Founder's Guide: Japan",
    subtitle: 'Three cities, endless wagyu, and 62 miles on foot.',
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'Japan',
    readTime: '12 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1493976040374-85c8e12f0c0e'),
    summary: "Japan changed how I think about travel. Everything is intentional - the food, the design, the service, the systems. I spent time in Kyoto, Tokyo, and Osaka, and each city has a completely different personality.",
    datePublished: '2026-03-16',
    tags: ['Japan', 'Food', 'Hotels', 'Markets', 'Culture'],
    content: `# Founder's Guide: Japan

Japan changed how I think about travel. Everything is intentional - the food, the design, the service, the systems. It's a country where a convenience store sandwich can be a genuine highlight of your trip, and I mean that with zero irony.

I spent time in Kyoto, Tokyo, and Osaka. Each city has a completely different personality, and you need all three to understand what makes Japan special.

## Where to Stay

Hotels in Japan can make or break the trip. I stayed at Four Seasons properties in all three cities, and the quality varied.

**Four Seasons Kyoto** was my favorite hotel of the entire trip - maybe any trip I've ever taken. It's set in a temple district with an 800-year-old pond garden, ofuro baths, a world-class spa, and a piano lounge that made me never want to leave. The danger of this hotel is that it's so peaceful and beautiful you have to force yourself to go explore the city. I used the ofuro baths every single day for recovery after walking. If you stay here, have the wagyu katsu sandwich at EMBA - cocktails, live pianist, and one of the best meals of the trip.

**Four Seasons Tokyo at Otemachi** had the best views. Breakfast overlooking the Imperial Palace Gardens is a top-10 Japan moment. It's a calm, modern high-rise above the chaos of Tokyo, and the pool and baths are excellent for recovery.

**The Peninsula Tokyo** is the classic luxury pick. The rooms are noticeably bigger than most Tokyo hotels, and the direct subway connection makes getting around incredibly easy. Polished and grand.

**Four Seasons Osaka** was beautiful with a great spa, but the location was slightly less convenient for getting to Osaka's main dining and nightlife areas. Still worth it for the hotel itself.

## Where to Eat

Japan's food scene is in a different league. Here's what actually stood out.

**EMBA Kyoto Grill** at the Four Seasons Kyoto was one of my most memorable meals. Wagyu katsu sandwich, fries, a cocktail, and a pianist playing in the background. Simple, elegant, perfect. This is the meal I tell everyone about.

**Gyukatsu Motomura** in Tokyo serves fried wagyu cutlet - it comes out rare and you sear it yourself on a hot stone at your table. Add the mustard sauce and wasabi. It's about fifteen dollars and it's one of the most satisfying meals in the city. Go for lunch to avoid the lines.

**Ukai-tei Ginza** is where wagyu gets the fine dining treatment. Tableside teppanyaki grilling in an elegant Ginza setting. Go for lunch - better value, equally impressive.

**Yakiniku Black Hole** is the interactive option - grill wagyu yourself at the table. Fun, casual, great after a big day at DisneySea.

**Ganko Yakiniku** - fabulous. 10 out of 10 recommend. This was one of my favorite discoveries of the trip. A tiny, hidden yakiniku spot that seats just a handful of people. The kind of place you stumble into and immediately know you found something special.

**Kakyo** in Kyoto is traditional kaiseki. Multi-course, seasonal, beautifully plated. The pacing is slow and intentional. This isn't about filling up - it's about the experience. Go for lunch and let it breathe.

**Ramen** - I didn't have one specific "best ramen" moment, but ramen after a long day of walking Tokyo is one of the most comforting things you can experience. Rich broth, quick service, under ten dollars. Pair it with a gyukatsu meal for the ultimate comfort day.

One lesson I learned: traditional omakase wasn't really my thing. I tried a high-end sushi omakase - 20+ courses, rigid pacing, ingredients like eel and abalone that I didn't connect with. If you're not already a sushi purist, you might want to stick with restaurants where you have more control over what you're eating. The wagyu experiences were far more memorable for me.

## The Markets

Markets in Japan were some of my favorite eating experiences of the entire trip.

**Nishiki Market** in Kyoto is a narrow covered street with over a hundred stalls. Chicken nanban, wagyu skewers, gyoza, tempura, toro, sake tastings - it's all there. My advice: do a guided tour your first time. You'll learn what to try and skip past the tourist traps.

**Kuromon Ichiba Market** in Osaka is the rowdier, more energetic version. Wagyu sushi, tempura, yakisoba, and every kind of street snack you can imagine. Walk the full length before you start buying. Bring cash for the smaller stalls. The experience here is just wandering and eating whatever catches your eye.

## The Surprise: Convenience Stores

I'm going to say something that sounds ridiculous: the 7-Eleven egg salad sandwich in Japan is a genuine food recommendation. Japanese convenience stores - they call them konbini - are nothing like what you're used to. Fresh onigiri, premium sandwiches, excellent fried chicken. Also try Famichiki from FamilyMart and Lawson's fried chicken. Available 24/7, costs almost nothing, and legitimately good.

## Experiences

**Tokyo DisneySea** was a huge highlight. I'm a Disney girl at heart, and I'd call this the most beautiful Disney park in the world. The design and attention to detail is on another level - it's architecturally stunning even if you don't ride anything. Surprisingly affordable compared to US Disney parks. Worth it even if you only somewhat like Disney.

**Fushimi Inari Taisha** in Kyoto - thousands of orange torii gates winding up a mountain. Go at sunrise. By 9am it's packed. The higher you climb, the fewer people. You don't need to go all the way to the top.

**Arashiyama Bamboo Grove** - arrive before 8am or don't bother. It's small and gets overwhelmed by mid-morning. But early, with the filtered light and the sound of wind through the bamboo, it's surreal.

**Shibuya Crossing** at night - cross it once for the energy (3,000 people at once), then watch from above. The neon at night makes it cinematic.

**Dotonbori** in Osaka - neon-lit canal district with the famous Glico running man sign. Amazing for one or two nights of sensory overload. Great street food along the strip.

## Recovery

Here's something nobody tells you about Japan: you will walk an insane amount. I logged 62 miles over the trip. My daily ritual was using the hotel pool and ofuro baths for recovery. If you're choosing between two hotels, pick the one with baths. You'll need them.

## Practical Stuff

**Trains** - once you realize that train lines have numbers and stations have numbers, Japan becomes incredibly easy to navigate. Don't be intimidated.

**Tours** - my strategy was one market tour and one cultural tour per city, then explore independently. Student-led tours were excellent value.

**Weather** - I went in September. It was about 90 degrees and humid, with typhoon season active. Bring an umbrella, a neck fan, and lightweight clothes.

**Flights** - about 11 hours outbound, 9 hours return, with a 16-hour time difference. It's a real commitment. My conclusion: one major international trip like this per year is enough.

## Top 10 Japan Moments

- Four Seasons Kyoto - the hotel itself
- Wagyu katsu sandwich at EMBA
- Ofuro hot baths after walking
- Nishiki Market grazing
- Kuromon Market in Osaka
- Ramen comfort meal after 25,000 steps
- Yakiniku dinner - grilling my own wagyu
- Tokyo DisneySea
- Shibuya Crossing at night
- Breakfast at Four Seasons Otemachi overlooking the Imperial Palace

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
  {
    slug: 'vienna',
    title: "Founder's Guide: Vienna",
    subtitle: 'Imperial charm, legendary sausages, and the coffeehouse ritual.',
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'Vienna',
    readTime: '5 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1516550893923-42d28e5677af'),
    summary: "I loved Vienna. The coffeehouse culture, the street food, the architecture - it's a city that moves at its own pace. Also, I would fly back just for the hot dogs. Dead serious.",
    datePublished: '2026-03-16',
    tags: ['Vienna', 'Food', 'Coffee', 'Hotels', 'Austria'],
    content: `# Founder's Guide: Vienna

I loved Vienna. I didn't go in expecting it to become one of my favorite cities, but it has this elegant, old-world atmosphere that just works. The coffeehouse culture, the street food, the architecture - it's a city that moves at its own pace, and once you sync up with it, everything clicks.

Also, I would fly back to Vienna just to eat hot dogs. I'm dead serious. For my upcoming trip, I was desperately trying to get back to Vienna just for the hot dogs. That's how good they are.

## Where to Stay

**Imperial Riding School Vienna** - I loved this hotel. It's a Marriott Autograph Collection property set in a beautifully converted former imperial riding school. High ceilings, real character, historic charm that you don't get from a standard chain hotel. Great location for walking the city center.

## Where to Eat

**Bitzinger Wurstelstand** is the most famous sausage stand in Vienna, and it earns every bit of that reputation. It's right behind the Albertina museum near the State Opera, and you'll see everyone from tourists to people in formalwear grabbing sausages after a show. Order the Kasekrainer - a cheese-stuffed sausage. Eat it standing at the high tables like everyone else. This is street food at its absolute best.

I said it at the top and I'll say it again: I would go back to Vienna just for these. My upcoming trip, I was desperately trying to figure out how to route through Vienna so I could eat here again.

**Cafe Sacher** is the coffeehouse experience I loved the most. It's inside the Hotel Sacher, and the interior feels like a palace - ornate, elegant, old Vienna in every detail. We went upstairs to the top floor and it was wonderful. Order the original Sachertorte and a Viennese coffee. This is about the coffeehouse ritual as much as it is about the cake. Definitely make reservations.

**Ganko Yakiniku** - 10 out of 10 recommend. This was my hidden gem discovery. A tiny Japanese yakiniku restaurant that seats maybe six people. That's how hidden it is - I had to dig to even find it again. It became one of my favorite meals of the entire trip. The intimacy is part of the charm. My plan for the next Vienna visit was honestly just to come back, eat here, get hot dogs at Bitzinger, and do nothing else.

## The Coffeehouse Culture

Vienna's coffeehouse culture is a real thing and worth experiencing. We went to two - one that was more low-key and one that felt more prestigious, almost like a palace setting. I loved the vibe of the more elegant one. Definitely make reservations, but the whole ritual of sitting down, ordering coffee and cake, and just taking your time - that's peak Vienna.

## The Takeaway

Vienna is a city for people who appreciate craft, history, and doing a few things really well rather than rushing through a checklist. My top three Vienna moments: the Kasekrainer at Bitzinger, coffee upstairs at Cafe Sacher, and stumbling into Ganko Yakiniku. None of those were planned. That's the kind of travel I love.

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
  {
    slug: 'las-vegas',
    title: "Founder's Guide: Las Vegas",
    subtitle: 'The right hotel, the right meals, and the hidden spots most visitors miss.',
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    destination: 'Las Vegas',
    readTime: '5 min read',
    coverImage: toSiteImageUrlFromPhotoId('photo-1605833556294-ea5c7a74f57d'),
    summary: "Vegas rewards you for knowing where to go. The right hotel, the right meals, and knowing the hidden spots make all the difference.",
    datePublished: '2026-03-16',
    tags: ['Las Vegas', 'Food', 'Hotels', 'Nightlife', 'Nevada'],
    content: `# Founder's Guide: Las Vegas

I love Las Vegas. The key is knowing which properties are worth the money, which meals are worth the splurge, and which hidden gems most visitors walk right past. If you do it right, Vegas is actually one of the best food and hotel cities in the country.

## Where to Stay

The hotel makes or breaks a Vegas trip. I've stayed at several on the Strip and have strong opinions.

### Wynn Las Vegas

**Wynn Las Vegas** is my favorite hotel in Vegas. It's on the north end of the Strip, and everything about it is a step above - the rooms, the pool, the casino floor, the landscaping. It's refined in a way that most Vegas hotels aren't. Request a higher floor facing the Strip. The pool complex is the best on the Strip.

### Encore at Wynn

**Encore at Wynn** is the sister property, connected to the Wynn but with its own identity. Slightly more intimate, all-suite, with its own pool and nightlife scene. The suites are a good value compared to the main Wynn tower. The Encore Beach Club is the party side if that's your thing.

### The Cosmopolitan

**The Cosmopolitan** is the coolest hotel on the Strip. Modern design, art installations, and the rare Vegas hotel that actually has balcony rooms. I used to stay here all the time. Book a Terrace Suite if you can - having a balcony overlooking the Strip at night is unforgettable. The Chandelier Bar inside is worth a drink even if you're staying elsewhere.

## Where to Eat

### La Cave Wine & Food Hideaway

**La Cave Wine & Food Hideaway** at the Wynn is one of my favorite brunches anywhere. Not just Vegas - anywhere. It's an intimate wine cave with family-style service. They bring dish after dish to your table - charcuterie, shareable plates, and a wine list to match. It's way too much food and it's amazing. The dishes come around to everyone's table and you just pull what you want off. It's a much better experience than any Vegas buffet, and better value than most Strip restaurants. Reserve ahead for weekend brunch.

*This is the meal I recommend to everyone going to Vegas.*

### Gordon Ramsay Fish & Chips

**Gordon Ramsay Fish & Chips** on the LINQ Promenade is the best quick lunch on the Strip. Counter service, classic British fish and chips, and it's actually really good. Perfect when you need a fast, satisfying meal between activities without sitting down for a two-hour dinner.

### Secret Pizza

**Secret Pizza** at the Cosmopolitan is exactly what it sounds like - a hidden, unmarked pizza counter on the third floor with no signage. Look for the hallway with vinyl records on the wall. Walk to the end. Late night pizza there is always a vibe. This is the Vegas late-night secret that everyone should know but most people miss.

### Bellagio Patisserie

**Bellagio Patisserie** - I love the crepes here. They're delicious. Stop in after seeing the Bellagio Conservatory. Quick, sweet, satisfying.

## The Hack

**ResortPass** is the move if you're staying at a hotel without a great pool. It lets you buy day passes and cabanas at top hotel pools without being a guest. Want the Wynn pool experience without the Wynn room rate? This is how. I actually use it regularly - I need to book one starting soon for a trip I have coming up. Book cabanas early on weekends - they sell out.

## The Takeaway

Vegas rewards you for knowing where to go. The difference between a forgettable Vegas trip and a great one comes down to three decisions: the right hotel, the right meals, and knowing the hidden spots. Stay at the Wynn or Cosmo. Brunch at La Cave. Late-night pizza at Secret Pizza. That's a Vegas trip worth remembering.

*This guide is based on my real experiences. Every recommendation is a place I've personally been to. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
  {
    slug: 'atlanta',
    title: "Founder's Guide: Atlanta",
    subtitle: 'A restaurant city that punches well above its weight.',
    destination: 'Atlanta',
    coverImage: toSiteImageUrlFromPhotoId('photo-1575917649111-0cee4e0e8b22'),
    authorName: 'Ashton Lightfoot',
    authorTitle: 'Co-Founder of Voyance',
    readTime: '6 min read',
    tags: ['Atlanta', 'Food', 'Restaurants', 'Day Trips', 'Georgia'],
    summary: "A local's guide to Atlanta — world-class dining, iconic attractions, and hidden gems from someone who lives here.",
    content: `# Founder's Guide: Atlanta

Atlanta is home. I live here, and I think I take it for granted sometimes. But when friends visit and I have to actually think about what to recommend, I realize this city has so much going for it. The dining scene here is deep. Atlanta doesn't get the credit it deserves nationally, but people who know food know that this city punches well above its weight.

## What to See

**Georgia Aquarium** is the largest aquarium in the Western Hemisphere, and the whale shark gallery is worth the trip alone. Stand at the big window on the lower level and just watch. Go on a weekday morning to avoid the crowds. You come into the city and this is the must-do.

**World of Coca-Cola** is right next to the Aquarium, so pair them. I'm a Coke addict, so this makes sense for me. The tasting room where you try Coke products from around the world is the best part. Try the Beverly from Italy - it's legendarily terrible, and that's the whole point.

**Piedmont Park** is Atlanta's Central Park. Walk the Active Oval loop for the best skyline views. The Saturday Green Market runs March through December and is worth timing around.

## Where to Eat

This is where Atlanta really shines. I have strong opinions here.

**Atlas** inside the St. Regis - if you're feeling really bougie, I love Atlas. The art collection alone is stunning. This is a dress-up, special-occasion spot. If you're celebrating something, this is where you go.

**Bacchanalia** is Atlanta's most celebrated restaurant. James Beard recognized, chef-driven, seasonal prix fixe. It's been the city's best for decades and it still earns it. Book two to three weeks ahead.

**Omakase Table** is the best sushi experience in Atlanta and one of my favorites. It's probably the most expensive spot on this list, but if you're a sushi fan, it will change your life. Book the counter seats and let the chef guide you. Trust the process.

**Chops Lobster Bar** is my go-to steakhouse, but here's the real move: skip the main dining room and go to the Lobster Bar downstairs. Better vibe, and the lobster bisque is a must.

**Taqueria Del Sol** is always a great vibe. Counter service, creative fillings with a Southern twist, lines out the door at lunch. The chicken taco and the brisket taco are the staples. Get the jalapeno coleslaw. Lines move fast. Just good food, good energy.

**Barcelona Wine Bar** in Inman Park is excellent. Perfect for a date night. Spanish tapas, great wine list, warm energy. Sit at the bar if you're a couple and let the sommelier pick your wine.

**Little Sparrow** is a solid neighborhood spot, but the real reason to go is **Bar Blanc** upstairs. Everything at Bar Blanc is upstairs. They do one of the best steak frites in the city - and I think the fries are unlimited. I actually want to go right now just thinking about it. This is the hidden Atlanta move that most visitors and even some locals don't know about.

**Marcel** has a great atmosphere - art deco design, good cocktails, and a see-and-be-seen crowd. A fun spot to go out and enjoy the vibe.

## Day Trip

**Chateau Elan Winery** is about an hour north of the city and makes a great day trip. French-inspired estate with wine tastings, a spa, golf courses, and nice grounds to walk. If you stay overnight, the spa is excellent. Start your trip this way if you're coming in from the north.

## The Takeaway

Atlanta is a restaurant city. That's what makes it great. The fine dining is world-class (Bacchanalia, Atlas, Omakase Table), the casual spots have serious followings (Taqueria Del Sol, Little Sparrow), and there are hidden gems like Bar Blanc that make you feel like you're in on a secret.

If you're visiting, build your trip around the food. See the Aquarium, walk Piedmont Park, but eat your way through the city. That's the real Atlanta.

*This guide is based on my real experiences. I live here. Every recommendation is a place I've personally been to - most of them, many times. That's the Voyance promise - we don't recommend what we haven't tried.*`,
  },
];

export function getFoundersGuides(): FoundersGuide[] {
  return foundersGuides;
}

export function getFoundersGuideBySlug(slug: string): FoundersGuide | undefined {
  return foundersGuides.find(g => g.slug === slug);
}
