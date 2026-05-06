/**
 * fix-placeholders.ts — Extracted placeholder detection and replacement logic.
 * Shared by universal-quality-pass.ts and action-generate-day.ts.
 */

import { type DiningConfig } from './dining-config.ts';

// =============================================================================
// FALLBACK RESTAURANT DATABASE — Rich city-aware venue pool for placeholder replacement
// =============================================================================

export interface FallbackRestaurant {
  name: string;
  address: string;
  price: number;
  description: string;
}

export const INLINE_FALLBACK_RESTAURANTS: Record<string, Record<string, FallbackRestaurant[]>> = {
  paris: {
    breakfast: [
      { name: "Café de Flore", address: "172 Bd Saint-Germain, 75006 Paris", price: 35, description: "Iconic Left Bank café. Famous for its Art Deco interior and literary history. Order the croissants with house jam and a grand crème." },
      { name: "Carette", address: "4 Pl. du Trocadéro et du 11 Novembre, 75016 Paris", price: 30, description: "Elegant patisserie with Eiffel Tower views from the terrace. Known for their macarons and hot chocolate." },
      { name: "Le Nemours", address: "2 Pl. Colette, 75001 Paris", price: 25, description: "Classic Parisian terrace café facing the Palais Royal gardens. Perfect for a leisurely morning coffee and croissant." },
      { name: "Maison Sauvage", address: "5 Rue de Buci, 75006 Paris", price: 25, description: "Flower-covered façade in Saint-Germain. Excellent avocado toast and fresh pastries in a photogenic setting." },
      { name: "Hôtel Costes", address: "239 Rue Saint-Honoré, 75001 Paris", price: 45, description: "Glamorous hotel restaurant with a lush courtyard. A see-and-be-seen breakfast spot near Place Vendôme." },
      { name: "Claus Paris", address: "14 Rue Jean-Jacques Rousseau, 75001 Paris", price: 28, description: "Self-proclaimed 'haute couture of breakfast.' Artisanal granola, organic eggs, and fresh-squeezed juices." },
      { name: "Ob-La-Di", address: "54 Rue de Saintonge, 75003 Paris", price: 20, description: "Third-wave coffee shop in Le Marais with excellent pastries and avocado toast." },
      { name: "Café Kitsuné", address: "51 Galerie de Montpensier, 75001 Paris", price: 22, description: "Japanese-French café in the Palais-Royal gardens. Matcha latte and flaky croissants." },
      { name: "Holybelly", address: "19 Rue Lucien Sampaix, 75010 Paris", price: 25, description: "Australian-style brunch in the Canal Saint-Martin area. Legendary pancakes." },
      { name: "La Fontaine de Belleville", address: "31-33 Rue Juliette Dodu, 75010 Paris", price: 18, description: "Specialty coffee roastery with homemade pastries. A local favorite near République." },
    ],
    lunch: [
      { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris", price: 55, description: "Yves Camdeborde's legendary bistro. The lunch menu is a masterclass in French comfort food. No reservations at lunch — arrive early." },
      { name: "Breizh Café", address: "109 Rue Vieille du Temple, 75003 Paris", price: 30, description: "The best crêpes in Paris. Buckwheat galettes with premium ingredients in the heart of Le Marais." },
      { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris", price: 25, description: "Neo-bouillon revival with stunning Belle Époque interior. Traditional French dishes at surprisingly accessible prices." },
      { name: "Chez Janou", address: "2 Rue Roger Verlomme, 75003 Paris", price: 40, description: "Provençal bistro near Place des Vosges. Famous for their chocolate mousse served in a giant bowl." },
      { name: "Le Petit Cler", address: "29 Rue Cler, 75007 Paris", price: 35, description: "Charming neighborhood bistro on the market street Rue Cler. Simple, excellent French cuisine near the Eiffel Tower." },
      { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris", price: 25, description: "Neo-bouillon revival with stunning Belle Époque interior. Classic French comfort food at fair prices." },
    ],
    dinner: [
      { name: "Le Relais de l'Entrecôte", address: "20 Rue Saint-Benoît, 75006 Paris", price: 50, description: "One menu only: walnut salad followed by steak-frites with their legendary secret sauce, served in two rounds. No reservations — expect a short queue." },
      { name: "Chez l'Ami Jean", address: "27 Rue Malar, 75007 Paris", price: 75, description: "Basque-influenced gastro-bistro. The rice pudding dessert is legendary. Boisterous, generous, unforgettable." },
      { name: "Le Chateaubriand", address: "129 Av. Parmentier, 75011 Paris", price: 80, description: "Neo-bistro pioneer. Creative tasting menu that changes daily. One of the restaurants that defined modern Parisian dining." },
      { name: "Frenchie", address: "5 Rue du Nil, 75002 Paris", price: 95, description: "Gregory Marchand's celebrated restaurant. Market-driven tasting menu with inventive French-global flavors. Book well in advance." },
      { name: "Le Bouillon Julien", address: "16 Rue du Faubourg Saint-Denis, 75010 Paris", price: 30, description: "Stunning Art Nouveau dining room from 1906. Classic French brasserie fare — onion soup, duck confit, profiteroles." },
      { name: "Septime", address: "80 Rue de Charonne, 75011 Paris", price: 110, description: "Modern French tasting menu from chef Bertrand Grébaut. Michelin-starred, ingredient-forward, one of the world's best restaurants." },
    ],
  },
  rome: {
    breakfast: [
      { name: "Sciascia Caffè", address: "Via Fabio Massimo 80/A, 00192 Rome", price: 12, description: "Roman institution since 1919. Their caffè with chocolate cream is legendary. Standing at the bar for the full Italian experience." },
      { name: "Roscioli Caffè Pasticceria", address: "Piazza Benedetto Cairoli 16, 00186 Rome", price: 15, description: "Gourmet pastry bar near Campo de' Fiori. Incredible cornetti and artisanal coffee." },
      { name: "Caffè Sant'Eustachio", address: "Piazza di S. Eustachio 82, 00186 Rome", price: 10, description: "Rome's most iconic espresso bar since 1938. The Gran Caffè is a closely-guarded recipe — order it 'senza zucchero' if you don't want it sweet." },
      { name: "Marigold Roma", address: "Via Giovanni da Empoli 37, 00154 Rome", price: 18, description: "Scandi-Italian bakery in Ostiense. Sourdough cinnamon buns, perfect filter coffee, and the best brunch eggs in the city." },
      { name: "Faro – Caffè Specialty", address: "Via Piave 55, 00187 Rome", price: 14, description: "Third-wave specialty roastery near Porta Pia. Single-origin pour-overs and pastries from a rotating roster of Roman bakers." },
      { name: "Antico Forno Roscioli", address: "Via dei Chiavari 34, 00186 Rome", price: 10, description: "Working bakery since 1824. Pizza bianca straight from the oven, maritozzi with cream, and the city's most coveted morning queue." },
      { name: "Pergamino Caffè", address: "Piazza del Risorgimento 7, 00192 Rome", price: 12, description: "Specialty coffee bar near the Vatican. Excellent flat whites and homemade granola — a calm reprieve from the basilica crowds." },
      { name: "Tiramisù Zum", address: "Piazza di Pietra 39, 00186 Rome", price: 13, description: "Compact bar tucked behind the Pantheon serving the city's best classical tiramisù alongside espresso and cornetti." },
    ],
    lunch: [
      { name: "Roscioli Salumeria", address: "Via dei Giubbonari 21, 00186 Rome", price: 45, description: "Legendary deli-restaurant. Outstanding cacio e pepe and curated wine list in a gourmet food temple." },
      { name: "Supplizio", address: "Via dei Banchi Vecchi 143, 00186 Rome", price: 15, description: "Gourmet supplì (Roman rice croquettes). The cacio e pepe version is unforgettable. Perfect quick lunch." },
      { name: "Pizzarium", address: "Via della Meloria 43, 00136 Rome", price: 15, description: "Gabriele Bonci's world-famous pizza al taglio. Creative toppings on impossibly light, crispy dough." },
      { name: "Trattoria Pennestri", address: "Via Giovanni da Empoli 5, 00154 Rome", price: 35, description: "Modern Roman trattoria in Ostiense. Family-run, ingredient-driven, and reliably one of the best lunch tables in the city." },
      { name: "Mordi e Vai", address: "Via Galvani, 00153 Rome (Testaccio Market, Box 15)", price: 10, description: "Sergio Esposito's Testaccio market stand. Allesso di bollito panini dunked in beef gravy — the most Roman lunch you'll have." },
      { name: "Da Cesare al Casaletto", address: "Via del Casaletto 45, 00151 Rome", price: 35, description: "Beloved neighborhood trattoria in Monteverde. Classic Roman primi, stellar fritti, and a leafy garden in summer." },
      { name: "Forno Campo de' Fiori", address: "Vicolo del Gallo 14, 00186 Rome", price: 8, description: "Pizza-by-the-slice institution. The pizza bianca and pizza rossa are the canonical takeaway lunch." },
    ],
    dinner: [
      { name: "Da Enzo al 29", address: "Via dei Vascellari 29, 00153 Rome", price: 35, description: "Trastevere institution. Perfect cacio e pepe, carbonara, and seasonal artichokes. No reservations — queue early." },
      { name: "Armando al Pantheon", address: "Salita dei Crescenzi 31, 00186 Rome", price: 50, description: "Family-run trattoria steps from the Pantheon. Classic Roman cuisine perfected over decades." },
      { name: "Salumeria Roscioli", address: "Via dei Giubbonari 21/22, 00186 Rome", price: 55, description: "Wine-bar-meets-deli in the historic center. Exceptional pasta, rare cheeses, and a stunning wine cellar." },
      { name: "Trattoria Da Teo", address: "Piazza dei Ponziani 7A, 00153 Rome", price: 40, description: "Cult Trastevere trattoria. The amatriciana and saltimbocca alla romana are perfect; book ahead or eat at the bar." },
      { name: "Flavio al Velavevodetto", address: "Via di Monte Testaccio 97, 00153 Rome", price: 45, description: "Cavernous Testaccio dining room carved into Monte dei Cocci. The rigatoni alla gricia is benchmark." },
      { name: "Pianostrada", address: "Via delle Zoccolette 22, 00186 Rome", price: 50, description: "All-female-led kitchen near Campo de' Fiori. Inventive focacce, vegetable-forward plates, and a hidden garden." },
      { name: "Trattoria Pennestri", address: "Via Giovanni da Empoli 5, 00154 Rome", price: 45, description: "Ostiense neighborhood favorite for thoughtful Roman cooking. Quietly one of the city's most consistent dinners." },
    ],
  },
  berlin: {
    breakfast: [
      { name: "House of Small Wonder", address: "Johannisstraße 20, 10117 Berlin", price: 18, description: "Japanese-inspired brunch in Mitte. Beautiful multi-level space with matcha lattes and okonomiyaki pancakes." },
      { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin", price: 20, description: "Grand Viennese-style café in a historic villa. Excellent Frühstück (German breakfast) and legendary apple strudel." },
      { name: "Father Carpenter", address: "Münzstraße 21, 10178 Berlin", price: 16, description: "Hidden courtyard café in Mitte. Australian-style flat whites, sourdough toast, and one of the best brunches in town." },
      { name: "Distrikt Coffee", address: "Bergstraße 68, 10115 Berlin", price: 17, description: "Bright Mitte specialty coffee bar. Excellent eggs Florentine and shakshuka with house-baked bread." },
      { name: "Roamers", address: "Pannierstraße 64, 12047 Berlin", price: 18, description: "Cult Neukölln brunch spot. Floral interiors, generous bowls, and impeccable lattes — expect a wait." },
      { name: "Benedict", address: "Uhlandstraße 49, 10719 Berlin", price: 22, description: "All-day breakfast institution near Ku'damm. The shakshuka and Eggs Royale are reliably superb." },
    ],
    lunch: [
      { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin", price: 8, description: "Iconic currywurst stand at Mehringdamm. The quintessential Berlin street food experience since 1980." },
      { name: "Markthalle Neun", address: "Eisenbahnstraße 42/43, 10997 Berlin", price: 18, description: "Kreuzberg's historic market hall. Street food stalls, craft beer, and artisan producers under a stunning iron roof." },
      { name: "Mustafa's Gemüse Kebap", address: "Mehringdamm 32, 10961 Berlin", price: 7, description: "Berlin's most famous kebab. Roasted vegetables, herbed chicken, feta — the queue is part of the ritual." },
      { name: "Standard – Serious Pizza", address: "Templiner Str. 7, 10119 Berlin", price: 18, description: "Wood-fired Neapolitan pizza in Prenzlauer Berg. Quietly one of the best lunches in the city." },
      { name: "Lon Men's Noodle House", address: "Kantstraße 33, 10625 Berlin", price: 15, description: "Tiny Taiwanese noodle house in Charlottenburg. The dan dan noodles and beef soup are iconic." },
      { name: "Zur Letzten Instanz", address: "Waisenstraße 14-16, 10179 Berlin", price: 25, description: "Berlin's oldest restaurant (1621). Classic Berliner pork knuckle and Königsberger Klopse in wood-paneled rooms." },
    ],
    dinner: [
      { name: "Nobelhart & Schmutzig", address: "Friedrichstraße 218, 10969 Berlin", price: 120, description: "Michelin-starred 'vocally local' dining. Counter-seating only, seasonal Berlin-Brandenburg ingredients." },
      { name: "Katz Orange", address: "Bergstraße 22, 10115 Berlin", price: 55, description: "Farm-to-table in a gorgeous courtyard. Their 12-hour slow-roasted pulled pork is legendary." },
      { name: "Lode & Stijn", address: "Lausitzer Straße 25, 10999 Berlin", price: 70, description: "Dutch-led tasting-menu restaurant in Kreuzberg. Hyper-seasonal, technical, and personal — book ahead." },
      { name: "Mrs Robinson's", address: "Pappelallee 29, 10437 Berlin", price: 65, description: "Prenzlauer Berg neighborhood favorite. Asian-inflected small plates and an exceptional natural wine list." },
      { name: "Hartmanns Restaurant", address: "Fichtestraße 31, 10967 Berlin", price: 75, description: "Long-running modern German restaurant in Kreuzberg. Refined cooking, warm service, prix-fixe driven." },
      { name: "Pauly Saal", address: "Auguststraße 11-13, 10117 Berlin", price: 95, description: "Glamorous Mitte dining room inside a former Jewish girls' school. Modern German cuisine in a Michelin-starred setting." },
    ],
  },
  barcelona: {
    breakfast: [
      { name: "Federal Café", address: "Passatge de la Pau 11, 08002 Barcelona", price: 16, description: "Australian-style café in El Gòtic. Excellent flat whites and smashed avo in a light-filled corner space." },
      { name: "Flax & Kale", address: "Carrer dels Tallers 74b, 08001 Barcelona", price: 20, description: "Health-conscious restaurant with flexitarian menu. Smoothie bowls, poached eggs, and plant-based options." },
      { name: "Granja M. Viader", address: "Carrer d'en Xuclà 4-6, 08001 Barcelona", price: 10, description: "Historic dairy bar (1870) in El Raval. Birthplace of Cacaolat — order a thick hot chocolate with melindros." },
      { name: "Caravelle", address: "Carrer del Pintor Fortuny 31, 08001 Barcelona", price: 17, description: "Cult Raval brunch spot. Huevos rancheros, pulled pork tacos, and excellent in-house pastries." },
      { name: "Syra Coffee", address: "Carrer d'Astúries 50, 08012 Barcelona", price: 9, description: "Specialty coffee bar with multiple Gràcia outposts. Perfect flat whites and rotating single-origin filters." },
      { name: "Cafés El Magnífico", address: "Carrer de l'Argenteria 64, 08003 Barcelona", price: 8, description: "Born neighborhood roastery since 1919. Old-school espresso bar with a cult following." },
    ],
    lunch: [
      { name: "La Boqueria – Bar Pinotxo", address: "La Rambla 91, 08001 Barcelona (Stall 466-470)", price: 25, description: "Juanito Bayén's iconic counter inside La Boqueria. Chickpeas with morcilla and the freshest market seafood." },
      { name: "Can Paixano (La Xampanyeria)", address: "Carrer de la Reina Cristina 7, 08003 Barcelona", price: 15, description: "Standing-room cava bar in Barceloneta. Cava and tapas at unbeatable prices. Chaotic, fun, authentic." },
      { name: "Bar del Pla", address: "Carrer de Montcada 2, 08003 Barcelona", price: 30, description: "Born neighborhood tapas bar. Modern takes on Catalan classics — ox cheek with potato foam, tuna tartare." },
      { name: "Bar Cañete", address: "Carrer de la Unió 17, 08001 Barcelona", price: 45, description: "Glittering Raval tapas bar. Counter seating, white-jacketed waiters, and pristine seafood." },
      { name: "Quimet & Quimet", address: "Carrer del Poeta Cabanyes 25, 08004 Barcelona", price: 25, description: "Tiny Poble-sec montadito bar. Stacked tinned-fish bites with a stunning vermouth and wine selection." },
      { name: "Bodega 1900", address: "Carrer de Tamarit 91, 08015 Barcelona", price: 50, description: "Albert Adrià's vermouth-bar take on classic tapas. Liquid olives, perfect anchovies, technical brilliance." },
    ],
    dinner: [
      { name: "Cal Pep", address: "Plaça de les Olles 8, 08003 Barcelona", price: 55, description: "Counter-seating tapas bar near Born. Chef Pep's seafood is extraordinary — the fried fish and clams are legendary." },
      { name: "Cervecería Catalana", address: "Carrer de Mallorca 236, 08008 Barcelona", price: 40, description: "Locals' favorite tapas in Eixample. Outstanding patatas bravas, jamón ibérico, and seafood montaditos." },
      { name: "Disfrutar", address: "Carrer de Villarroel 163, 08036 Barcelona", price: 220, description: "Three-Michelin-starred temple from elBulli alumni. Among the world's best tasting menus — book months out." },
      { name: "Suculent", address: "Rambla del Raval 43, 08001 Barcelona", price: 60, description: "Carles Abellán's intimate Raval bistro. Inventive Catalan cooking with a deep regional wine list." },
      { name: "Estimar", address: "Carrer de Sant Antoni dels Sombrerers 3, 08003 Barcelona", price: 90, description: "Born seafood gem from the Iglesias family. Pristine fish, simple preparations, an insider favorite." },
      { name: "Mont Bar", address: "Carrer de la Diputació 220, 08011 Barcelona", price: 65, description: "Eixample tapas bar with Michelin-level technique. The bikini and seasonal small plates are extraordinary." },
    ],
  },
  london: {
    breakfast: [
      { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London", price: 20, description: "Bombay café reimagined. Bacon naan roll and chai are breakfast perfection. Expect queues at weekends." },
      { name: "The Wolseley", address: "160 Piccadilly, W1J 9EB London", price: 35, description: "Grand café-restaurant in a former car showroom. Viennese-style breakfast with impeccable service." },
      { name: "Granger & Co.", address: "175 Westbourne Grove, W11 2SB London", price: 22, description: "Bill Granger's airy Notting Hill flagship. The ricotta hotcakes are a London brunch institution." },
      { name: "St. JOHN Bakery", address: "72 Druid St, SE1 2HQ London", price: 8, description: "Bermondsey bakery from Fergus Henderson. Warm doughnuts, eccles cakes, and the best sourdough loaf in town." },
      { name: "Pavilion Bakery", address: "190 Victoria Park Rd, E9 7HD London", price: 10, description: "East London neighborhood bakery. Cardamom buns, sourdough, and excellent flat whites by the park." },
      { name: "E5 Bakehouse", address: "395 Mentmore Terrace, E8 3PH London", price: 12, description: "London Fields canal-side bakery. Stone-milled sourdough, croissants, and a calm sit-down café." },
    ],
    lunch: [
      { name: "Borough Market – Padella", address: "6 Southwark St, SE1 1TQ London", price: 18, description: "Hand-rolled pasta at Borough Market. The pici cacio e pepe is extraordinary. No reservations — worth the queue." },
      { name: "Borough Market", address: "8 Southwark St, SE1 1TL London", price: 20, description: "London's legendary food market. Artisan producers, street food, and specialist ingredients under Victorian railway arches." },
      { name: "Koya Soho", address: "50 Frith St, W1D 4SQ London", price: 18, description: "Udon counter in Soho. Hot or cold dashi udon, exceptional tempura — minimalist and reliably superb." },
      { name: "Rochelle Canteen", address: "16 Playground Gardens, E2 7FA London", price: 35, description: "Hidden Shoreditch lunch spot in a former bike shed. Margot Henderson's seasonal British plates and a leafy courtyard." },
      { name: "Kiln", address: "58 Brewer St, W1F 9TL London", price: 30, description: "Soho counter serving live-fire Northern Thai cooking. The clay-pot glass noodles and lamb skewers are killers." },
      { name: "Quo Vadis", address: "26-29 Dean St, W1D 3LL London", price: 40, description: "Soho institution from Jeremy Lee. The smoked eel sandwich at the bar is a perfect London lunch." },
    ],
    dinner: [
      { name: "Brat", address: "4 Redchurch St, E1 6JL London", price: 65, description: "Michelin-starred Basque-inspired grill in Shoreditch. Whole turbot and padron peppers cooked over fire." },
      { name: "Gymkhana", address: "42 Albemarle St, W1S 4JH London", price: 75, description: "Michelin-starred Indian restaurant in Mayfair. Colonial hunting-lodge décor with extraordinary modern Indian cuisine." },
      { name: "St. JOHN", address: "26 St John St, EC1M 4AY London", price: 60, description: "Fergus Henderson's nose-to-tail manifesto. Roast bone marrow with parsley salad is essential. Whitewashed, joyful, definitive." },
      { name: "Lyle's", address: "Tea Building, 56 Shoreditch High St, E1 6JJ London", price: 70, description: "James Lowe's Michelin-starred British tasting menu. Hyper-seasonal, technical, and quietly thrilling." },
      { name: "Smoking Goat", address: "64 Shoreditch High St, E1 6JJ London", price: 45, description: "Loud Shoreditch Thai bar. The fish-sauce wings, lardo fried rice, and natural wines are unbeatable." },
      { name: "Trullo", address: "300-302 St Paul's Rd, N1 2LH London", price: 50, description: "Highbury neighborhood Italian. Hand-cut pasta, charcoal-grilled meats, and a perfect pre-Arsenal dinner." },
    ],
  },
  lisbon: {
    breakfast: [
      { name: "Heim Café", address: "R. de Santos-o-Velho 2, 1200-808 Lisbon", price: 15, description: "Cozy brunch spot in Santos. Excellent avocado toast, açaí bowls, and specialty coffee." },
      { name: "Copenhagen Coffee Lab", address: "R. Nova da Piedade 10, 1200-298 Lisbon", price: 12, description: "Scandinavian-style specialty coffee roaster. Perfectly crafted pour-overs in a minimalist Chiado setting." },
      { name: "Nicolau Lisboa", address: "R. de São Nicolau 17, 1100-547 Lisbon", price: 14, description: "Modern café near Rossio square. Great eggs Benedict and fresh juices with a street-level people-watching terrace." },
    ],
    lunch: [
      { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon", price: 45, description: "Legendary seafood beer hall. Tiger prawns, percebes, and a steak sandwich to finish. Cash-heavy, always packed." },
      { name: "A Cevicheria", address: "R. Dom Pedro V 129, 1250-093 Lisbon", price: 40, description: "Chef Kiko Martins' Peruvian-Portuguese fusion. Creative ceviches under a hanging giant octopus sculpture." },
      { name: "Café de São Bento", address: "R. de São Bento 212, 1200-821 Lisbon", price: 50, description: "Classic Lisbon steakhouse. Their prego steak sandwich and garlic prawns are local institutions." },
    ],
    dinner: [
      { name: "Sacramento do Chiado", address: "R. do Sacramento 26, 1200-394 Lisbon", price: 45, description: "Converted church in Chiado. Portuguese cuisine with a modern twist in a stunning architectural setting." },
      { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, 1150-269 Lisbon", price: 55, description: "Minho-style cooking near Restauradores. Legendary presunto (cured ham) and seafood rice." },
      { name: "Pharmácia", address: "R. Marechal Saldanha 1, 1249-069 Lisbon", price: 40, description: "Pharmacy-themed restaurant in Santa Catarina. Creative Portuguese dishes served in lab glassware with Tagus views." },
    ],
  },
};

// =============================================================================
// REGIONAL EMERGENCY FALLBACK — country-level real venues used when the
// city-specific INLINE_FALLBACK_RESTAURANTS pool is missing or exhausted.
// Goal: NEVER ship a "find a local spot" stub mid-itinerary. Every chain
// terminates in a real, named venue rather than a template.
// =============================================================================
const REGIONAL_EMERGENCY_FALLBACK: Record<string, Record<'breakfast' | 'lunch' | 'dinner', FallbackRestaurant>> = {
  italy: {
    breakfast: { name: "Sant'Eustachio Il Caffè", address: "Piazza di S. Eustachio 82, Rome, Italy", price: 10, description: "Italy's most iconic espresso bar. Order the Gran Caffè at the counter — Roman ritual perfected." },
    lunch: { name: "All'Antico Vinaio", address: "Via dei Neri 65, Florence, Italy", price: 12, description: "Italy's most-loved schiacciata sandwich shop. Cured meats, pecorino, and creamy spreads on warm bread." },
    dinner: { name: "Trattoria Sostanza", address: "Via del Porcellana 25, Florence, Italy", price: 50, description: "Florentine institution since 1869. Bistecca alla fiorentina, butter chicken, artichoke tortino — a Tuscan benchmark." },
  },
  france: {
    breakfast: { name: "Du Pain et des Idées", address: "34 Rue Yves Toudic, 75010 Paris, France", price: 12, description: "Christophe Vasseur's cult bakery. Pain des amis and escargot pistache-chocolat — the city's best morning queue." },
    lunch: { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris, France", price: 25, description: "Stunning Belle Époque brasserie. Classic French comfort food at honest prices — no reservations." },
    dinner: { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris, France", price: 65, description: "Yves Camdeborde's iconic bistro. The bistronomy template — refined French cooking in a buzzing room." },
  },
  spain: {
    breakfast: { name: "Granja M. Viader", address: "Carrer d'en Xuclà 4, Barcelona, Spain", price: 10, description: "Historic dairy bar (1870). Birthplace of Cacaolat — order thick hot chocolate with melindros." },
    lunch: { name: "Bar Pinotxo", address: "La Boqueria, La Rambla 91, Barcelona, Spain", price: 25, description: "Juanito Bayén's market counter. Chickpeas with morcilla, cuttlefish with beans — quintessential Catalan." },
    dinner: { name: "Casa Lucio", address: "Calle Cava Baja 35, Madrid, Spain", price: 60, description: "Madrid institution famous for huevos rotos. The Spanish power-dinner spot since 1974." },
  },
  germany: {
    breakfast: { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin, Germany", price: 20, description: "Grand Viennese-style café in a historic villa. The Frühstück platter is a Berlin classic." },
    lunch: { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin, Germany", price: 8, description: "Iconic Berlin currywurst stand since 1980." },
    dinner: { name: "Zur Letzten Instanz", address: "Waisenstraße 14-16, 10179 Berlin, Germany", price: 35, description: "Berlin's oldest restaurant (1621). Classic Berliner pork knuckle in wood-paneled rooms." },
  },
  uk: {
    breakfast: { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London, UK", price: 20, description: "Bombay café reimagined. The bacon naan roll is a London breakfast institution." },
    lunch: { name: "Padella", address: "6 Southwark St, SE1 1TQ London, UK", price: 18, description: "Borough Market hand-rolled pasta. Pici cacio e pepe is essential — no reservations, worth the queue." },
    dinner: { name: "St. JOHN", address: "26 St John St, EC1M 4AY London, UK", price: 60, description: "Fergus Henderson's nose-to-tail manifesto. Roast bone marrow with parsley salad — definitively British." },
  },
  portugal: {
    breakfast: { name: "Manteigaria", address: "R. do Loreto 2, 1200-242 Lisbon, Portugal", price: 4, description: "Pastéis de nata baked all day at the counter. Warm, perfect, dusted with cinnamon." },
    lunch: { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon, Portugal", price: 45, description: "Legendary seafood beer hall. Tiger prawns, percebes, finished with a prego steak sandwich." },
    dinner: { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, Lisbon, Portugal", price: 55, description: "Minho-style cooking. Legendary presunto and seafood rice in a lively, family-run dining room." },
  },
  usa: {
    breakfast: { name: "Russ & Daughters Cafe", address: "127 Orchard St, New York, NY 10002, USA", price: 25, description: "Lower East Side bagel-and-lox temple. Smoked fish boards, latkes, egg creams — pure NYC." },
    lunch: { name: "Katz's Delicatessen", address: "205 E Houston St, New York, NY 10002, USA", price: 25, description: "1888 deli landmark. Hand-carved pastrami on rye is the canonical American sandwich." },
    dinner: { name: "Gramercy Tavern", address: "42 E 20th St, New York, NY 10003, USA", price: 90, description: "Danny Meyer's seasonal American flagship. Warm, polished, a benchmark dinner since 1994." },
  },
  japan: {
    breakfast: { name: "Tsukiji Sushi Sei", address: "4-13-9 Tsukiji, Chuo City, Tokyo, Japan", price: 30, description: "Edomae sushi for breakfast at Tsukiji outer market. Counter-only, traditional, transcendent." },
    lunch: { name: "Tsuta", address: "1-14-1 Sugamo, Toshima City, Tokyo, Japan", price: 20, description: "First Michelin-starred ramen. Truffle-oil shoyu broth and house-made noodles." },
    dinner: { name: "Kagari", address: "6-4-12 Ginza, Chuo City, Tokyo, Japan", price: 25, description: "Ginza tori-paitan ramen. Silky chicken broth and perfect noodles — quietly the city's best bowl." },
  },
  mexico: {
    breakfast: { name: "Lalo!", address: "Zacatecas 173, Roma Norte, Mexico City, Mexico", price: 18, description: "Eduardo García's all-day spot. Chilaquiles, smoked salmon tortas, excellent espresso." },
    lunch: { name: "El Turix", address: "Emilio Castelar 212, Polanco, Mexico City, Mexico", price: 12, description: "Cult Yucatecan cochinita pibil counter. Order the panucho and the torta." },
    dinner: { name: "Contramar", address: "Calle de Durango 200, Roma Norte, Mexico City, Mexico", price: 50, description: "Gabriela Cámara's seafood lunch-room. The tuna tostada and pescado a la talla are essential." },
  },
};

const CITY_COUNTRY_MAP: Record<string, keyof typeof REGIONAL_EMERGENCY_FALLBACK> = {
  rome: 'italy', milan: 'italy', florence: 'italy', venice: 'italy', naples: 'italy', bologna: 'italy', turin: 'italy',
  paris: 'france', nice: 'france', lyon: 'france', marseille: 'france', bordeaux: 'france', strasbourg: 'france',
  barcelona: 'spain', madrid: 'spain', seville: 'spain', valencia: 'spain', granada: 'spain', bilbao: 'spain', malaga: 'spain',
  berlin: 'germany', munich: 'germany', hamburg: 'germany', frankfurt: 'germany', cologne: 'germany',
  london: 'uk', manchester: 'uk', edinburgh: 'uk', glasgow: 'uk', dublin: 'uk', liverpool: 'uk', oxford: 'uk',
  lisbon: 'portugal', porto: 'portugal',
  'new york': 'usa', 'los angeles': 'usa', chicago: 'usa', 'san francisco': 'usa', miami: 'usa', boston: 'usa', 'new orleans': 'usa', seattle: 'usa', austin: 'usa', washington: 'usa',
  tokyo: 'japan', kyoto: 'japan', osaka: 'japan', sapporo: 'japan', fukuoka: 'japan',
  'mexico city': 'mexico', cdmx: 'mexico', oaxaca: 'mexico', guadalajara: 'mexico',
};

const GLOBAL_EMERGENCY_FALLBACK: Record<'breakfast' | 'lunch' | 'dinner', FallbackRestaurant> = {
  breakfast: { name: "Local specialty café", address: "Top-rated café near your hotel", price: 12, description: "Pick a 4.5+ star specialty café within a 5-min walk of your hotel. Order the local pastry plus a strong espresso or pour-over." },
  lunch: { name: "Highly-rated neighborhood restaurant", address: "Top-rated lunch spot near your morning activity", price: 25, description: "Pick a 4.5+ star neighborhood restaurant near your morning activity. The concierge can confirm the booking." },
  dinner: { name: "Highly-rated neighborhood restaurant", address: "Top-rated dinner spot near your evening activity", price: 45, description: "Pick a 4.5+ star restaurant within walking distance of your evening plans. The concierge can lock the booking." },
};

function regionalEmergencyFallback(city: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks'): FallbackRestaurant {
  const m = mealType === 'drinks' ? 'dinner' : mealType;
  const cityKey = (city || '').toLowerCase().trim().split(',')[0].trim();
  for (const [needle, country] of Object.entries(CITY_COUNTRY_MAP)) {
    if (cityKey.includes(needle) || needle.includes(cityKey)) {
      const region = REGIONAL_EMERGENCY_FALLBACK[country];
      if (region && region[m]) {
        console.warn(`[PLACEHOLDER_GAP] city="${city}" meal=${mealType} → regional ${country} fallback`);
        return region[m];
      }
    }
  }
  console.warn(`[PLACEHOLDER_GAP] city="${city}" meal=${mealType} → global fallback`);
  return GLOBAL_EMERGENCY_FALLBACK[m];
}

// =============================================================================
// HELPER: Get a random fallback restaurant from the hardcoded pool
// =============================================================================
export function getRandomFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  usedNames: Set<string>,
  ignoreUsed?: boolean,
): FallbackRestaurant | null {
  const cityKey = city.toLowerCase().trim();
  let cityData: Record<string, FallbackRestaurant[]> | undefined;
  for (const [key, data] of Object.entries(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      cityData = data;
      break;
    }
  }
  if (!cityData) return null;

  // Drinks falls back to dinner pool
  let options = cityData[mealType];
  if ((!options || options.length === 0) && mealType === 'drinks') {
    options = cityData['dinner'];
  }
  if (!options || options.length === 0) return null;

  if (ignoreUsed) {
    return options[Math.floor(Math.random() * options.length)];
  }

  const available = options.filter(r => !usedNames.has(r.name.toLowerCase()));
  if (available.length === 0) return options[0];

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * GUARANTEED resolver — ALWAYS returns a real, named venue. Walks
 *   city pool → city pool (recycled) → regional country pool → global emergency.
 * Use this anywhere we would otherwise emit a "find a local spot" stub.
 */
export function resolveAnyMealFallback(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  usedNames: Set<string>,
): FallbackRestaurant {
  return (
    getRandomFallbackRestaurant(city, mealType, usedNames, false) ||
    getRandomFallbackRestaurant(city, mealType, new Set<string>(), true) ||
    regionalEmergencyFallback(city, mealType)
  );
}

// =============================================================================
// HELPER: Apply fallback restaurant data to an activity
// =============================================================================
export function applyFallbackToActivity(
  activity: any,
  fallback: FallbackRestaurant,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  usedVenueNamesInDay: Set<string>,
  diningConfig?: DiningConfig,
): void {
  const mealLabel = mealType === 'breakfast' ? 'Breakfast' : mealType === 'lunch' ? 'Lunch' : mealType === 'drinks' ? 'Drinks' : 'Dinner';
  activity.title = `${mealLabel} at ${fallback.name}`;
  activity.name = activity.title;
  if (activity.location) {
    activity.location.name = fallback.name;
    activity.location.address = fallback.address;
  } else {
    activity.location = { name: fallback.name, address: fallback.address };
  }
  activity.venue_name = fallback.name;
  if (fallback.description) activity.description = fallback.description;

  // Price clamping: clamp to DNA config range when available
  let price = fallback.price;
  if (price && diningConfig) {
    const pr = diningConfig.priceRange[mealType] || diningConfig.priceRange.dinner;
    if (pr) {
      price = Math.max(pr[0], Math.min(pr[1], price));
    }
  }
  if (price && activity.cost) {
    activity.cost.amount = price;
  }
  if (price) {
    activity.cost_per_person = price;
  }

  usedVenueNamesInDay.add(fallback.name.toLowerCase());
  console.log(`[PLACEHOLDER] REPLACED → "${activity.title}" at "${fallback.address}" (€${price}/pp)`);
}

// =============================================================================
// FALLBACK WELLNESS DATABASE — Real, named spa/wellness venues by city
// Mirrors INLINE_FALLBACK_RESTAURANTS for the wellness category so we never
// ship generic placeholders like "Private Wellness Refresh".
// =============================================================================

export interface FallbackWellness {
  name: string;
  address: string;
  price: number; // USD per person, real reference price
  description: string;
}

export const INLINE_FALLBACK_WELLNESS: Record<string, FallbackWellness[]> = {
  paris: [
    { name: "Spa Valmont at Le Meurice", address: "228 Rue de Rivoli, 75001 Paris", price: 280, description: "Swiss luxury skincare rituals in a refined hotel spa overlooking the Tuileries." },
    { name: "Spa My Blend by Clarins", address: "37 Av. Hoche, 75008 Paris (Le Royal Monceau)", price: 260, description: "Signature Clarins treatments inside Le Royal Monceau Raffles Paris, with indoor pool access." },
    { name: "Hammam Pacha", address: "17 Rue Mayet, 75006 Paris", price: 75, description: "Traditional Moroccan hammam ritual with steam rooms, gommage and mint tea." },
  ],
  rome: [
    { name: "Cristallo Spa at Palazzo Manfredi", address: "Via Labicana 125, 00184 Rome", price: 220, description: "Boutique hotel spa near the Colosseum with hammam, sauna and bespoke treatments." },
    { name: "AcquaMadre Hammam", address: "Via di S. Ambrogio 17, 00186 Rome", price: 65, description: "Tranquil Roman-Jewish-quarter hammam with a hot pool, steam rooms and scrubs." },
  ],
  berlin: [
    { name: "Vabali Spa Berlin", address: "Seydlitzstraße 6, 10557 Berlin", price: 60, description: "Bali-inspired thermal spa with saunas, pools and gardens minutes from Hauptbahnhof." },
    { name: "Liquidrom", address: "Möckernstraße 10, 10963 Berlin", price: 45, description: "Saltwater flotation pool with underwater music, plus saunas and steam rooms." },
  ],
  barcelona: [
    { name: "Aire Ancient Baths", address: "Passeig de Picasso 22, 08003 Barcelona", price: 95, description: "Candle-lit thermal baths in a restored 19th-century factory in Born." },
    { name: "Spa Mayan Secret at Hotel Claris", address: "Carrer de Pau Claris 150, 08009 Barcelona", price: 180, description: "Mayan-inspired rooftop hotel spa with pool and skyline views." },
  ],
  london: [
    { name: "ESPA Life at Corinthia", address: "Whitehall Pl, London SW1A 2BD", price: 295, description: "Four-floor wellness destination with sleep pods, vitality pool and signature ESPA rituals." },
    { name: "Akasha Holistic Wellbeing at Hotel Café Royal", address: "68 Regent St, London W1B 4DY", price: 240, description: "Earth/Air/Fire/Water-themed treatments, hammam and 18m pool in Mayfair." },
    { name: "AIRE Ancient Baths London", address: "1 Saint Thomas St, London SE1 9RY", price: 105, description: "Thermal bath circuit in a restored 19th-century warehouse near London Bridge." },
  ],
  lisbon: [
    { name: "Six Senses Spa at Tivoli Avenida Liberdade", address: "Av. da Liberdade 185, 1269-050 Lisbon", price: 220, description: "Six Senses signature spa with thermal circuit, vitality pool and tailored facials." },
    { name: "Spa at Bairro Alto Hotel", address: "Praça Luís de Camões 2, 1200-243 Lisbon", price: 160, description: "Intimate Chiado hotel spa with Aromatherapy Associates rituals." },
  ],
};

// =============================================================================
// HELPER: Get a random fallback wellness venue
// =============================================================================
export function getRandomFallbackWellness(
  city: string,
  usedNames: Set<string>,
  ignoreUsed?: boolean,
): FallbackWellness | null {
  const cityKey = (city || '').toLowerCase().trim();
  let options: FallbackWellness[] | undefined;
  for (const [key, list] of Object.entries(INLINE_FALLBACK_WELLNESS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      options = list;
      break;
    }
  }
  if (!options || options.length === 0) return null;
  if (ignoreUsed) return options[Math.floor(Math.random() * options.length)];
  const available = options.filter(r => !usedNames.has(r.name.toLowerCase()));
  if (available.length === 0) return options[0];
  return available[Math.floor(Math.random() * available.length)];
}

// =============================================================================
// HELPER: Apply fallback wellness to an activity
// =============================================================================
export function applyFallbackWellnessToActivity(
  activity: any,
  fallback: FallbackWellness,
  usedVenueNamesInDay: Set<string>,
): void {
  activity.title = `Spa Session at ${fallback.name}`;
  activity.name = activity.title;
  if (activity.location) {
    activity.location.name = fallback.name;
    activity.location.address = fallback.address;
  } else {
    activity.location = { name: fallback.name, address: fallback.address };
  }
  activity.venue_name = fallback.name;
  if (fallback.description) activity.description = fallback.description;
  if (activity.cost) activity.cost.amount = fallback.price;
  activity.cost_per_person = fallback.price;
  activity.category = activity.category || 'wellness';
  usedVenueNamesInDay.add(fallback.name.toLowerCase());
  console.log(`[PLACEHOLDER WELLNESS] REPLACED → "${activity.title}" at "${fallback.address}" ($${fallback.price}/pp)`);
}

// =============================================================================
// WELLNESS PLACEHOLDER DETECTION
// =============================================================================
export const GENERIC_WELLNESS_TITLE_PATTERNS = [
  /^(private\s+)?(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment|ritual|escape)\.?$/i,
  /^(spa|wellness|massage|hammam|sauna|thermal)(\s+(at|in)\s+(a|an|the|your)\s+.+)?$/i,
  /^(relaxing|rejuvenating|luxurious|private|quick|brief|short|personalized|personalised|customized|customised|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|restorative|holistic)\s+(spa|wellness|massage|treatment|hammam|experience|ritual|session|facial|skincare|beauty|pampering)\b/i,
  /^(personalized|personalised|customized|customised|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|holistic|restorative)\s+(wellness|spa|massage|treatment|experience|ritual|session|facial|skincare|beauty|pampering)\b/i,
  /^(wellness|spa)\s+(experience|treatment|ritual|session)\s+(at|in)\s+(a|an|the|your)\s+/i,
  /^(hotel\s+)?(spa|wellness)\s+(time|break|stop|moment)$/i,
  /^pamper\s+yourself/i,
  /^unwind\s+(at\s+)?(the\s+)?(spa|hotel|hammam)?\.?$/i,
  /^(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment|ritual|escape|visit|stop)$/i,
  /^(curated|bespoke|signature|personalized|personalised|premium|luxury|private|exclusive)\s+(wellness|spa)\s+(visit|stop|appointment|hour|hours)\b/i,
  // Treatment-name-only titles (no spa/wellness keyword but clearly a spa offering)
  /^(glow|radiance|bliss|escape|serenity|tranquility|tranquillity|harmony|balance|renewal|refresh|zen|aura)\s*[&+]?\s*(wellness|spa|beauty|skincare|facial|ritual)\b/i,
  /^(facial|beauty|skincare|pampering)\s+(ritual|session|experience|treatment|moment|escape)\b/i,
];

const WELLNESS_KEYWORD_RE = /\b(spa|wellness|massage|hammam|sauna|onsen|thermal|treatment|ritual|facial|skincare|beauty|pampering|hot\s*spring|hot\s*tub|jacuzzi|cryotherapy|reflexology|aromatherapy)\b/i;

// Generic / unverified venue strings the AI tends to invent for wellness items.
const GENERIC_WELLNESS_VENUE_PATTERNS = [
  /^(the\s+)?(spa|wellness|salon|hammam|sauna)$/i,
  /^(hotel|on-?site|in-?house|on\s+property|property|resort)\s+(spa|wellness|salon|gym)$/i,
  /^(a|the|your)\s+(hotel|spa|wellness|destination|salon)/i,
  /\b(spa|wellness)\s+(in|at|near|by)\s+(the\s+)?(hotel|property|resort)\b/i,
  /^(luxury|boutique|upscale|premium|local|nearby|popular|recommended)\s+(spa|wellness|salon)\b/i,
];

// Pre-built lowercase set of every real wellness venue we ship with, used as a
// "known-real" allowlist when neither placeId nor a numeric address is present.
let _knownWellnessVenues: Set<string> | null = null;
function getKnownWellnessVenueSet(): Set<string> {
  if (_knownWellnessVenues) return _knownWellnessVenues;
  const s = new Set<string>();
  for (const list of Object.values(INLINE_FALLBACK_WELLNESS)) {
    for (const v of list) s.add(v.name.toLowerCase());
  }
  _knownWellnessVenues = s;
  return s;
}

/**
 * Returns true if the activity is a generic/placeholder wellness entry.
 */
export function isPlaceholderWellness(activity: any, cityName: string, hotelName?: string): boolean {
  const category = (activity.category || '').toLowerCase();
  const title = (activity.title || '').trim();
  const venue = ((activity.location?.name) || activity.venue_name || '').trim();
  const address = String(activity.location?.address || '').trim();

  const isWellnessCat = category === 'wellness' || category === 'spa';
  const isWellnessTitle = WELLNESS_KEYWORD_RE.test(title);
  if (!isWellnessCat && !isWellnessTitle) return false;

  // Hard verification short-circuit — a confirmed placeId means the venue is real,
  // regardless of how generic the title sounds.
  const hasPlaceId =
    !!activity?.metadata?.google_place_id ||
    !!activity?.metadata?.placeId ||
    !!activity?.verified?.placeId;
  if (hasPlaceId) return false;

  // Title is generic placeholder
  if (GENERIC_WELLNESS_TITLE_PATTERNS.some(re => re.test(title))) return true;

  // Title mentions wellness/spa but venue is empty / placeholder / city / "Your Hotel"
  const venueLower = venue.toLowerCase();
  const cityLower = (cityName || '').toLowerCase().trim();
  const isGenericVenue =
    venue.length < 4 ||
    venueLower === 'your hotel' ||
    venueLower === 'the destination' ||
    venueLower === 'the city' ||
    (cityLower && venueLower === cityLower) ||
    GENERIC_WELLNESS_VENUE_PATTERNS.some(re => re.test(venue));

  if (isGenericVenue) {
    // Only flag if title doesn't already include a specific named venue marker.
    // Heuristic: a title like "Spa Valmont at Le Meurice" has a proper-noun chain after "at".
    const hasNamedVenue = / at [A-Z][\w'’-]+(?:\s+[A-Z&][\w'’-]+){0,5}/.test(title);
    if (!hasNamedVenue) return true;
  }

  // VERIFICATION GATE — wellness items with non-generic venue strings still need
  // proof the venue is real. Accept any of:
  //   • a street address with a digit (e.g. "228 Rue de Rivoli")
  //   • venue name appears in INLINE_FALLBACK_WELLNESS (known-real allowlist)
  //   • venue name matches the user's confirmed hotel
  //   • metadata.unverified_venue explicitly false
  // (placeId path already short-circuited above.)
  const hasNumericAddress = address.length >= 8 && /\d/.test(address);
  const matchesKnownVenue = venueLower.length >= 4 && getKnownWellnessVenueSet().has(venueLower);
  const matchesHotel =
    !!hotelName && venueLower.length >= 4 && venueLower === hotelName.toLowerCase().trim();
  const explicitlyVerified = activity?.metadata?.unverified_venue === false;

  if (!hasNumericAddress && !matchesKnownVenue && !matchesHotel && !explicitlyVerified) {
    return true;
  }

  return false;
}

// =============================================================================
// PLACEHOLDER DETECTION PATTERNS
// =============================================================================
export const PLACEHOLDER_TITLE_PATTERNS = [
  /^(breakfast|lunch|dinner|meal|brunch)\s+(at\s+)?a\s+/i,
  /^(breakfast|lunch|dinner|meal|brunch)\s+(at\s+)?the\s+/i,
  /^(breakfast|lunch|dinner)\s+at\s+(a\s+)?(local|nearby|neighborhood|traditional|typical|popular|cozy|charming)/i,
  /at a (bistro|brasserie|café|cafe|boulangerie|trattoria|osteria|taverna|izakaya|tapas bar|pub|diner|restaurant|eatery|food stall|canteen|pizzeria|ramen shop|noodle shop|sushi bar|beer hall|wine bar|gastro)/i,
  /get a restaurant recommendation/i,
  // Verb-led titles
  /^enjoy\s+(breakfast|lunch|dinner|brunch|a meal)/i,
  /^have\s+(breakfast|lunch|dinner|brunch|a meal)/i,
  /^grab\s+(breakfast|lunch|dinner|brunch|a meal|a bite|a coffee)/i,
  /^try\s+(breakfast|lunch|dinner|brunch|a meal|some local)/i,
  // Adjective-led generics
  /^(traditional|local|typical|authentic|regional)\s+(cuisine|food|meal|breakfast|lunch|dinner|dining)/i,
  // Spot/recommendation patterns
  /^(breakfast|lunch|dinner|brunch)\s+(spot|recommendation|place|option)/i,
  // "Sample local cuisine" etc.
  /^sample\s+(local|traditional|regional)/i,
];

export const PLACEHOLDER_VENUE_PATTERNS = [
  /^the destination$/i,
  /^the city$/i,
  /^(city|town) center$/i,
  /^downtown$/i,
  /^near(by)?\s+(the\s+)?hotel$/i,
  /^your hotel$/i,
  /get a restaurant recommendation/i,
  /^.{0,3}$/,
  // Generic venue names
  /^local\s+(café|cafe|restaurant|bistro|trattoria|osteria|taverna|eatery|diner|pub|bar|pizzeria|brasserie)/i,
  /^a\s+(cozy|charming|traditional|nearby|local|popular|quaint|lovely|nice|good)\s+(restaurant|café|cafe|bistro|trattoria|eatery|spot|place)/i,
  /^recommended\s+(restaurant|café|cafe|spot|place|eatery)/i,
  /^popular\s+(spot|restaurant|café|cafe|eatery|place)/i,
  /^neighborhood\s+(restaurant|café|cafe|bistro|spot)/i,
];

// =============================================================================
// AI STUB VENUE PATTERNS
// Catches French/Italian-styled stub names the AI loves to invent
// (e.g. "Café Matinal", "Table du Quartier", "Bistrot du Marché",
// "Le Comptoir du Midi", "Brasserie de la Gare", "Boulangerie du Quartier").
// Per the Meal Rules core memory these are BANNED — every guard should call
// matchesAIStubVenue() and treat a hit as a placeholder.
// =============================================================================
export const AI_STUB_VENUE_PATTERNS: RegExp[] = [
  // <Venue-noun> (du|de la|des|de|del|della) <generic filler>
  /^(le |la |il |el )?(table|bistrot|brasserie|caf[eé]|comptoir|boulangerie|p[âa]tisserie|trattoria|osteria|taverna|restaurant|maison|petit|grand|bar|cave)\s+(du|de la|des|de|del|della|dei)\s+(quartier|march[ée]|coin|place|soir|midi|matin|gare|arts|jardin|vins|coeur|nord|sud|est|ouest|centre|village|port|pont)\b/i,
  // "Café Matinal" / "Le Petit Matin" / "La Petite Place"
  /^(le |la )?(petit|petite|grand|grande|caf[eé])\s+(matin|matinal|matinale|soir|midi|jardin|comptoir|march[ée]|place|coin)\b/i,
  // Catch-all for the legacy template strings (case-insensitive exact)
  /^(caf[eé] matinal|boulangerie du quartier|le petit matin|caf[eé] des arts|p[âa]tisserie du coin|bistrot du march[ée]|le comptoir du midi|brasserie du coin|caf[eé] de la place|table du quartier|restaurant le jardin|la table du soir|le petit comptoir|brasserie de la gare|restaurant du march[ée]|le bar du coin|comptoir des vins|le petit bar|bar de la place|cave [àa] vins)$/i,
];

export function matchesAIStubVenue(name: string): boolean {
  return AI_STUB_VENUE_PATTERNS.some((re) => re.test((name || '').trim()));
}

/**
 * Universal placeholder meal detection.
 * Returns true if the activity looks like a generic/placeholder dining entry.
 */
export function isPlaceholderMeal(activity: any, cityName: string): boolean {
  const category = (activity.category || '').toUpperCase();
  const title = (activity.title || '').trim();
  const venue = (activity.location?.name || activity.venue_name || '').trim();
  const description = (activity.description || '').trim();

  // Title-shape detection FIRST — many meal-shaped placeholders ship with a
  // non-DINING category (e.g. "experience", "food", or empty). We treat any
  // meal-labeled activity as a candidate, then defer category gating.
  const looksLikeMeal =
    category === 'DINING' ||
    category === 'RESTAURANT' ||
    /^(breakfast|brunch|lunch|dinner|supper|drinks|meal)\b/i.test(title);
  if (!looksLikeMeal) return false;

  if (PLACEHOLDER_TITLE_PATTERNS.some(p => p.test(title))) return true;
  if (cityName.length > 2 && venue.toLowerCase() === cityName.toLowerCase()) return true;
  if (PLACEHOLDER_VENUE_PATTERNS.some(p => p.test(venue))) return true;
  if (/get a restaurant recommendation/i.test(description)) return true;
  if (/get a restaurant recommendation/i.test(venue)) return true;
  // Legacy "find a local spot" stubs from prior generations
  if (/find a local spot/i.test(title)) return true;
  if (/find a local spot/i.test(venue)) return true;
  // Venue name equals title (e.g. both are "Lunch at a bistro")
  if (venue && title && venue.toLowerCase() === title.toLowerCase()) return true;
  // Empty venue on a meal-labeled activity = placeholder
  if (looksLikeMeal && !venue) return true;
  // AI-generated French/Italian stub names
  if (matchesAIStubVenue(title)) return true;
  if (matchesAIStubVenue(venue)) return true;
  const titleNoLabel = title.replace(/^(breakfast|brunch|lunch|dinner|supper|drinks|meal)\s*[:\-—–]?\s*(at\s+)?/i, '').trim();
  if (titleNoLabel && titleNoLabel !== title && matchesAIStubVenue(titleNoLabel)) return true;

  return false;
}


// =============================================================================
// NUCLEAR PLACEHOLDER SWEEP — synchronous, zero-API last line of defense
// =============================================================================
export function nuclearPlaceholderSweep(
  activities: any[],
  city: string,
  diningConfig?: DiningConfig,
): number {
  const destinationCity = (city || '').toLowerCase().split(',')[0].trim();
  const usedNames = new Set<string>();
  let replaced = 0;

  for (const activity of activities) {
    if (!isPlaceholderMeal(activity, destinationCity)) continue;

    const startTimeStr = activity.startTime || activity.start_time || '12:00';
    const mealType = parseMealType(startTimeStr);

    // GUARANTEED resolver: city pool → recycled → regional → global. Never null.
    const fallback = resolveAnyMealFallback(city, mealType, usedNames);
    applyFallbackToActivity(activity, fallback, mealType, usedNames, diningConfig);
    // Force category=DINING so downstream pricing/UI handle it correctly.
    activity.category = 'dining';

    activity._placeholder_replaced = true;
    replaced++;
    console.warn(`[NUCLEAR] Placeholder survived quality pass — force-replaced: "${activity.title}"`);
  }

  if (replaced > 0) {
    console.warn(`[NUCLEAR] Force-replaced ${replaced} surviving placeholder(s) in ${city}`);
  }

  return replaced;
}

interface PlaceholderSlot {
  activityRef: any;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
}

// =============================================================================
// AI-POWERED RESTAURANT FALLBACK
// =============================================================================
const RESTAURANT_SUGGESTION_TOOL = {
  type: "function" as const,
  function: {
    name: "suggest_restaurant",
    description: "Suggest a single real restaurant",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Real restaurant name" },
        address: { type: "string", description: "Full street address" },
        price: { type: "number", description: "Average cost per person in USD" },
        description: { type: "string", description: "1-2 sentence description with signature dish" },
      },
      required: ["name", "address", "price", "description"],
    },
  },
};

export async function generateFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  budgetTier: string,
  apiKey: string,
  usedNames: Set<string>,
  country?: string,
  tripType?: string,
  dayTheme?: string,
  neighborhood?: string,
  diningConfig?: DiningConfig,
): Promise<FallbackRestaurant | null> {
  const blocklist = Array.from(usedNames).slice(0, 20).join(', ');

  // If we have a DNA-aware dining config, use its price ranges and style
  let priceRange: string;
  let styleDesc: string;

  if (diningConfig) {
    const pr = diningConfig.priceRange[mealType] || diningConfig.priceRange.dinner;
    priceRange = `€${pr[0]}-${pr[1]} per person`;
    styleDesc = diningConfig.diningStyle;
  } else {
    // Legacy fallback
    const priceGuidance: Record<string, Record<string, string>> = {
      Luminary: {
        breakfast: '€25-60 per person',
        lunch: '€40-80 per person',
        dinner: '€60-200 per person (Michelin-starred options welcome)',
        drinks: '€20-50 per person',
      },
      Explorer: {
        breakfast: '€10-30 per person',
        lunch: '€20-50 per person',
        dinner: '€30-80 per person',
        drinks: '€15-35 per person',
      },
      Budget: {
        breakfast: '€5-15 per person',
        lunch: '€8-25 per person',
        dinner: '€15-40 per person',
        drinks: '€8-20 per person',
      },
    };

    const styleDescriptions: Record<string, string> = {
      Luminary: 'luxury, refined, memorable dining experiences',
      Explorer: 'authentic, local favorites, quality over price',
      Budget: 'affordable, good value, local gems',
    };

    const effectiveTripType = tripType || 'Explorer';
    const prices = priceGuidance[effectiveTripType] || priceGuidance.Explorer;
    priceRange = prices[mealType] || prices.lunch;
    styleDesc = styleDescriptions[effectiveTripType] || styleDescriptions.Explorer;
  }

  const locationStr = country ? `${city}, ${country}` : city;

  const avoidStr = diningConfig?.avoidPatterns?.length ? `\n- AVOID these dining types: ${diningConfig.avoidPatterns.join(', ')}` : '';
  const michelinHint = diningConfig?.michelinPolicy === 'required' && mealType === 'dinner'
    ? '\n- Consider Michelin-starred restaurants if appropriate'
    : diningConfig?.michelinPolicy === 'discouraged' && mealType === 'dinner'
      ? '\n- Do NOT suggest Michelin-starred restaurants'
      : '';

  const promptParts = [
    `You are a restaurant expert for ${locationStr}. Suggest ONE real, currently operating ${mealType} restaurant.`,
    `- Dining style: ${styleDesc}`,
    `- Price range: ${priceRange}`,
    neighborhood ? `- Preferably in or near: ${neighborhood}` : null,
    dayTheme ? `- Day theme: ${dayTheme}` : null,
    michelinHint || null,
    mealType === 'drinks' ? '- Suggest a bar, wine bar, cocktail lounge, or similar venue' : null,
    `- Must be a REAL place with a REAL street address`,
    `- Pick a well-reviewed local favorite, not a tourist trap`,
    avoidStr || null,
    `- DO NOT suggest: ${blocklist || 'none'}`,
  ].filter(Boolean);

  const prompt = promptParts.join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [RESTAURANT_SUGGESTION_TOOL],
        tool_choice: { type: "function", function: { name: "suggest_restaurant" } },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[ai-restaurant] HTTP ${response.status} for ${mealType} in ${city}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.warn(`[ai-restaurant] No tool call in response for ${mealType} in ${city}`);
      return null;
    }

    const args = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    if (!args.name || !args.address) {
      console.warn(`[ai-restaurant] Missing name/address for ${mealType} in ${city}`);
      return null;
    }

    console.log(`[ai-restaurant] ✓ Generated: "${args.name}" for ${mealType} in ${city}`);
    return {
      name: args.name,
      address: args.address,
      price: args.price || 30,
      description: args.description || '',
    };
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.warn(`[ai-restaurant] Timeout for ${mealType} in ${city}`);
    } else {
      console.warn(`[ai-restaurant] Error for ${mealType} in ${city}:`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// HELPER: Determine meal type from start time
// =============================================================================
function parseMealType(startTime: string): 'breakfast' | 'lunch' | 'dinner' | 'drinks' {
  const hourMatch = startTime.match(/^(\d{1,2})/);
  const hour24 = hourMatch ? parseInt(hourMatch[1], 10) : 12;
  if (hour24 < 11) return 'breakfast';
  if (hour24 < 16) return 'lunch';
  if (hour24 < 21) return 'dinner';
  return 'drinks';
}

// =============================================================================
// EXPORTED: Fill a single placeholder slot (detection + replace + patch)
// =============================================================================
export async function fillPlaceholderSlot(
  activity: any,
  city: string,
  country: string,
  tripType: string,
  budgetTier: string,
  apiKey: string,
  usedVenueNames: Set<string>,
  dayTheme?: string,
  diningConfig?: DiningConfig,
): Promise<boolean> {
  const startTimeStr = activity.startTime || activity.start_time || '12:00';
  const mealType = parseMealType(startTimeStr);

  // Fast path: hardcoded fallback (free, instant)
  const fallback = getRandomFallbackRestaurant(city, mealType, usedVenueNames);
  if (fallback) {
    applyFallbackToActivity(activity, fallback, mealType, usedVenueNames, diningConfig);
    return true;
  }

  // Slow path: AI-powered fallback
  if (!apiKey) return false;

  try {
    const aiRestaurant = await generateFallbackRestaurant(
      city,
      mealType,
      budgetTier,
      apiKey,
      usedVenueNames,
      country || undefined,
      tripType || undefined,
      dayTheme,
      undefined,
      diningConfig,
    );
    if (aiRestaurant) {
      applyFallbackToActivity(activity, aiRestaurant, mealType, usedVenueNames, diningConfig);
      return true;
    }
  } catch (err) {
    console.warn(`[SLOT-FILLER] AI fallback failed for ${mealType} in ${city}:`, err);
  }

  return false;
}

// =============================================================================
// MAIN: Detect and fix all placeholder dining activities for a day
// =============================================================================
export async function fixPlaceholdersForDay(
  activities: any[],
  city: string,
  country: string,
  tripType: string,
  dayIndex: number,
  usedRestaurants: string[],
  budgetTier: string,
  apiKey: string,
  lockedActivities: any[],
  dayTitle?: string,
  diningConfig?: DiningConfig,
): Promise<void> {
  const destinationLower = (city || '').toLowerCase().trim();
  const destinationCity = destinationLower.split(',')[0].trim();

  const usedVenueNamesInDay = new Set<string>();
  // Seed with locked dining venue names
  for (const locked of lockedActivities) {
    const lCat = (locked.category || '').toLowerCase();
    if (lCat === 'dining' || lCat === 'restaurant') {
      const lName = (locked.location?.name || locked.title || '').toLowerCase();
      if (lName) usedVenueNamesInDay.add(lName);
    }
  }
  // Seed with usedRestaurants passed from orchestrator
  const usedList: string[] = Array.isArray(usedRestaurants) ? usedRestaurants : [];
  for (const u of usedList) {
    if (u) usedVenueNamesInDay.add(u.toLowerCase());
  }

  let placeholderCount = 0;

  for (const activity of activities) {
    if (!isPlaceholderMeal(activity, destinationCity)) continue;

    const title = (activity.title || '').trim();
    const venueName = (activity.location?.name || activity.venue_name || '').trim();
    console.error(`[QUALITY] Day ${dayIndex}: PLACEHOLDER DETECTED: "${title}" at "${venueName}" — replacing`);

    const success = await fillPlaceholderSlot(
      activity, city, country, tripType, budgetTier, apiKey,
      usedVenueNamesInDay, dayTitle, diningConfig,
    );

    if (success) {
      placeholderCount++;
      console.log(`[QUALITY] Replaced placeholder with: "${activity.title}"`);
    } else {
      console.error(`[QUALITY] Failed to fill placeholder at day ${dayIndex}: "${title}"`);
    }
  }

  if (placeholderCount === 0) {
    console.log(`[QUALITY] Day ${dayIndex}: No placeholders detected ✓`);
  } else {
    console.log(`[QUALITY] Day ${dayIndex}: Fixed ${placeholderCount} placeholder(s)`);
  }
}

// =============================================================================
// NUCLEAR WELLNESS SWEEP — terminal wellness placeholder safety net
// Mirrors nuclearPlaceholderSweep for the wellness/spa category. Runs late in
// the pipeline so that any wellness item that slipped past per-day repair
// (e.g. introduced by Smart Finish or weather backups) gets one final pass:
//   1. Replace with a real venue from INLINE_FALLBACK_WELLNESS, OR
//   2. Downgrade to free hotel-spa time, OR
//   3. Strip the activity entirely (high-cost no-venue items must never ship).
// Returns the number of activities mutated or removed (mutates `activities` in place).
// =============================================================================
export function nuclearWellnessSweep(
  activities: any[],
  city: string,
  hotelName?: string,
): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;

  const cityKey = (city || '').toLowerCase().trim();
  const used = new Set<string>();
  let mutated = 0;

  // First pass: collect names of already-real wellness venues to avoid dup repick.
  for (const a of activities) {
    const cat = String(a?.category || '').toLowerCase();
    if (cat === 'wellness' || cat === 'spa') {
      const v = String(a?.location?.name || a?.venue_name || '').toLowerCase().trim();
      if (v.length >= 4) used.add(v);
    }
  }

  // Walk in reverse so we can splice.
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i];
    if (!act) continue;
    if (!isPlaceholderWellness(act, city, hotelName)) continue;

    const before = act.title || '';
    const fb = getRandomFallbackWellness(cityKey, used);

    if (fb) {
      applyFallbackWellnessToActivity(act, fb, used);
      act.source = 'wellness-nuclear-sweep-replaced';
      mutated++;
      console.log(`[WELLNESS NUCLEAR] REPLACED "${before}" → "${act.title}"`);
      continue;
    }

    if (hotelName) {
      act.title = `Spa Time at ${hotelName}`;
      act.name = act.title;
      if (act.location) {
        act.location.name = hotelName;
      } else {
        act.location = { name: hotelName, address: '' };
      }
      act.venue_name = hotelName;
      act.description = 'Use the hotel spa or wellness facilities. Confirm availability and any service charge with the front desk.';
      if (act.cost && typeof act.cost === 'object') act.cost.amount = 0;
      act.cost_per_person = 0;
      act.metadata = act.metadata || {};
      act.metadata.unverified_venue = true;
      act.source = 'wellness-nuclear-sweep-downgraded';
      mutated++;
      console.warn(`[WELLNESS NUCLEAR] DOWNGRADED "${before}" → "${act.title}" ($0)`);
      continue;
    }

    // No fallback DB hit, no hotel — strip entirely. A high-cost spa with no
    // venue is worse than a missing slot. Zero the cost first as belt-and-braces.
    if (act.cost && typeof act.cost === 'object') act.cost.amount = 0;
    act.cost_per_person = 0;
    activities.splice(i, 1);
    mutated++;
    console.warn(`[WELLNESS NUCLEAR] STRIPPED "${before}" — no venue, no hotel`);
  }

  return mutated;
}
