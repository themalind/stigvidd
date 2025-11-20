import { Review, ReviewImage, Trail, User } from "./types";

// Users
export const mockUsers: User[] = [
  {
    id: "user_001",
    nickName: "NaturElskaren",
    email: "natur@example.local",
  },
  {
    id: "user_002",
    nickName: "VandrarVennen",
    email: "vandrar@example.local",
  },
  {
    id: "user_003",
    nickName: "FjällFanatikern",
    email: "fjall@example.local",
  },
  {
    id: "user_004",
    nickName: "SkogsSpringaren",
    email: "skog@example.local",
  },
  {
    id: "user_005",
    nickName: "ÄventyrAnna",
    email: "aventyr@example.local",
  },
  {
    id: "user_006",
    nickName: "VildmarksViktor",
    email: "vildmark@example.local",
  },
];

// Trails med bilder
export const mockTrails: Trail[] = [
  {
    id: "trail_001",
    name: "Tiveden",
    trailLenght: "9,5",
    classification: "Svår",
    accessability: false,
    accessabilityInfo: "Delvis väldigt svår terräng, kräver god fysik",
    trailSymbol: "Röd markering",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_001",
        imageUrl: require("../assets/images/tiveden/20250925122257.jpg"),
        trailId: "trail_001",
      },
      {
        id: "img_002",
        imageUrl: require("../assets/images/tiveden/20250925122143.jpg"),
        trailId: "trail_001",
      },
      {
        id: "img_003",
        imageUrl: require("../assets/images/tiveden/20250925110314.jpg"),
        trailId: "trail_001",
      },
    ],
  },
  {
    id: "trail_002",
    name: "Storsjöleden",
    trailLenght: "8,5",
    classification: "Svår",
    accessability: false,
    accessabilityInfo: "Delvis väldigt svår terräng, kräver god fysik",
    trailSymbol: "Blå markering",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_004",
        imageUrl: require("../assets/images/storsjon/20241102113934.jpg"),
        trailId: "trail_002",
      },
      {
        id: "img_005",
        imageUrl: require("../assets/images/storsjon/20241102121010.jpg"),
        trailId: "trail_002",
      },
      {
        id: "img_006",
        imageUrl: require("../assets/images/storsjon/20241102112335.jpg"),
        trailId: "trail_002",
      },
    ],
  },
  {
    id: "trail_003",
    name: "Tångaleden",
    trailLenght: "9,1",
    classification: "Medel",
    accessability: false,
    accessabilityInfo: "Stigar, spångar och grusväg, vacker utsikt",
    trailSymbol: "Orange markering",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_007",
        imageUrl: require("../assets/images/tangaleden/20250902122917.jpg"),
        trailId: "trail_003",
      },
      {
        id: "img_008",
        imageUrl: require("../assets/images/tangaleden/20250902130421.jpg"),
        trailId: "trail_003",
      },
      {
        id: "img_009",
        imageUrl: require("../assets/images/hofsnas/20250822093635.jpg"),
        trailId: "trail_003",
      },
    ],
  },
  {
    id: "trail_004",
    name: "Vildmarksleden Årås",
    trailLenght: "8,5",
    classification: "Medel",
    accessability: true,
    accessabilityInfo: "Naturstigar, beteshagar, spång och grusväg",
    trailSymbol: "Grön markering",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_010",
        imageUrl: require("../assets/images/aras/20250818102417.jpg"),
        trailId: "trail_004",
      },
      {
        id: "img_011",
        imageUrl: require("../assets/images/aras/20250818094810.jpg"),
        trailId: "trail_004",
      },
      {
        id: "img_012",
        imageUrl: require("../assets/images/aras/20250818103640.jpg"),
        trailId: "trail_004",
      },
      {
        id: "img_013",
        imageUrl: require("../assets/images/aras/20250818112639.jpg"),
        trailId: "trail_004",
      },
    ],
  },
  {
    id: "trail_005",
    name: "Gesebol",
    trailLenght: "6",
    classification: "Lätt",
    accessability: false,
    accessabilityInfo: "Asfalt, stig och grusväg",
    trailSymbol: "Röd markering med en 6:a på",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_014",
        imageUrl: require("../assets/images/gesebol/20250824100243.jpg"),
        trailId: "trail_005",
      },
      {
        id: "img_015",
        imageUrl: require("../assets/images/gesebol/20250824105053.jpg"),
        trailId: "trail_005",
      },
      {
        id: "img_016",
        imageUrl: require("../assets/images/gesebol/20250824095946.jpg"),
        trailId: "trail_005",
      },
      {
        id: "img_017",
        imageUrl: require("../assets/images/gesebol/20250824110936.jpg"),
        trailId: "trail_005",
      },
    ],
  },
  {
    id: "trail_006",
    name: "Hultafors",
    trailLenght: "4,5",
    classification: "Medel",
    accessability: false,
    accessabilityInfo: "Asfalt, stigar och grusväg",
    trailSymbol: "Blå markering ",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [
      {
        id: "img_018",
        imageUrl: require("../assets/images/hultafors/20240217105404.jpg"),
        trailId: "trail_006",
      },
      {
        id: "img_019",
        imageUrl: require("../assets/images/hultafors/20240217105412.jpg"),
        trailId: "trail_006",
      },
      {
        id: "img_020",
        imageUrl: require("../assets/images/hultafors/20240217111003.jpg"),
        trailId: "trail_006",
      },
    ],
  },
  {
    id: "trail_007",
    name: "Nässehult",
    trailLenght: "4,5",
    classification: "Lätt",
    accessability: true,
    accessabilityInfo: "Asfalt och grusväg",
    trailSymbol: "Nässla",
    trailSymbolImage: "../assets/images/nassla.png",
    trailImages: [
      {
        id: "img_021",
        imageUrl: require("../assets/images/nasslehult/20240119131715.jpg"),
        trailId: "trail_007",
      },
      {
        id: "img_022",
        imageUrl: require("../assets/images/nasslehult/20240119132416.jpg"),
        trailId: "trail_007",
      },
      {
        id: "img_023",
        imageUrl: require("../assets/images/nasslehult/20240120103723.jpg"),
        trailId: "trail_007",
      },
    ],
  },
  {
    id: "trail_008",
    name: "Hoffsnäs",
    trailLenght: "4,8",
    classification: "Lätt",
    accessability: true,
    accessabilityInfo: "Asfalt, stig och grusväg",
    trailSymbol: "Läderbagge",
    trailSymbolImage: "../assets/images/mock-trail-symbol.png",
    trailImages: [],
  },
];

// Reviews

// Reviews - nu baserade på de riktiga lederna
export const mockReviews: Review[] = [
  {
    id: "review_001",
    review:
      "Tiveden är verkligen utmanande! Branta klippor och fantastisk natur. Mina ben känner fortfarande av det!",
    grade: 5,
    trailId: "trail_001",
    userId: "user_001",
  },
  {
    id: "review_002",
    review:
      "Storsjöleden var tuffare än förväntat men så vacker! Perfekt träning.",
    grade: 4,
    trailId: "trail_002",
    userId: "user_002",
  },
  {
    id: "review_003",
    review:
      "Tångaleden är en favorit! Spångarna gör det enklare och utsikten är magisk.",
    grade: 5,
    trailId: "trail_003",
    userId: "user_001",
  },
  {
    id: "review_004",
    review:
      "Vildmarksleden Årås är mysig! Såg både kor och får längs vägen. Barnvänlig.",
    grade: 4,
    trailId: "trail_004",
    userId: "user_002",
  },
  {
    id: "review_005",
    review: "Tiveden är inget för nybörjare. Ta med vatten och ta det lugnt!",
    grade: 4,
    trailId: "trail_001",
    userId: "user_003",
  },
  {
    id: "review_006",
    review:
      "Bästa leden i området! Tiveden är krävande men så otroligt vacker med alla klippformationer.",
    grade: 5,
    trailId: "trail_001",
    userId: "user_004",
  },
  {
    id: "review_007",
    review: "Storsjöleden passerar vackra vyer över sjön. Värt ansträngningen!",
    grade: 5,
    trailId: "trail_002",
    userId: "user_005",
  },
  {
    id: "review_008",
    review:
      "Lite hala stenar på vissa ställen i Storsjöleden, men annars toppen!",
    grade: 4,
    trailId: "trail_002",
    userId: "user_006",
  },
  {
    id: "review_009",
    review:
      "Tångaleden är perfekt för en avslappnad vandring. Spångarna är välbyggda.",
    grade: 4,
    trailId: "trail_003",
    userId: "user_003",
  },
  {
    id: "review_010",
    review: "Gick Tångaleden i solnedgången - magiskt! Rekommenderas starkt.",
    grade: 5,
    trailId: "trail_003",
    userId: "user_004",
  },
  {
    id: "review_011",
    review:
      "Årås är superbra för hela familjen! Kan till och med cykla delar av sträckan.",
    grade: 5,
    trailId: "trail_004",
    userId: "user_005",
  },
  {
    id: "review_012",
    review:
      "Fin blandning av natur och lantbrukslandskap på Vildmarksleden. Väldigt trivsamt!",
    grade: 4,
    trailId: "trail_004",
    userId: "user_001",
  },
  {
    id: "review_013",
    review:
      "Tiveden utmanade verkligen min kondition. Ta med snacks och vatten!",
    grade: 4,
    trailId: "trail_001",
    userId: "user_006",
  },
  {
    id: "review_014",
    review:
      "Storsjöleden hade vackra höstfärger när vi gick den. Lite lerig efter regn.",
    grade: 4,
    trailId: "trail_002",
    userId: "user_003",
  },
  {
    id: "review_015",
    review:
      "Tångaleden är min go-to för en snabb eftermiddagspromenad. Lugnt och skönt!",
    grade: 5,
    trailId: "trail_003",
    userId: "user_006",
  },
  {
    id: "review_016",
    review:
      "Årås är en underbar led! Grusvägen gör det enkelt och naturen är vacker.",
    grade: 5,
    trailId: "trail_004",
    userId: "user_004",
  },
  {
    id: "review_017",
    review: "Tiveden kräver bra skor med bra grepp. Klipporna kan vara hala!",
    grade: 4,
    trailId: "trail_001",
    userId: "user_005",
  },
  {
    id: "review_018",
    review:
      "Lite för tuff för mig personligen men vacker natur i Storsjöleden.",
    grade: 3,
    trailId: "trail_002",
    userId: "user_004",
  },
  {
    id: "review_019",
    review:
      "Gesebol är perfekt för en lugn promenad! Bra mix av underlag och fin natur.",
    grade: 4,
    trailId: "trail_005",
    userId: "user_001",
  },
  {
    id: "review_020",
    review: "Enkel och trevlig led, passar bra för joggingrundan också!",
    grade: 4,
    trailId: "trail_005",
    userId: "user_002",
  },
  {
    id: "review_021",
    review: "Kort och mysig tur. Barnen tyckte det var lagom längd.",
    grade: 5,
    trailId: "trail_005",
    userId: "user_003",
  },
  {
    id: "review_022",
    review: "Gesebol är en favorit för kvällspromenader. Lugnt och fridfullt!",
    grade: 5,
    trailId: "trail_005",
    userId: "user_006",
  },
  {
    id: "review_023",
    review:
      "Hultafors har lite mer utmaning än man tror! Fina stigar genom skogen.",
    grade: 4,
    trailId: "trail_006",
    userId: "user_004",
  },
  {
    id: "review_024",
    review: "Bra träningsrunda! Lite variation i terrängen gör det intressant.",
    grade: 4,
    trailId: "trail_006",
    userId: "user_005",
  },
  {
    id: "review_025",
    review:
      "Hultafors överraskade positivt. Vacker skogsmark och bra skyltning.",
    grade: 5,
    trailId: "trail_006",
    userId: "user_001",
  },
  {
    id: "review_026",
    review: "Lite för korta stigdelar för min smak men annars trevlig led.",
    grade: 3,
    trailId: "trail_006",
    userId: "user_003",
  },
  {
    id: "review_027",
    review: "Nässehult är absolut bäst för barnvagn! Släta vägar hela vägen.",
    grade: 5,
    trailId: "trail_007",
    userId: "user_002",
  },
  {
    id: "review_028",
    review: "Perfekt tillgänglig led. Kunde köra rullstol utan problem!",
    grade: 5,
    trailId: "trail_007",
    userId: "user_006",
  },
  {
    id: "review_029",
    review:
      "Enkelt och lättgått. Bra för äldre eller de som behöver tillgänglighet.",
    grade: 4,
    trailId: "trail_007",
    userId: "user_004",
  },
  {
    id: "review_030",
    review: "Nässehult är mysig! Fin promenad längs med bra underlag.",
    grade: 4,
    trailId: "trail_007",
    userId: "user_005",
  },
  {
    id: "review_031",
    review: "Gesebol är min favoritrunda på 6 km. Lagom längd och varierat!",
    grade: 5,
    trailId: "trail_005",
    userId: "user_004",
  },
  {
    id: "review_032",
    review: "Hultafors ger lite träning trots att den är kort. Sköna stigar!",
    grade: 4,
    trailId: "trail_006",
    userId: "user_002",
  },
];

// Review Images
export const mockReviewImages: ReviewImage[] = [
  {
    id: "revimg_001",
    ImageUrl: require("../assets/images/mock-review/review0011.jpg"),
    reviewId: "review_001",
  },
  {
    id: "revimg_002",
    ImageUrl: require("../assets/images/mock-review/review0012.jpg"),
    reviewId: "review_001",
  },
  {
    id: "revimg_003",
    ImageUrl: require("../assets/images/mock-review/review0031.jpg"),
    reviewId: "review_003",
  },
];
