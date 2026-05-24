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
    location: "Dalsjöfors, ca 10 km öster om Borås",
    description:
      "Dalsjöfors har ett omväxlande landskap med både skogspartier och öppen jordbruksmark. Intill samhället ligger Dalsjön med badplats och flera vandringsleder i omgivningarna.",
    image: { uri: "https://stigvidd.se/files/trails/area-dalsjofors.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bergagärdesgrillen",
          location: "Banvallen, Dalsjöfors",
          description: "Tillgänglighetsanpassad grillplats längs Banvallen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Slättåsgrillen",
          location: "Slättås, Dalsjöfors",
          description: "Grillplats med vindskydd.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Övrarpsgrillen",
          location: "Övrarp, Dalsjöfors",
          description: "Grillplats i anslutning till vandringslederna vid Övrarp.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Ankedammen",
          location: "Dalsjöfors",
          description: "Fiskeplats vid Ankedammen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Häggån",
          location: "Dalsjöfors",
          description: "Fiske i ån Häggån.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Stora och Lilla Dalsjön",
          location: "Dalsjöfors",
          description: "Fiske i Stora och Lilla Dalsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Ås-Tolken",
          location: "Dalsjöfors",
          description: "Fiske i sjön Ås-Tolken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Dalsjöns badplats",
          location: "Dalsjön, Dalsjöfors",
          description: "Badplats med sandstrand, brygga och klätterutrustning för barn.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Rölle, Dalsjöfors",
          description: "Bokskogsnaturreservat på 8 hektar, bildat 1982. Skyddas för sina höga naturvärden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
    },
  },
  {
    identifier: "rya-asar",
    name: "Rya åsar",
    location: "Väster om Borås centrum, Hestra–Almenäs",
    description:
      "562 hektar kommunalt naturreservat bildat 2001 med klippbranter, ekskogar och stigar för alla nivåer. Kulturlandskapet bär spår av en väg som Carl von Linné vandrade 1746.",
    image: { uri: "https://stigvidd.se/files/trails/area-rya.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "Grillplats vid Fjällsjön i anslutning till Björbostugans startpunkt.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "Grillplats på Högplatån vid Ålgårdens startpunkt.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "Vindskydd vid Fjällsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "Vindskydd på Högplatån.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Ryssbybäcken fiskevårdsområde",
          location: "Rya åsar",
          description: "Delvis inom reservatsgränsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Norr om Borås",
          description: "Fiske i Öresjö. Dricksvattentäkt sedan 1932 — tvåtaktsmotorer förbjudna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Borås",
          description: "562 hektar kommunalt naturreservat bildat 2001 med gammal tallskog, klippbranter och ekskogar.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
    },
  },
  {
    identifier: "kype",
    name: "Kype",
    location: "Norra Borås, vid Kypesjön",
    description:
      "Kype är ett friluftsområde i norra Borås med vandringsleder, motionsslingor, bad och fiske. Kypegårdens friluftsgård erbjuder dusch, vedeldad bastu och café.",
    image: { uri: "https://stigvidd.se/files/trails/area-kype.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "Grillplats med vindskydd i Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypegården Inte-nudda-marken-parken",
          location: "Kypegården, Borås",
          description: "Grillplats vid Inte-nudda-marken-parken på Kypegården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "Grillplats med vindskydd vid badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön grillstuga",
          location: "Kypesjön, Borås",
          description: "Tillgänglighetsanpassad grillstuga vid Kypesjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön pulkabacken",
          location: "Kypesjön, Borås",
          description: "Grillplats vid pulkabacken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Horsatorpet",
          location: "Kypeskogen, Borås",
          description: "Grillplats vid Horsatorpet i Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Klämmabäcken",
          location: "Kypeskogen, Borås",
          description: "Grillplats vid Klämmabäcken i Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Rävsrydsberget Tosseryd",
          location: "Rävsrydsberget, Tosseryd",
          description: "Grillplats på Rävsrydsberget vid Tosseryd.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "Vindskydd i Kypeskogen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "Vindskydd vid badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Kypesjöns badplats",
          location: "Kypesjön, Kypegården, Borås",
          description: "Kommunal badplats med sandstrand och stor brygga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "kransmossen",
    name: "Kransmossen",
    location: "Östra Borås, mot Gånghester",
    description:
      "Kransmossen är ett stort idrotts- och friluftsområde med utegym, multisportarena, basketplan, hinderbana, boulebana och lekplats. Vintertid finns pulkabacke och belysta skidspår. Friluftsgård med dusch och bastu.",
    image: { uri: "https://stigvidd.se/files/trails/area-kransmossen.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Fältspatsgruvan",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Fältspatsgruvan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Grillstugan",
          location: "Kransmossen, Borås",
          description: "Grillstuga i Kransmosseområdet.",
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
          description: "Grillplats med vindskydd vid Sjölid/Mulleängen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "Grillplats med vindskydd vid pulkabacken Himlabacken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Kärleksängen",
          location: "Kransmossen, Borås",
          description: "Tillgänglighetsanpassad grillplats vid Kärleksängen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "MTB-höjden",
          location: "Kransmossen, Borås",
          description: "Grillplats vid MTB-höjden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Slättholmen",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Slättholmen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Äppelängen",
          location: "Kransmossen, Borås",
          description: "Grillplats vid Äppelängen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Gånghester Sjölid/Mulleängen",
          location: "Gånghester, Borås",
          description: "Vindskydd vid Sjölid/Mulleängen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "Vindskydd vid pulkabacken.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Lillån – Kransån fiskevårdsområde",
          location: "Kransmossen, Borås",
          description: "Fiske i Lillån och Kransån vid Kransmosseområdet.",
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
    location: "Öresjöns södra strand, nära Borås centrum",
    description:
      "Almenäs ligger vid Öresjöns södra strand och är hem till Borås största och mest populära kommunala badplats med sandstrand, brygga och badramp. Området sträcker sig även till Sjöbo vid Viskans strand med grönområden, leder och grillplatser. Elstängsel finns vid badplatsen för att hålla vildsvin borta.",
    image: { uri: "https://stigvidd.se/files/trails/area-almenas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Almenäs beachvolleybollplanen",
          location: "Almenäs, Borås",
          description: "Grillplats intill beachvolleybollplanen vid stranden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs lilla stranden",
          location: "Almenäs, Borås",
          description: "Tillgänglighetsanpassad grillplats med hårdgjord grusväg från parkeringen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Sjöbobron",
          location: "Sjöbobron, Borås",
          description: "Grillplats nära bron mellan Almenäs och Sjöbo.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Udden I",
          location: "Almenäsudden, Borås",
          description: "Grillplats på Almenäsudden öster om stranden bland gamla tallar.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo Rydastrand",
          location: "Sjöbo, Borås",
          description: "Grillplats på Viskans västra sida vid Sjöbo.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbovallen",
          location: "Sjöbovallen, Borås",
          description: "Grillplats vid Viskan intill idrottsanläggningen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, norr om Borås",
          description:
            "Fiske efter gädda, abborre och gös. Öresjö är dricksvattentäkt för Borås sedan 1932 — tvåtaktsmotorer är förbjudna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Almenäs badplats",
          location: "Öresjöns södra strand, Borås",
          description: "Kommunens största och mest populära badplats med sandstrand, brygga och badramp.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo badplats",
          location: "Öresjöns sydöstra strand, Borås",
          description: "Kommunal badplats med stora gräsytor och liten sandstrand.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Almenäs, Borås",
          description: "Kommunalt naturreservat bildat 2001, 562 hektar. Gammal tallskog med markerade vandringsleder.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
    },
  },
  {
    identifier: "aplared",
    name: "Aplared",
    location: "Ca 15 km sydost om Borås",
    description:
      "Aplared är en by i ett småkuperat landskap med skog och jordbruksmarker. Intill byn finns Skansasjön med badplats och Lindåsabäcken naturreservat som skyddar flodpärlmusslan.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Aplared Ekbacken",
          location: "Söder om fotbollsplanen, Aplared",
          description: "Grillplats i Aplaredsskolans skog, nås via lederna från idrottsplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Aplared Ekbacken vindskydd",
          location: "Söder om fotbollsplanen, Aplared",
          description: "Vindskydd i anslutning till grillplatsen, nås via lederna från idrottsplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Såken fiskevårdsområde",
          location: "Öster om Borås, vid Aplared",
          description: "Fiskevårdsområde öster om Borås nära Aplared.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Skansasjön badplats",
          location: "Ca 1,5 km nordväst om Aplared",
          description: "Badplats med brygga och gräsyta vid Skansasjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Lindåsabäckens naturreservat",
          location: "Svenljungavägen (väg 1698), Aplared",
          description: "9 hektar skyddat område bildat 2008 för att bevara flodpärlmusslan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
    },
  },
  {
    identifier: "borgstena",
    name: "Borgstena",
    location: "Nordligaste Borås kommun, norr om Fristad",
    description:
      "Borgstena ligger i kommunens nordligaste del med ett varierat landskap dominerat av ek- och bokskogar med historiska rötter från medeltid till modern tid.",
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
          description: "Fiskevårdsområde norr om Fristad nära Borgstena.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/borgstena.4.73feea1318de86063208414c.html",
        },
        {
          name: "Myresjö fiskevårdsområde",
          location: "Norr om Borås, utanför Borgstena",
          description: "Fiskevårdsområde strax utanför Borgstena.",
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
    location: "Borås centrum",
    description:
      "Centrala Borås är en levande stadskärna där kultur och natur möts. Tre huvudparker — Ramnaparken, Stadsparken och Annelundsparken — erbjuder vattennära promenader och rekreation mitt i staden.",
    image: { uri: "https://stigvidd.se/files/trails/area-annelund.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "A-Ö-skogens grillplats Bodakullen",
          location: "Bodakullen vid Bodavallen, Borås",
          description: "Grillplats längs elljusspåret, tillgänglig med barnvagn från västra sidan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
        {
          name: "Annelundsparken",
          location: "Annelundsparken, Borås centrum",
          description: "Grillplats med regnskydd och ved, intill en stor lekplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Annelundsparken regnskydd",
          location: "Annelundsparken, Borås centrum",
          description: "Regnskydd i anslutning till grillplatsen vid stora lekplatsen.",
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
    location: "Ca 6 km väster om Fristad, norra Borås kommun",
    description:
      "Bredared har flera vandringsleder i varierande natur. Från Klockaregården utgår fem markerade leder genom barrskogslandskap med vyer över Hjortsbergsdalen och sjön Veksjön.",
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
    location: "Centrala Borås, vid sjön Kolbränningen",
    description:
      "Vid sjön Kolbränningen finns ett naturskönt område med kommunal badplats med sandstrand, gräsmatta och brygga. Vackra skogsstigar och promenadstråk löper genom omgivande bostadsområden.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Byttorp badplats",
          location: "Byttorp badplats, Borås",
          description: "Grillplats intill badplatsen längs Hestraskogsleden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
        {
          name: "Kolbränningen",
          location: "Vid sjön Kolbränningen, Borås",
          description: "Grillplats med bänkar vid sjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Byttorp, Kolbränningen badplats",
          location: "Sjön Kolbränningen, Borås",
          description: "Kommunal badplats med sandstrand, gräsmatta, brygga och badflotte.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "dannike",
    name: "Dannike",
    location: "Ca 20 km öster om Borås",
    description:
      "Dannike ligger i ett småkuperat landskap med skog och jordbruksmarker. Rammsjön erbjuder en populär badplats med sandstrand och hopptorn, och i närheten finns Rölle naturreservat med lövskog och ängar.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rammsjön grillplats",
          location: "Rammsjöns badplats, Dannike",
          description: "Grillplats vid badplatsen, ej tillgänglighetsanpassad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Boanäs fiskevårdsområde",
          location: "Yttre Åsunden och Torpasjön",
          description: "Fiske i Yttre Åsunden och Torpasjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Rammsjön fiskevårdsområde",
          location: "Öster om Dannike",
          description: "Fiske i Rammsjön öster om Dannike.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Torpasjön fiskevårdsområde",
          location: "Vid Torpa stenhus",
          description: "Fiske i Torpasjön nära Torpa stenhus.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rammsjöns badplats",
          location: "Rammsjön, Dannike",
          description: "Badplats med sandstrand, två bryggor, hopptorn och gräsytor.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Väg 1706 vid Rölle/Hulten",
          description: "Statligt naturreservat bildat 1982, 8 hektar lövskog och ängar med värdefull flora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
    },
  },
  {
    identifier: "fristad",
    name: "Fristad",
    location: "Öresjöns norra strand, norra Borås kommun",
    description:
      "Fristad ligger vid Öresjöns norra strand med varierad geografi från bördig jordbruksmark till skogbeklädda höjder. Tre badplatser, sex grillplatser och två naturreservat gör Fristad till ett av kommunens rikaste friluftsområden.",
    image: { uri: "https://stigvidd.se/files/trails/area-fristad.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Asklanda badplats (bryggan)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats vid bryggan på Asklanda badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (västra)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats på västra sidan av Asklanda badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (östra)",
          location: "Asklanda, västra Fristad",
          description: "Grillplats på östra sidan av Asklanda badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats (bryggan)",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "Grillplats vid bryggan på Skalle badplats.",
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
          description: "Grillplats vid Solviken badplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Säven fiskevårdsområde",
          location: "Norr om Fristad",
          description: "Fiske i Säven norr om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Varnum & Marsjöarna",
          location: "Öster om Sparsör",
          description: "Fiske i Varnum och Marsjöarna öster om Sparsör.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Ärtingen fiskevårdsområde",
          location: "Väster om Fristad",
          description: "Fiske i sjön Ärtingen väster om Fristad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Fristad",
          description: "Fiske i Öresjö. Dricksvattentäkt sedan 1932 — tvåtaktsmotorer förbjudna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Asklanda badplats",
          location: "Västra Fristad, Öresjöns strand",
          description: "Sandstrand med volleybollnät, klätternät och grillplatser.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "Lång och vacker sandstrand med brygga och fågeltorn.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Solviken badplats",
          location: "Sjön Ärtingen, 4 km väster om Fristad",
          description: "Sandstrand med brygga och badflotte vid sjön Ärtingen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Mölarps naturreservat",
          location: "Där Viskan möter Öresjö, Fristad",
          description: "66 hektar, bildat 1990. Känt fågelskådningsområde vid Viskans mynning i Öresjö.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Vänga Mosse naturreservat",
          location: "Fristad",
          description: "238 hektar, bildat 2010. Spänger och fågeltorn gör myren tillgänglig.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
    },
  },
  {
    identifier: "frufallan",
    name: "Frufällan",
    location: "Öster om Öresjö, norr om Borås",
    description:
      "Runt Frufällan finns en blandning av skog och öppna landskap vid Öresjöns östra strand. Badplats med brygga och sandstrand, fyra grillplatser och fiske i Öresjö.",
    image: { uri: "https://stigvidd.se/files/trails/area-frufallan.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Frufällans badplats",
          location: "Frufällan, Borås",
          description: "Grillplats vid badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Kröklings hage",
          location: "Frufällan, Borås",
          description: "Grillplats vid Kröklings hage.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Mölarps ö",
          location: "Frufällan, Borås",
          description: "Grillplats på Mölarps ö.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Vikåsaudden",
          location: "Frufällan, Borås",
          description: "Grillplats på Vikåsaudden med bänkar och grusvägar.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Frufällan",
          description: "Fiske i Öresjö. Dricksvattentäkt sedan 1932 — tvåtaktsmotorer förbjudna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Frufällans badplats",
          location: "Öresjöns östra strand, Frufällan",
          description: "Badplats med brygga, sandstrand och gräsyta.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "gasslosa",
    name: "Gässlösa",
    location: "Söder om Borås centrum",
    description:
      "Gässlösa är ett naturskönt friluftsområde söder om Borås med skogssjöar och ädellövskog. Förutom vandringsleder och elljusspår finns en populär badplats vid Stora Transåssjön och fiske med regnbåge.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Gässlösa elljusspår",
          location: "Gässlösa, Borås",
          description: "Grillplats längs elljusspåret med utsikt över Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Kråkered – Stora Transåssjön",
          location: "Stora Transåssjön, Gässlösa",
          description: "Fiske med utsättning av regnbåge. Sex uthyrningsbåtar finns tillgängliga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Transås badplats",
          location: "Stora Transåssjön, Gässlösa",
          description: "Badplats med sandstrand, gräsyta och omklädningsrum.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hedared",
    name: "Hedared",
    location: "Ca 20 km nordväst om Borås",
    description:
      "Hedared omges av skogar och jordbruksmark med flera små sjöar. Sex vandringsleder startar vid Hedareds stavkyrka — en av de äldsta bevarade träkyrkorna i Skandinavien. Badplats med sandstrand vid Östra Valsjön.",
    image: { uri: "https://stigvidd.se/files/trails/area-hedared.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Östra Valsjön",
          location: "Ca 2 km öster om Hedared",
          description: "Grillplats vid badplatsen på Östra Valsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Östra Valsjöns badplats",
          location: "Ca 2 km öster om Hedared",
          description: "Badplats med gräsytor, sandstrand och brygga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hestra",
    name: "Hestra",
    location: "Södra Borås, Hestra/Ekås",
    description:
      "Hestra erbjuder flera motionsslingor och vandringsleder i varierande längd genom skogslandskapet. Hestrastugan på Ekås är bas för sju leder, och Rya åsar naturreservat gränsar till området.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Hestrastugan",
          location: "Ekås, Borås",
          description: "Grillplats bakom stugan, ej tillgänglighetsanpassad.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
        {
          name: "Lomsjön Kypered",
          location: "Ca 1,7 km norr om Hestrastugan",
          description: "Grillplats vid Lomsjön.",
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
          description: "562 hektar kommunalt naturreservat bildat 2001 med gammal tallskog och markerade leder.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
      ],
    },
  },
  {
    identifier: "hofsnas-torpa",
    name: "Hofsnäs och Torpa",
    location: "Östra Borås, vid Yttre Åsunden och Torpasjön",
    description:
      "Idylliska platser vid Yttre Åsunden och Torpasjön med rik historisk miljö. Hofsnäs herrgård och Torpa stenhus — ett välbevarat renässansslott från 1500-talet — ger området en unik karaktär. Elva grillplatser och en badplats gör det till ett omtyckt utflyktsmål.",
    image: { uri: "https://stigvidd.se/files/trails/area-hofsnas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Campingen",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid campingplatsen vid Hofsnäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ekenäs",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Ekenäs.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Flaxet",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Flaxet.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Näset",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid Näset.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ångbåtsbryggan",
          location: "Hofsnäs, Borås",
          description: "Grillplats vid den gamla ångbåtsbryggan.",
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
          description: "Fiske i Torpasjöns vatten runt Torpanäsets naturreservat vid Torpa stenhus.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Hofsnäs badplats",
          location: "Östra Torpasjön, Hofsnäs",
          description: "Badplats med strand, brygga, gräsytor, två grillplatser och vindskydd.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Torpanäsets naturreservat",
          location: "Hofsnäs, östra Borås",
          description:
            "Statligt naturreservat, 159 hektar, bildat 2002. Leder genom betesmark, skog och strandmiljöer med rikt fågelliv.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
    },
  },
  {
    identifier: "sjomarken",
    name: "Sjömarken",
    location: "Ca 7 km väster om Borås",
    description:
      "Sjömarken ligger vid Viaredssjön med omväxlande landskap av skog och öppna fält. Badplats med sandstrand och lång brygga, fyra grillplatser och fiske.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sjömarkens badplats (bryggan)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats vid bryggan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (stranden)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats vid stranden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (udden)",
          location: "Sjömarkens badplats, Borås",
          description: "Grillplats på udden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens idrottsgård",
          location: "Sjömarkens idrottsgård, Borås",
          description: "Grillplats vid idrottsgården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared/Sjömarken",
          description: "Fiske i Viaredssjön nära Sandared och Hultafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sjömarkens badplats",
          location: "Viaredssjön, Sjömarken",
          description: "Sandstrand, stor gräsmatta och lång brygga. Två lekplatser och klätternät.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "knektas-tosseryd",
    name: "Knektås, Tosseryd",
    location: "Tosseryd, norra Borås",
    description:
      "Knektås är sommarhalvåret en arena för mountainbike och vintertid kan man åka skidor här. Sex MTB-leder och en 1 100 meter lång rullskidspår sköts av Borås GIF.",
    image: { uri: "https://stigvidd.se/files/trails/area-knektas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/knektastosseryd.4.5493346718e560a04fa6d1b7.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Knektås GIF-stugan",
          location: "Kullen bakom Borås GIF:s klubbstuga, Knektås",
          description: "Grillplats på kullen bakom klubbstugan, parkering ca 50 m bort.",
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
    location: "Ca 8 km söder om Borås",
    description:
      "Rydboholm ligger i Viskan-dalen vid Storsjön med ett vackert landskap av skog och jordbruksmark. Sju vandringsleder, badplats vid Furusjön och fiske i Storsjön.",
    image: { uri: "https://stigvidd.se/files/trails/area-rydboholm.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Maden Rydboholm",
          location: "Sven Eriksons väg, Rydboholm",
          description: "Grillplats vid vattnet.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Storsjön och Viskan fiskevårdsområde",
          location: "Storsjön, Rydboholm",
          description: "Fiske i Storsjön och Viskan. Gratis bålramp tillgänglig.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Furusjöns badplats",
          location: "Furusjön, Rydboholm",
          description: "Mysig skogssjö med liten sandstrand och lugnt badvatten.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "rangedala",
    name: "Rångedala",
    location: "Ca 15 km nordöst om Borås",
    description:
      "Rångedala har ett varierat landskap med skog och jordbruksmark. Sju vandringsleder startar från Rångedala Hembygdsgård i Algutstorp, och Marsjöns badplats erbjuder sandstrand och brygga.",
    image: { uri: "https://stigvidd.se/files/trails/area-rangedala.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Algutstorp Bäckravinen",
          location: "Algutstorp, Rångedala",
          description: "Grillplats vid bäckravinen nära hembygdsgården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Algutstorp Ängen",
          location: "Algutstorp, Rångedala",
          description: "Grillplats på ängen vid hembygdsgården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "Grillplats vid badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "Liten sandstrand med brygga och stor gräsmatta.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandared",
    name: "Sandared",
    location: "Ca 10 km väster om Borås",
    description:
      "Sandareds landskap präglas av skog och öppna ytor nära Viaredssjön. Två badplatser med sandstrand, fem grillplatser och nio markerade leder inklusive Sjuhäradsleden.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björviksudden",
          location: "Viaredssjön, Sandared",
          description: "Grillplats på Björviksudden.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Nordtorp",
          location: "SOK-stugan, Sandared",
          description: "Grillplats vid SOK-stugan i Nordtorp.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats väster",
          location: "Sandareds badplats, Sandared",
          description: "Grillplats på västra sidan av badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats öster",
          location: "Sandareds badplats, Sandared",
          description: "Grillplats på östra sidan av badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandaredsån Ängen & Åkilen",
          location: "Sandaredsån, Sandared",
          description: "Grillplats vid ån på Ängen och Åkilen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared",
          description: "Fiske i Viaredssjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rydets badplats",
          location: "Viaredssjön, Sandared",
          description: "Stor sandstrand vid Viaredssjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats",
          location: "Viaredssjön, Sandared",
          description: "Generös sandstrand med brygga och hopptorn.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandhult",
    name: "Sandhult",
    location: "Ca 10 km nordväst om Borås",
    description:
      "Sandhult har ett naturskönt landskap med skog och öppna jordbruksmarker nära Trummesjön och Madsjön. Fyra markerade vandringsleder och en badplats med liten sandstrand.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "Grillplats vid badplatsen med bänkar och bord.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "Liten sandstrand med brygga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "seglora",
    name: "Seglora",
    location: "Ca 20 km sydväst om Borås",
    description:
      "Seglora har ett varierat landskap med skog och jordbruksmark vid Viskan. Tranhults naturreservat skyddar en bokskogsklädd bergssida längs Viskans strand.",
    image: { uri: "https://stigvidd.se/files/trails/area-seglora.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bogryds badplats",
          location: "Bogrydssjön, Seglora",
          description: "Grillplats vid badplatsen.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Surtans övre fiskevårdsområde",
          location: "Sjön Hungern, Seglora",
          description: "Sjön Hungern är det primära fiskevatnet i området.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Bogrydssjön badplats",
          location: "Bogrydssjön, Seglora",
          description: "Sandstrand med grillplats.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
        {
          name: "Bua badplats",
          location: "Stora Hålsjön, Seglora",
          description: "Badplats vid Stora Hålsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Tranhults naturreservat",
          location: "Viskans strand, Seglora",
          description: "Statligt naturreservat, 3 hektar, bildat 1984. Bokskogsklädd bergssida längs Viskan.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
    },
  },
  {
    identifier: "sparsor",
    name: "Sparsör",
    location: "Vid Öresjö, norra Borås",
    description:
      "Sparsör ligger vid Öresjö med relativt kuperad terräng. Två naturreservat — Kröklings hage och Mölarp — finns i området, liksom kommunal badplats och vindskydd vid Trollevi.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "Grillplats vid kommunal badplats med lång brygga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Trollevi",
          location: "Trollevi, Sparsör",
          description: "Grillplats vid Trollevi idrottsanläggning.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Trollevi",
          location: "Norr om fotbollsplanerna, Sparsör",
          description: "Vindskydd norr om fotbollsplanerna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Gingri Ön fiskevårdsområde",
          location: "Viskans huvudfåra, Sparsör",
          description: "Fiske i Viskans huvudfåra vid Gingri Ön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Sparsör",
          description: "Fiske i Öresjö. Dricksvattentäkt sedan 1932 — tvåtaktsmotorer förbjudna.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "Kommunal badplats med lång brygga.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Kröklings hage naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description: "Statligt naturreservat, 14 hektar, bildat 1962. Ängsmark och ädellövskog.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Mölarps naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description:
            "Statligt naturreservat, 66 hektar, bildat 1990. Där Viskan möter Öresjö — känt fågelskådningsområde.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
    },
  },
  {
    identifier: "svaneholm",
    name: "Svaneholm",
    location: "Ca 15 km söder om Borås",
    description:
      "Svaneholm omges av ett vackert naturlandskap med skog och jordbruksmark vid Storsjön och Viskan. Storsjön naturreservat på 460 hektar ger en känsla av vildmark nära staden.",
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
          description: "Delvis i Marks kommun. Fiske söder om Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Ca 1 mil sydväst om Borås, vid Viskafors",
          description:
            "460 hektar kommunalt naturreservat bildat 2014 med vildmarkskänsla och populärt rekreationsområde.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
    },
  },
  {
    identifier: "viskafors",
    name: "Viskafors",
    location: "Ca 12 km sydväst om Borås",
    description:
      "Viskafors har ett varierat landskap vid Viskan och Storsjön. 12 grillplatser, 4 vindskydd, badplats med sandstrand och Storsjön naturreservat gör det till kommunens sydligaste friluftspärla.",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "Grillplats vid Storsjögården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Klipporna",
          location: "Storsjön, Viskafors",
          description: "Grillplats vid klipporna längs Storsjön.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "Grillplats med vindskydd vid Hultaberg.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "Vindskydd vid Storsjögården.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Hultaberg.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Kopparhammaren",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Kopparhammaren.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Lomsjö",
          location: "Storsjön, Viskafors",
          description: "Vindskydd vid Lomsjö.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Bålån fiskevårdsområde",
          location: "Bålån, Viskafors",
          description: "3 km lång å med lugnt flöde.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Frisjön fiskevårdsområde",
          location: "Sydöst om Viskafors",
          description: "Fiske i Frisjön sydöst om Viskafors.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Seglora fiskevårdsområde",
          location: "Viskan, Viskafors",
          description: "Fiske i Viskan vid Seglora.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Storsjön & Viskan, Rydboholm",
          location: "Storsjön, Viskafors",
          description: "Fiske i Storsjön och Viskan. Gratis bålramp tillgänglig.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Storsjöns badplats",
          location: "Storsjön, Viskafors",
          description: "Sandstrand, gräsytor, brygga och grillplatser.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Viskafors",
          description: "460 hektar kommunalt naturreservat bildat 2014. Ger en känsla av vildmark nära Borås.",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
    },
  },
  {
    identifier: "ymergarden",
    name: "Ymergården",
    location: "Södra Borås, vid Borås skidstadion",
    description:
      "Ymergården är ett aktivitetsområde med utegym, boulebana, beachvolleyboll och en 27-håls disc golf-bana. Fyra vandringsleder och en rullskidsbana nära Borås skidstadion.",
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
