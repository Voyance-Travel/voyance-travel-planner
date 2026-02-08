/**
 * Reliable Destination Image Utility
 * 
 * Uses curated Unsplash images as the source of truth.
 * Does NOT rely on database images which have quality issues.
 */

// Rome: local curated hero images (NO PEOPLE)
import romeHero2 from '@/assets/destinations/rome-hero-2.jpg';
import romeHero3 from '@/assets/destinations/rome-hero-3.jpg';
import romeHero4 from '@/assets/destinations/rome-hero-4.jpg';
import romeHero5 from '@/assets/destinations/rome-hero-5.jpg';

// Curated high-quality images for popular destinations
const CURATED_DESTINATION_IMAGES: Record<string, string[]> = {
  // Europe
  'paris': [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=1200',
  ],
  'london': [
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200',
    'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=1200',
    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=1200',
  ],
  'rome': [
    romeHero5,
    romeHero2,
    romeHero3,
    romeHero4,
  ],
  'barcelona': [
    'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200',
    'https://images.unsplash.com/photo-1562883676-8c7feb83f09b?w=1200',
    'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=1200',
  ],
  'santorini': [
    'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200',
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200',
  ],
  'lisbon': [
    'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200', // Belém Tower
    'https://images.unsplash.com/photo-1555881400-69b4f7a5f3b1?w=1200', // Alfama rooftops
    'https://images.unsplash.com/photo-1548707309-dcebeab9ea9b?w=1200', // Tram 28 in Alfama
    'https://images.unsplash.com/photo-1575373647588-50fa8fc2d16f?w=1200', // Colorful tiles
  ],
  'amsterdam': [
    'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200',
    'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?w=1200',
    'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1200',
  ],
  'vienna': [
    'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200',
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200',
    'https://images.unsplash.com/photo-1573599852326-2d4da0aea6c8?w=1200',
  ],
  'copenhagen': [
    'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200',
    'https://images.unsplash.com/photo-1552560880-2482cef14240?w=1200',
    'https://images.unsplash.com/photo-1551516594-56cb78394645?w=1200',
  ],
  'florence': [
    'https://images.unsplash.com/photo-1541370976299-4d24ebbc9077?w=1200',
    'https://images.unsplash.com/photo-1504019347908-b45f9b0b8dd5?w=1200',
    'https://images.unsplash.com/photo-1534359265607-b39e67e08544?w=1200',
  ],
  'porto': [
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200',
    'https://images.unsplash.com/photo-1513735718075-2e2d37cb7952?w=1200',
  ],
  'reykjavik': [
    'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=1200',
    'https://images.unsplash.com/photo-1504233529578-6d46baba6d34?w=1200',
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1200',
  ],

  // Asia
  'tokyo': [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1200',
  ],
  'kyoto': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200',
    'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=1200',
  ],
  'bali': [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200',
    'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200',
    'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200',
  ],
  'bangkok': [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200',
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
  ],
  'singapore': [
    'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200',
    'https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=1200',
    'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200',
  ],
  'seoul': [
    'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200',
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200',
    'https://images.unsplash.com/photo-1546874177-9e664107314e?w=1200',
  ],
  'busan': [
    'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200', // Haeundae Beach
    'https://images.unsplash.com/photo-1578037571214-25e07a2f91ef?w=1200', // Gamcheon Culture Village
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f11?w=1200', // Busan coastal view
  ],
  'jeju': [
    'https://images.unsplash.com/photo-1597668889648-f6c85fe33c57?w=1200', // Jeju landscape
    'https://images.unsplash.com/photo-1623083500086-8a7cd5a8f4a6?w=1200', // Jeju coast
    'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?w=1200', // Jeju nature
  ],
  'osaka': [
    'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=1200', // Osaka Castle
    'https://images.unsplash.com/photo-1556731740-e9f6b0b7f8f5?w=1200', // Dotonbori
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1200', // Osaka night
  ],
  'taipei': [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200', // Taipei 101
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200', // Temple
    'https://images.unsplash.com/photo-1553653924-39b70295f8da?w=1200', // Jiufen
  ],
  'hong kong': [
    'https://images.unsplash.com/photo-1536599018102-9f803c979b2d?w=1200', // Victoria Harbour
    'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=1200', // Hong Kong skyline
    'https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=1200', // Street view
  ],
  'hong-kong': [
    'https://images.unsplash.com/photo-1536599018102-9f803c979b2d?w=1200',
    'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=1200',
    'https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=1200',
  ],
  'kuala lumpur': [
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1200', // Petronas Towers
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200', // KL skyline
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200', // Batu Caves
  ],
  'kuala-lumpur': [
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1200',
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200',
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200',
  ],
  'hanoi': [
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200',
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200',
  ],
  'ho chi minh': [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200',
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200',
  ],
  'ho-chi-minh': [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200',
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200',
  ],
  'saigon': [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200',
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200',
  ],

  // Americas - Major US Cities
  'new york': [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200',
  ],
  'new-york': [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200',
  ],
  'baltimore': [
    'https://images.unsplash.com/photo-1575438276866-8ee7e60acf2d?w=1200', // Inner Harbor
    'https://images.unsplash.com/photo-1588859211408-94e55a9f2f00?w=1200', // Baltimore skyline
    'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=1200', // Downtown Baltimore
  ],
  'washington dc': [
    'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200', // Capitol Building
    'https://images.unsplash.com/photo-1617581629397-a72507c3de9e?w=1200', // Washington Monument
    'https://images.unsplash.com/photo-1585107403124-b1b9b0c6a69f?w=1200', // Lincoln Memorial
  ],
  'washington-dc': [
    'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200',
    'https://images.unsplash.com/photo-1617581629397-a72507c3de9e?w=1200',
    'https://images.unsplash.com/photo-1585107403124-b1b9b0c6a69f?w=1200',
  ],
  'washington': [
    'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200',
    'https://images.unsplash.com/photo-1617581629397-a72507c3de9e?w=1200',
    'https://images.unsplash.com/photo-1585107403124-b1b9b0c6a69f?w=1200',
  ],
  'philadelphia': [
    'https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=1200', // Philadelphia skyline
    'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=1200', // Independence Hall area
    'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=1200', // Philadelphia downtown
  ],
  'boston': [
    'https://images.unsplash.com/photo-1501979376754-00b7c04c6a81?w=1200', // Boston skyline
    'https://images.unsplash.com/photo-1573155993874-d5d48af862ba?w=1200', // Boston Common
    'https://images.unsplash.com/photo-1559335936-d2b8d7e93d17?w=1200', // Boston waterfront
  ],
  'chicago': [
    'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=1200', // Chicago skyline
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200', // Chicago downtown
    'https://images.unsplash.com/photo-1581373449483-37449f962b6c?w=1200', // Cloud Gate
  ],
  'atlanta': [
    'https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1200', // Atlanta skyline
    'https://images.unsplash.com/photo-1570126618953-d437176e8c79?w=1200', // Atlanta downtown
    'https://images.unsplash.com/photo-1587162146766-e06b1189b907?w=1200', // Atlanta at night
  ],
  'denver': [
    'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1200', // Denver skyline with mountains
    'https://images.unsplash.com/photo-1619856699906-09e1f58c98b9?w=1200', // Denver downtown
    'https://images.unsplash.com/photo-1600041161228-519e6dd27bac?w=1200', // Denver cityscape
  ],
  'seattle': [
    'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=1200', // Seattle skyline
    'https://images.unsplash.com/photo-1516905041604-7935af78f572?w=1200', // Space Needle
    'https://images.unsplash.com/photo-1542223616-9de9adb5f3c8?w=1200', // Seattle waterfront
  ],
  'portland': [
    'https://images.unsplash.com/photo-1545085799-5b88ea4d36f2?w=1200', // Portland skyline
    'https://images.unsplash.com/photo-1548039149-e21405d4de92?w=1200', // Portland bridges
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200', // Portland downtown
  ],
  'nashville': [
    'https://images.unsplash.com/photo-1546464677-905db9a3a6c3?w=1200', // Nashville skyline
    'https://images.unsplash.com/photo-1571690022330-9e951a9ff0f9?w=1200', // Nashville downtown
    'https://images.unsplash.com/photo-1545601445-4d6a0a0565f0?w=1200', // Nashville music scene
  ],
  'austin': [
    'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=1200', // Austin skyline
    'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=1200', // Austin downtown
    'https://images.unsplash.com/photo-1588580000645-4562a6d2c839?w=1200', // Austin Congress Ave
  ],
  'san francisco': [
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200', // Golden Gate Bridge
    'https://images.unsplash.com/photo-1521747116042-5a810fda9664?w=1200', // San Francisco skyline
    'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=1200', // SF waterfront
  ],
  'san-francisco': [
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200',
    'https://images.unsplash.com/photo-1521747116042-5a810fda9664?w=1200',
    'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=1200',
  ],
  'los angeles': [
    'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1200', // LA skyline
    'https://images.unsplash.com/photo-1580655653885-65763b2597d0?w=1200', // Hollywood
    'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=1200', // Santa Monica
  ],
  'los-angeles': [
    'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1200',
    'https://images.unsplash.com/photo-1580655653885-65763b2597d0?w=1200',
    'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=1200',
  ],
  'miami': [
    'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=1200', // Miami Beach
    'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1200', // Miami skyline
    'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=1200', // South Beach
  ],
  'las vegas': [
    'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=1200', // Las Vegas strip
    'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=1200', // Vegas at night
    'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=1200', // Bellagio
  ],
  'las-vegas': [
    'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=1200',
    'https://images.unsplash.com/photo-1581351721010-8cf859cb14a4?w=1200',
    'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=1200',
  ],
  // Latin America
  'mexico city': [
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200',
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200',
  ],
  'mexico-city': [
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200',
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200',
  ],
  'buenos aires': [
    'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200',
    'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200',
    'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200',
  ],
  'buenos-aires': [
    'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200',
    'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200',
    'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200',
  ],
  'vancouver': [
    'https://images.unsplash.com/photo-1609825488888-3a766db05542?w=1200',
    'https://images.unsplash.com/photo-1578469550956-0e16b69c6a3d?w=1200',
    'https://images.unsplash.com/photo-1560814304-4f05976ef22e?w=1200',
  ],
  'cartagena': [
    'https://images.unsplash.com/photo-1533690519961-46e5a84f1c17?w=1200',
    'https://images.unsplash.com/photo-1569012871812-f38ee64cd54c?w=1200',
    'https://images.unsplash.com/photo-1547149600-a6cdf8fce60c?w=1200',
  ],
  'new orleans': [
    'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=1200',
    'https://images.unsplash.com/photo-1560507074-b9eb4b818538?w=1200',
    'https://images.unsplash.com/photo-1565214975484-3cfa370c43ed?w=1200',
  ],
  'new-orleans': [
    'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=1200',
    'https://images.unsplash.com/photo-1560507074-b9eb4b818538?w=1200',
    'https://images.unsplash.com/photo-1565214975484-3cfa370c43ed?w=1200',
  ],
  'cusco': [
    'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200',
    'https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=1200',
    'https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?w=1200',
  ],
  'oaxaca': [
    'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200',
    'https://images.unsplash.com/photo-1547558840-8ad6c4dc309c?w=1200',
    'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1200',
  ],
  // US Small Towns (use regional scenic images)
  'thurmont': [
    'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200', // Maryland countryside
    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=1200', // Small town America
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', // Appalachian hills
  ],
  'weymouth': [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', // New Jersey landscape
    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=1200', // Small town America
    'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200', // East Coast scenery
  ],
  'weymouth township': [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=1200',
    'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200',
  ],

  // Africa & Middle East
  'cape town': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200', // Table Mountain
    'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200', // Cape Town coast
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200', // Cape Town cityscape
  ],
  'cape-town': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200',
    'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200',
  ],
  'marrakech': [
    'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200', // Marrakech medina
    'https://images.unsplash.com/photo-1489493512598-d08130f49bea?w=1200', // Moroccan architecture
    'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1200', // Marrakech market
  ],
  'inhambane': [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200', // African coast
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200', // Mozambique beach
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200', // Coastal African city
  ],
  'mozambique': [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200',
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200',
  ],
  'petra': [
    'https://images.unsplash.com/photo-1563177978-4c5fb3c0e3c9?w=1200', // The Treasury
    'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?w=1200', // Petra ruins
    'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=1200', // Petra canyon
  ],
  'dubai': [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200', // Dubai skyline
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200', // Burj Khalifa
    'https://images.unsplash.com/photo-1546412414-e1885259563a?w=1200', // Dubai marina
  ],
  'cairo': [
    'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1200', // Pyramids
    'https://images.unsplash.com/photo-1539768942893-daf53e448371?w=1200', // Cairo city
    'https://images.unsplash.com/photo-1553913861-c0fddf2619ee?w=1200', // Egyptian landmarks
  ],
  'nairobi': [
    'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=1200', // Nairobi skyline
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1200', // African wildlife
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200', // African landscape
  ],
  'johannesburg': [
    'https://images.unsplash.com/photo-1577948000111-9c970dfe3743?w=1200', // Johannesburg skyline
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200', // South Africa cityscape
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200', // African urban landscape
  ],

  // Oceania
  'melbourne': [
    'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200',
    'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200',
  ],
  'sydney': [
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200',
    'https://images.unsplash.com/photo-1524293581917-878a6d017c71?w=1200',
    'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=1200',
  ],
  'auckland': [
    'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1200',
    'https://images.unsplash.com/photo-1595125990323-885cec5217ff?w=1200',
    'https://images.unsplash.com/photo-1544413164-5f1b361f5bfa?w=1200',
  ],
};

// Generate Unsplash URL for unknown destinations
const generateUnsplashUrl = (destination: string, index = 0): string => {
  const seed = destination.toLowerCase().replace(/[^a-z]/g, '');
  const sizes = ['1200', '800', '600'];
  const size = sizes[index % sizes.length];
  return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=${size}&q=80&sig=${seed}${index}`;
};

// Generic travel fallbacks for completely unknown destinations
const GENERIC_TRAVEL_IMAGES = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200', // Travel suitcase
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200', // Mountain lake
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', // Nature
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200', // Beach sunset
  'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=1200', // Travel scene
];

/**
 * Get the primary image for a destination
 */
export function getDestinationImage(destination: string): string {
  const normalized = destination.toLowerCase().trim();
  
  // Check curated images first
  if (CURATED_DESTINATION_IMAGES[normalized]) {
    return CURATED_DESTINATION_IMAGES[normalized][0];
  }
  
  // Try variations (with/without spaces, dashes)
  const withDash = normalized.replace(/\s+/g, '-');
  const withSpace = normalized.replace(/-/g, ' ');
  
  if (CURATED_DESTINATION_IMAGES[withDash]) {
    return CURATED_DESTINATION_IMAGES[withDash][0];
  }
  if (CURATED_DESTINATION_IMAGES[withSpace]) {
    return CURATED_DESTINATION_IMAGES[withSpace][0];
  }
  
  // Return a generic travel image based on destination hash
  const hash = normalized.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return GENERIC_TRAVEL_IMAGES[hash % GENERIC_TRAVEL_IMAGES.length];
}

/**
 * Get multiple images for a destination gallery with fallbacks
 */
export function getDestinationImages(destination: string, count = 4): string[] {
  const normalized = destination.toLowerCase().trim();
  // Also try extracting just the city name (before comma or parenthetical)
  const cityOnly = normalized.split(',')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  
  // Check curated images first with multiple matching strategies
  const images = CURATED_DESTINATION_IMAGES[normalized] 
    || CURATED_DESTINATION_IMAGES[normalized.replace(/\s+/g, '-')]
    || CURATED_DESTINATION_IMAGES[normalized.replace(/-/g, ' ')]
    || CURATED_DESTINATION_IMAGES[cityOnly]
    || CURATED_DESTINATION_IMAGES[cityOnly.replace(/\s+/g, '-')]
    || CURATED_DESTINATION_IMAGES[cityOnly.replace(/-/g, ' ')];
  
  if (images && images.length > 0) {
    // Return curated images plus some generic fallbacks
    const result = [...images.slice(0, count)];
    // Add generic fallbacks at the end
    const hash = normalized.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    result.push(GENERIC_TRAVEL_IMAGES[hash % GENERIC_TRAVEL_IMAGES.length]);
    result.push(GENERIC_TRAVEL_IMAGES[(hash + 1) % GENERIC_TRAVEL_IMAGES.length]);
    return result;
  }
  
  // Generate dynamic Unsplash URLs for unknown destinations
  const dynamicUrls = Array.from({ length: count }, (_, i) => generateUnsplashUrl(destination, i));
  // Add generic fallbacks
  const hash = normalized.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  dynamicUrls.push(GENERIC_TRAVEL_IMAGES[hash % GENERIC_TRAVEL_IMAGES.length]);
  dynamicUrls.push(GENERIC_TRAVEL_IMAGES[(hash + 1) % GENERIC_TRAVEL_IMAGES.length]);
  return dynamicUrls;
}

/**
 * Check if we have curated images for a destination
 */
export function hasCuratedImages(destination: string): boolean {
  const normalized = destination.toLowerCase().trim();
  const cityOnly = normalized.split(',')[0].trim();
  return !!(
    CURATED_DESTINATION_IMAGES[normalized] ||
    CURATED_DESTINATION_IMAGES[normalized.replace(/\s+/g, '-')] ||
    CURATED_DESTINATION_IMAGES[normalized.replace(/-/g, ' ')] ||
    CURATED_DESTINATION_IMAGES[cityOnly] ||
    CURATED_DESTINATION_IMAGES[cityOnly.replace(/\s+/g, '-')] ||
    CURATED_DESTINATION_IMAGES[cityOnly.replace(/-/g, ' ')]
  );
}

/**
 * Generate a deterministic gradient data URL for a destination
 * Used as the final fallback when all image sources fail
 */
export function generateDestinationGradient(seed: string): string {
  // Generate deterministic hue from seed
  const hash = seed.toLowerCase().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40) % 360; // Complementary-ish offset
  
  // Create a canvas-free SVG gradient as data URL
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1}, 60%, 45%)"/>
          <stop offset="100%" style="stop-color:hsl(${hue2}, 50%, 35%)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>
  `.replace(/\s+/g, ' ').trim();
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export {
  CURATED_DESTINATION_IMAGES,
  GENERIC_TRAVEL_IMAGES,
};

export default {
  getDestinationImage,
  getDestinationImages,
  hasCuratedImages,
  generateDestinationGradient,
  CURATED_DESTINATION_IMAGES,
  GENERIC_TRAVEL_IMAGES,
};
