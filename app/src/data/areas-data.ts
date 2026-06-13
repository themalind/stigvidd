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
    location: "areas.dalsjofors.location",
    description: "areas.dalsjofors.description",
    image: { uri: "https://stigvidd.se/files/trails/area-dalsjofors.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bergagärdesgrillen",
          location: "Banvallen, Dalsjöfors",
          description: "areas.dalsjofors.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Slättåsgrillen",
          location: "Slättås, Dalsjöfors",
          description: "areas.dalsjofors.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Övrarpsgrillen",
          location: "Övrarp, Dalsjöfors",
          description: "areas.dalsjofors.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Ankedammen",
          location: "Dalsjöfors",
          description: "areas.dalsjofors.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Häggån",
          location: "Dalsjöfors",
          description: "areas.dalsjofors.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Stora och Lilla Dalsjön",
          location: "Dalsjöfors",
          description: "areas.dalsjofors.fishing.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
        {
          name: "Ås-Tolken",
          location: "Dalsjöfors",
          description: "areas.dalsjofors.fishing.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Dalsjöns badplats",
          location: "Dalsjön, Dalsjöfors",
          description: "areas.dalsjofors.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Rölle, Dalsjöfors",
          description: "areas.dalsjofors.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dalsjofors.4.73feea1318de86063206c0bc.html",
        },
      ],
    },
  },
  {
    identifier: "rya-asar",
    name: "Rya åsar",
    location: "areas.ryaAsar.location",
    description: "areas.ryaAsar.description",
    image: { uri: "https://stigvidd.se/files/trails/area-rya.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "areas.ryaAsar.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "areas.ryaAsar.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Rya åsar Fjällsjön",
          location: "Björbostugan, Rya åsar",
          description: "areas.ryaAsar.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Rya åsar Högplatån",
          location: "Ålgården, Rya åsar",
          description: "areas.ryaAsar.shelter.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Ryssbybäcken fiskevårdsområde",
          location: "Rya åsar",
          description: "areas.ryaAsar.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Norr om Borås",
          description: "areas.ryaAsar.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Borås",
          description: "areas.ryaAsar.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/ryaasar.4.1601545718c38a990ab44a4c.html",
        },
      ],
    },
  },
  {
    identifier: "kype",
    name: "Kype",
    location: "areas.kype.location",
    description: "areas.kype.description",
    image: { uri: "https://stigvidd.se/files/trails/area-kype.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "areas.kype.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypegården Inte-nudda-marken-parken",
          location: "Kypegården, Borås",
          description: "areas.kype.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "areas.kype.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön grillstuga",
          location: "Kypesjön, Borås",
          description: "areas.kype.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön pulkabacken",
          location: "Kypesjön, Borås",
          description: "areas.kype.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Horsatorpet",
          location: "Kypeskogen, Borås",
          description: "areas.kype.firepit.5",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypeskogen Klämmabäcken",
          location: "Kypeskogen, Borås",
          description: "areas.kype.firepit.6",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Rävsrydsberget Tosseryd",
          location: "Rävsrydsberget, Tosseryd",
          description: "areas.kype.firepit.7",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Björkängsskogen Kypeskogen",
          location: "Kypeskogen, Borås",
          description: "areas.kype.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
        {
          name: "Kypesjön badplatsen",
          location: "Kypesjön, Borås",
          description: "areas.kype.shelter.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Kypesjöns badplats",
          location: "Kypesjön, Kypegården, Borås",
          description: "areas.kype.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kype.4.73feea1318de86063206bb14.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "kransmossen",
    name: "Kransmossen",
    location: "areas.kransmossen.location",
    description: "areas.kransmossen.description",
    image: { uri: "https://stigvidd.se/files/trails/area-kransmossen.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Fältspatsgruvan",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Grillstugan",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Gånghester Lilla Häljasjö",
          location: "Gånghester, Borås",
          description: "areas.kransmossen.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Gånghester Sjölid/Mulleängen",
          location: "Gånghester, Borås",
          description: "areas.kransmossen.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Kärleksängen",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.5",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "MTB-höjden",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.6",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Slättholmen",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.7",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Äppelängen",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.firepit.8",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Gånghester Sjölid/Mulleängen",
          location: "Gånghester, Borås",
          description: "areas.kransmossen.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
        {
          name: "Himlabacken",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.shelter.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/kransmossen.4.73feea1318de86063206bc07.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Lillån – Kransån fiskevårdsområde",
          location: "Kransmossen, Borås",
          description: "areas.kransmossen.fishing.0",
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
    location: "areas.almenas.location",
    description: "areas.almenas.description",
    image: { uri: "https://stigvidd.se/files/trails/area-almenas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Almenäs beachvolleybollplanen",
          location: "Almenäs, Borås",
          description: "areas.almenas.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs lilla stranden",
          location: "Almenäs, Borås",
          description: "areas.almenas.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Sjöbobron",
          location: "Sjöbobron, Borås",
          description: "areas.almenas.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Almenäs Udden I",
          location: "Almenäsudden, Borås",
          description: "areas.almenas.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo Rydastrand",
          location: "Sjöbo, Borås",
          description: "areas.almenas.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbovallen",
          location: "Sjöbovallen, Borås",
          description: "areas.almenas.firepit.5",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, norr om Borås",
          description: "areas.almenas.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Almenäs badplats",
          location: "Öresjöns södra strand, Borås",
          description: "areas.almenas.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
        {
          name: "Sjöbo badplats",
          location: "Öresjöns sydöstra strand, Borås",
          description: "areas.almenas.swimming.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rya åsar naturreservat",
          location: "Almenäs, Borås",
          description: "areas.almenas.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/almenas.4.1601545718c38a990ab486b1.html",
        },
      ],
    },
  },
  {
    identifier: "aplared",
    name: "Aplared",
    location: "areas.aplared.location",
    description: "areas.aplared.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Aplared Ekbacken",
          location: "Söder om fotbollsplanen, Aplared",
          description: "areas.aplared.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Aplared Ekbacken vindskydd",
          location: "Söder om fotbollsplanen, Aplared",
          description: "areas.aplared.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Såken fiskevårdsområde",
          location: "Öster om Borås, vid Aplared",
          description: "areas.aplared.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Skansasjön badplats",
          location: "Ca 1,5 km nordväst om Aplared",
          description: "areas.aplared.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Lindåsabäckens naturreservat",
          location: "Svenljungavägen (väg 1698), Aplared",
          description: "areas.aplared.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/aplared.4.6b00451018e55e78a7c1d447.html",
        },
      ],
    },
  },
  {
    identifier: "borgstena",
    name: "Borgstena",
    location: "areas.borgstena.location",
    description: "areas.borgstena.description",
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
          description: "areas.borgstena.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/borgstena.4.73feea1318de86063208414c.html",
        },
        {
          name: "Myresjö fiskevårdsområde",
          location: "Norr om Borås, utanför Borgstena",
          description: "areas.borgstena.fishing.1",
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
    location: "areas.borasCentrala.location",
    description: "areas.borasCentrala.description",
    image: { uri: "https://stigvidd.se/files/trails/area-annelund.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "A-Ö-skogens grillplats Bodakullen",
          location: "Bodakullen vid Bodavallen, Borås",
          description: "areas.borasCentrala.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
        {
          name: "Annelundsparken",
          location: "Annelundsparken, Borås centrum",
          description: "areas.borasCentrala.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/borascentrala.4.73feea1318de86063206bf0f.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Annelundsparken regnskydd",
          location: "Annelundsparken, Borås centrum",
          description: "areas.borasCentrala.shelter.0",
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
    location: "areas.bredared.location",
    description: "areas.bredared.description",
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
    location: "areas.byttorpKolbranningen.location",
    description: "areas.byttorpKolbranningen.description",
    image: { uri: "https://stigvidd.se/files/trails/area-kolbranningen.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Byttorp badplats",
          location: "Byttorp badplats, Borås",
          description: "areas.byttorpKolbranningen.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
        {
          name: "Kolbränningen",
          location: "Vid sjön Kolbränningen, Borås",
          description: "areas.byttorpKolbranningen.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Byttorp, Kolbränningen badplats",
          location: "Sjön Kolbränningen, Borås",
          description: "areas.byttorpKolbranningen.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/byttorpkolbranningen.4.5493346718e560a04fa5d2ec.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "dannike",
    name: "Dannike",
    location: "areas.dannike.location",
    description: "areas.dannike.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Rammsjön grillplats",
          location: "Rammsjöns badplats, Dannike",
          description: "areas.dannike.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Boanäs fiskevårdsområde",
          location: "Yttre Åsunden och Torpasjön",
          description: "areas.dannike.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Rammsjön fiskevårdsområde",
          location: "Öster om Dannike",
          description: "areas.dannike.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
        {
          name: "Torpasjön fiskevårdsområde",
          location: "Vid Torpa stenhus",
          description: "areas.dannike.fishing.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rammsjöns badplats",
          location: "Rammsjön, Dannike",
          description: "areas.dannike.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Rölle naturreservat",
          location: "Väg 1706 vid Rölle/Hulten",
          description: "areas.dannike.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/dannike.4.73feea1318de860632084213.html",
        },
      ],
    },
  },
  {
    identifier: "fristad",
    name: "Fristad",
    location: "areas.fristad.location",
    description: "areas.fristad.description",
    image: { uri: "https://stigvidd.se/files/trails/area-fristad.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Asklanda badplats (bryggan)",
          location: "Asklanda, västra Fristad",
          description: "areas.fristad.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (västra)",
          location: "Asklanda, västra Fristad",
          description: "areas.fristad.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Asklanda badplats (östra)",
          location: "Asklanda, västra Fristad",
          description: "areas.fristad.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats (bryggan)",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "areas.fristad.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats (udden)",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "areas.fristad.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Solviken badplats",
          location: "Sjön Ärtingen, 4 km väster om Fristad",
          description: "areas.fristad.firepit.5",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Säven fiskevårdsområde",
          location: "Norr om Fristad",
          description: "areas.fristad.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Varnum & Marsjöarna",
          location: "Öster om Sparsör",
          description: "areas.fristad.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Ärtingen fiskevårdsområde",
          location: "Väster om Fristad",
          description: "areas.fristad.fishing.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Fristad",
          description: "areas.fristad.fishing.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Asklanda badplats",
          location: "Västra Fristad, Öresjöns strand",
          description: "areas.fristad.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Skalle badplats",
          location: "Östra Öresjöstranden, söder om Fristad",
          description: "areas.fristad.swimming.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Solviken badplats",
          location: "Sjön Ärtingen, 4 km väster om Fristad",
          description: "areas.fristad.swimming.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Mölarps naturreservat",
          location: "Där Viskan möter Öresjö, Fristad",
          description: "areas.fristad.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
        {
          name: "Vänga Mosse naturreservat",
          location: "Fristad",
          description: "areas.fristad.naturereserv.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/fristad.4.73feea1318de86063206a396.html",
        },
      ],
    },
  },
  {
    identifier: "frufallan",
    name: "Frufällan",
    location: "areas.frufallan.location",
    description: "areas.frufallan.description",
    image: { uri: "https://stigvidd.se/files/trails/area-frufallan.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Frufällans badplats",
          location: "Frufällan, Borås",
          description: "areas.frufallan.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Kröklings hage",
          location: "Frufällan, Borås",
          description: "areas.frufallan.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Mölarps ö",
          location: "Frufällan, Borås",
          description: "areas.frufallan.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
        {
          name: "Vikåsaudden",
          location: "Frufällan, Borås",
          description: "areas.frufallan.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Frufällan",
          description: "areas.frufallan.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Frufällans badplats",
          location: "Öresjöns östra strand, Frufällan",
          description: "areas.frufallan.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/frufallan.4.5493346718e560a04fa6d15b.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "gasslosa",
    name: "Gässlösa",
    location: "areas.gasslosa.location",
    description: "areas.gasslosa.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Gässlösa elljusspår",
          location: "Gässlösa, Borås",
          description: "areas.gasslosa.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Kråkered – Stora Transåssjön",
          location: "Stora Transåssjön, Gässlösa",
          description: "areas.gasslosa.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Transås badplats",
          location: "Stora Transåssjön, Gässlösa",
          description: "areas.gasslosa.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/gasslosa.4.73feea1318de86063206bca4.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hedared",
    name: "Hedared",
    location: "areas.hedared.location",
    description: "areas.hedared.description",
    image: { uri: "https://stigvidd.se/files/trails/area-hedared.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Östra Valsjön",
          location: "Ca 2 km öster om Hedared",
          description: "areas.hedared.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Östra Valsjöns badplats",
          location: "Ca 2 km öster om Hedared",
          description: "areas.hedared.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/hedared.4.5493346718e560a04fa6cd38.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "hestra",
    name: "Hestra",
    location: "areas.hestra.location",
    description: "areas.hestra.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Hestrastugan",
          location: "Ekås, Borås",
          description: "areas.hestra.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
        {
          name: "Lomsjön Kypered",
          location: "Ca 1,7 km norr om Hestrastugan",
          description: "areas.hestra.firepit.1",
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
          description: "areas.hestra.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/hestra.4.5493346718e560a04fa5d641.html",
        },
      ],
    },
  },
  {
    identifier: "hofsnas-torpa",
    name: "Hofsnäs och Torpa",
    location: "areas.hofsnasTorpa.location",
    description: "areas.hofsnasTorpa.description",
    image: { uri: "https://stigvidd.se/files/trails/area-hofsnas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Campingen",
          location: "Hofsnäs, Borås",
          description: "areas.hofsnasTorpa.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ekenäs",
          location: "Hofsnäs, Borås",
          description: "areas.hofsnasTorpa.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Flaxet",
          location: "Hofsnäs, Borås",
          description: "areas.hofsnasTorpa.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Näset",
          location: "Hofsnäs, Borås",
          description: "areas.hofsnasTorpa.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
        {
          name: "Ångbåtsbryggan",
          location: "Hofsnäs, Borås",
          description: "areas.hofsnasTorpa.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Torpasjön vindskydd",
          location: "Torpasjön, Borås",
          description: "areas.hofsnasTorpa.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Torpasjön fiskevårdsområde",
          location: "Kring Torpanäsets naturreservat",
          description: "areas.hofsnasTorpa.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Hofsnäs badplats",
          location: "Östra Torpasjön, Hofsnäs",
          description: "areas.hofsnasTorpa.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Torpanäsets naturreservat",
          location: "Hofsnäs, östra Borås",
          description: "areas.hofsnasTorpa.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/hofsnasochtorpa.4.73feea1318de86063206bd97.html",
        },
      ],
    },
  },
  {
    identifier: "sjomarken",
    name: "Sjömarken",
    location: "areas.sjomarken.location",
    description: "areas.sjomarken.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sjömarkens badplats (bryggan)",
          location: "Sjömarkens badplats, Borås",
          description: "areas.sjomarken.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (stranden)",
          location: "Sjömarkens badplats, Borås",
          description: "areas.sjomarken.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens badplats (udden)",
          location: "Sjömarkens badplats, Borås",
          description: "areas.sjomarken.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
        {
          name: "Sjömarkens idrottsgård",
          location: "Sjömarkens idrottsgård, Borås",
          description: "areas.sjomarken.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared/Sjömarken",
          description: "areas.sjomarken.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sjömarkens badplats",
          location: "Viaredssjön, Sjömarken",
          description: "areas.sjomarken.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sjomarken.4.73feea1318de8606320843ef.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "knektas-tosseryd",
    name: "Knektås, Tosseryd",
    location: "areas.knektasTosseryd.location",
    description: "areas.knektasTosseryd.description",
    image: { uri: "https://stigvidd.se/files/trails/area-knektas.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/knektastosseryd.4.5493346718e560a04fa6d1b7.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Knektås GIF-stugan",
          location: "Kullen bakom Borås GIF:s klubbstuga, Knektås",
          description: "areas.knektasTosseryd.firepit.0",
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
    location: "areas.rydboholm.location",
    description: "areas.rydboholm.description",
    image: { uri: "https://stigvidd.se/files/trails/area-rydboholm.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Maden Rydboholm",
          location: "Sven Eriksons väg, Rydboholm",
          description: "areas.rydboholm.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Storsjön och Viskan fiskevårdsområde",
          location: "Storsjön, Rydboholm",
          description: "areas.rydboholm.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Furusjöns badplats",
          location: "Furusjön, Rydboholm",
          description: "areas.rydboholm.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/rydboholm.4.73feea1318de860632085c53.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "rangedala",
    name: "Rångedala",
    location: "areas.rangedala.location",
    description: "areas.rangedala.description",
    image: { uri: "https://stigvidd.se/files/trails/area-rangedala.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Algutstorp Bäckravinen",
          location: "Algutstorp, Rångedala",
          description: "areas.rangedala.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Algutstorp Ängen",
          location: "Algutstorp, Rångedala",
          description: "areas.rangedala.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "areas.rangedala.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Marsjöns badplats",
          location: "Marsjön, Rångedala",
          description: "areas.rangedala.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/oster/rangedala.4.73feea1318de8606320845cd.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandared",
    name: "Sandared",
    location: "areas.sandared.location",
    description: "areas.sandared.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Björviksudden",
          location: "Viaredssjön, Sandared",
          description: "areas.sandared.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Nordtorp",
          location: "SOK-stugan, Sandared",
          description: "areas.sandared.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats väster",
          location: "Sandareds badplats, Sandared",
          description: "areas.sandared.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats öster",
          location: "Sandareds badplats, Sandared",
          description: "areas.sandared.firepit.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandaredsån Ängen & Åkilen",
          location: "Sandaredsån, Sandared",
          description: "areas.sandared.firepit.4",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Viaredssjön fiskevårdsområde",
          location: "Viaredssjön, Sandared",
          description: "areas.sandared.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Rydets badplats",
          location: "Viaredssjön, Sandared",
          description: "areas.sandared.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
        {
          name: "Sandareds badplats",
          location: "Viaredssjön, Sandared",
          description: "areas.sandared.swimming.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandared.4.73feea1318de86063206c004.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "sandhult",
    name: "Sandhult",
    location: "areas.sandhult.location",
    description: "areas.sandhult.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "areas.sandhult.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [],
      [FacilityType.SwimmingArea]: [
        {
          name: "Trummesjöns badplats",
          location: "Ca 2,5 km norr om Sandhult",
          description: "areas.sandhult.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/vaster/sandhult.4.73feea1318de860632085d1c.html",
        },
      ],
      [FacilityType.NatureReserv]: [],
    },
  },
  {
    identifier: "seglora",
    name: "Seglora",
    location: "areas.seglora.location",
    description: "areas.seglora.description",
    image: { uri: "https://stigvidd.se/files/trails/area-seglora.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Bogryds badplats",
          location: "Bogrydssjön, Seglora",
          description: "areas.seglora.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.Shelter]: [],
      [FacilityType.FishingArea]: [
        {
          name: "Surtans övre fiskevårdsområde",
          location: "Sjön Hungern, Seglora",
          description: "areas.seglora.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Bogrydssjön badplats",
          location: "Bogrydssjön, Seglora",
          description: "areas.seglora.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
        {
          name: "Bua badplats",
          location: "Stora Hålsjön, Seglora",
          description: "areas.seglora.swimming.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Tranhults naturreservat",
          location: "Viskans strand, Seglora",
          description: "areas.seglora.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/seglora.4.73feea1318de8606320842db.html",
        },
      ],
    },
  },
  {
    identifier: "sparsor",
    name: "Sparsör",
    location: "areas.sparsor.location",
    description: "areas.sparsor.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "areas.sparsor.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Trollevi",
          location: "Trollevi, Sparsör",
          description: "areas.sparsor.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Trollevi",
          location: "Norr om fotbollsplanerna, Sparsör",
          description: "areas.sparsor.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Gingri Ön fiskevårdsområde",
          location: "Viskans huvudfåra, Sparsör",
          description: "areas.sparsor.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Öresjö fiskevårdsområde",
          location: "Öresjön, Sparsör",
          description: "areas.sparsor.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Sparsörs badplats",
          location: "Öresjöns östra strand, Sparsör",
          description: "areas.sparsor.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Kröklings hage naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description: "areas.sparsor.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
        {
          name: "Mölarps naturreservat",
          location: "Mölarps kvarn, Sparsör",
          description: "areas.sparsor.naturereserv.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/norr/sparsor.4.73feea1318de860632084504.html",
        },
      ],
    },
  },
  {
    identifier: "svaneholm",
    name: "Svaneholm",
    location: "areas.svaneholm.location",
    description: "areas.svaneholm.description",
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
          description: "areas.svaneholm.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
      [FacilityType.SwimmingArea]: [],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Ca 1 mil sydväst om Borås, vid Viskafors",
          description: "areas.svaneholm.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/svaneholm.4.5493346718e560a04fa6d342.html",
        },
      ],
    },
  },
  {
    identifier: "viskafors",
    name: "Viskafors",
    location: "areas.viskafors.location",
    description: "areas.viskafors.description",
    image: { uri: "https://stigvidd.se/files/trails/area-mock.jpg" },
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
    trails: [],
    facilities: {
      [FacilityType.Firepit]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "areas.viskafors.firepit.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Klipporna",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.firepit.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.firepit.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.Shelter]: [
        {
          name: "Storsjögården",
          location: "Storsjögården, Viskafors",
          description: "areas.viskafors.shelter.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Hultaberg",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.shelter.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Kopparhammaren",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.shelter.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Lomsjö",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.shelter.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.FishingArea]: [
        {
          name: "Bålån fiskevårdsområde",
          location: "Bålån, Viskafors",
          description: "areas.viskafors.fishing.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Frisjön fiskevårdsområde",
          location: "Sydöst om Viskafors",
          description: "areas.viskafors.fishing.1",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Seglora fiskevårdsområde",
          location: "Viskan, Viskafors",
          description: "areas.viskafors.fishing.2",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
        {
          name: "Storsjön & Viskan, Rydboholm",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.fishing.3",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.SwimmingArea]: [
        {
          name: "Storsjöns badplats",
          location: "Storsjön, Viskafors",
          description: "areas.viskafors.swimming.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
      [FacilityType.NatureReserv]: [
        {
          name: "Storsjön naturreservat",
          location: "Viskafors",
          description: "areas.viskafors.naturereserv.0",
          url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur/soder/viskafors.4.73feea1318de860632083f9d.html",
        },
      ],
    },
  },
  {
    identifier: "ymergarden",
    name: "Ymergården",
    location: "areas.ymergarden.location",
    description: "areas.ymergarden.description",
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
