import { ImageSourcePropType } from "react-native";

export enum FacilityType {
  Firepit = "firepit",
  Shelter = "shelter",
  FishingArea = "fishingarea",
  SwimmingArea = "swimmingarea",
  NatureReserv = "naturereserv",
}

export interface FacilityItem {
  name: string;
  location: string;
  description: string;
  url: string;
}

export interface AreaFacilities {
  [FacilityType.Firepit]: FacilityItem[];
  [FacilityType.Shelter]: FacilityItem[];
  [FacilityType.FishingArea]: FacilityItem[];
  [FacilityType.SwimmingArea]: FacilityItem[];
  [FacilityType.NatureReserv]: FacilityItem[];
}

export interface BorasArea {
  identifier: string;
  name: string;
  location: string;
  description: string;
  image: ImageSourcePropType;
  url: string;
  trails: string[]; // trail identifiers — filtreras mot Trail.city via API
  facilities: AreaFacilities;
}

export const borasAreas: BorasArea[] = [
  {
    identifier: "dalsjofors",
    name: "Dalsjöfors",
    location: "Öster om Borås",
    description: "Dalsjöfors bjuder på varierad natur med sjöar, vattendrag och skogsmarker öster om Borås. Här finns grillplatser, badplatser och fiske för hela familjen.",
    image: { uri: "https://stigvidd.se/files/trails/area-dalsjofors.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bergagärdesgrillen",
          location: "Banvallen, Dalsjöfors",
          description: "Grillplats längs den gamla banvallen i Dalsjöfors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Slättåsgrillen",
          location: "Slättås, Dalsjöfors",
          description: "Grillplats vid Slättås med tillgång till naturmark.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Övrarpsgrillen",
          location: "Övrarp, Dalsjöfors",
          description: "Grillplats vid Övrarp omgiven av skog.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Ankedammen",
          location: "Dalsjöfors",
          description: "Ankedammen är ett populärt fiskevatten i Dalsjöfors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Häggån",
          location: "Dalsjöfors",
          description: "Häggån erbjuder fiske i ett naturligt vattendrag.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Stora och Lilla Dalsjön",
          location: "Dalsjöfors",
          description: "Stora och Lilla Dalsjön är fiskrika sjöar i Dalsjöfors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Ås-Tolken",
          location: "Dalsjöfors",
          description: "Ås-Tolken är ett fiskevårdsområde med goda fiskeförhållanden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Dalsjöns badplats",
          location: "Dalsjön, Dalsjöfors",
          description: "Dalsjöns badplats med brygga och sandstrand vid den vackra sjön Dalsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Rölle, Dalsjöfors",
          description: "Rölle naturreservat skyddar värdefull natur med gamla träd och varierade naturmiljöer.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
    },
  },
  {
    identifier: "rya-asar",
    name: "Rya åsar",
    location: "Norr om Borås",
    description: "Rya åsar är ett omtyckt friluftsområde norr om Borås med kuperad terräng, sjöar och vidsträckta skogsmarker. Naturreservatet erbjuder vandring, skidåkning och fina naturupplevelser.",
    image: { uri: "https://stigvidd.se/files/trails/area-rya.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "Grillplats vid Fjällsjön med vindskydd och natursköna omgivningar.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "Grillplats på Högplatån med fin utsikt över omgivande landskap.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "Vindskydd vid Fjällsjön med grillmöjligheter och rastplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "Vindskydd på Högplatån vid Ålgården, lämpligt för längre vistelse.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Ryssbybäcken fiskevårdsområde",
          location: "Rya åsar",
          description: "Ryssbybäcken fiskevårdsområde erbjuder fiske i ett naturligt vattendrag.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Norr om Borås",
          description: "Öresjö är en stor sjö med goda fiskemöjligheter norr om Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Borås",
          description: "Rya åsar naturreservat skyddar kuperade åsar med rik fauna och flora, och erbjuder friluftsliv för hela familjen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
    },
  },
  {
    identifier: "kype",
    name: "Kype",
    location: "Centrala Borås",
    description: "Kype är ett populärt friluftsområde i centrala Borås med Kypesjön som nav. Området erbjuder badplatser, grillplatser och fina promenadstråk för boråsarna.",
    image: { uri: "https://stigvidd.se/files/trails/area-kype.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "Grillplats i Björkängsskogen vid Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypegården Inte-nudda-marken-parken",
          location: "Kypegården, Borås",
          description: "Grillplats vid Kypegården i den populära Inte-nudda-marken-parken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "Grillplats vid Kypesjöns badplats med strandnära läge.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön grillstuga",
          location: "Kypesjön, Borås",
          description: "Grillstuga vid Kypesjön med möjlighet att grilla i skydd.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön pulkabacken",
          location: "Kypesjön, Borås",
          description: "Grillplats vid Kypesjöns pulkabacke med vinteraktiviteter.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Horsatorpet",
          location: "Kypeskogen, Borås",
          description: "Grillplats i Kypeskogen vid det historiska Horsatorpet.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Klämmabäcken",
          location: "Kypeskogen, Borås",
          description: "Grillplats i Kypeskogen vid Klämmabäcken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Rävsrydsberget Tosseryd",
          location: "Rävsrydsberget, Tosseryd",
          description: "Grillplats vid Rävsrydsberget i Tosseryd med fin utsikt.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "Vindskydd i Björkängsskogen vid Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "Vindskydd vid Kypesjöns badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Kypesjöns badplats",
          location: "Kypesjön, Kypegården, Borås",
          description: "Kypesjöns badplats vid Kypegården med brygga, sandstrand och omklädningsrum.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "kransmossen",
    name: "Kransmossen",
    location: "Södra Borås",
    description: "Kransmossen är ett stort friluftsområde i södra Borås med varierad natur. Området har många grillplatser, vindskydd och möjligheter till fiske och naturupplevelser.",
    image: { uri: "https://stigvidd.se/files/trails/area-kransmossen.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Fältspatsgruvan",
          location: "Kransmossen, Borås",
          description: "Grillplats vid den gamla fältspatsgruvan i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Grillstugan",
          location: "Kransmossen, Borås",
          description: "Grillstuga i Kransmossen med möjlighet att grilla i skyddad miljö.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Gånghester Lilla Häljasjö",
          location: "Gånghester, Borås",
          description: "Grillplats vid Lilla Häljasjö i Gånghester.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Gånghester Sjölid/Mulleängen",
          location: "Gånghester, Borås",
          description: "Grillplats vid Sjölid och Mulleängen i Gånghester.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Himlabacken i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Kärleksängen",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Kärleksängen i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "MTB-höjden",
          location: "Kransmossen, Borås",
          description: "Grillplats vid MTB-höjden i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Slättholmen",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Slättholmen i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Äppelängen",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Äppelängen i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Gånghester Sjölid/Mulleängen",
          location: "Gånghester, Borås",
          description: "Vindskydd vid Sjölid och Mulleängen i Gånghester.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "Vindskydd vid Himlabacken i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Lillån – Kransån fiskevårdsområde",
          location: "Kransmossen, Borås",
          description: "Lillån–Kransån fiskevårdsområde med fiske i naturliga vattendrag i Kransmossen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "almenas",
    name: "Almenäs",
    location: "Norr om Borås, vid Öresjön",
    description: "Almenäs ligger vid Öresjöns södra strand och erbjuder fina badplatser, grillplatser och fiskemöjligheter. Området är ett välbesökt utflyktsmål för boråsarna.",
    image: { uri: "https://stigvidd.se/files/trails/area-almenas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Almenäs beachvolleybollplanen",
          location: "Almenäs, Borås",
          description: "Grillplats vid beachvolleybollplanen i Almenäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs lilla stranden",
          location: "Almenäs, Borås",
          description: "Grillplats vid lilla stranden i Almenäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Sjöbobron",
          location: "Sjöbobron, Borås",
          description: "Grillplats vid Sjöbobron i Almenäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Udden I",
          location: "Almenäsudden, Borås",
          description: "Grillplats vid Almenäsudden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo Rydastrand",
          location: "Sjöbo, Borås",
          description: "Grillplats vid Sjöbo Rydastrand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbovallen",
          location: "Sjöbovallen, Borås",
          description: "Grillplats vid Sjöbovallen i Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, norr om Borås",
          description: "Öresjö fiskevårdsområde vid den stora sjön Öresjön norr om Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Almenäs badplats",
          location: "Öresjöns södra strand, Borås",
          description: "Almenäs badplats vid Öresjöns södra strand med brygga och sandstrand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo badplats",
          location: "Öresjöns sydöstra strand, Borås",
          description: "Sjöbo badplats vid Öresjöns sydöstra strand med goda badmöjligheter.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Almenäs, Borås",
          description: "Rya åsar naturreservat i anslutning till Almenäsområdet.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
    },
  },
  {
    identifier: "aplared",
    name: "Aplared",
    location: "Öster om Borås",
    description: "Aplared är en ort öster om Borås med naturmarker och fiskemöjligheter. Ekbacken erbjuder grillplats och vindskydd i natursköna omgivningar.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Aplared Ekbacken",
          location: "Söder om fotbollsplanen, Aplared",
          description: "Grillplats vid Ekbacken söder om fotbollsplanen i Aplared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Aplared Ekbacken vindskydd",
          location: "Söder om fotbollsplanen, Aplared",
          description: "Vindskydd vid Aplared Ekbacken söder om fotbollsplanen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Såken fiskevårdsområde",
          location: "Öster om Borås, vid Aplared",
          description: "Såken fiskevårdsområde öster om Borås vid Aplared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Skansasjön badplats",
          location: "Ca 1,5 km nordväst om Aplared",
          description: "Skansasjöns badplats ca 1,5 km nordväst om Aplared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Lindåsabäckens naturreservat",
          location: "Svenljungavägen (väg 1698), Aplared",
          description: "Lindåsabäckens naturreservat längs Svenljungavägen vid Aplared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
    },
  },
  {
    identifier: "borgstena",
    name: "Borgstena",
    location: "Norr om Borås, vid Fristad",
    description: "Borgstena är en liten ort norr om Borås med sjöar och naturmarker. Området erbjuder fiskemöjligheter i Mollasjön och Myresjö.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/borgstena.4.73feea1318de86063208414c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Mollasjön fiskevårdsområde",
          location: "Norr om Borås och Fristad, vid Borgstena",
          description: "Mollasjön fiskevårdsområde norr om Borås och Fristad vid Borgstena.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/borgstena.4.73feea1318de86063208414c.html",
        },
        {
          name: "Myresjö fiskevårdsområde",
          location: "Norr om Borås, utanför Borgstena",
          description: "Myresjö fiskevårdsområde norr om Borås utanför Borgstena.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/borgstena.4.73feea1318de86063208414c.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "boras-centrala",
    name: "Borås, centrala",
    location: "Centrala Borås",
    description: "Borås centrala friluftsområde erbjuder grönska och rekreation mitt i staden. Annelundsparken och A-Ö-skogen ger boråsarna natur nära till hands.",
    image: { uri: "https://stigvidd.se/files/trails/area-annelund.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "A-Ö-skogens grillplats Bodakullen",
          location: "Bodakullen vid Bodavallen, Borås",
          description: "Grillplats vid Bodakullen i A-Ö-skogen vid Bodavallen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
        {
          name: "Annelundsparken",
          location: "Annelundsparken, Borås centrum",
          description: "Grillplats i Annelundsparken i Borås centrum.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Annelundsparken regnskydd",
          location: "Annelundsparken, Borås centrum",
          description: "Regnskydd i Annelundsparken i Borås centrum.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
      ],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "bredared",
    name: "Bredared",
    location: "Norr om Borås",
    description: "Bredared är ett naturskönt område norr om Borås med skog och vattendrag. Området passar för promenader och naturupplevelser.",
    image: { uri: "https://stigvidd.se/files/trails/area-bredared.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/bredared.4.5493346718e560a04fa6cfa9.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "byttorp-kolbranningen",
    name: "Byttorp, Kolbränningen",
    location: "Västra Borås",
    description: "Byttorp och Kolbränningen ligger i västra Borås med badplats vid sjön Kolbränningen och grillplatser i natursköna omgivningar.",
    image: { uri: "https://stigvidd.se/files/trails/area-kolbranningen.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Byttorp badplats",
          location: "Byttorp badplats, Borås",
          description: "Grillplats vid Byttorp badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
        {
          name: "Kolbränningen",
          location: "Vid sjön Kolbränningen, Borås",
          description: "Grillplats vid sjön Kolbränningen i Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Byttorp, Kolbränningen badplats",
          location: "Sjön Kolbränningen, Borås",
          description: "Byttorp, Kolbränningen badplats vid sjön Kolbränningen i Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "dannike",
    name: "Dannike",
    location: "Öster om Borås",
    description: "Dannike är ett område öster om Borås med sjöar, natur och kulturhistoriska miljöer. Rammsjöns badplats och fiskemöjligheter i flera sjöar lockar besökare.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rammsjön grillplats",
          location: "Rammsjöns badplats, Dannike",
          description: "Grillplats vid Rammsjöns badplats i Dannike.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Boanäs fiskevårdsområde",
          location: "Yttre Åsunden och Torpasjön",
          description: "Boanäs fiskevårdsområde med fiske i Yttre Åsunden och Torpasjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Rammsjön fiskevårdsområde",
          location: "Öster om Dannike",
          description: "Rammsjön fiskevårdsområde öster om Dannike.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Torpasjön fiskevårdsområde",
          location: "Vid Torpa stenhus",
          description: "Torpasjön fiskevårdsområde vid Torpa stenhus.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rammsjöns badplats",
          location: "Rammsjön, Dannike",
          description: "Rammsjöns badplats vid Rammsjön i Dannike.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Väg 1706 vid Rölle/Hulten",
          description: "Rölle naturreservat längs väg 1706 vid Rölle och Hulten.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
    },
  },
  {
    identifier: "fristad",
    name: "Fristad",
    location: "Norr om Borås",
    description: "Fristad är en ort norr om Borås med Öresjön och flera sjöar i omgivningen. Området erbjuder badplatser, grillplatser och fiskemöjligheter i en vacker sjömiljö.",
    image: { uri: "https://stigvidd.se/files/trails/area-fristad.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Asklanda badplats (bryggan)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats vid bryggan på Asklanda badplats, västra Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (västra)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats på västra delen av Asklanda badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (östra)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats på östra delen av Asklanda badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats (bryggan)",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "Grillplats vid bryggan på Skalle badplats, söder om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats (udden)",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "Grillplats på udden vid Skalle badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Solviken badplats",
          location: "Sjön Ärtingen, 4 km väster om Fristad",
          description: "Grillplats vid Solviken badplats vid sjön Ärtingen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Säven fiskevårdsområde",
          location: "Norr om Fristad",
          description: "Säven fiskevårdsområde norr om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Varnum & Marsjöarna",
          location: "Öster om Sparsör",
          description: "Varnum och Marsjöarna fiskevårdsområde öster om Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Ärtingen fiskevårdsområde",
          location: "Väster om Fristad",
          description: "Ärtingen fiskevårdsområde väster om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Fristad",
          description: "Öresjö fiskevårdsområde vid Öresjön, Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Asklanda badplats",
          location: "Västra Fristad, Öresjöns strand",
          description: "Asklanda badplats vid Öresjöns västra strand i Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "Skalle badplats vid Öresjöns östra strand söder om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Solviken badplats",
          location: "Sjön Ärtingen, 4 km väster om Fristad",
          description: "Solviken badplats vid sjön Ärtingen, ca 4 km väster om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Mölarps naturreservat",
          location: "Där Viskan möter Öresjö, Fristad",
          description: "Mölarps naturreservat där Viskan möter Öresjö i Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Vänga Mosse naturreservat",
          location: "Fristad",
          description: "Vänga Mosse naturreservat i Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
    },
  },
  {
    identifier: "frufallan",
    name: "Frufällan",
    location: "Norr om Borås, vid Öresjön",
    description: "Frufällan ligger vid Öresjöns östra strand norr om Borås. Området erbjuder badplats, grillplatser och fiskemöjligheter i en vacker sjönära miljö.",
    image: { uri: "https://stigvidd.se/files/trails/area-frufallan.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Frufällans badplats",
          location: "Frufällan, Borås",
          description: "Grillplats vid Frufällans badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Kröklings hage",
          location: "Frufällan, Borås",
          description: "Grillplats vid Kröklings hage i Frufällan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Mölarps ö",
          location: "Frufällan, Borås",
          description: "Grillplats vid Mölarps ö i Frufällan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Vikåsaudden",
          location: "Frufällan, Borås",
          description: "Grillplats vid Vikåsaudden i Frufällan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Frufällan",
          description: "Öresjö fiskevårdsområde vid Öresjön i Frufällan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Frufällans badplats",
          location: "Öresjöns östra strand, Frufällan",
          description: "Frufällans badplats vid Öresjöns östra strand med brygga och badmöjligheter.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "gasslosa",
    name: "Gässlösa",
    location: "Södra Borås",
    description: "Gässlösa är ett område i södra Borås med elljusspår och naturmark. Transåssjön erbjuder badplats och fiskemöjligheter i natursköna omgivningar.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Gässlösa elljusspår",
          location: "Gässlösa, Borås",
          description: "Grillplats vid Gässlösa elljusspår.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Kråkered – Stora Transåssjön",
          location: "Stora Transåssjön, Gässlösa",
          description: "Kråkered–Stora Transåssjön fiskevårdsområde vid Gässlösa.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Transås badplats",
          location: "Stora Transåssjön, Gässlösa",
          description: "Transås badplats vid Stora Transåssjön i Gässlösa.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hedared",
    name: "Hedared",
    location: "Väster om Borås",
    description: "Hedared är känt för sin medeltida stavkyrka och natursköna omgivningar väster om Borås. Östra Valsjön erbjuder bad och grillmöjligheter.",
    image: { uri: "https://stigvidd.se/files/trails/area-hedared.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Östra Valsjön",
          location: "Ca 2 km öster om Hedared",
          description: "Grillplats vid Östra Valsjön ca 2 km öster om Hedared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Östra Valsjöns badplats",
          location: "Ca 2 km öster om Hedared",
          description: "Östra Valsjöns badplats ca 2 km öster om Hedared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hestra",
    name: "Hestra",
    location: "Söder om Borås",
    description: "Hestra är ett friluftsområde söder om Borås med Rya åsar naturreservat i närheten. Hestrastugan och Lomsjön erbjuder grillplatser i skog och natur.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Hestrastugan",
          location: "Ekås, Borås",
          description: "Grillplats vid Hestrastugan i Ekås, Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
        {
          name: "Lomsjön Kypered",
          location: "Ca 1,7 km norr om Hestrastugan",
          description: "Grillplats vid Lomsjön i Kypered, ca 1,7 km norr om Hestrastugan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Hestra, Borås",
          description: "Rya åsar naturreservat i anslutning till Hestra.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
      ],
    },
  },
  {
    identifier: "hofsnas-torpa",
    name: "Hofsnäs och Torpa",
    location: "Öster om Borås",
    description: "Hofsnäs och Torpa är ett populärt friluftsområde öster om Borås vid Torpasjön. Området erbjuder badplats, grillplatser, fiske och det historiska Torpa stenhus.",
    image: { uri: "https://stigvidd.se/files/trails/area-hofsnas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Campingen",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid campingen i Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ekenäs",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Ekenäs i Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Flaxet",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Flaxet i Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Näset",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Näset i Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ångbåtsbryggan",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Ångbåtsbryggan i Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Torpasjön vindskydd",
          location: "Torpasjön, Borås",
          description: "Vindskydd vid Torpasjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Torpasjön fiskevårdsområde",
          location: "Kring Torpanäsets naturreservat",
          description: "Torpasjön fiskevårdsområde kring Torpanäsets naturreservat.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Hofsnäs badplats",
          location: "Östra Torpasjön, Hofsnäs",
          description: "Hofsnäs badplats vid östra Torpasjön med brygga och vackra omgivningar.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Torpanäsets naturreservat",
          location: "Hofsnäs, östra Borås",
          description: "Torpanäsets naturreservat vid Hofsnäs öster om Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
    },
  },
  {
    identifier: "sjomarken",
    name: "Sjömarken",
    location: "Väster om Borås",
    description: "Sjömarken ligger vid Viaredssjön väster om Borås och erbjuder en populär badplats och grillplatser. Området är välbesökt under sommaren.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sjömarkens badplats (bryggan)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats vid bryggan på Sjömarkens badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (stranden)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats vid stranden på Sjömarkens badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (udden)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats vid udden på Sjömarkens badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens idrottsgård",
          location: "Sjömarkens idrottsgård, Borås",
          description: "Grillplats vid Sjömarkens idrottsgård.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared/Sjömarken",
          description: "Viaredssjön fiskevårdsområde vid Viaredssjön i Sandared/Sjömarken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sjömarkens badplats",
          location: "Viaredssjön, Sjömarken",
          description: "Sjömarkens badplats vid Viaredssjön med brygga och sandstrand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "knektas-tosseryd",
    name: "Knektås, Tosseryd",
    location: "Norr om Borås",
    description: "Knektås och Tosseryd ligger norr om Borås med naturmark och friluftsanläggningar. Grillplatsen vid GIF-stugan på Knektås är ett populärt utflyktsmål.",
    image: { uri: "https://stigvidd.se/files/trails/area-knektas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/knektastosseryd.4.5493346718e560a04fa6d1b7.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Knektås GIF-stugan",
          location: "Kullen bakom Borås GIF:s klubbstuga, Knektås",
          description: "Grillplats på kullen bakom Borås GIF:s klubbstuga vid Knektås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/knektastosseryd.4.5493346718e560a04fa6d1b7.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "rydboholm",
    name: "Rydboholm",
    location: "Söder om Borås",
    description: "Rydboholm är ett naturskönt område söder om Borås med Storsjön och Furusjön. Området erbjuder badplats, grillplats och fiske i vacker sjönatur.",
    image: { uri: "https://stigvidd.se/files/trails/area-rydboholm.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Maden Rydboholm",
          location: "Sven Eriksons väg, Rydboholm",
          description: "Grillplats vid Maden i Rydboholm längs Sven Eriksons väg.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Storsjön och Viskan fiskevårdsområde",
          location: "Storsjön, Rydboholm",
          description: "Storsjön och Viskan fiskevårdsområde vid Storsjön i Rydboholm.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Furusjöns badplats",
          location: "Furusjön, Rydboholm",
          description: "Furusjöns badplats vid Furusjön i Rydboholm.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "rangedala",
    name: "Rångedala",
    location: "Öster om Borås",
    description: "Rångedala är ett område öster om Borås med Marsjön och Algutstorp. Området erbjuder badplats, grillplatser och naturupplevelser.",
    image: { uri: "https://stigvidd.se/files/trails/area-rangedala.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Algutstorp Bäckravinen",
          location: "Algutstorp, Rångedala",
          description: "Grillplats vid Bäckravinen i Algutstorp, Rångedala.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Algutstorp Ängen",
          location: "Algutstorp, Rångedala",
          description: "Grillplats vid Ängen i Algutstorp, Rångedala.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "Grillplats vid Marsjöns badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "Marsjöns badplats vid Marsjön i Rångedala.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandared",
    name: "Sandared",
    location: "Väster om Borås",
    description: "Sandared ligger vid Viaredssjön väster om Borås och erbjuder fina badplatser, grillplatser och fiskemöjligheter. Området är omtyckt för friluftsliv vid sjön.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björviksudden",
          location: "Viaredssjön, Sandared",
          description: "Grillplats vid Björviksudden vid Viaredssjön, Sandared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Nordtorp",
          location: "SOK-stugan, Sandared",
          description: "Grillplats vid Nordtorp vid SOK-stugan i Sandared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats väster",
          location: "Sandareds badplats, Sandared",
          description: "Grillplats på västra delen av Sandareds badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats öster",
          location: "Sandareds badplats, Sandared",
          description: "Grillplats på östra delen av Sandareds badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandaredsån Ängen & Åkilen",
          location: "Sandaredsån, Sandared",
          description: "Grillplats vid Sandaredsån vid Ängen och Åkilen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared",
          description: "Viaredssjön fiskevårdsområde vid Viaredssjön i Sandared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rydets badplats",
          location: "Viaredssjön, Sandared",
          description: "Rydets badplats vid Viaredssjön i Sandared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats",
          location: "Viaredssjön, Sandared",
          description: "Sandareds badplats vid Viaredssjön med brygga och sandstrand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandhult",
    name: "Sandhult",
    location: "Väster om Borås",
    description: "Sandhult är en ort väster om Borås med Trummesjön i närheten. Sjön erbjuder bad och rekreation i en lugn naturmiljö.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "Grillplats vid Trummesjöns badplats ca 2,5 km norr om Sandhult.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "Trummesjöns badplats ca 2,5 km norr om Sandhult.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "seglora",
    name: "Seglora",
    location: "Söder om Borås",
    description: "Seglora är ett naturskönt område söder om Borås med sjöar och Viskan. Området erbjuder badplatser, fiske och naturreservat.",
    image: { uri: "https://stigvidd.se/files/trails/area-seglora.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bogryds badplats",
          location: "Bogrydssjön, Seglora",
          description: "Grillplats vid Bogrydssjöns badplats i Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Surtans övre fiskevårdsområde",
          location: "Sjön Hungern, Seglora",
          description: "Surtans övre fiskevårdsområde vid sjön Hungern i Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Bogrydssjön badplats",
          location: "Bogrydssjön, Seglora",
          description: "Bogrydssjön badplats vid Bogrydssjön i Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
        {
          name: "Bua badplats",
          location: "Stora Hålsjön, Seglora",
          description: "Bua badplats vid Stora Hålsjön i Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Tranhults naturreservat",
          location: "Viskans strand, Seglora",
          description: "Tranhults naturreservat längs Viskans strand i Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
    },
  },
  {
    identifier: "sparsor",
    name: "Sparsör",
    location: "Norr om Borås, vid Öresjön",
    description: "Sparsör ligger vid Öresjöns östra strand norr om Borås. Området erbjuder badplats, grillplatser, fiskemöjligheter och naturreservat.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "Grillplats vid Sparsörs badplats vid Öresjöns östra strand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Trollevi",
          location: "Trollevi, Sparsör",
          description: "Grillplats vid Trollevi i Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Trollevi",
          location: "Norr om fotbollsplanerna, Sparsör",
          description: "Vindskydd vid Trollevi norr om fotbollsplanerna i Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Gingri Ön fiskevårdsområde",
          location: "Viskans huvudfåra, Sparsör",
          description: "Gingri Ön fiskevårdsområde i Viskans huvudfåra vid Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Sparsör",
          description: "Öresjö fiskevårdsområde vid Öresjön i Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "Sparsörs badplats vid Öresjöns östra strand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Kröklings hage naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description: "Kröklings hage naturreservat vid Mölarps kvarn i Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Mölarps naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description: "Mölarps naturreservat vid Mölarps kvarn i Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
    },
  },
  {
    identifier: "svaneholm",
    name: "Svaneholm",
    location: "Söder om Borås",
    description: "Svaneholm är ett lugnt område söder om Borås med Sävsjön och naturreservat. Storsjön naturreservat ligger i närheten.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Sävsjön fiskevårdsområde",
          location: "Söder om Borås, vid Svaneholm",
          description: "Sävsjön fiskevårdsområde söder om Borås vid Svaneholm.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Ca 1 mil sydväst om Borås, vid Viskafors",
          description: "Storsjön naturreservat ca 1 mil sydväst om Borås vid Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
    },
  },
  {
    identifier: "viskafors",
    name: "Viskafors",
    location: "Söder om Borås",
    description: "Viskafors är en ort söder om Borås vid Storsjön. Det populära friluftsområdet erbjuder badplats, grillplatser, vindskydd och fiskemöjligheter i en vacker sjömiljö.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "Grillplats vid Storsjögården i Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Klipporna",
          location: "Storsjön, Viskafors",
          description: "Grillplats vid Klipporna vid Storsjön i Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "Grillplats vid Hultaberg vid Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "Vindskydd vid Storsjögården i Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Hultaberg vid Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Kopparhammaren",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Kopparhammaren vid Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Lomsjö",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Lomsjö vid Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Bålån fiskevårdsområde",
          location: "Bålån, Viskafors",
          description: "Bålån fiskevårdsområde i Bålån vid Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Frisjön fiskevårdsområde",
          location: "Sydöst om Viskafors",
          description: "Frisjön fiskevårdsområde sydöst om Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Seglora fiskevårdsområde",
          location: "Viskan, Viskafors",
          description: "Seglora fiskevårdsområde i Viskan vid Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Storsjön & Viskan, Rydboholm",
          location: "Storsjön, Viskafors",
          description: "Storsjön och Viskan, Rydboholm fiskevårdsområde vid Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Storsjöns badplats",
          location: "Storsjön, Viskafors",
          description: "Storsjöns badplats vid Storsjön i Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Viskafors",
          description: "Storsjön naturreservat i Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
    },
  },
  {
    identifier: "ymergarden",
    name: "Ymergården",
    location: "Västra Borås",
    description: "Ymergården är ett friluftsområde i västra Borås med naturmark och promenadmöjligheter.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ymergarden.4.5493346718e560a04fa5d5cd.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [],
    },
  },
];
