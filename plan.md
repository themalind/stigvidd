# Plan: koppla leder mot Borås Stads öppna data

Mål: kunna köra om importen av `spar_leder` regelbundet och få med tillägg, ändringar
och borttag i källan — utan att dubblera leder eller skriva över eget innehåll.

Källa: <https://catalog.boras.se/store/1/resource/87> (GeoJSON, `spar_leder`)

> Reviderad 2026-08-20 efter att två exporter jämförts mot varandra och mot databasen.
> Den ursprungliga designen nycklade på `properties.id`. **Det håller inte** — se §2.

---

## 1. Vad datan faktiskt innehåller

Två exporter har analyserats:

| | `examensarbete/spar_leder.json` | `Downloads/spar_leder.json` |
| --------------------- | ------------------------------- | --------------------------- |
| Nedladdad             | 2025-11-20                      | 2026-08-20                  |
| Storlek               | 14,9 MB                         | 21,5 MB                     |
| Features              | 211                             | 203                         |
| `properties.id`       | 4117–4464                       | **1–389**                   |
| Unika namn            | 138                             | 194                         |
| Geometrityper         | 194 LineString, **16 utan geometri**, 1 MultiLineString | 203 LineString |
| Features med `avpubl` | 9                               | 9                           |

Koordinater är `[lon, lat, 0]` — tredje elementet alltid 0.

### Kritisk detalj: relationen är 1:N

Flera features hör till samma verkliga led — samma `namn`, samma `sparlangd`, samma
`link`, men olika geometrisegment. I 2026-08-exporten kvarstår:

| namn                                | features |
| ----------------------------------- | -------- |
| Torpanäset                          | 3        |
| Kröcklings hage                     | 3        |
| avpubl Svaneholm / Bogryd 2,4 - 5,3 km | 3     |
| Munkåleden                          | 2        |
| Rya åsar Utsiktsstigen              | 2        |
| Vänga mosse                         | 2        |

En `BorasId`-kolumn på `Trail` kan inte representera det här — du tvingas välja ett id,
tappar resten, och nästa import ser dem som nya leder.

### Källan städar själv mellan exporter

`Olsfors-kommungränsen` fanns som **24 separata features** 2025-11. Alla 24 importerades
som egna `Trail`-rader; de sitter ihop ände mot ände och bildar en obruten linje på
4,625 km (största hopp mellan punkter 6,7 m, snitt 2,0 m).

I 2026-08-exporten är de borta. Istället finns tio rena etapper:

```
Sjuhäradsleden Etapp 01 Hindås - Hestrafors
Sjuhäradsleden Etapp 02 Hestra - Olsfors          ← de 24 fragmenten, nu en feature
Sjuhäradsleden Etapp 03 Olsfors - Nordtorp
Sjuhäradsleden Etapp 04 Nordtorp - Rya Åsar
Sjuhäradsleden Etapp 05 Rya åsar - Karlsaflogar
Sjuhäradsleden Etapp 06 Karlsaflogar - Blackered
Sjuhäradsleden Etapp 07 Blackered - Prångens Camping
Sjuhäradsleden Etapp 08 Prångens Campg. - Böne kyrka
Sjuhäradsleden Etapp 09 Böne kyrka - Årås kvarn
Sjuhäradsleden Etapp 10 Årås säteri - Hotell Mullsjö
Sjuhäradsleden Alla Etapper
```

Källan har också döpt om den alternativa rundan till
`Sjuhäradsrundan (alternativ sträckning)` — samma slutsats som geometrin i databasen
tvingar fram (§8).

Slutsats: **handmerga inte gammal data.** Det källan redan konsoliderat ska hämtas, inte
återskapas för hand.

### Källans egen "soft delete"

9 features har namn som börjar med `avpubl` / `avpublicerad`. Källan markerar alltså
avpublicering i namnfältet i stället för att ta bort raden. Måste tolkas som status,
inte som ett namn.

---

## 2. `properties.id` är INTE en stabil nyckel

Det här är planens viktigaste rättelse.

De två exporterna jämfördes på geometri (ändpunkter avrundade till 7 decimaler):

| Utfall                              | Antal |
| ----------------------------------- | ----- |
| Samma geometri, **samma** `id`      | **0** |
| Samma geometri, **olika** `id`      | 102   |
| Finns bara i 2026-08-exporten       | 101   |

Exempel: `Munkåleden` 4351 → 1. `Gåshult Röd led` 4202 → 105.
`Bredareds IF gula vandringsleden 5,0 km` 4391 → 156.

`properties.id` är alltså ett radnummer som sätts vid export, inte en identitet.

**Konsekvens för den ursprungliga designen:** ett unikt index på
`(Source, ExternalId)` med `ExternalId = properties.id` gör att första synken efter
nästa export hittar noll träffar, skapar 203 nya leder och sätter `MissingSinceAt` på
samtliga befintliga länkar — tyst, utan felmeddelande.

### Vad som faktiskt är stabilt

Geometrin. De 24 `Olsfors-kommungränsen`-raderna i databasen matchade **24 av 24** mot
sin källfil på exakta ändpunkter. Över nio månader och en omarbetning av datasetet höll
geometrin för 102 features.

Men geometri ändras när Borås ritar om en led — och just då *vill* man ha en manuell
blick. Därför:

- **Geometrihash** = snabb väg. Identisk geometri → säker match.
- **Spatial matchning** (PostGIS) = fallback när hashen missar.
- **Människa** = skiljedomare vid låg konfidens.

`properties.id` sparas som *senast observerat* värde för felsökning. Aldrig som join-nyckel.

---

## 3. Beslut: egen kopplingstabell

Utöver 1:N-problemet ger en egen tabell tre saker:

1. **Synk-metadata** (senast sedd, hash, rå JSON) hålls utanför domänmodellen `Trail`.
2. **Flera källor** senare (annan kommun, Naturkartan, OSM) ryms i samma tabell.
3. **Rader utan `Trail`** — en ny feature kan ligga i granskningskö i stället för att
   auto-publiceras.

### Entitet

`backend/Infrastructure/Data/Entities/TrailSourceLink.cs`

```csharp
public class TrailSourceLink : BaseEntity
{
    public required string Source { get; set; }          // "boras-stad"

    // Stabil nyckel: SHA-256 över hela punktlistan vid 7 decimaler (se §3, mätningen).
    public required string GeometryFingerprint { get; set; }

    // Senast observerat properties.id. Diagnostik — aldrig join-nyckel.
    public string? LastSeenExternalId { get; set; }

    public int? TrailId { get; set; }                    // null = i granskningskö
    public Trail? Trail { get; set; }

    public TrailSourceLinkRole Role { get; set; }
    public MatchConfidence Confidence { get; set; }
    public bool ConfirmedByHuman { get; set; }           // spärrar automatisk omkoppling

    public string? SourceSnapshot { get; set; }          // jsonb: senaste properties
    public DateTime LastSeenAt { get; set; }             // bara vid import, till skillnad från LastUpdatedAt
    public DateTime? MissingSinceAt { get; set; }
    public int MissingImportCount { get; set; }
}

public enum TrailSourceLinkRole
{
    Segment = 0,     // bidrar med geometri; ledens GeoPath = LineMerge av alla Segment-länkar
    Duplicate = 1,   // samma led, redundant geometri — behåll kopplingen, ignorera geometrin
    Excluded = 2,    // medvetet inte publicerad (avpubl, trasig geometri)
}

public enum MatchConfidence { Unmatched = 0, Medium = 1, High = 2, Certain = 3 }
```

Två avsteg från utkastet ovan, gjorda när entiteten byggdes 2026-08-20:

**`FirstSeenAt` är struken.** `BaseEntity.CreatedAt` sätts när länken skapas, och en länk
skapas i exakt det ögonblick featuren först ses. Två kolumner med samma innebörd är två
kolumner som kan glida isär. `LastSeenAt` finns kvar och betyder något eget:
`LastUpdatedAt` ändras vid varje redigering, `LastSeenAt` bara när featuren dyker upp i
en import.

**`MatchConfidence` är omvänd och numrerad.** `default(enum)` är 0, och med planens
ordning hade en nyskapad länk fått `Certain` gratis — den ena av fyra värden som säger
"uppdatera automatiskt, ingen granskning". Nu är 0 `Unmatched`, alltså granskningskö, och
skalan är stigande så att en tröskel skrivs `Confidence >= MatchConfidence.High`. Båda
enumerna har explicita värden, som de andra i `Infrastructure/Enums/`, eftersom siffrorna
hamnar i databasen.

`Role` är det som gör 1:N hanterbart. `Segment` betyder att featuren ingår i ledens
sträcka; en led med 24 `Segment`-länkar får sin geometri räknad ur alla 24. Lägger
Borås till en 25:e växer leden automatiskt. `Duplicate` betyder att featuren hör till
leden men inte ska bidra med geometri — kopplingen finns bara för att featuren aldrig
ska återskapas som en ny led.

### Fingeravtrycket, mätt mot verklig data

Mätt 2026-08-20 mot testmiljöns 220 leder och 2026-08-exporten (203 features).

**Ändpunkter + punktantal räcker för att särskilja allt.** Efter MOCK-städningen finns
noll kollisioner i tabellen, och noll i exportfilen. Det unika indexet nedan håller.
Ändpunkter *ensamt* gör det inte — 22 kollisioner i exporten, 28 i 2025-exporten.

**Längden ska inte hashas som ett tal någon räknat fram i SQL.** PostGIS
`ST_Length(::geography)` och en haversineberäkning i C# skiljer sig upp till 0,33 % —
46 m på en 14 km-led. Räknas den på två ställen matchar ingenting, tyst. Antingen räknas
den i exakt en kodväg (NTS), eller så hashas hela punktlistan i stället. Hela
punktlistan är att föredra: samma särskiljningsförmåga, ingen enhetstvetydighet.

**Fingeravtrycket bär bara en dryg tredjedel av matchningen mellan två exporter.** 74 av
203 features i 2026-exporten har exakt samma geometri som någon feature i 2025-filen. Av
de 129 som inte har det är tre numeriskt brus, 59 samma led med omritad sträckning och 67
nya eller omdragna. Lösare avrundning hjälper inte (36 % vid 7 decimaler, 46 % vid 4).
Tiernas i §4 är alltså inte en förfining av fingeravtrycket — de är huvudmekanismen.

**Mot databasen ser det bättre ut än mot den gamla filen.** 177 av 203 features (87 %)
träffar en befintlig led exakt. Av de 26 som inte gör det saknar 22 helt en led inom
50 m. Åt andra hållet saknar 42 Borås-leder motsvarighet i exporten. Första synken landar
alltså på ungefär 22 nya leder och ~42 rader att ta ställning till — granskningskön i §9
behöver inte skalas för hundratals.

**150 av de 177 matchade lederna har ett annat namn i källan.**
`"Bredareds IF Vit"` i databasen mot `"Bredareds IF vit vandringsled 13 km"` i exporten.
Databasens namn är de handputsade; källans är maskinella. Därför äger vi `Name` — se §5,
där fältet flyttats och regeln skärpts till att synken aldrig skriver namn på en
befintlig led.

Samma siffra stänger dörren för namnmatchning som fallback i §4: den hade missat 85 % av
de leder geometrin hittar.

**`properties.id` delas inte alls mellan de två exporterna** — noll gemensamma av
195/203. Geometrinyckeln är inte bara bättre, id-vägen finns inte.

### EF-konfiguration

`backend/Infrastructure/Data/StigViddDbContext.cs`

```csharp
modelBuilder.Entity<TrailSourceLink>()
    .HasIndex(l => new { l.Source, l.GeometryFingerprint })
    .IsUnique();

modelBuilder.Entity<TrailSourceLink>()
    .HasIndex(l => new { l.Source, l.LastSeenExternalId });   // uppslag, inte unikt

modelBuilder.Entity<TrailSourceLink>()
    .HasOne(l => l.Trail)
    .WithMany(t => t.SourceLinks)
    .HasForeignKey(l => l.TrailId)
    .OnDelete(DeleteBehavior.SetNull);   // länken överlever om leden tas bort
```

Plus `public ICollection<TrailSourceLink>? SourceLinks { get; set; }` på `Trail`.

`SetNull` är medvetet valt: alla åtta befintliga FK:er mot `Trails` är `CASCADE` (§7),
och en länk som försvinner med leden vore precis den kunskap man behöver för att inte
återskapa den.

---

## 4. Synk-algoritmen

Per import, per feature:

**Steg 1 — matcha.**

| Villkor                                                            | Konfidens   | Åtgärd                    |
| ------------------------------------------------------------------ | ----------- | ------------------------- |
| Identisk geometrihash                                              | `Certain`   | Uppdatera automatiskt     |
| ≥ 95 % ömsesidig täckning inom 15 m **och** samma `namn`            | `High`      | Uppdatera automatiskt     |
| ≥ 80 % täckning, **eller** samma `namn` + `link` inom 200 m         | `Medium`    | Granskningskö             |
| Inget av ovan                                                       | `Unmatched` | Granskningskö, ingen led  |

Att `High` kräver *samma `namn`* är svagare än det ser ut: 150 av 177 geometrimatchade
leder har olika namn i databas och källa (§3). Kriteriet faller alltså nästan aldrig ut,
och tiern kollapsar i praktiken ner i `Medium` — alltså granskningskö. Antingen stryks
namnvillkoret ur `High`, eller så jämförs mot källans namn i `SourceSnapshot` från förra
importen i stället för mot `Trail.Name`, som är vårt och medvetet avvikande.

### Tiers efter mätning 2026-08-20

Matcharen är byggd och körd mot exporten (203 features) och testdatabasens 188 leder.
Utfallet: **177 `Certain`, 5 `High`, 5 `Medium`, 16 `Unmatched`** på 414 jämförelser, 16 s.
Två ändringar mot tabellen ovan, båda framtvingade av datan:

**Namnvillkoret i `High` är struket.** Fyra av de fem `High`-matchningarna har olika namn
i databas och källa (`Kröcklings hage` mot `Kröcklings Hage`, `Mulleslingan Dalsjöfors`
mot `Dalsjöfors Mulleslingan`). Med villkoret kvar hade fyra av fem hamnat i kön i onödan.
Matcharen får inga namn alls — den tar bara geometri.

**`Medium` triggar också på ensidig täckning.** Ligger featuren helt på en led men täcker
bara en del av den, är det en etapp som bryts ur en längre led — en `Segment`-länk, inte
en ny led. Utan den regeln blev fyra Sjuhäradsleden-etapper `Unmatched` trots 100 %
framåttäckning. Nu pekar de på rätt led i granskningskön.

De 16 `Unmatched` är 9 kanotleder (Kanotcentralen, Gäddviken, Storö — 0 % täckning,
genuint nya) och 7 delvisa överlapp att titta på.

**Kanotlederna förklarar `sparlangd` i minuter** (§6): det är paddeltider.

En länk med `ConfirmedByHuman = true` kopplas aldrig om automatiskt — bara geometrin
och källfälten uppdateras.

**Steg 2 — uppdatera.** För matchade länkar: uppdatera `LastSeenAt`,
`LastSeenExternalId`, `SourceSnapshot`, och de fält källan äger (§5). Räkna om ledens
`GeoPath` som `ST_LineMerge` av alla dess `Segment`-länkars geometrier.

**Steg 3 — saknade.** Alla länkar för källan med `LastSeenAt < importstart` får
`MissingSinceAt` satt och `MissingImportCount` ökad.

**Ta aldrig bort en led direkt.** Användare har vandringar, recensioner, favoriter och
önskelistor kopplade till den, och alla FK:er är `CASCADE` — en `DELETE` tar med sig
allt tyst. Kräv att featuren saknats i flera importer i rad, och **avpublicera**
(`IsVerified = false`) i stället för att radera. Samma hantering för `avpubl`-prefixet.

### Geometrin blir härledd, inte lagrad en gång

Detta är skillnaden mot en engångsstädning: ledens `GeoPath` är ett *resultat* av dess
`Segment`-länkar, inte ett värde någon satt för hand. Sammanslagningen blir en regel
som gäller vid varje synk.

Undantag: leder med kuraterad geometri (§5).

---

## 5. Vem äger vilket fält

| Källan äger                                                          | Vi äger                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Classification`, `Accessibility`, `AccessibilityInfo`, `TrailSymbol`, `GeoPath`, `TrailLinks` | **`Name`**, **`TrailLength`**, `Description`, `FullDescription`, `TrailSymbolImage`, `TrailImages`, `Tags`, `City`, `IsVerified`, `VisitorInformation` |

### `Name` är vårt, utan undantag

Namnen i databasen är omdöpta med avsikt. Källans namn är långa
(`"Bredareds IF vit vandringsled 13 km"` mot `"Bredareds IF Vit"` i databasen) och
fungerar på webben men inte i appen, där de radbryts och blir svårlästa i kort- och
listvyerna. Kortandet är ett fattat beslut, inte en tillfällighet, och det gäller
150 av de 177 geometrimatchade lederna.

Synken får därför **aldrig** skriva `Name` på en led som redan finns — inte ens via
trevägs-merge, för då räcker en enda oredigerad led för att källan ska ta tillbaka det
långa namnet.

Källans `namn` används på exakt ett ställe: som förslag när en omatchad feature blir en
ny led. Då är det ändå bara ett utgångsläge att putsa.

Källans namn sparas fortsatt i `SourceSnapshot` — det är användbart i granskningsvyn för
att se vad källan kallar leden, men det är diagnostik, aldrig en skrivning.

### Undantag: leder som importen själv skapar

Regeln ovan skyddar det som redan finns. En led som `CreateNew` skapar har inget kuraterat
att skydda — den finns inte förrän importen skriver den — så namnet och längden måste komma
någonstans ifrån, och källan är det enda som finns.

Att ta källans `namn` rakt av vore däremot att bygga tillbaka precis det som städats bort:
`"Bredareds IF vit vandringsled 13 km"` i stället för `"Bredareds IF Vit"`. Därför frågar
granskningsvyn i stället. Knappen `New trail` öppnar en panel med källans namn förifyllt i
ett textfält och en längd att välja, och först därifrån går beslutet iväg. Valet sparas på
förslaget som `DecidedName` och `DecidedLengthKm`, och det är de fälten steg 8 läser — inte
`FeatureName`.

Två följder som är avsiktliga:

- En ny led kan inte bli till av en tangenttryckning. `n` öppnar panelen, den beslutar
  inte. Banvallen-raden som blev `CreateNew` av ett tappat `n` kan alltså inte uppstå igen.
- Massbeslut skapar aldrig leder. `decide-bulk` tar varken namn eller längd, och API:t
  avvisar ett namn på varje beslut utom `CreateNew`. En omatchad hög kan inte råka bli 180
  leder med långa namn.

Längden på en ny led väljs mellan två siffror: den uppmätta ur linjen, förvald eftersom det
är den geometrin leden lagras med, och källans `sparlangd`, som är den rätta när det är
linjen som är trasig — Sjömarkensrundan är fallet, halv linje mot 14 km på skylten. Valet
visas bara när de två är oense enligt `TrailLength.Disagrees`; annars står det bara vilken
längd leden får.

### `TrailLength` är också vårt

Längderna rättas mot skyltarna på plats när leder fotograferas. Mätt 2026-08-20: av de
177 geometrimatchade lederna avviker **35** från källans `sparlangd`. I 22 av dem har
källan en egen siffra som skulle skriva över, och där ligger databasens värde närmare den
faktiskt lagrade geometrin i **14 av 22**.

Fotograferingen är inte klar. Leder som ännu inte kontrollerats bär alltså en siffra som
kan vara fel — men det är fortfarande arbetsvärdet, och rättas när den upptäcks. Källan
får inte fylla i luckan, för efter en överskrivning går det inte längre att se vad som
var kontrollerat.

Två fall i tabellen är varken källans eller skyltarnas fel utan Sjuhäradsleds-problemet i
Öppna frågor: 359 bär 130 km (hela öglan) mot 10,6 km mätt, och 302 bär 47 km mot 12,8 km
mätt. De löses separat.

För de övriga delade fälten används `SourceSnapshot` till en **trevägs-merge**: skriv bara över
om nuvarande DB-värde är identiskt med *förra importens* källvärde. Skiljer det sig har
någon redigerat lokalt → lämna orört och logga konflikten. Utan detta skrivs varje
handpåläggning över vid nästa körning.

### Första synken har inget att jämföra med

Trevägs-mergen behöver förra importens källvärde. Det finns inte förrän en import har
kört och sparat `SourceSnapshot`. Vid den allra första körningen ser därför varje fält
oredigerat ut, och en merge som körs då skriver över allt eget innehåll — precis det den
är byggd för att förhindra.

Första synken ska alltså **bara upprätta länkar och snapshots, inte skriva ett enda
källägt fält** på befintliga leder. Från andra körningen och framåt har mergen ett
utgångsläge att jämföra mot. Nya leder som skapas ur omatchade features berörs inte —
de har inget eget innehåll att skydda.

### Undantag: kuraterad geometri

`GeoPath` står i "källan äger", men det finns leder där källans geometri är trasig och
ersatts lokalt. `Vänga mosse` id 295 är öppen med 1 217,8 m mellan start och slut i
källan; den lagas med en egen inspelad vandring (§8).

Sådana leder behöver en spärr — `Trail.GeoPathIsCurated` eller att samtliga deras länkar
sätts till `Duplicate` så ingen `Segment`-länk finns att räkna geometri ur. Det första är
tydligare att läsa i admin, det andra kräver ingen ny kolumn.

---

## 6. Ombyggnad av importern

`backend/MapData/TransmogrifyBorasData.cs` gör i dag `stigViddDbContext.Trails.Add(trail)`
rakt av, utan någon dedupe — **en omkörning i dag dubblerar alla 203 leder**. Den skrivs
om till upsert via länktabellen samtidigt som tabellen införs.

Robusthetskrav som den nuvarande koden inte klarar:

- **Features utan geometri.** 16 st i 2025-11-exporten. Får inte bli en `Trail` med
  `GeoPath = null` — logga och lägg i granskningskö.
- **MultiLineString.** 1 st (`Munkåleden`) i 2025-11-exporten.
  `JsonSerializer.Deserialize<double[][]>` kastar på den. Entiteten är `LineString?`, så
  en MultiLineString måste `LineMerge`:as till en linje eller avvisas — kolumnen är
  generisk `GEOMETRY` och sväljer den, men EF kastar när den ska materialiseras.
- **Namnet `-`.** 21 features i 2025-11-exporten. Inte ett namn — granskningskö.
- **`avpubl`-prefix.** Status, inte namn.
- **SRID.** Ingenting i modellen sätter SRID — inget `HasSrid`, ingen default. NTS
  skapar `new LineString(...)` med SRID 0. Att 18 av 42 rader i `Hikes` ligger med SRID 0
  medan resten har 4326 är samma bugg redan i produktion, och den gör
  `ST_Intersection` mot `Trails` omöjlig utan explicit `ST_SetSRID`. Sätt 4326 explicit i
  importern, och överväg `HasSrid(4326)` på båda geometrikolumnerna.

Övrigt:

- **`sparlangd` har sex olika format, `ParseTrailLength` klarar ett.** Se avsnittet
  nedan. Totalt parsas **29 av 203** features till noll i dag. Fixas innan någon
  omkörning, oavsett resten av synken.
- **`sparmarkering` har tre stavningar av "ingen markering".** Se avsnittet nedan.
- Läs `properties.id` (ignoreras helt i dag) — som `LastSeenExternalId`, inte som nyckel.
- Hämta direkt från URL i stället för lokal fil, så synken kan schemaläggas.
- `Program.cs` anropar i dag ingenting — importen är utkommenterad/aldrig körd i koden.
- Koordinater har tre element (`[lon, lat, 0]`); nuvarande `c[0]`, `c[1]` är rätt.

### `sparlangd`: sex format, inte ett

Kartlagt 2026-08-20 över alla 203 features i 2026-08-exporten:

| Form | Antal | Exempel |
| --- | --- | --- |
| `km` | 166 | `"2,5 km"`, `"31,5 km"`, `"Drygt 1 km"`, `"3,5 km "` |
| meter | 13 | `"800 m"`, `"9100m"` (utan mellanslag) |
| tidsangivelse | 9 | `"5 min"` … `"60 min"` |
| intervall | 5 | `"2,4 - 5,3 km"` |
| siffra utan enhet | 9 | `"1724"`, `"2,5"` |
| tomt | 1 | `null` |

Att bara kolla om strängen innehåller `km` räcker alltså inte — men man behöver inte
heller sex grenar. **Parsa när enheten är utskriven, räkna ur geometrin annars:**

1. Trimma. Innehåller strängen `km` → talet är kilometer.
2. Innehåller den en siffra följd av `m` (med eller utan mellanslag) → meter, dela med 1000.
3. **Allt annat → räkna längden ur koordinaterna.** Tid, intervall, tomt och naken siffra
   hamnar alla här.

Att den nakna siffran hamnar i "räkna"-facket är hela poängen: `"1724"` och `"2,5"` går
inte att skilja åt på annat än en gissning om decimaltecken, och gissningen kostar
1724 km när den slår fel. Geometrin vet redan svaret.

Tidsangivelserna går ändå inte att räkna om — `"5 min"` sitter på både 0,29 och 0,41 km,
så det finns ingen hastighet att utgå från.

**Det som avgjorde regeln:** längden skrivs bara när en *ny* led skapas (§5), och bland
de 26 features som saknar motsvarighet i databasen ser formerna ut så här:

| Form | Antal nya |
| --- | --- |
| `km` | 16 |
| tid | **9** |
| meter | 1 |
| intervall / naken siffra / tomt | 0 |

**Samtliga nio tidsangivelser är nya leder** — ett kluster kring Kanotcentralen,
Gäddviken och Storö som inte finns i databasen alls. Regeln träffar alltså inte ett
kantfall utan en tredjedel av allt nytt. Och de tvetydiga formerna förekommer inte bland
de nya över huvud taget, så den farliga grenen behöver aldrig skrivas.

**Korskontrollen behövs ändå**, för `km`-grenen är inte pålitlig bara för att den är
entydig. Bland de 16 nya med `km`: `Banvallen` säger 8,2 km men mäter 15,72,
`Kröcklings hage` säger 2,0 men mäter 0,06 (ett fragment), `Etapp 10` säger 22 men mäter
12,46. Skiljer sig parsat och beräknat grovt är det en flagga till granskningsvyn — den
fångar trasig geometri lika ofta som fel längd.

### Men räkna hellre längden ur koordinaterna

`sparlangd` ska inte vara huvudkällan. Längden går att räkna ur geometrin, och det är
bättre på varje punkt: en kodväg i stället för sex, ett svar för alla 203 features i
stället för 187, och ingen tvetydighet om enheter.

Uppmätt mot databasen 2026-08-20 (179 leder, efter att Sjuhärads-raderna räknats bort):

| Beräknad längd mot lagrad | |
| --- | --- |
| inom 2 % | 54 |
| inom 5 % | 93 |
| inom 10 % | 132 |
| inom 25 % | 159 |
| **medianavvikelse** | **4,4 %** |

De ~20 som avviker grovt avslöjar nästan alltid **trasig geometri**, inte fel längd:
`Kröcklings Hage` 0,05 km, `Munkåleden` 0,44 km, de avpublicerade naturstigarna 0,17 och
0,31 km. Det är importfragmenten från §8.

Det är också den ärliga invändningen: den beräknade längden är aldrig bättre än
geometrin. Skillnaden är att den **failar högt** — en led på 50 meter är uppenbart fel,
medan ett inaktuellt `"2,0 km"` ser rimligt ut för alltid.

**Rollfördelningen blir:**

- **Beräknad längd** — förslag för nya leder, och underlag i granskningsvyn.
- **`sparlangd`** — bara korskontroll. Går den att tolka och skiljer den sig grovt från
  geometrin är det en flagga. Går den inte att tolka (tid, intervall, tomt — 16 features)
  händer ingenting, i stället för att en 1724 km-rad skrivs.
- **Lagrad `TrailLength`** — vinner alltid över båda på en befintlig led (§5).

Medianavvikelsen på 4,4 % är skälet till att beräknad längd inte heller får skriva över:
skyltarna avrundar till hel eller halv kilometer, den ritade linjen gör inte det. På en
5 km-led är 4,4 % drygt 200 meter.

*(Kontrollerat och avfärdat: teorin att öppna tur-och-retur-leder skulle ge dubbel mätt
längd. Bara två leder ligger nära faktor 0,5 och ingen av dem är dubbelritad — 266 är en
sluten slinga med 0,1 m mellan ändarna, 276 en öppen linje med 14,4 km fågelvägen. Båda
har helt enkelt fel lagrad siffra. 165 av 220 leder är slingor, 55 är öppna.)*

### `sparmarkering`: tre stavningar av ingenting

84 distinkta värden, varav tre betyder samma sak: `"-"` (22), `"Omarkerad"` (18) och
`null` (16). Tillsammans 56 features, alltså 28 %.

Alla tre normaliseras till `"Omarkerad"`. Det är redan konventionen i databasen — 36
rader har exakt det värdet — och `app/src/components/trail/trail-info.tsx:28` renderar
`trailSymbol` rakt av under etiketten "Markering", så `null` skulle ge ett tomt fält
medan `"-"` skulle visa ett bindestreck.

De återstående ~70 värdena är fritext för en handfull färger med olika stavning:
`"orange"`, `"Orange"`, `"Orange markering"`, `"Gul"`, `"Gul markering"`, `"röd"`,
`"Röd markering"`, `"Röd reflex"`. Det är en egen normaliseringsfråga och behöver inte
lösas i samma veva — men den finns, och den syns i appen.

*(Att `"Omarkerad"` är svensk text i databasen som renderas oöversatt är en befintlig
sak, inte något synken inför.)*

---

---

## 7. Utgångsläget i databasen

Mätt 2026-08-20 mot testmiljön:

| | |
| ------------------------------- | --- |
| Leder totalt                    | 228 |
| Aktiva (`IsVerified`)           | 152 |
| `CreatedBy = 'Borås Stad'`      | 136 |
| `CreatedBy = 'MOCK'`            | 9   |
| Namn som delas av flera rader   | 18 grupper, 60 rader |

**Alla åtta FK:er mot `dbo."Trails"` är `ON DELETE CASCADE`:** `VisitorInformations`,
`TrailImages`, `TrailLinks`, `Reviews`, `TrailObstacles`, `CityAreaTrail`,
`UserFavorites`, `UserWishList`. En `DELETE` på fel rad tar kurerat innehåll och
användarnas sparade leder med sig utan felmeddelande.

Innehåll som måste överleva synken: 150 `VisitorInformations`, 470 riktiga `TrailImages`
(ytterligare 589 är mock-platshållare — fyra URL:er som ligger på 136–141 leder var),
370 `TrailLinks`, 30 `Reviews`, 162 `CityAreaTrail`, 26 favoriter, 26 önskelistor.

---

## 8. Beslut som ska överleva synken

Fattade 2026-08-20 utifrån kart- och geometrianalys. De är **testfall för matchningen** —
går synken igenom utan att bryta något av dem fungerar den.

| Grupp | Beslut | Underlag |
| ----- | ------ | -------- |
| `Torpanäset` / `Hofsnäs Torpanäset` (254, 398, 377) | Tre **olika** leder. Alla behålls, alla aktiva. | Källan har fortfarande 3 features. |
| `Sjuhäradsrundan` (242, 244, 359) | 242 + 359 = sluten ögla, 130,93 km (angiven längd 130 km). 244 är egen rad: *alternativ sträckning*. | Alla tre delar start- och slutpunkt (0,0 m). Källan har nu `Sjuhäradsrundan (alternativ sträckning)` som egen feature. |
| `Kröcklings hage` (413 + 305, 271, 311) | 413 **är** 2 km-leden (1,87 km, `TrailLength` 2.00). 305/271/311 är 86 m importsplitter. Texten på 271 (988 tkn) räddas till 413. | Fragmenten ansluter inte rent — glapp 0,9–2,5 m, merge ger 2–3 delar. |
| `Älmåsspåret` (397, 268) | 268 ingår inte i leden. | Ej kopplad på Borås karta; överlapp 9 % / 1,6 %. |
| `Aplareds IF Elljusspår` (365, 298) | Två **olika** slingor. Behålls som de är. | |
| `Rydboholms SK Elljusspår` (347, 299) | Två **separata** spår. Behålls som de är. | Överlapp 5,8 % / 1,8 %. |
| `Vänga mosse` (313, 295) | 313 är korrekt (sluten slinga, 2,345 km). 295 är trasig och lagas med `Hikes` id 32. | 295 öppen med 1 217,8 m glapp. Hike 32: 3,609 km, 6,1 m mellan ändar, innehåller 100 % av 295. Kräver `ST_SetSRID(...,4326)`. |
| `avpubl Svaneholm / Bogryd`, `Avpublicerad Naturstig` | Lämnas orörda — avpublicerade av källan. | |
| `Olsfors-kommungränsen` (24 rader) | Ersätts av `Etapp 02 Hestra - Olsfors` vid synken. Merge för hand är onödig. | 24/24 matchade sin källfil exakt. |
| MOCK-rader (id 1, 2, 4–9) | ~~Raderas.~~ **Gjort 2026-08-20** mot testmiljön. | Inaktuell startdata. Id 7 hade en geometri med 1 punkt. Sex av dem var dessutom exakta geometriska dubbletter av riktiga leder — se nedan. |
| MOCK id 3 `Tångenleden` | **Behålls.** ~~`CreatedBy` → `Borås Stad`, relativ symbolväg.~~ **Gjort 2026-08-20.** `CreatedBy` → `Borås Stad`. `TrailSymbolImage` byts från `https://inkaben.se/stigvidd/mock/mock-trail-symbol.png` till relativ sökväg. | Bär 2 recensioner, 1 favorit, 1 önskelista, VisitorInformation, 1 139 tkn beskrivning. Absolut URL bryter konventionen att symbolvägar prefixas med `PresentableBaseUrl`. |

### Beslut 2026-08-20: Sjuhäradsleden byggs om i stället för att matchas

De 36 raderna med `juhärad` eller `Olsfors` i namnet är dubbletter, importfragment och
inaktuella aggregat — 21 av dem heter `Olsfors-kommungränsen` och har 6–33 punkter var.
Att matcha tio rena etapp-features mot dem kostar mer granskningsarbete än det ger.

Underlaget: **35 av 36 är opublicerade** (bara 242 syns i appen). **Noll användarinnehåll**
står på spel — den enda recensionen och den enda önskelistan sitter på 318, som matchar
exporten exakt och inte rörs. De 142 bilderna är mock-platshållarna som ligger på 135–140
leder var.

**Tre rader klarar sig själva** genom exakt geometrimatchning: 302 → `Etapp 04`,
318 → `Etapp 02`, 359 → `Sjuhäradsrundan (alternativ sträckning)`.

**32 rader raderas** — `backend/cleanup-sjuharadsleden.sql`, **kört mot testmiljön
2026-08-20**. Efteråt: 220 → 188 leder, noll av de 32 kvar, 302 bär de 568 tecknen, noll
föräldralösa bilder/länkar/besöksinfo/favoriter/önskelistor, och fortfarande noll
fingeravtryckskollisioner. 318:s recension ligger kvar. Ögonblicksbild av de 32 raderna
med WKT-geometri plus deras 36 länkar och 126 bilder togs före körningen och ligger
utanför repot. Inte kört mot produktion. Verifierat att inget unikt
följer med: 285:s `FullDescription` finns ordagrant inuti 221:s, 244 är byte-identisk med
242 i text och taggar, och 221:s `Description` är samma som 302:s. Bara 221:s
`FullDescription` (568 tkn) är unik och flyttas till 302 före raderingen.

### Rättelse 2026-08-20: 242 har en motsvarighet, och 280 saknar namn

Matcharen (§4) körd mot verklig data motsäger två saker nedan.

**242 `Sjuhäradsrundan` har en motsvarighet.** Feature 148 matchar 90,7 % framåt och
99,2 % bakåt. Beslutet nedan — skapa ny, publicera, radera 242 — är alltså onödigt.
Synken kan i stället koppla om 242 och uppdatera geometrin, och då **behåller den sina
recensioner och favoriter**. Hausdorff är 4 801 m, så sträckningarna avviker 4,8 km
någonstans: ett granskningsfall, inte en automatisk uppdatering.

**Led 280 har inget namn alls.** 60,56 km, 30 402 punkter, `TrailLength` 47,00,
opublicerad, noll användarinnehåll. Enda namnlösa leden i tabellen. Den slapp
Sjuhärad-städningen för att den frågan filtrerade på namn, och 280:s namn är tomt.
Fyra av de nya etapperna (07–10) ligger 100 % inuti den, och `TrailLength` 47 är samma
inaktuella siffra som resten av aggregaten bär. Med all sannolikhet ännu ett
Sjuhäradsleden-aggregat, och därmed en raderingskandidat på samma grund som de 32.
**Raderad 2026-08-21** av användaren, på den grunden.

~~**242 väntar.** Den är den enda publicerade, saknar motsvarighet i exporten (källan har
ritat om Sjuhäradsrundan: 63 643 punkter mot dess 59 107) och har unik text. Den tas bort
först när synken skapat den nya rundan och den publicerats.~~ **Ersatt 2026-08-21:** 242
kopplas om mot feature 148 och behåller sitt id, sin text och sitt användarinnehåll.
Geometrin uppdateras till källans. Förslaget går genom granskningen som alla andra —
Hausdorff 4,8 km är för stort för att godkännas automatiskt.
`TrailLength` rörs inte: källans angivna längd och 242:s curerade siffra är båda 130 km
(beslutat 2026-08-21). Hausdorff mäter största avvikelse, inte längdskillnad, så en
omdragen sträckning kan avvika 4,8 km och ändå vara lika lång.

En detalj att städa efteråt: texten som flyttas till 302 påstår `"Sträckan genom Borås är
47 km"`. Det är samma inaktuella siffra som i Öppna frågor, fast i brödtext. Två leder har
den formuleringen, båda i raderingslistan — men den följer med via flytten.

Ytterligare dubbletter som synken ska landa rätt i:
`Storsjöleden` 2 ≡ 424 (`ST_Equals` = true), `Tångenleden` 3 ⊃ 252 + 309 (100 % inuti),
`Nordtorp-RyaÅsar` 302 ⊃ 221, `Rya åsar Vildmarksspåret` 373 ≡ 292,
`Rya åsar Utsiktsstigen` 406 ≡ 253.

Kartunderlaget för besluten: granskningsartefakten från 2026-08-20.

---

## 9. Admin-UI för synken

Granskningen görs i admingränssnittet: ladda upp GeoJSON-filen, se matchningsförslagen,
fatta besluten. Tre faser, och **ingenting rör `Trails` förrän Verkställ**:

```
Ladda upp  →  Analysera (bakgrundsjobb)  →  Granska kö  →  Verkställ
   ↓                  ↓                          ↓             ↓
 session         förslag + konfidens        dina beslut   transaktion
```

### Entiteter

```csharp
public class TrailImportSession : BaseEntity
{
    public required string Source { get; set; }        // "boras-stad"
    public required string FileName { get; set; }
    public long FileSizeBytes { get; set; }
    public required string FileHash { get; set; }      // SHA-256 — varnar vid omuppladdning
    public required string StoredPath { get; set; }    // mediavolymen, inte en textkolumn
    public ImportSessionStatus Status { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime? AnalyzedAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public int FeatureCount { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ApplyReport { get; set; }           // jsonb: vad Verkställ faktiskt ändrade
    public ICollection<TrailImportProposal>? Proposals { get; set; }
}

public enum ImportSessionStatus
{
    Uploaded, Analyzing, AwaitingReview, Applying, Applied, Failed
}

public class TrailImportProposal : BaseEntity
{
    public int SessionId { get; set; }
    public TrailImportSession? Session { get; set; }

    public required string ExternalId { get; set; }        // properties.id i DENNA fil
    public required string FeatureName { get; set; }
    public required string GeometryFingerprint { get; set; }
    public string? FeatureProperties { get; set; }         // jsonb
    public LineString? FeatureGeometry { get; set; }       // granskningen slipper läsa om filen

    public int? SuggestedTrailId { get; set; }
    public MatchConfidence Confidence { get; set; }
    public double CoverageForward { get; set; }            // % av featuren som ligger på leden
    public double CoverageBackward { get; set; }           // % av leden som ligger på featuren
    public double? HausdorffMeters { get; set; }
    public string? MatchReason { get; set; }               // "identical geometry hash"

    public ProposalDecision Decision { get; set; }         // Pending som default
    public int? DecidedTrailId { get; set; }               // vald vid granskningen
    public int? CreatedTrailId { get; set; }               // satt av Verkställ vid CreateNew
    public TrailSourceLinkRole DecidedRole { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
}

public enum ProposalDecision { Pending, Accept, Relink, CreateNew, Exclude, Skip }
```

### Vilka leder blev nya?

Nya leder behöver bilder, besöksinformation, beskrivning och taggar efteråt — och det
arbetet görs av en människa långt efter att synken kört. Listan får därför inte bara
finnas som ett ögonblick i granskningsvyn.

`CreatedTrailId` på förslaget är det som gör den frågan besvarbar i efterhand:
Verkställ sätter den när ett `CreateNew`-förslag faktiskt skapat en led. Då är "vad blev
nytt i session 12" en vanlig query, för alltid, och inte något som måste fångas i stunden.

Två saker till som gör listan användbar:

- **Nya leder skapas `IsVerified = false`.** De ska inte synas i appen innan de fått
  innehåll. Det gör också arbetslistan självförklarande: opublicerade leder från senaste
  sessionen är precis det som återstår.
- **Sessionens `ApplyReport`** sammanfattar körningen — antal skapade, uppdaterade,
  omkopplade och avpublicerade — så att man ser omfattningen utan att räkna förslag.

Endpointen `GET /api/v1/admin/trail-import/sessions/{id}/created` returnerar de skapade
lederna med identifierare och namn. Samma lista i CSV är värd att ha, eftersom
efterarbetet är avprickning snarare än klickande.

Förslagen är ett mellanlager. Analysen skriver dem, granskaren ändrar `Decision`,
Verkställ läser dem och skriver `TrailSourceLink` + `Trail`. Går att avbryta när som
helst utan att något är halvgjort.

### Endpoints

Samtliga med `[Authorize(Policy = "Admin")]`.

```
POST   /api/v1/admin/trail-import/sessions                  multipart GeoJSON → session
POST   /api/v1/admin/trail-import/sessions/{id}/analyze     köar bakgrundsjobbet
GET    /api/v1/admin/trail-import/sessions                  lista
GET    /api/v1/admin/trail-import/sessions/{id}             status + summering per konfidens
GET    /api/v1/admin/trail-import/sessions/{id}/proposals   ?confidence=&decision=&page=
GET    /api/v1/admin/trail-import/sessions/{id}/proposals/{pid}/preview   → GeoJSON
POST   /api/v1/admin/trail-import/sessions/{id}/proposals/{pid}/decide
POST   /api/v1/admin/trail-import/sessions/{id}/decide-bulk  { ids[], decision }
GET    /api/v1/admin/trail-import/sessions/{id}/diff        vad Verkställ kommer göra
POST   /api/v1/admin/trail-import/sessions/{id}/apply
DELETE /api/v1/admin/trail-import/sessions/{id}
```

Uppladdningsgränsen räcker: `Program.cs` sätter redan 100 MB (`maxUploadBytes`), och
exporten är 21,5 MB.

### Analysen är ett bakgrundsjobb

En parvis spatial jämförelse av hela materialet tog ~38 s mot testdatabasen. Det är för
långsamt för ett HTTP-anrop och granskaren behöver progress. Kö + `BackgroundService`
med `IServiceScopeFactory` för egen DbContext — samma mönster som
`ExpiredObstacleCleanupService`, men händelsestyrt i stället för tidsstyrt.
`Session.Status` driver UI:t; frontend pollar.

### Granskningsvyn

Summeringsrad överst: `Certain` / `High` / `Medium` / `Unmatched` med antal. Bara de två
sista kräver en människa, men de två första ska gå att stickprova.

Per förslag i listan: featurenamn, föreslagen led, konfidenschip, täckning i procent,
och en **miniatyrkarta**. Detaljvyn visar större karta, en diff mellan källans värden och
ledens nuvarande, och besluten.

Beslut: **Godkänn** (koppla enligt förslaget), **Koppla om** (sök annan led), **Ny led**,
**Uteslut** (`avpubl`, trasig geometri), **Hoppa över**. Massval för `Certain` och `High`.
Tangentbord — `j`/`k` för att stega, `a` godkänn, `x` uteslut, `n` ny led. 203 features
går fort när man inte behöver flytta handen till musen.

### Kartan: webben har inget kartbibliotek

`web/package.json` innehåller varken maplibre, leaflet eller mapbox, och det finns inga
kartkomponenter under `src/`. Att granska geometrisk matchning utan att se geometrierna
är dock hela svårigheten.

Förslag: börja med **klientritad SVG** ur `preview`-endpointens GeoJSON — feature i en
färg, kandidatled i en annan, ändpunkter markerade, skalstock. Ingen ny dependency, ingen
tile-kostnad, och det räcker för att skilja kedja från dublett från två olika leder.
Lägg till `maplibre-gl` på detaljvyn först om granskningen visar att bakgrundskarta
behövs för att avgöra om en sträcka följer väg eller stig — MapTiler-nyckel och
attribution finns redan från appen.

### Verkställ

I en transaktion:

1. Skriv `TrailSourceLink` ur besluten, med `ConfirmedByHuman = true` på allt som en
   människa rört.
2. Räkna om `GeoPath` för berörda leder ur deras `Segment`-länkar.
3. Applicera källägda fält med trevägs-merge (§5).
4. Sätt `MissingSinceAt` på länkar som inte sågs i filen. **Radera aldrig** — avpublicera.
5. Spara `ApplyReport` på sessionen.

Idempotent: att verkställa en redan verkställd session är en no-op. Filhashen gör att
omuppladdning av samma fil känns igen.

Beslutstabellen i §8 är facit under den första granskningsomgången.

---

## 10. Ordning att bygga i

1. ~~**`[Authorize(Policy = "Admin")]` på `AdminController`**~~ **Gjort 2026-08-20** —
   och hela §11 med den, alla fyra stegen. Kvar där är bara det som ligger utanför koden:
   realm-rollen `stigvidd-user` ska skapas i Keycloak, sättas som default role och
   backfillas, innan `Authorization:UserRole` sätts. Skickat till authteamkamraten.
2. ~~Entitet + EF-konfiguration + migration~~ **Gjort 2026-08-20** —
   `Infrastructure/Data/Entities/TrailSourceLink.cs`, enumerna i `Infrastructure/Enums/`,
   `Trail.SourceLinks`, tre index och `SetNull` i `StigViddDbContext`, migrationen
   `20260820135013_AddTrailSourceLink`. Migrationen rör bara den nya tabellen — inga
   ALTER på befintliga. `SourceSnapshot` är `jsonb`; integrationstesternas SQLite
   accepterar kolumntypen, så `EnsureCreated` bygger modellen på båda providers
   (276 integrationstester, 927 enhetstester gröna). **Körd mot testmiljön 2026-08-20**,
   som SQL-skript efter granskning i stället för `dotnet ef database update`, eftersom
   `Infrastructure`s user secrets inte var verifierade att peka på test. 13 av 13
   migrationer applicerade. Beteendet provat i en transaktion som rullades tillbaka:
   det unika indexet avvisar en dubblett, samma avtryck under en annan `Source` släpps
   igenom, `SourceSnapshot->>'sparlangd'` går att läsa, och en raderad led lämnar sina
   länkar kvar med `TrailId = NULL`. Inte körd mot produktion.

   Notera: `__EFMigrationsHistory` ligger i `public`, inte i `dbo` som tabellerna.
3. ~~Geometrihash~~ **Gjort 2026-08-20** — `Core/Common/GeometryFingerprint.cs`,
   SHA-256 över hela punktlistan vid 7 decimalers precision, riktningsnormaliserad.
   13 tester i `Tests/UnitTests/CommonTests/`. Verifierad mot verklig data i en enda
   kodväg: noll kollisioner i både exporten (203) och databasen (220), 177/203 exakt
   matchning. Den spatiala matcharen återstår, med §8 som testfall.
4. ~~`TrailImportSession` + `TrailImportProposal` + migration.~~ **Gjort 2026-08-20** —
   entiteterna, enumerna `ImportSessionStatus` och `ProposalDecision` i
   `Infrastructure/Enums/`, migrationen `20260820161610_AddTrailImportSession`, körd mot
   testmiljön på samma sätt som steg 2 (granskad SQL, inte `database update`). 14 av 14
   migrationer applicerade, två nya tabeller, inga `ALTER` på befintliga.

   `SuggestedTrailId`, `DecidedTrailId` och `CreatedTrailId` är **avsiktligt vanliga
   int-kolumner, inte främmande nycklar**. Ett förslag är ett protokoll över vad som
   beslutades, och en raderad led får inte nollställa den historiken — vilket är precis
   tvärtom mot `TrailSourceLink`, där `SetNull` är hela poängen. Verifierat i en
   transaktion som rullades tillbaka: en raderad led lämnar `CreatedTrailId` orört, medan
   en raderad session tar sina förslag med sig (`Cascade`). Geometrin går att mäta med
   PostGIS och `FeatureProperties->>'sparlangd'` går att läsa.

   Ett index på `(Source, FileHash)` gör omuppladdningsvarningen billig. Inte unikt — att
   ladda upp samma fil igen ska varna, inte blockera.
5. **Analysen som bakgrundsjobb — PÅBÖRJAT 2026-08-20, se "Läget just nu" sist i dokumentet.**
6. ~~Admin-endpoints.~~ **Gjort 2026-08-21** — `StigviddAPI/Controllers/TrailImportController.cs`
   under `api/v1/admin/trail-import`, hela klassen bakom `[Authorize(Policy = "Admin")]`.
   Tio endpoints byggda; `diff` och `apply` hör ihop med trevägs-mergen och ligger kvar i
   punkt 8. Lager under: `ITrailImportService`/`TrailImportService` (validering och
   översättning till svar), `ITrailImportFileStore`/`TrailImportFileStore` (filen på disk),
   och elva nya repositorymetoder. Kontrakten ligger i `WebDataContracts/*/TrailImport/`.
   Se "Steg 6" sist i dokumentet.
7. ~~Admin-UI: uppladdning, granskningskö, SVG-preview, beslut.~~ **Gjort 2026-08-21** —
   `/trail-import` (uppladdning + sessionslista) och `/trail-import/:sessionId`
   (granskningsvyn), plus `GeometryPreview` som ritar båda linjerna i SVG utan nytt
   kartbibliotek. Se "Steg 7" sist i dokumentet.
7b. ~~Ledrelationer: entitet, enum, migration.~~ **Gjort 2026-08-23** — `TrailRelation` med
   `PartOf` och `Alternative`, migrationen `20260823093348_AddTrailRelation`, fyra bevisade
   schematester. Ligger före steg 8 därför att föräldern annars publiceras som en ensam
   134 km-led utan något sätt att filtrera bort den. Se "Ledrelationer" sist i dokumentet.
8. ~~Verkställ-fasen med trevägs-merge.~~ **Gjort 2026-08-23** — `POST sessions/{id}/apply`,
   `ApplyPlanner` som ren funktion, tvågrindad trevägs-merge, härledd `GeoPath`, idempotent,
   plus omanalysvarningen och `ApplyPanel` i webben. **Inte körd mot någon databas.**
   Se "Steg 8 — Verkställ" sist i dokumentet.
9. Skriv om `TransmogrifyBorasData` att gå via sessionen i stället för att `Add`:a rakt av.
10. Hantering av saknade och avpublicerade features.
11. Schemaläggning av synken (samma kod, ingen manuell uppladdning).
12. Bryt ut synkkärnan och lägg källadaptrarna bakom ett gränssnitt — **se §12**. Ligger
    här och inte tidigare därför att steg 9 är adapterns första andra-användare.

~~MOCK-städningen (§8) är oberoende av allt ovan och kan göras när som helst.~~ **Fel —
den var en förutsättning, och är gjord 2026-08-20.** Sex av MOCK-raderna var exakta
geometriska dubbletter av riktiga leder (1≡302, 2≡424, 4≡318, 5≡289, 6≡304, 8≡9≡254) och
utgjorde samtliga sex fingeravtryckskollisioner i tabellen. Det unika indexet i steg 2
hade inte kunnat skapas med dem kvar. Efter städningen: 220 leder, noll kollisioner.

---

## 11. Rollmodellen och hålet i den

Kartlagt 2026-08-20. **Åtgärdas innan nya admin-endpoints byggs**, annars ärver de samma hål.

Målbilden är tre nivåer: **icke-medlem** (utloggad), **user** (inloggad appanvändare) och
**admin**. Rollerna är inte färdiga än.

### Vad som fanns innan åtgärd

Nuläget nedan är kartläggningen som gjordes innan steg 1–4 i *Ordning* utfördes.

Autentiseringen var konsekvent genomförd: varje skrivande endpoint hade `[Authorize]`,
läsningar är anonyma. Det är rätt gräns mot icke-medlemmar.

Det som saknas är nivån ovanför. `Policy` förekommer **noll gånger** i samtliga femton
controllers. `Program.cs:71` definierar en policy mot realm-rollen `stigvidd-admin` — med
en kommentar om att den ska gate:a export/import — men den används aldrig.
`app.MapControllers()` (rad 174) har ingen `RequireAuthorization`, och det finns varken
`FallbackPolicy` eller globala filter.

Rollen `stigvidd-admin` **finns och fungerar**, men bara i webbfrontenden:
`web/src/services/keycloak-auth.ts:32` sätter den som `REQUIRED_ROLE` och inloggningen
avvisas utan den (rad 143, 165). Den kollen är kosmetisk — API:t bryr sig inte, så ett
app-token räcker för att gå direkt på endpointen.

Följden är att vilken inloggad appanvändare som helst kan:

- **redigera eller skapa vilken led som helst** (`PUT /trails/{id}`, `POST /trails`)
- ladda upp och radera ledbilder och symboler
- skapa, ändra och radera anläggningar (`FacilitiesController`)
- läsa och ändra hela mediabiblioteket
- `GET /api/v1/admin/export` → hela databasen, mediavolymen och Keycloak-realmen med
  samtliga användaruppgifter
- `POST /api/v1/admin/import` → dokumenterad "DESTRUCTIVE — replaces this host's data"

### Föreslagen indelning

| Endpointgrupp | Idag | Bör vara |
| ------------- | ---- | -------- |
| `GET` leder, stadsområden, anläggningar, hinder, recensioner | anonymt | **icke-medlem** |
| Egna vandringar (CRUD), recensioner, favoriter, önskelista, vänner, notiser, konto | `[Authorize]` | **user** |
| Rapportera hinder (`POST /trailobstacles`) | `[Authorize]` | **user** |
| Leder: `POST`, `PUT`, bilder, symbol | `[Authorize]` | **admin** |
| Anläggningar: `POST`, `PUT`, `DELETE`, bilder | `[Authorize]` | **admin** |
| Mediabibliotek (`GET`, `PATCH /media`) | `[Authorize]` | **admin** |
| `admin/export`, `admin/import` | `[Authorize]` | **admin** |
| `admin/trail-import/*` (§9) | — | **admin** |

Rollen ensam räcker inte överallt: radering av egen recension eller eget hinder är
`user` + ägarskap, medan admin ska kunna radera andras. Ägarkontrollen ligger i
servicelagret och måste finnas kvar bredvid rollkollen.

### Ordning

1. ~~`[Authorize(Policy = "Admin")]` på `AdminController`.~~ **Gjort 2026-08-20.**
2. ~~Samma policy på ledernas och anläggningarnas skrivendpoints samt `MediaController`.~~
   **Gjort 2026-08-20** — 12 endpoints i `TrailsController`, `FacilitiesController` och
   `MediaController`. Verifierat att appen inte anropar någon av dem: den läser bara
   `GET /facilities` anonymt, rör inte `/media`, och dess `addTrail` är död kod som bara
   refereras av sitt eget test.
3. ~~Inför `user`-rollen och sätt den på appanvändarnas endpoints.~~ **Gjort 2026-08-20** —
   policyn `User` finns i `Program.cs` och sitter på samtliga 18 tidigare nakna
   `[Authorize]` i `FriendsController`, `HikeShareRecipientController`,
   `HikeSharesController`, `HikesController`, `NotificationsController`,
   `ReviewsController`, `TrailObstaclesController` och `UsersController`.

   Realm-rollen finns **inte** i Keycloak ännu, så policyn är byggd i två lägen:

   ```csharp
   var userRole = builder.Configuration["Authorization:UserRole"];

   options.AddPolicy("User", policy =>
   {
       policy.RequireAuthenticatedUser();

       if (!string.IsNullOrWhiteSpace(userRole))
       {
           policy.RequireRole(userRole, adminRole);
       }
   });
   ```

   Så länge `Authorization:UserRole` är osatt betyder `User` "vilken inloggad som helst",
   precis som förut — ingen låses ute. När rollen väl finns i realmen räcker det att sätta
   konfignyckeln för att slå på kontrollen; ingen kodändring. Admin passerar `User`
   eftersom en administratör också är medlem.

   **Att göra i Keycloak innan nyckeln sätts:** skapa realm-rollen, lägg den som *default
   role* så nya konton får den vid registrering, och backfill:a befintliga användare.
   Sätts nyckeln före det får alla 403.

   > **ÅTERSTÄLLT 2026-08-25.** Rollen skapas aldrig — realmen ska ha en enda roll, admin.
   > Policyn `User` och alla 18 attributen är borta, tillbaka till naket `[Authorize]`.
   > Se "Användarrollen är borttagen" sist i dokumentet. Målbilden ovan är alltså
   > tvådelad, inte tredelad: utloggad, inloggad, admin.

4. ~~Överväg `FallbackPolicy` = autentiserad, med explicit `[AllowAnonymous]` på de
   publika `GET`-arna.~~ **Gjort 2026-08-20.** `FallbackPolicy` kräver nu inloggad
   anropare för endpoints helt utan authorization-metadata, så en glömd attribut-rad
   failar stängt i stället för öppet. 14 endpoints markerades `[AllowAnonymous]`:
   `CityAreasController` (klassnivå, båda `GET`), två `GET` i `FacilitiesController`, en i
   `ReviewsController`, två i `TrailObstaclesController` och sju i `TrailsController` —
   varav `POST /trails/cards`, som är en batchläsning trots verbet och därför lätt att
   missa när man scannar efter `[HttpGet]`. `AccountController` var redan `[AllowAnonymous]`
   på klassnivå. `app.MapOpenApi()` fick `.AllowAnonymous()`; NSwags `UseOpenApi()` och
   `UseSwaggerUi()` är middleware som ligger före `UseAuthorization()` och berörs inte.

### Testtäckning

`TestAuthHandler` läser realm-roller ur headern `X-Test-Roles` (kommaseparerad) och
speglar därmed vad `KeycloakRealmRolesTransformation` gör med ett riktigt token. Tester
som anropar admin-endpoints sätter `X-Test-Roles: stigvidd-admin`.

Sex tester verifierar **403 utan rollen**: `admin/export`, `admin/import`,
`POST /trails/create`, `PUT /trails/{id}`, `POST /facilities` och `GET /media`. Ett sjunde
täcker 401 på `admin/export` utan token, eftersom `AdminController` saknade testfil helt.
Lägg till motsvarande när nya admin-endpoints byggs (§9).

`Tests/IntegrationTests/Authorization/EndpointAuthorizationTests.cs` täcker hela ytan i
stället för enskilda endpoints. Den räknar upp `EndpointDataSource` i testvärden och:

- **`AnonymousEndpoints_ShouldBeExactlyTheApprovedOnes`** jämför alla endpoints med
  `IAllowAnonymous` mot en lista på 17 (14 publika läsningar + `Account/register` +
  `Account/forgot-password` + OpenAPI-dokumentet, som bara mappas i Development —
  testvärden kör `UseEnvironment("Development")`). Ett nytt publikt endpoint kräver därmed
  en medveten rad i testet, inte bara ett attribut.
- **`ProtectedEndpoints_ShouldNameAPolicy`** kräver att varje icke-anonymt endpoint har
  `[Authorize(Policy = …)]`. `FallbackPolicy` ska vara ett skyddsnät, inte mekanismen —
  ett endpoint som bara överlever tack vare fallbacken fäller testet.
- **`UserPolicy_WhenTheRoleIsConfigured_ShouldRejectCallersWithoutIt`** startar en extra
  värd med `UseSetting("Authorization:UserRole", "stigvidd-user")` och verifierar 403 utan
  rollen och icke-403 med den. Det är beviset för att omkopplaren i steg 3 faktiskt biter
  den dag rollen finns i Keycloak.

Totalt 276 integrationstester och 877 unit-tester gröna, bygget utan varningar.

---

## 12. Flera källor: Härryda, och det som gör den dyr

Beslutat 2026-08-21. Synken är byggd för Borås, men den ska tåla en andra kommun utan att
kodbasen växer på tvären. Frågan är inte om koden ligger snyggt — den är vad ett tillägg
av `Härryda` faktiskt kostar i filer.

### Vad som redan är källoberoende

Matchningen bryr sig inte om vem som publicerat datan. `GeometryFingerprint`,
`GeometryComparison`, `TrailMatcher` och `LocalMetricProjection` tar en `LineString` in och
ger ett svar ut. Sessioner, förslag, granskningsvyn, besluten, verkställ — allt det är en
enda implementation oavsett antal källor. `Source` är redan ett fält på både
`TrailImportSession` och `TrailSourceLink`, och det unika indexet är
`(Source, GeometryFingerprint)`, så två kommuner kan äga samma geometri utan att krocka.

### Vad som faktiskt är Borås-specifikt

Tre ställen, inte fler — men alla tre är hårdkodade idag:

| Var | Vad | Varför det inte bär |
| --- | --- | ------------------- |
| `SourceFeatureReader` | `properties.namn` och `properties.id` som fältnamn | Härryda heter något annat |
| `SourceFeatureReader.ReadGeometry` | Antar en platt `LineString`-koordinatlista | Klarar inte `MultiLineString`, och tar inget SRID: Borås publicerar i WGS84, vilket inte är givet någon annanstans |
| `TrailLength.Parse` | `sparlangd`s sex format | En annan kommun har sina egna format, eller inget fält alls |
| `TrailImportService.ReadSourceLength` | Slår upp `"sparlangd"` som strängkonstant | Samma sak |

### Beslutet: en adapter per källa, inget mer

Sömmen läggs vid inläsningen, inte vid arkitekturen. Ett gränssnitt som tar en fil och ger
normaliserade `SourceFeature` — externt id, namn, angiven längd, egenskapssnapshot och en
geometri i WGS84 — och en implementation per kommun. Allt nedströms om det ser samma sak.

Konsekvensen är den som betyder något: **Härryda blir en ny fil plus en registrering**,
inte en ny uppsättning entiteter, repositories, endpoints och vyer. Uppladdningen tar redan
emot `source` som parameter; den väljer adapter i stället för att anta Borås.

Det som ska in i adaptern och ut ur det som finns:

- `SourceFeatureReader` blir `BorasStadSourceAdapter` och slutar vara statisk.
- Fältnamnen (`id`, `namn`, `sparlangd`) blir adapterns ensak. `TrailImportService` ska
  inte känna till `sparlangd`.
- `TrailLength.Parse` flyttar in i adaptern. `TrailLength.FromGeometry` och `Disagrees`
  stannar där de är — de mäter och jämför, vilket är källoberoende.
- Projektion till WGS84 blir adapterns ansvar, så en källa i SWEREF99 kan läggas till utan
  att något annat vet om det.

### Och paketeringen

Samma beslut gäller filplaceringen, av samma skäl: när en andra källa finns ska ingen
behöva leta. Synkkärnan — de fyra geometrifilerna, `TrailLength` och adaptrarna — bryts ut
ur `Core/Common/`, där den idag ligger som granne med `PagedResult` och `RepositoryResult`.
Enkelriktat beroende: kärnan kan NetTopologySuite och ingenting annat.

**Vad som INTE bryts ut, och varför.** Entiteterna kan inte lämna `Infrastructure` —
`StigViddDbContext` måste se dem, så ett projekt som ägde både entiteter och repository
hade refererat `Infrastructure` samtidigt som `Infrastructure` refererade det. Cirkel.
Controllern och `TrailImportAnalysisWorker` kan inte lämna API:t: granskningen är HTTP och
kön är en `Channel<int>` i processen. Att flytta ut arbetaren betyder riktig kö — tabell
att polla eller meddelandebuss — vilket är ett eget bygge, inte en flytt.

Alltså: **fristående som modul, inte som körbar enhet.** MapData är en konsolapp som körs
för hand en gång; den här måste bo i API:t eftersom en människa klickar i den.

### När

**Efter steg 8.** Först då finns hela synken och det går att se vilken sömmen verkligen är
i stället för att gissa. Att abstrahera för Härryda innan verkställ-fasen är skriven vore
att designa gränssnittet mot en halv kravbild.

Två saker som talar för att vänta, utöver det: `TransmogrifyBorasData` skrivs om i steg 9
att gå via sessionen, och den omskrivningen är den första riktiga andra-användaren av
adaptern — den visar om gränssnittet håller. Och namnrymdsbytet träffar
`StigViddDbContextModelSnapshot.cs`, som pekar ut typerna med fullt CLR-namn; den vill man
regenerera en gång, inte två.

**Fram till dess står strukturen.** Steg 7 är admin-UI och rör ingen av filerna.

---

---

## Öppna frågor


### Fundering: föräldrarelation mellan led och etapp — 2026-08-21

**AVGJORD 2026-08-23** — se "Ledrelationer" sist i dokumentet. Det blev den generella
kopplingstabellen, med `PartOf` och `Alternative`. Resten av avsnittet är underlaget som
ledde dit och står kvar som det skrevs.

Uppkom under granskningen av importen. `Sjuhäradsleden Alla Etapper` (källans id 366) är
en sammanhängande linje på 134,25 km — hela leden som **en** feature, vid sidan av de tio
etapp-features som utgör samma sträcka. Frågan blev: kan man knyta aggregatet till
etapperna så att en användare som tittar på en etapp kan se leden i sin helhet?

**Vad som finns idag: ingenting.** `TrailLink` är externa URL:er (`Link` + `Title`), inte
relationer mellan leder. `TrailSourceLink` bär `SourceSnapshot` — källans *egenskaper* som
jsonb — men **ingen geometri**, och appen läser aldrig den tabellen; den är synkens
bokföring. En `Duplicate`-länk skulle alltså registrera släktskapet men inte ge appen någon
linje att rita. Geometrin finns bara på `TrailImportProposal`, som är sessionsdata och
försvinner med sessionen.

**Två vägar:**

| | Föräldrarelation | Generella ledrelationer |
| --- | --- | --- |
| Modell | `Trail.PartOfTrailId int?`, självrefererande | Kopplingstabell med relationstyp |
| Typer | Bara "del av" | `PartOf`, `Alternative`, `Nearby` |
| Löser också | — | 242 ↔ 359 *alternativ sträckning*, Torpanäsets tre |
| Kostnad | En nullable kolumn, en relation, en migration | Ny tabell, enum, mer UI |

Förälder/barn är bokstavligen vad "Alla Etapper + Etapp 01–10" är, så den mindre vägen
räcker för det som utlöste frågan. Kopplingstabellen är dit man går om alternativ
sträckning också ska med — och det finns redan två sådana fall i materialet, vilket är
argumentet för att ta den större vägen direkt.

**Att ta upp med senior:** om relationen ska vara enkelriktad eller symmetrisk, om
`GeoPath` på föräldern ska härledas ur barnen eller vara källans egen linje, och vad som
händer i appen när samma mark täcks av både förälder och etapp på kartan.

**Sekvensering — det här blockerar inte steg 8.** Verkställ behöver bara veta om aggregatet
blir en led eller inte. Väljs `CreateNew` finns leden, och `PartOfTrailId` kan läggas till
senare som en additiv ändring. Det är **`Exclude` som är det oåterkalleliga valet**:
beslutet måste då tas tillbaka och importen köras om för att komma åt idén.

Notera att namnet i så fall blir källans, `Sjuhäradsleden Alla Etapper`. Enligt §5 är
`Name` vårt, så det är ett namn att kurera till bara `Sjuhäradsleden`.

**Rättelse till tidigare råd i den här filen:** aggregatet kallades först en
raderingskandidat på samma grund som de 32 Sjuhärad-raderna. Det är fel parallell — de var
*fragment* (21 stycken `Olsfors-kommungränsen` med 6–33 punkter var), medan den här är en
sammanhängande linje som mäter rimligt mot sin egen uppgivna längd (134,25 mot 140 km).

**Licensen** på datasetet bör kollas på katalogsidan innan lansering. Vi krediterar redan
"Borås Stad" via `Trail.CreatedBy` och `TrailLink.Title`, men villkoren är värda att ha
svart på vitt nu när det inte längre är ett examensarbete.

**Sjuhäradsledens längd — löst av källan.** ~~Etapperna summerar till ~66 km medan
`TrailLength` säger 47 km på varje rad.~~ 2026-08-exporten har tio etapper med **var sin
egen längd**, vilket är precis det som saknades. Verifierat 2026-08-20:

| | `sparlangd` | mätt |
| --- | --- | --- |
| Etapp 01 Hindås – Hestrafors | 13 km | 13,03 |
| Etapp 02 Hestra – Olsfors | 10 km | 9,34 |
| Etapp 03 Olsfors – Nordtorp | 10 km | 10,24 |
| Etapp 04 Nordtorp – Rya Åsar | 13 km | 12,76 |
| Etapp 05 Rya åsar – Karlsafloga | 19 km | 18,80 |
| Etapp 06 Karlsaflogar – Blackered | 20 km | 19,53 |
| Etapp 07 Blackered – Prångens Camp. | 12 km | 10,95 |
| Etapp 08 Prångens Campg. – Böne kyrka | 15 km | 15,61 |
| Etapp 09 Böne kyrka – Årås kvarn | 12 km | 11,54 |
| Etapp 10 Årås säteri – Hotell Mullsjö | 22 km | **12,46** |
| **Summa** | 146 km | **134,25** |

Etapperna kedjar ihop ände mot ände på **0,0 m** hela vägen — de är en sammanhängande
led, inte lösa bitar. Bara Etapp 10 är påtagligt fel i källan (22 mot 12,5 km); övriga
ligger inom en dryg kilometer.

Att vi äger `TrailLength` (§5) hindrar inte att de här hämtas in. Regeln är att synken
aldrig skriver över — de befintliga 47- och 130-raderna rättas som en **engångsåtgärd**,
med källans etappsiffror som förslag. Därefter gäller regeln som vanligt.

### `Sjuhäradsleden Alla Etapper` är arketypen för `Duplicate`

Exporten har utöver de tio etapperna en feature `Sjuhäradsleden Alla Etapper`:
67 594 punkter, 134,25 km. Etapperna summerar till 67 608 punkter och 134,25 km — samma
längd på metern, och 94–96 % av varje etapps punkter återfinns ordagrant i den. Den är
alltså inte en egen led utan hela sträckan som en enda rad.

Länkas den som `Segment` blir ledens sammanslagna geometri dubbel. Den ska ha rollen
`Duplicate` enligt §3 — det här är det konkreta fall rollen infördes för.

`Sjuhäradsrundan` (131,41 km mätt) är däremot något helt annat trots liknande längd:
den delar **15 av 67 594** punkter med Alla Etapper, alltså 0 %. Två separata leder.

**Etappnamnen ändras.** Databasens `Etapp 1a`, `Etapp 1b`, `Nordtorp-RyaÅsar` m.fl. har
inga motsvarigheter i den nya exportens `Etapp 01`–`Etapp 10`. Namnmatchning kommer att
missa dem; de faller på geometri eller hamnar i granskningskö.

**SRID-buggen i `Hikes`** (18 av 42 rader med SRID 0) ligger utanför den här planen men
bör lagas i samma veva — den blockerar all spatial jämförelse mellan vandringar och leder.

---

## Läget just nu — 2026-08-20 (historik, se 2026-08-21 sist i dokumentet)

### Klart och kört mot testmiljön

| Steg | |
| --- | --- |
| §11 i sin helhet | admin-policy, `User`-policy, `FallbackPolicy`, 14 `[AllowAnonymous]` |
| §8 MOCK-städning | 228 → 220 leder |
| §8 Sjuhäradsleden | 220 → 188 leder, 32 rader borta |
| §10:2 `TrailSourceLink` | migration `20260820135013` körd |
| §10:3 Geometrihash | `GeometryFingerprint`, tre fastnaglade digests |
| §10:4 Session + förslag | migration `20260820161610` körd |

Databasen har **14 av 14 migrationer**, 188 leder, noll länkar, noll sessioner.

### Steg 5: byggt men inte bevisat

Nio nya filer, cirka 630 rader, allt registrerat i DI:

```
SourceFeatureReader      Core/Common/          läser GeoJSON, hoppar över trasiga features
LocalMetricProjection    Core/Common/          grader -> meter
GeometryComparison       Core/Common/          täckning + Hausdorff
TrailMatcher             Core/Common/          §4:s tiers
TrailGeometry            Core/Common/          leden reducerad till det matcharen behöver
ITrailImportRepository   Core/Interfaces/      + TrailImportRepository
ITrailImportAnalysis*    Core/Interfaces/      + service och kö
TrailImportAnalysisWorker StigviddAPI/BackgroundServices/
```

**968 enhetstester och 276 integrationstester gröna, bygget utan varningar.** 41 av dem
är nya här. Efter ändringarna 2026-08-21: 971 enhetstester och 281 integrationstester
gröna, bygget fortfarande utan varningar.

**`TrailLength` är byggd i förskott.** `Core/Common/TrailLength.cs` implementerar §6:s
regel — parsa bara när enheten är utskriven, mät ur geometrin annars, plus `Disagrees`
som flagga när de två siffrorna skiljer sig grovt. 20 tester. Den refereras ännu av
**ingen produktionskod**: den kopplas in när förslagen ska bära en föreslagen längd
(steg 6) och när Verkställ skapar nya leder (steg 8). Ligger utanför de nio filerna ovan
eftersom den hör till §6, inte till matchningen.

Tre beslut som avviker från planen, med skäl:

- **Räknas i C# med NTS, inte i PostGIS.** Det finns noll rå SQL i `Core`/`Infrastructure`
  idag, och PostGIS-vägen hade brutit integrationstesterna som kör SQLite. Projektionen är
  verifierad mot PostGIS: 1842,95 m mot 1843,241 m på samma sträcka, alltså 0,29 m fel.
  Den siffran är inbränd i `LocalMetricProjectionTests`.
- **Täckning mäts på punkter var tionde meter, inte på hörn.** Källan förtätar geometrin
  mellan exporter; en hörnräkning hade gett olika svar för samma sträckning.
- **Tier-reglerna justerade** — se "Tiers efter mätning" i §4.

### Steg 5 är bevisat — 2026-08-21

**Spiken kördes mot testmiljön och siffrorna stämmer: 177 `Certain`, 5 `High`,
5 `Medium`, 16 `Unmatched` av 203 features**, lästa ur databasen och inte ur minnet.
203 av 203 förslag bär sin geometri, alla 203 avtryck är unika, allt står `Pending`,
och den största geometrin (67 594 punkter, `Sjuhäradsleden Alla Etapper`) rundtrippar
genom Npgsql/NTS utan att tappa en punkt. Testmiljön är städad efteråt: noll sessioner,
noll förslag, noll länkar, 188 leder.

De fem `High` är `Banvallen` → 276, `Kröcklings hage` → 305, `Mulleslingan Dalsjöfors`
→ 301, `Tångenleden` → 3 och `Tremilaleden` → 228 — alla på 100 % ömsesidig täckning,
alla med olika namn i databas och källa. Det är kvittot på att namnvillkoret var rätt
att stryka (§4).

De fem `Medium` är fyra Sjuhäradsleden-etapper som pekar på **led 280**, den namnlösa
(18–26 % baklängestäckning), plus `Sjuhäradsrundan` → 242 på 91 %. Båda är precis de
fall §8 lämnade öppna, och de kommer alltså upp i granskningskön av sig själva.

De 16 `Unmatched` är nio kanotleder, fyra Sjuhäradsleden-etapper, `Alla Etapper`,
`A-Ö-skogen` och `Älmås Blåvit led` — samma bild som mätningen 2026-08-20.

### Rättelse: batchstorleken var fel spår

**Diagnosen 2026-08-20 att skrivfelet berodde på storleken var fel.** Uppmätt
2026-08-21 mot testmiljön, samma fil, samma tabell:

| Omgång | Svep 1 | Svep 2 |
| ------ | ------ | ------ |
| 1      | bröt   | OK 3,2 s |
| 3      | OK 1,4 s | OK 1,2 s |
| 5      | bröt   | bröt |
| 10     | bröt   | OK 1,2 s |
| 20     | OK 1,0 s | OK 1,0 s |

Samma storlek bröt i ena svepet och gick igenom i det andra, med sekunder emellan.
Dessförinnan skrevs alla 203 förslag **en och en** utan ett enda fel på 5,5 s — inklusive
67 594-punktaren. Det finns alltså ingen storleksgräns att hitta: **anslutningen kapas
slumpmässigt**, oberoende av hur mycket som skickas.

EF säger det själv i undantagstexten: *"An exception has been raised that is likely due
to a transient failure."*

Batchningen i punkt 1 är därför inte fel — den bär sitt eget skäl, att inte lägga hela
filens geometri i ett enda kommando — men den **löser inte** det som fick körningen
2026-08-20 att haverera. Det gör bara omförsök.

### Fynd: en kapad körning låser tabellen

När en anslutning dör mitt i skrivningen märker servern det inte. Uppmätt: pid 8235 stod
kvar som `active` / `ClientRead` med transaktionen öppen i över fyra minuter och höll
`RowExclusiveLock` på `TrailImportProposals`. En efterföljande `DELETE` mot
`TrailImportSessions` gick i timeout av precis det skälet. Postgres städar först när
TCP-keepalive löser ut, vilket med standardinställningar dröjer två timmar.

Den explicita transaktionen från punkt 1 gör fönstret längre: låsen hålls över alla
omgångar i stället för per sats. Det är rätt avvägning för att skrivningen ska vara hel
eller ingen, men det betyder att ett omförsök måste kunna komma förbi ett lås som en
tidigare kapad körning håller.

Både det här och siffrorna ovan togs fram med samma spik, som ligger kvar i scratchpad.

**Att göra härnäst, i ordning:**

1. ~~`TrailImportRepository.ReplaceProposalsAsync` ska skriva i mindre omgångar i stället
   för en `SaveChangesAsync`.~~ **Gjort 2026-08-21** — 20 förslag per omgång, och
   raderingen plus inserterna ligger i en transaktion, så en kapad länk lämnar sessionens
   förslag som de var i stället för halvt omskrivna. Tre integrationstester i
   `Tests/IntegrationTests/TrailImport/` täcker det: 45 förslag — två hela omgångar plus en
   halv — skrivs allihop med geometrin i behåll, en omkörning ersätter i stället för att
   lägga till, och en annan sessions förslag lämnas orörda. De ligger bland
   integrationstesterna eftersom varken `ExecuteDelete` eller transaktioner finns på
   in-memory-providern som enhetstesterna kör.

   Att 20 är rätt siffra visade sig vara fel fråga — se rättelsen ovan. Omgången
   behålls för att den bär sitt eget skäl, inte för att den löser avbrotten.
2. ~~Kör om spiken och verifiera 177/5/5/16 ur databasen.~~ **Gjort 2026-08-21.**
   Siffrorna stämmer, lästa ur databasen. Spiken ligger kvar körbar i
   `…/Temp/claude/D--projekt-stigvidd/47fc272f-.../scratchpad/e2e` och behöver bara VPN
   och `PGQ_CS`. **Använd `StigviddAPI`s user secrets** — `Infrastructure`s pekar på
   `stigvidd.se`, alltså produktion.
3. ~~En session-rad med status `Failed` ligger kvar i testmiljön.~~ **Gjort 2026-08-21.**
   Det var två till slut: den från 2026-08-20 och en från dagens första försök. Båda
   borta, tillsammans med de hängande transaktioner de lämnat. Noll rörda leder.
4. ~~Sessioner som fastnar i `Analyzing` vid en omstart plockas inte upp igen.~~
   **Beslutat och gjort 2026-08-21.** Valet stod mellan att återköa dem automatiskt vid
   uppstart och att lita på "analysera om"-knappen i steg 6. Ingetdera valdes rakt av:

   Automatisk återköning ger en omstartsloop den dag en fil faktiskt kraschar analysen —
   starta, återköa, krascha — och kör API:t på fler än en instans återköar varje instans
   samma session. Att bara lita på knappen lämnar däremot granskaren med en spinner som
   aldrig tar slut, utan något som förklarar varför.

   Därför: vid uppstart **markeras** sessioner som står i `Analyzing` som `Failed` med
   `"The analysis was interrupted by a restart. Run it again."`, men körs inte om. Ingen loop,
   inget instansproblem, och UI:t visar något sant och handlingsbart. Omkörningen görs med
   `POST /sessions/{id}/analyze`, som ändå står i §9:s endpointlista, och
   `ReplaceProposalsAsync` raderar innan den skriver — en omkörning är alltid säker.

   `TrailImportAnalysisWorker` kallar `FailInterruptedSessionsAsync` en gång innan den
   börjar läsa kön; repositoryt sväljer fel, så en databas som inte hunnit upp tar inte
   ner workern. Fyra tester: två i `TrailImportRepositoryIntegrationTests` (bara
   `Analyzing` rörs, noll rader är inte ett fel) och två enhetstester (meddelandet
   når fram, ett repository-fel kastar inte).

   Antagandet att API:t kör på **en** instans står i koden. Blir det flera behöver
   markeringen ett ägarskapsbegrepp — då kan en instans som startar om markera en annan
   instans pågående analys som avbruten.

   Testvärden kör inte längre workern. Dess uppstartsfråga racear `SeedDatabase` på den
   delade in-memory-anslutningen, precis som `ExpiredObstacleCleanupService` gjorde, och
   den togs bort på samma grund.

   Kommentaren i `TrailImportAnalysisService` som påstod att en avbruten session "is picked
   up again" är rättad — den beskrev den här lösningen, inte koden som stod där.
5. ~~`TrailImportAnalysisService.BuildProposalsAsync` räknar fingeravtrycket två gånger per
   feature.~~ **Gjort 2026-08-21** — `TrailMatch` bär nu `FeatureFingerprint`, alltså det
   värde matcharen faktiskt jämförde med, och förslaget lagrar det i stället för att hasha
   linjen en andra gång. Utöver den sparade hashningen kan de två värdena inte längre glida
   isär. Fastspikat i `Match_ShouldCarryOutTheFingerprintItMatchedOn`.
6. ~~Omförsök på transienta avbrott.~~ **Gjort 2026-08-21, lokalt i `ReplaceProposalsAsync`
   — inte globalt.**

   `EnableRetryOnFailure` på DbContexten var det första förslaget och förkastades. Den
   sätts på `AddDbContextFactory` och gäller därmed varje kontext appen skapar, med tre
   följder: de två explicita transaktionerna i koden (`TrailImportRepository` och
   `UserRepository.DeleteUserAsync`) kastar i drift om de inte körs genom
   `CreateExecutionStrategy().ExecuteAsync(...)`, och **ingen av dem fångas av testsviten**
   eftersom integrationstesterna kör SQLite där Npgsql-strategin inte ens är konfigurerad;
   ett omförsök av kontoraderingen kör om Keycloak-anropet som transaktionen finns för att
   hålla i synk, alltså precis den halva radering kommentaren där varnar för; och en
   databas som verkligen är nere gör varje felsvar i appen ~30 s långsammare.

   `ReplaceProposalsAsync` är däremot **idempotent av konstruktion** — den raderar
   sessionens förslag innan den skriver nya. Ingen annan skrivning i appen har den
   egenskapen. Omförsöket hör alltså hemma där och ingen annanstans.

   Loopen väntar 1 s, 5 s, 30 s, 90 s mellan fem försök. Sekunder, inte millisekunder,
   eftersom en kapad föregångare kan hålla tabellen tills serverns keepalives tar den — och
   det här är ett bakgrundsjobb, ingen håller ett anrop öppet. Transient avgörs på
   exception-kedjan (`TimeoutException`, `SocketException`, `IOException`), inte på
   Npgsql-typer, så repositoryt förblir providerneutralt och regeln går att testa.
   Nycklarna nollställs mellan försöken: en rullad transaktion lämnar id:n som inte finns.

   Tre enhetstester i `TrailImportRepositoryTests` täcker loopen — fem försök vid ihållande
   avbrott, fem vid stallad läsning, **ett** vid ett fel som inte är transient.

   **Bevisat mot testmiljön samma dag.** Tre analyser i rad, utan yttre omförsök: alla tre
   nådde `AwaitingReview` med 177/5/5/16 på 17–19 s, och den tredje först efter att loopen
   fångat ett verkligt avbrott (*"Attempt 1 for session 19 was cut short; retrying in
   00:00:01"*). Det är hela steg 5 bevisat: samma siffror, genom ett avbrott, utan
   handpåläggning.


### Öppet, inte beslutat

- ~~**Led 280**, den namnlösa — raderas eller behållas?~~ **Raderad 2026-08-21.**
  Aggregatet är borta; etapp 07–10 står kvar för sig själva.
- **242 `Sjuhäradsrundan` kopplas om mot feature 148** i stället för att ersättas —
  beslutat 2026-08-21. Se rättelsen i §8.
- Realm-rollen `stigvidd-user` i Keycloak, hos authteamkamraten. **Dröjer ännu.**
- Föräldrarelation mellan led och etapp — se funderingen under Öppna frågor. Väntar på
  avstämning med senior utvecklare. Blockerar inte steg 8; det gör bara `Exclude` på
  `Sjuhäradsleden Alla Etapper`, som stänger dörren.
- ~~Postgres keepalive-inställningar.~~ **Satta och verifierade 2026-08-21** av
  authteamkamraten, med `ALTER DATABASE stigvidd SET …`: `tcp_keepalives_idle` 7200 → 60 s,
  `tcp_keepalives_interval` 75 → 10 s, `count` kvar på 9, `client_connection_check_interval`
  0 → 10 s. Avläst på en ny anslutning. Detektionen av en död klient går från ~2 h 11 min
  till 150 s, alltså den tid ett föräldralöst lås som mest kan hålla importtabellen.
  **Låstiden är uppmätt efter ändringen:** ett föräldralöst lås från en kapad skrivning
  släppte av sig självt efter 90 sekunder, mot 2 h 11 min före.

  **Produktion får dem via migrationen `20260821091423_TuneConnectionKeepalives`**, lagd
  2026-08-21 så att sättningen inte behöver kommas ihåg. Den kör vid API:ts uppstart som
  alla andra migrationer. Tre detaljer i den:

  - `ALTER DATABASE` kräver ett literalt namn, så namnet hämtas ur `current_database()`
    via `format()` — en hårdkodad databas hade bara fungerat där den råkar heta rätt.
  - Hela blocket fångar `insufficient_privilege` och varnar i stället för att fela.
    Migrationer kör vid uppstart, och en trimningsinställning får aldrig vara det som
    hindrar API:t från att starta. På test äger rollen `stigvidd` databasen, vilket
    räcker — superuser behövs inte — men produktion är inte verifierad.
  - `tcp_keepalives_count` sätts explicit till 9 trots att det redan var värdet. Det
    kom från OS:ets default och kan skilja mellan maskiner; nu är alla fyra deterministiska.

  Verifierat att `ALTER DATABASE … SET` fungerar inuti en transaktion, vilket EF kör
  migrationer i. Skriptet är kört mot testmiljön (14 → 15 migrationer).

### Steg 6 är byggt — 2026-08-21

`api/v1/admin/trail-import`, hela controllern bakom `[Authorize(Policy = "Admin")]`.

| Metod | Väg | Svar |
| ----- | --- | ---- |
| POST | `/sessions` | 201 + sessionen. Multipart, `file` + valfri `source`. |
| POST | `/sessions/{id}/analyze` | 202. Köar jobbet och returnerar direkt. |
| GET | `/sessions` | Alla sessioner, nyast först. Utan räknare. |
| GET | `/sessions/{id}` | Sessionen **med** räknare per konfidens och per beslut. |
| GET | `/sessions/{id}/proposals` | Sidindelat. `?confidence=&decision=&page=&pageSize=` |
| GET | `/sessions/{id}/proposals/{pid}/preview` | Båda linjerna som koordinatpar + längder. |
| POST | `/sessions/{id}/proposals/{pid}/decide` | 204. |
| POST | `/sessions/{id}/decide-bulk` | `{ decided: n }`. |
| DELETE | `/sessions/{id}` | 204. Tar förslagen och filen med sig. |
| GET | `/vocabulary` | Namnen som filtren och besluten accepterar. |

`diff` och `apply` är medvetet inte byggda: de **är** trevägs-mergen, alltså punkt 8.

**Beslut på vägen**

- **Filen ligger på en egen volym, inte i WebDAV.** Analysen öppnar den med
  `File.OpenRead`, och en omkörning läser samma fil dagar efter uppladdningen. `api` hade
  ingen volym alls i `docker-compose.yml`, så en fil i containern hade försvunnit vid
  nästa deploy. Tillagt: `trail_imports:/app/trail-imports` plus
  `TrailImport__StoragePath`. Utan konfiguration hamnar den i tempkatalogen, vilket räcker
  lokalt. Inte WebDAV: det är publikt läsbart och de här filerna är adminarbetsmaterial.
- **Hashen räknas medan filen skrivs**, genom en `CryptoStream`. En 21,5 MB-export läses
  aldrig en andra gång bara för att kännas igen.
- **Uppladdningsnamnet bestämmer ingenting.** Filen får ett GUID-namn i lagringskatalogen;
  bara ändelsen tas från namnet, och bara om den ser ut som en ändelse. Provat med
  `../../etc/passwd`.
- **Statusen sätts till `Analyzing` innan kön får sessionen**, inte i arbetaren. Det är
  det som gör att ett andra anrop får 409 i stället för att köa samma session igen.
- **Listan bär inte geometrin.** `ProposalSummary` är en egen projektion; annars hade en
  sida på 50 features släpat tiotusentals koordinater med sig för en lista som inte ritar
  någon av dem. `preview` är den enda läsningen som hämtar `FeatureGeometry`.
- **`Accept` tar leden ur varje förslags egen `SuggestedTrailId`**, i SQL, så ett massval
  över 177 rader med olika leder blir en enda `UPDATE`.
- **Två spärrar som annars hade gett obrukbara sessioner:** `Accept` på ett förslag utan
  föreslagen led avvisas (det hade godkänt en matchning som aldrig gjordes), och ett
  id som hör till en annan session avvisar hela batchen i stället för att tyst hoppa över
  det. Båda avgörs av en enda `CheckProposalsAsync`-fråga.
- **`Exclude` tvingar rollen till `Excluded`** oavsett vad anropet skickade med.
- **Enumar går ut som namn, aldrig som siffror.** Databasvärdena förblir en intern detalj,
  och `/vocabulary` säger vilka namn som gäller.

**Testning:** 998 enhetstester (+24) och 308 integrationstester (+27), alla gröna.
Enhetstesterna täcker spärrarna, integrationstesterna kör riktig SQL mot SQLite för allt
som använder `ExecuteUpdate`, gruppering eller underfrågor — inget av det översätts av
in-memory-providern.

Kontraktstestet `OpenApiContractTests` slog till som det ska: den nya controllern ändrade
`web/openapi.json`, testet skrev om den och begärde omgenerering. `npm run generate:api`
är kört, så `web/src/api/generated/trail-import/` finns och webbklienten är i fas.

**Inte gjort:** ingenting av det här är kört mot testmiljön. Endpointsen är bevisade mot
SQLite, inte mot Postgres, och den riktiga exporten har inte gått genom uppladdningen.

### Steg 7 är byggt — 2026-08-21

Två sidor i `web/`, båda under `ProtectedRoute` och nådda från sidomenyn:

| Väg | Vad |
| --- | --- |
| `/trail-import` | Uppladdning + sessionslista med status, analysera, granska, radera |
| `/trail-import/:sessionId` | Granskningsvyn: summeringsrad, filter, lista, detaljvy, beslut |

Nya filer: `src/api/trail-import.ts`, `src/pages/admin/trail-import-page.tsx`,
`src/pages/admin/trail-import-review-page.tsx`,
`src/components/trail-import/{geometry-preview,proposal-detail,badges}.tsx`.

**Kartan blev SVG, som planerat.** `GeometryPreview` tar `preview`-endpointens
koordinatpar och ritar båda linjerna: källfeaturen ovanpå den matchade leden, fylld cirkel
vid start och ihålig vid slut — det är vad som skiljer en sluten slinga från en öppen led —
och en skalstock i rundade steg (1, 2 eller 5 gånger en tiopotens). Ingen ny dependency,
ingen tile-kostnad.

Tre saker som geometrin tvingade fram:

- **Longituden skalas med `cos(latitud)`.** Utan det ritas en led på 57°N nästan dubbelt så
  bred som den är.
- **Punkterna glesas ut till 1 500 per linje.** Den längsta leden bär 59 107 punkter, och
  fler än så tillför ingenting vid skärmstorlek men gör DOM:en tung. Slutpunkten släpps
  aldrig — det är den som bestämmer var linjen tar slut.
- **Ytterkanterna räknas i en loop, inte med `Math.min(...punkter)`.** Spreaden hade
  spräckt argumentgränsen på just den led verktyget finns för.

**Tangentbordet:** `j`/`k` stegar, `a` godkänn, `r` koppla om, `n` ny led, `x` uteslut,
`s` hoppa över. Ignoreras medan fokus står i ett fält, så en anteckning som innehåller ett
`a` inte godkänner något. Efter ett beslut flyttas markeringen framåt **innan** listan
laddas om — annars hade den fallit tillbaka till toppen varje gång, eftersom raden lämnar
`Pending`-filtret.

**Massval är låst till `Certain` och `High`.** Knappen är utgråad så snart urvalet
innehåller något lägre, med förklaringen i `title`. Det är de 177 exakta som ska gå igenom
i ett svep; resten är själva granskningsarbetet.

**Markera alla — tillagt 2026-08-21** efter att vyn provkörts: en kryssruta över listan tar
hela sidan, och när sidan är full och filtret rymmer fler dyker *"Select all 177 matching"*
upp. Den går igenom filtret sida för sida (200 åt gången, API:ts tak) och samlar id:na, så
"markera alla" betyder alla 177 och inte de 50 som råkar synas.

Urvalet lagras som id → konfidens, inte som en id-mängd. Med markeringar över flera sidor
är raden inte längre i vy när spärren "bara `Certain` och `High` får massgodkännas" ska
avgöras, och då måste konfidensen följa med markeringen.

Sidbyte nollställer urvalet med flit. Alternativet är en markering som lever vidare utan att
synas någonstans, och "markera alla i filtret" täcker ändå behovet.

**Bokstavsordning — tillagt 2026-08-21.** Listan sorterades på konfidens och sedan `Id`,
alltså på inläsningsordning. Nu konfidens och sedan namn, så en påslagen konfidensfilter ger
ren bokstavsordning.

Den svenska ordningen krävde en mätning. Testdatabasen har collation `en_US.UTF-8`, och den
sorterar `Alfa < Älmås < Åsa < Örby < Zeta` — Å, Ä och Ö hamnar bland A och O i stället för
sist. `sv-SE-x-icu` finns på servern och ger `Alfa < Zeta < Åsa < Älmås < Örby`.

Sorteringen begär därför den collationen, men **bara på Postgres**: integrationstesterna kör
på SQLite, som inte har någon sådan och hade fallit på en hårdkodad `COLLATE`. Repositoryt
läser `ProviderName` och faller tillbaka på vanlig namnsortering annars. Testet verifierar
alltså "sorterat på namn"; den svenska ordningen är uppmätt mot servern, inte testad.

**Längddiffen syns direkt i detaljvyn:** uppmätt featurelängd, källans angivna längd,
ledens kuraterade och ledens uppmätta — sida vid sida, med varning när källans siffra inte
går ihop med dess egen geometri. Det är exakt underlaget 242 Sjuhäradsrundan behöver.

### Kontraktsändring: leder namnges med identifier

`DecideProposalRequest.TrailId` (int) byttes mot `TrailIdentifier` (string) medan UI:t
byggdes. Webben har aldrig ledernas numeriska id — `getAllTrails()` ger `identifier` och
`name` — och resten av API:t namnger konsekvent leder med identifier. Repositoryt slår upp
id:t (`GetTrailIdByIdentifierAsync`) i stället för att bara kontrollera att det finns.
Förslagens **svar** bär fortfarande numeriska id, eftersom de är importens eget protokoll.

### Bonus: felmeddelanden syns nu

`customFetch` kastade `HTTP error 400` och slängde serverns förklaring. Varenda spärr i
steg 6 svarar med en anledning, så mutatorn läser nu ut den — bar JSON-sträng från
`ToActionResult`, eller `ProblemDetails` när modellbindningen sa nej. Gäller hela webben,
inte bara den här vyn.

**Verifierat:** `npm run build` och `npm run lint` rena, 998 enhetstester och 309
integrationstester gröna. `web/openapi.json` och orval-klienten omgenererade efter
kontraktsändringen.

**Inte gjort:** vyn är inte körd mot testmiljön med den riktiga exporten, och `apply`-knappen
finns inte — den hör till steg 8.

### Buggen som gjorde varje adminendpoint till 403 — 2026-08-21

Upptäckt när granskningsvyn skulle provköras: **både `/trail-import` och den befintliga
"Export all data" gav 403.** Alltså inte steg 6–7, utan rollkopplingen — och den har varit
trasig hela tiden.

**Mätt, inte gissat.** En liten probe som bygger API:ts autentisering med samma
konfiguration och läser ut `TokenValidationParameters`:

```
RoleClaimType : role
NameClaimType : preferred_username
```

`KeycloakRealmRolesTransformation` skrev rollerna som `ClaimTypes.Role`, alltså
`http://schemas.microsoft.com/ws/2008/06/identity/claims/role`. Men `RequireRole` går via
`IsInRole`, som läser identitetens **egen** `RoleClaimType` — `"role"`. Rollen fanns i
token, transformationen körde, claimet lades till, och policyn tittade på fel ställe.

Fixen är en rad: skriv claimet under `identity.RoleClaimType` i stället för en hårdkodad
typ. Då fungerar det oavsett vad handlern råkar konfigurera.

**Varför 1 307 tester inte såg det.** `TestAuthHandler` bygger en vanlig `ClaimsIdentity`,
vars `RoleClaimType` som default *är* `ClaimTypes.Role` — så testerna och den trasiga koden
var överens med varandra. Dessutom går `X-Test-Roles` förbi transformationen helt, så
ingenting i sviten körde den. Fem nya enhetstester i
`Tests/UnitTests/ControllerTests/KeycloakRealmRolesTransformationTests.cs` täpper till det,
och de asserterar genom `IsInRole` — det policyn faktiskt anropar — inte genom att leta
efter ett claim. Bevisat att de fångar buggen: med den gamla raden återinlagd blir två av
dem röda.

En sidoeffekt värd att notera: `NameClaimType` är `preferred_username`, så
`User.Identity?.Name` — det som hamnar i `DecidedBy` på varje förslag — blir
Keycloak-användarnamnet. Det är rätt värde, men det är tur snarare än design.

---

## Läget just nu — 2026-08-21, att fortsätta från

Ersätter avsnittet daterat 2026-08-20 längre upp.

### Klart

Steg 1–7 av elva. **Granskningsvyn är provkörd mot testmiljön med den riktiga exporten**
och fungerar hela vägen: ladda upp, analysera, filtrera, granska, massmarkera, besluta.

Testläge: **1 003 enhetstester och 310 integrationstester, gröna.** Bygget utan varningar,
`npm run build` och `npm run lint` rena.

Vad den skarpa körningen visade, session 20, `spar_leder.json`, 203 features:

| | Antal | Kommentar |
| --- | --- | --- |
| Certain | 177 | Oförändrat sedan spiken |
| High | 5 | |
| Medium | 1 | 242 Sjuhäradsrundan mot feature 148 |
| Unmatched | 20 | Sjuhäradsetapper, kanotled, aggregatet |

Medium gick från 5 till 1 och Unmatched från 16 till 20 därför att led 280 raderades:
etapp 07–10 låg helt inuti den och tappade sin kandidat. `5 − 4 = 1`, `16 + 4 = 20`.

### Fyra fynd från provkörningen, alla åtgärdade

1. **403 på varje adminendpoint**, inklusive den befintliga exporten. `RoleClaimType` är
   `role`, inte `ClaimTypes.Role`. Se eget avsnitt ovan.
2. **Markera alla** saknades för de 177. Byggt, inklusive över sidgränser.
3. **Bokstavsordning** saknades. Byggt, med svensk collation på Postgres.
4. **`customFetch` slängde serverns felmeddelanden.** Fixat.

### De tre sakerna att göra härnäst

**1. Rollväljare i detaljvyn — blockerar steg 8.**

`TrailSourceLinkRole` finns i enum, kontrakt och tjänst, men granskningsvyn skickar aldrig
`role`, så allt blir `Segment`. Det är `Segment`-länkarnas geometri som slås ihop till
ledens `GeoPath` i Verkställ, alltså kan ett felmärkt aggregat smälta in en 134 km-linje i
en etapp.

Att göra: en väljare i `proposal-detail.tsx` med `Segment` som default och `Duplicate` för
aggregat, skickad i `decideProposal`. Visas bara när beslutet faktiskt kopplar till en led,
alltså `Accept` och `Relink`. `Exclude` tvingar redan `Excluded` på serversidan och ska
inte visa väljaren.

**2. Närmaste led med i omatchade.**

Idag säger raden `10/100 %` och `no trail suggested` samtidigt. Procenten avser en led
matcharen faktiskt hittade, men `TrailMatcher` kastar id:t i sista returen och behåller
bara siffrorna. För triage är namnet det enda som gör talen användbara.

Designen som ska byggas, så morgondagen blir utförande och inte utredning:

- `TrailMatch` får `NearestTrailId`, satt även när `TrailId` är null.
- `TrailImportProposal` får `NearestTrailId int?` — **egen kolumn, inte `SuggestedTrailId`**.
  `CheckProposalsAsync` räknar `SuggestedTrailId == null` för att stoppa `Accept` på en
  icke-matchning, och den spärren får inte luckras upp.
- Migration för kolumnen. Följer mönstret från `AddTrailImportSession`: bara tillägg.
- Vidare ut genom `ProposalSummary`, `TrailImportProposalResponse` och preview-svaret, och
  visas i listan som "närmast: *namn*" — som upplysning, aldrig som förslag.

**3. Två läsfrågor mot testmiljön.**

- **De 20 omatchade i tabell:** namn, uppmätt längd, `sparlangd`, antal punkter. Syftet är
  att skilja Sjuhäradsetapp från riktig ny led från kanotetapp utan att klicka igenom dem
  en och en. Kanotetapperna känns igen på att de är raka linjer med två koordinater.
- **Längdgranskning av alla 187 leder:** `TrailLength` mot `GeoPath` mätt med samma
  haversine som `TrailLength.FromGeometry`, så siffrorna blir identiska med vyns. Utlöst av
  Sjömarkensrundan: kuraterad 14 km, uppmätt 6,02 km, och källan säger också 14. Frågan är
  om det är ett undantag eller ett mönster innan 203 beslut fattas.

### Punkt 3 körd mot testmiljön — 2026-08-22

Läsning mot 10.240.10.1, session 20 (`spar_leder.json`, boras-stad, 203 features). Mätt med
`TrailLength.FromGeometry`, så siffrorna är identiska med vyns. Ingenting skrevs.

#### De 20 omatchade delar sig i tre högar

| Hög | Antal | Vad det är |
| --- | --- | --- |
| Sjuhäradsleden | 9 | `Alla Etapper` plus etapp 01, 03, 05, 06, 07, 08, 09, 10 |
| Riktigt nya leder | 2 | Älmås Blåvit led (4,41 km, källan säger 4,4 km) och A-Ö-skogen (0,75 km, källan säger "Drygt 1 km") |
| Kanotetapper | 9 | Kanotcentralen–, Gäddviken–, Björkens–, Storö–, Brofästet–Agnaviken, Dammfästet– |

**Rättelse till antagandet ovan:** kanotetapperna känns *inte* igen på att de är raka linjer
med två koordinater. Bara 3 av 9 har två punkter; resten har 3–8. Den säkra markören är
`sparlangd` i minuter — alla nio kanotrader anger minuter, och ingen annan rad i hela
sessionen gör det.

#### Tre saker att ta ställning till

- `Sjuhäradsleden Alla Etapper` står på `CreateNew` (134,25 km) samtidigt som åtta av dess
  egna etapper gör det. Verkställs det som det står läggs samma mark in både som led och som
  sina egna delar. Det är precis det `Exclude` på den raden skulle ha hindrat, och som
  väntar på föräldrarelationsbeslutet.
- Etapp 02 och 04 matchade `Certain` och accepterades. Etapp 04 gick på led 302
  `Sjuhäradsleden Nordtorp-RyaÅsar`, vars kuraterade `TrailLength` är 47 km mot 12,76
  uppmätta. Att acceptera geometrin rättar inte längden.
- Källans egen `sparlangd` är fel på två etapper: 10 säger 22 km men mäter 12,46, och 07
  säger 12 km men mäter 10,95. §5:s undantag tar uppmätt längd för `CreateNew`, så det
  löser sig — men det bekräftar att `sparlangd` inte får bli en genväg.

#### Längdgranskningen: Sjömarkensrundan är ett mönster, men bara ett av tre

20 av 187 leder faller utanför 1,6×-regeln. De är inte en företeelse utan tre, och bara den
andra är den Sjömarkensrundan tillhör.

**A. Trasig geometri — 8 leder.** Uppmätt längd är en spillra och punktantalet minimalt.
Kuraterad längd är sannolikt rätt; det är linjen som saknas.

| Led | Kuraterad | Uppmätt | Punkter |
| --- | --- | --- | --- |
| Kröcklings Hage (311) | 2,00 | 0,01 | 4 |
| Kröcklings hage (271) | 2,00 | 0,03 | 12 |
| Kröcklings Hage (305) | 2,00 | 0,05 | 26 |
| Avpublicerad Borås Golfklubb Naturstig röd (255) | 3,00 | 0,17 | 85 |
| Avpublicerad Naturstig (272) | 4,50 | 0,30 | 153 |
| Älmåsspåret (268) | 2,40 | 0,25 | 100 |
| Skalle fågeltorn (290) | 1,20 | 0,22 | 113 |
| Munkåleden (230) | 2,10 | 0,44 | 40 |

Tre Kröcklings Hage med samma kuraterade längd och tre olika trasiga linjer är egentligen
en dubblettfråga, inte en längdfråga.

**B. Längden beskriver hela rundan, geometrin en bit — 3 leder.**

| Led | Kuraterad | Uppmätt |
| --- | --- | --- |
| Sjuhäradsrundan (359) | 130,00 | 10,60 |
| Sjuhäradsleden Nordtorp-RyaÅsar (302) | 47,00 | 12,76 |
| Sjömarkensrundan Svart-Vit (223) | 14,00 | 6,02 |

Det var den här högen frågan gällde. Den har alltså två syskon, inte 186.

**C. `TrailLength` aldrig satt — 6 leder.** Fem `avpubl Svaneholm/Bogryd`, vars `sparlangd`
är intervallet `2,4 - 5,3 km` som `Parse` med flit vägrar, plus Tångenleden (252) på 0,00
mot 3,84 uppmätta. Den senare har dessutom en namne på id 3 med 9,10 mot 9,04 — dubblett.

**D. Tre i bandet 1,9–2,3×:** Vänga Mosse (3,60 / 1,84), Algutstorp Naturstigen (3,00 / 1,55)
och Kransmossen Tillgänglighetsanpassad (1,20 / 2,73 — den enda där geometrin är mer än
dubbelt så lång som längden).

Resterande 167 ligger mellan 0,69 och 1,4, alltså skyltavrundning till halva kilometer.

**Slutsats för steg 8:** ingenting av det här blockerar, eftersom `TrailLength` är vårt och
aldrig importeras. Men det säger att den kuraterade längden inte duger som rimlighetskoll på
en matchning — för 20 leder mäter den något annat än geometrin gör.

#### Källans egen längd stämmer inte med källans egen linje — 11 av 179

Mätt 2026-08-22 över session 20. 179 features anger en enhet i `sparlangd`; för elva av dem
avviker siffran från den geometri de själva levererar med mer än 1,6×.

| Feature | `sparlangd` | Geometrin mäter |
| --- | --- | --- |
| Banvallen | 8,2 km | **15,72** |
| Kransmossen tillgänglighetsanpassad | 1,2 km | **2,73** |
| Rångedala HF Naturstigen grön | 2,8 km | 1,55 |
| Sjömarkensrundan | 14 km | 6,02 |
| Sjuhäradsleden Etapp 10 | 22 km | 12,46 |
| Kröcklings hage (två features) | 2,0 km | 0,03 / 0,06 |
| Golfklubb Naturstig röd | 3,0 km | 0,17 |
| Avpublicerad Naturstig | 4,5 km | 0,30 |
| Skalle fågeltorn | 1,2 km | 0,22 |
| Munkåleden | 2,1 km | 0,44 |

Kröcklings hage mäter 0,03 km **i källan**. Stumparna i hög A ovan är alltså inte något som
gått sönder hos oss — de kommer så, och att acceptera de matchningarna byter en trasig linje
mot en lika trasig.

Sjömarkensrundan gick åt andra hållet, kontrollerad 2026-08-22: kommunens sida beskriver en
slinga från idrottsplatsen och tillbaka, 14 km, men **kartan där är lika halv som datan**.
Vår `GeoPath` mäter 6,02 och källans feature mäter också 6,02 — det är samma avhuggna linje.
Ingen import kommer alltså att laga den, för källan är där felet börjar. Den leden behöver
geometri från något annat håll, ritad eller från OSM.

Mätt på linjen 2026-08-22: 2 979 punkter, **inga hopp över 100 m**, och ändarna 3 172 m
isär (Lundaskog 57,71941/12,86380 mot Ekås 57,74627/12,88161). Linjen är alltså obruten och
välritad — den är bara halv. Ingen annan feature i filen är den saknade delen; grannarna är
egna namngivna leder. Hypotesen att returvägen delas med Sjuhäradsleden Etapp 04 är
avlivad: Borås kommun uppgav i samtal våren 2026 att varje led bär sina egna koordinater
och att ingenting lagras genom delning. Då ska Sjömarkensrundans egen linje vara hela
slingan, och att den är halv är deras datafel — inte en modelleringsfråga.

Banvallen är motsatsen och det avgörande fallet: källans fält säger 8,2, källans egen sida
säger 15,5, geometrin mäter 15,72. Fältet är det som är fel, och vår `TrailLength` stod på
8,2 därför att siffran en gång kom därifrån. Rättad för hand i test 2026-08-22.

#### Erbjud uppmätt längd i verkställ-steget

Beslutat 2026-08-22, inte byggt. Att mäta vår egen geometri är inte att importera
`sparlangd`; regeln i §5 gäller källans siffra och står orörd.

Erbjudandet räknas på den geometri leden **får** efter synken, inte den den har — accepteras
ett förslag byggs linjen om, och diffen mot dagens `GeoPath` är då delvis missvisande.

Förkryssningen styrs av **riktningen**, inte av hur många källor som är överens:

- **Geometrin mäter längre än längden** → lita på geometrin, förkryssat. Man snubblar inte
  över extra led av misstag. Banvallen, Kransmossen.
- **Geometrin mäter mycket kortare** → avhuggen eller stump, inte förkryssat utan flaggat.
  Kröcklings, Munkåleden, Sjömarkensrundan.

"Två av tre är överens" duger inte som regel: för Banvallen var vår 8,2 och källans 8,2 inte
två oberoende röster utan samma siffra två gånger, och regeln hade sagt fel.

Plus ett "kryssa i alla" — annars är det tjugo klick, vilket var hela invändningen.

De leder importen inte rör alls — de sex med `TrailLength` 0,00, Kröcklings-trion — behöver
en egen liten längdgenomgång i adminen. Samma mätning, fristående från en session.

#### Källsidan länkas nu från granskningsvyn — byggt 2026-08-22

Varje feature bär `properties.link` till kommunens egen sida, och `FeatureProperties` fanns
redan i preview-svaret. Detaljpanelen visar den nu som "Source page" bredvid källans id. Det
var den kontrollen som gjordes för hand när Banvallens längd skulle avgöras.

#### Leder delar inte koordinater, men de delar mark — 130 par

Mätt 2026-08-22 över de 189 features som är minst 0,5 km, med `GeometryComparison` på 15 m.
130 par löper längs varandra i minst 0,5 km. Kommunens uppgift gäller alltså lagringen —
varje feature bär sin egen fullständiga linje — inte marken. Att två leder följs åt i
kilometer är normalfallet i den här datan, inte undantaget.

De längsta paren efter Sjuhäradsleden och dess egna etapper:

| Sträcka | Täckning | Par |
| --- | --- | --- |
| 14,74 km | 94 % / 11 % | Banvallen ‖ Sjuhäradsrundan |
| 9,47 km | 94 % / 60 % | Bredareds IF gröna 10 km ‖ Bredareds IF vit 13 km |
| **7,93 km** | **100 % / 100 %** | **Vildmarksleden ‖ Vildmarksspåret (gran)** |
| 7,75 km | 81 % / 63 % | Hestra IF grön-vita 9,0 km ‖ Hestra IF rosa 13 km |
| 6,72 km | 92 % / 49 % | Bredareds IF blå 7,5 km ‖ Bredareds IF vit 13 km |

Det betyder att matcharens `min(fwd, bwd)` bär hela lasten här. Den klarar det — men
konsekvensen är att en `Relink` sällan är uppenbar för ögat.

**Vildmarks-paret är en dubblett i båda ändar.** Två features som täcker varandra till
100 % matchade var sin led, 373 och 292 — och båda lederna heter *Rya åsar,
Vildmarksspåret* och är 9,00 km. Källan har leden två gånger, vi har den två gånger, och
matcharen parade ihop dem en och en. Ingen av dem är fel var för sig; tillsammans är de en
dubblett som behöver ett beslut.

#### Banvallen står på `CreateNew` trots 100 % matchning

Kontrollerat 2026-08-22. Förslaget har 100 % ömsesidig täckning mot led 276 *Banvallen*,
6 m Hausdorff och `High`, men beslutet som ligger är `CreateNew`. Verkställs det som det
står får vi **två** Banvallen — och den befintliga är den vars längd nyss rättades för hand
till 15,72.

Sannolikt en tangenttryckning: `n` är kortkommando för `CreateNew` i granskningsvyn.

Steg 8 behöver därför en kontroll före skrivning: `CreateNew` på ett förslag som har ett
`High`- eller `Certain`-förslag ska stoppas eller åtminstone kräva en bekräftelse. Samma
sak för `Exclude` — båda kastar en matchning som geometrin är säker på.

#### Ångra ett beslut — byggt 2026-08-22

`Pending` var redan ett giltigt beslut i `DecideAsync`; det som saknades var en knapp och en
detalj i skrivningen. `SetDecisionAsync` behandlar nu `Pending` som ett återställande och
nollar `DecidedBy`, `DecidedAt`, `DecidedTrailId` och anteckningen, med rollen tillbaka på
`Segment`. Utan det stod raden som "Undecided · decided by …", och `0 undecided`-räknaren
stämde medan namnet ljög. Det analysen mätte — `SuggestedTrailId`, `Confidence` — rörs inte.

I granskningsvyn: en **Undo** sist i beslutsraden, synlig bara på beslutade rader,
kortkommando `u` i serien `a` / `r` / `n` / `x` / `s`. `u` på en obeslutad rad gör
ingenting.

Två tester tillkom (1322 → 1324).

**Känt hål:** ångrar man ett `Exclude` som ärvts från en tidigare import gäller det bara den
här sessionen — nästa analys hittar fingeravtrycket bland de uteslutna och sätter tillbaka
det. Fingeravtrycksuppslaget gör sitt jobb, men beteendet är inte självklart för den som
ångrar.

### Beslut som väntar på dig

- **Föräldrarelation led ↔ etapp** — funderingen under Öppna frågor, hos din seniora
  utvecklare. Blockerar inte steg 8. Det gör bara `Exclude` på `Sjuhäradsleden Alla
  Etapper`, som stänger dörren för idén.
- **Kanotleden:** ska paddelsträckor in i Stigvidd alls, och i så fall som en led eller sex?
- **Realm-rollen `stigvidd-user`** hos authteamkamraten. Oförändrat.

### Efter det

Steg 8, Verkställ-fasen med trevägs-merge. Den är först destruktiv — allt fram till nu har
kunnat raderas och köras om.

En sak att lösa när den byggs: enligt §5 importeras `Name` och `TrailLength` aldrig, men en
led som skapas av `CreateNew` har inget kuraterat att bevara. Källans namn och den uppmätta
längden måste bli utgångsvärden. Det är ett undantag i regeln och ska skrivas in i §5.

---

## Punkt 1 och 2 är byggda — 2026-08-22

**Rollväljaren.** Backend hade redan allt: `Role` på både `DecideProposalRequest` och
bulkvarianten, parsningen i `DecideAsync` och `Exclude`-tvånget som skriver `Excluded`
oavsett vad som skickades. Det enda som saknades var att vyn skickade fältet.

`proposal-detail.tsx` har nu en radiogrupp med `Segment` och `Duplicate`, default
`Segment`, och `role` följer med i `decideProposal` bara för `Accept` och `Relink`.
`CreateNew` skickar inget: en ny led som föds ur featuren kan inte vara en `Duplicate` av
sig själv, och servern defaultar till `Segment`. Väljaren visas när ett beslut faktiskt
kan koppla — `canAccept || relinking` — och en redan beslutad proposal öppnas på sin
`decidedRole`.

**Närmaste led.** `TrailMatch` fick `NearestTrailId`, satt i alla fyra returerna, även när
`TrailId` är null. Egen kolumn `NearestTrailId` på proposalen, migration
`20260822084459_AddProposalNearestTrail`, bara ett `AddColumn`. `SuggestedTrailId` är
orörd, så spärren i `CheckProposalsAsync` står kvar precis som den skulle.

Vidare genom `ProposalSummary`, repo-projektionen och `TrailImportProposalResponse`.
Listan visar `nearest: <namn>` där det förut stod `no trail suggested`.

Utöver planen: förhandsvisningen ritar nu även närmaste led för en omatchad feature.
Geometrin fanns redan att hämta, och för de 20 omatchade är det skillnaden mellan två
procenttal och något att placera featuren mot. `TrailIsNearestOnly` i preview-svaret är
det som hindrar vyn från att läsa linjen som ett förslag, och rutan ovanför säger det i
ord.

**Testläge: 1 317 gröna**, upp från 1 313. Fyra nya:

- `Match_ForAParallelTrailFortyMetresAway` och grannarna kontrollerar nu `NearestTrailId`.
- `DecideAsync_ForAcceptAsDuplicate_ShouldStoreTheRoleTheReviewerPicked` — det var den här
  vägen ett felmärkt aggregat kunde smälta in en 134 km-linje i en etapp.
- `DecideAsync_ForARoleThatDoesNotExist_ShouldListTheOnesThatDo`.
- `GetProposalsAsync_ForAnUnmatchedFeature_ShouldNameTheNearestTrailWithoutSuggestingIt` —
  hävdar också att `SuggestedTrailId` förblir null.
- `GetPreview_ForAFeatureThatMatchedNothing_ShouldDrawTheNearestTrailAndSaySoItIsNotASuggestion`.

Bygget rent utan varningar, `npm run lint` och `npm run build` rena, `openapi.json`
omskriven av kontraktstestet och klienten regenererad.

**Kvar av de tre:** inget — punkt 3 kördes 2026-08-22, se nedan. Ingenting är provkört mot
testmiljön ännu — bara mot testsviten.

---

## Kanotlederna är avgjorda som modellfråga — 2026-08-22

Öppna frågan "en led eller sex?" har ett svar: **ingetdera, det går inte.**

Id 380–389 (381 saknas), alla `klassning: Lätt`, alla `link: null`, alla med paddeltid i
`sparlangd` (5–60 min), tillsammans 9,50 km. Borås sida beskriver dem som *en* kanotled i
Bosjön på ca två timmar.

Men mätt på geometrin är de nio **en graf, inte en linje**: elva iläggsplatser, tre
förgreningspunkter (Kanotcentralen, Gäddviken, Dammfäste har alla grad 3) och två separata
komponenter, med 10 m tolerans. `Trail.GeoPath` är en `LineString`. `ST_LineMerge` av dem
ger en `MultiLineString`. En egen `WaterRoute`-klass löser det inte heller — samma graf,
samma linjefält, plus hela `Trail`s följe av `TrailImage`, `Review`, `TrailObstacle` och
`VisitorInformation` att duplicera eller polymorfa.

Kvarstår `Exclude` på alla nio. Vad de nio är för något, och var iläggsplatserna hör hemma
om de någon gång ska synas, ligger i `docs/anlaggningar-och-omraden.md` — det är en egen
story, inte ledimport.

### Men `Exclude` höll inte över omkörningar (byggt 2026-08-22, se nedan)

Analysfasen läser inte `TrailSourceLink` alls. Varken `TrailImportAnalysisService` eller
`TrailImportRepository` rör länktabellen — features jämförs bara mot `Trail`-geometrier.
Utesluts de nio idag kommer de tillbaka som `Unmatched` vid varje framtida import. Nio
klick per synk, för alltid, och samma sak för allt annat som någonsin utesluts.

`TrailSourceLink.TrailId` är nullbar, så en utesluten länk utan led går att lagra. Det som
saknas är uppslaget: analysen ska slå upp featurens fingeravtryck i `TrailSourceLink`
**innan** den jämför mot leder, och en träff med `Role = Excluded` ska ge ett förslag som
redan står på `Exclude` i stället för en tom rad.

§4:s tier 1 är redan fingeravtrycksmatchning. Den behöver bara omfatta uteslutna länkar,
inte bara ledgeometrier. Hör hemma i steg 8 och ska byggas innan de 203 besluten fattas —
annars är besluten inte värda något vid nästa export.

### Fingeravtrycksuppslaget är byggt — 2026-08-22

Analysen läser numera länktabellen innan den jämför mot leder. Nytt repository-anrop
`GetExcludedFingerprintsAsync(source)` hämtar fingeravtrycken för alla
`TrailSourceLink` med `Role = Excluded` i den källan, en gång per körning precis som
ledgeometrierna. Träffar en feature det setet byggs förslaget av
`AlreadyExcluded(...)` i stället för matcharen:

| Fält          | Värde                            |
| ------------- | -------------------------------- |
| `Decision`    | `Exclude`                        |
| `DecidedRole` | `Excluded`                       |
| `DecidedBy`   | `"an earlier import"`            |
| `DecidedAt`   | analystidpunkten                 |
| `Confidence`  | `Unmatched`                      |
| `MatchReason` | `"excluded in an earlier import"`|
| Ledfälten     | `null`                           |

Detaljvyn skriver redan ut `decided by {DecidedBy}`, så raden läser
*"decided by an earlier import"* utan någon ändring i webben. Kontraktet är orört —
inga nya fält, ingen omgenerering av klienten.

**Ingen led jämförs för en utesluten feature.** Uppslaget sker *före* matchningen, så
`SuggestedTrailId` och `NearestTrailId` blir båda `null`. Det är avsiktligt: en utesluten
feature har ingen led, och `Accept` är redan spärrat på att `SuggestedTrailId` är `null`.
Vill man ändå göra om den till en led går `Relink` och `CreateNew` som vanligt — beslutet
är förvalt, inte låst.

**Konfidensen blir `Unmatched`, inte `Certain`.** `MatchConfidence` säger hur säker synken
är på att featuren hör till *den led den matchades mot*. En utesluten feature matchades
inte mot någon. `Certain` hade blåst upp den bucketen med rader utan led.

`TrailMatcher.Match` fick en överlagring som tar fingeravtrycket från anroparen, så det
räknas en gång per feature i stället för två. Gamla signaturen finns kvar och räknar
själv.

Fem nya tester, 1317 → 1322, noll varningar:

- att en tidigare utesluten feature kommer tillbaka som `Exclude` medan grannraden är kvar
  på `Pending`
- att den inte pekas på någon led, ens när geometrin är identisk med en befintlig led
- att uppslaget görs för sessionens egen `Source`
- att en misslyckad läsning av länkarna **fäller sessionen** i stället för att köa varje
  tidigare uteslutning på nytt (tom lista och trasig fråga ser likadana ut annars)
- repository-nivå: bara `Excluded`-länkar för rätt källa kommer med

#### Kvar: en bekräftad `Relink` har samma hål

Uppslaget täcker `Excluded` och ingenting annat. En länk med `ConfirmedByHuman = true` som
pekar på en *annan* led än den geometriskt närmaste kopplas om av matcharen vid nästa
import, precis som förut — §4 säger att det aldrig får ske automatiskt, men det är skrivet
om synkfasen, inte om analysen. Samma mekanism löser det (slå upp länken, ta dess
`TrailId` och `Role`), men det innebär att analysen börjar förbesluta `Accept`, vilket är
ett större steg än att göra `Exclude` hållbart. Eget beslut, inte inbakat här.

### Kartan i granskningsvyn: zoom och panorering — 2026-08-22

`GeometryPreview` ritar fortfarande egen SVG — ingen `maplibre-gl`, ingen nyckel, ingen
tile-kostnad. §9:s villkor för att lägga till ett kartbibliotek står kvar orört. Det som
tillkom är att den ritade ytan går att undersöka:

- hjul zoomar mot pekaren (styrplattans nyp kommer in som samma händelse)
- dra för att panorera, dubbelklick zoomar in
- fyra knappar: in, ut, passa featuren, passa båda linjerna
- tangentbord när ytan har fokus: piltangenter panorerar, `+`/`-` zoomar, `0` passar

**Skalstocken räknas om ur den aktuella vyn**, inte ur den fulla utbredningen, så den är
sann vid varje zoomnivå. Den flyttades från SVG:n till ett HTML-lager ovanpå — text i
SVG skalas med `viewBox` och hade behövt fontstorlek i världskoordinater.

**Punktgallringen gjordes vyberoende.** Förr ströks linjen ner till 1500 punkter med ett
fast steg över hela sträckan, vilket tog bort detaljen just där man zoomade in. Nu
behålls *varje* punkt innanför vyn och bara skelettet utanför, så inzoomning avslöjar
detalj i stället för att dölja den. Det är hela poängen med att kunna zooma: se om två
linjer skiljer sig åt med två meter eller tvåhundra.

Tre fällor som kostade en runda var:

- **Wheel måste bindas direkt på elementet.** React registrerar `wheel` passivt på roten,
  där `preventDefault` ignoreras, så sidan hade rullat medan man zoomade.
- **Vyåterställningen får inte ligga i en effekt.** `react-hooks/set-state-in-effect`
  fäller det, och en effekt hade dessutom hunnit rita föregående förslags vy först. Den
  görs under render mot ett `drawnFor`-värde.
- **Knapparna ligger inuti panoreringsytan**, och `setPointerCapture` på en dragning åt
  annars deras klick. Pekarhändelser som börjar på en `button` ignoreras nu.

**Verifierat i webbläsare 2026-08-22.** Två fel föll ut vid provkörning, båda i
punktgallringen och inte i själva zoomen:

1. Punkter utanför vyn ströks ner men ritades ändå ihop till en sammanhängande linje, så
   sträckan mellan två glest liggande punkter blev en rak korda tvärs genom bilden. Vilka
   kordor som hamnade där berodde på vyn, så de svepte omkring under zoomen. Allt utanför
   vyn kapas nu bort och banan bryts där (`M` i stället för `L`), med grannpunkten precis
   utanför kanten kvar så att segmentet in i bild är helt.
2. Steget var inte nästlat, så en tätare nivå gav nya hörn på nya ställen i stället för att
   fylla i. `strideFor` är nu en tvåpotens som halveras per zoomnivå, och varje nivå ritar
   en äkta delmängd av nästa. Nivån är `floor(log2(fitAll.w / view.w))` — ett heltal, så
   den ändras vid distinkta trösklar och inte kontinuerligt under ett hjulskrall.

Ett tredje fel kom ur samma provkörning: gallringen kapade mot `viewBox`, men
`preserveAspectRatio="meet"` målar mer värld än vyn längs boxens långa sida. Linjen slutade
i en rak lodrät kant inne i bild. Kapningen sker nu mot `paintedArea(view, size)`, den
verkliga världsrektangeln på skärmen.

Kostnad efter rättningarna: `trail-import-review-page` växte 8,01 → 8,19 kB gzippat.

Webben har fortfarande ingen testuppsättning alls — inga `vitest`, `testing-library` eller
`playwright` i `package.json` — så allt sådant här måste provköras för hand.

#### Filtren i granskningsvyn kombineras, och det syntes inte

Säkerhetskorten och beslutsknapparna är två oberoende filter som gäller samtidigt. `High` +
`New trail` ger tomt, och de nya lederna som kom ur `Unmatched` göms av kortet — men
tomrutan sa bara "Nothing matches this filter", i singular och utan väg tillbaka.

Nu finns en rad under filtren, `Showing High · New trail` med en `Show all`, som syns även
när listan har innehåll: elva rader ser annars ut som *alla* nya leder tills något säger att
det är elva av `High`. Tomrutan namnger båda filtren och har samma `Show all`. Orden
kommer från `decisionLabel` i `badges.tsx`, samma tabell som brickorna på raderna.

Antal per filterknapp vore bättre än båda — då hade `New trail 0` sagt ifrån innan
klicket — men `session.counts` har bara totaler, inte per säkerhetsnivå. Kräver en ändring
i API:t.

#### MapTiler-nyckeln räcker inte till webben

Bakgrundskarta skulle behöva en **egen nyckel**, och free tier tillåter bara en aktiv.
Appens nyckel är spärrad på `User-Agent: stigvidd`, och en webbläsare kan inte sätta den
headern — `User-Agent` är en forbidden header name, så `transformRequest` i
MapLibre GL JS kommer inte förbi det. Åt andra hållet skickar appens native-anrop ingen
`Origin`, som en origin-spärrad nyckel kräver. De två spärrarna kan alltså inte samsas på
en nyckel utan att `?` (tillåt okända origins) slår ut skyddet.

Nyckeln som finns kör appens karta i produktion och ska inte experimenteras med. Frågan
löser sig när Flex-planen ändå tecknas inför lansering. Alternativ utan tredje part: en
egen PMTiles-fil över kommunen serverad från `media.stigvidd.se`.

Ett gratisalternativ finns och är avvaktat 2026-08-22: rasterrutor från
`tile.openstreetmap.org` som `<image>` under linjerna i den befintliga SVG:n. Ingen nyckel,
inget konto, ingen ny dependency, och zoom, pan och gallring står orörda. Priset är att
`drawing` måste projicera i EPSG:3857 i stället för lokala meter, och att skalstocken då
behöver korrigeras med `cos(latitud)`. Attribution `© OpenStreetMap contributors` är
obligatorisk, och OSM:s tile-policy gäller lågvolym — ett verktyg som körs en gång i
kvartalet ligger väl innanför.


## Namn och längd väljs i granskningen — byggt 2026-08-22

`New trail` beslutar inte längre direkt. Knappen öppnar en panel, på samma sätt som
`Relink` gör, med två saker att bestämma innan leden skapas:

- **Namnet.** Textfältet står förifyllt med källans namn och är till för att kortas. Tomt
  fält går inte att skicka.
- **Längden.** Uppmätt ur linjen är förvalt. Källans `sparlangd` går att välja i stället,
  och valet visas bara när de två siffrorna är oense.

Accept fick samtidigt det som saknades sedan Banvallen: när en befintlig leds kuraterade
längd ligger långt från vad dess egen linje mäter erbjuds den uppmätta siffran som en
kryssruta bredvid rollvalet. **Aldrig förkryssad** — den kuraterade siffran är avläst från
en skylt på plats, och §5 säger att den är vår. Erbjudandet visas när skillnaden är minst
0,5 km *och* minst en tiondel av längden, så halvkilometersavrundningen på skyltarna inte
skräpar ner vyn. Banvallen: 8,2 mot 15,72 uppmätt — syns. En led på 5,0 mot 5,24 — syns
inte.

### Vad som lagras

Två nya kolumner på `TrailImportProposals`, migration
`20260822163523_AddProposalDecidedNameAndLength`:

| Kolumn | Typ | Skrivs av |
| --- | --- | --- |
| `DecidedName` | `text` | bara `CreateNew` |
| `DecidedLengthKm` | `numeric(18,2)` | `CreateNew`, `Accept`, `Relink` |

Servicen avvisar ett namn på varje annat beslut ("Only CreateNew takes a name."), en längd
på `Skip`, `Exclude` och `Pending`, och en längd utanför 0–1000 km. Ångra (`Pending`)
nollar båda tillsammans med resten av granskarens avtryck — ett beslut anger sina
överskrivningar i sin helhet, så att utelämna dem är hur de tas bort igen.

Migrationen är genererad, **inte körd** mot testmiljön. Den går på nästa API-uppstart.

### Vad steg 8 ska läsa

Verkställ tar namnet från `DecidedName`, inte från `FeatureName`, och längden från
`DecidedLengthKm` när den är satt. För `Accept` och `Relink` är `DecidedLengthKm` den
enda vägen in i `Trail.TrailLength` — utan den står den kuraterade siffran orörd, precis
som §5 kräver.

Prov: 1330 gröna (1324 + 6), `dotnet build backend.sln` 0 varningar. `web/openapi.json`
skrevs om av kontraktstestet och klienten är omgenererad; granskningsvyn 8,59 → 9,28 kB
gzippad.


### Rättelse: erbjudandet pekade åt fel håll — 2026-08-22

Provkört i webbläsaren: Banvallen erbjöd ingen längd, Kröcklings hage gjorde det. Mätt mot
testmiljön, session 20:

| Led | Kurerad | Linjen mäter | Skillnad |
| --- | --- | --- | --- |
| 276 Banvallen | 15,72 km | 15,72 km | 0 % |
| 305 Kröcklings Hage | 2,00 km | 0,05 km | 97,5 % |
| 271 Kröcklings hage | 2,00 km | 0,03 km | 98,5 % |
| 413 Kröcklings hage | 2,00 km | 1,86 km | 7,0 % |

Banvallen är rätt beteende: siffran är redan rättad för hand, det finns inget att erbjuda.

### Riktningsregeln är förkastad — 2026-08-22

Första försöket byggde riktningsregeln ur §5: erbjud bara den uppmätta längden när linjen
är **längre** än den kurerade siffran, och varna om trasig geometri när den är kortare.

Det höll inte. En linje som är kortare än längden säger kan lika gärna vara en led som är
felmärkt som en geometri som är kapad, och **ingenting i datan skiljer de två åt** — det
gör bara bilden. Att kalla det "trasig linje" i vyn är att påstå en diagnos vi inte har
täckning för, och att samtidigt ta bort valet är att låsa granskaren ute från det ena av
två lika möjliga fall.

Erbjudandet visas därför åt **båda hållen**, aldrig förkryssat, med de två siffrorna
utskrivna och åt vilket håll linjen avviker. Texten säger vad den vet och inte mer: en
linje som faller kort kan vara avkapad lika gärna som en längd som aldrig stämde, och
teckningen ovanför är det som skiljer dem åt. Valet är granskarens.

Kröcklings hage är fortfarande fallet att titta på — 2,00 km mot en stump på 30 meter — men
vyn talar om vad den mäter i stället för att gissa varför.


## Två features på samma led varnas nu — byggt 2026-08-22

Rollen `Duplicate` fanns, men den byggde på att granskaren själv kom ihåg att två rader
långt ifrån varandra i listan pekade på samma led. Missar man det blir ledens sträckning
en sammanslagning av samma linje två gånger: 373 hade blivit 15,9 km i stället för 7,93.
Det syns inte förrän någon undrar varför en åttakilometersled står som sexton.

Förhandsvisningen svarar därför på frågan själv. `GetSiblingsOnTrailAsync` läser de andra
förslagen i sessionen som siktar på samma led — `DecidedTrailId ?? SuggestedTrailId`, så
en omkopplad rad räknas dit den faktiskt pekar — och de följer med i
`TrailImportPreviewResponse.SharingTheTrail`. `CreateNew` och `Exclude` sorteras bort:
de siktar inte på någon led alls.

Vyn visar en gul ruta med de andra featurernas namn och en knapp, **Accept as duplicate**,
som beslutar med rollen `Duplicate` direkt utan att radioknappen behöver röras. Rutan
sitter ovanför rollvalet, alltså före det beslut den handlar om.

Mätt mot session 20 efter omanalysen: **en enda led i hela sessionen** har mer än en
feature på sig — 373 "Rya åsar, Vildmarksspåret", med `Vildmarksleden` (Certain, identisk
hash) och `Vildmarksspåret (gran)` (High, 100 % ömsesidig täckning). Alla andra 201
features har sin egen led, och för dem är `Segment` som förval rätt.

### Sidospår: dubbletten i databasen är utagerad

373 och 292 var samma stig, båda 9,00 km, 100 %/100 % täckning och 5 m ifrån varandra,
båda skapade 2026-02-03 av samma ursprungsimport. 373 bar allt kuraterat — verifierad,
symbolbild, besöksinformation, området Rya åsar, fem riktiga bilder. 292 hade fyra
mock-bilder, ingen besöksinformation, inget område, och identisk `FullDescription`.

292:s kortbeskrivning var den bättre av de två och flyttades över till 373; därefter togs
292 bort. Inga recensioner, önskelistor eller favoriter hängde i den. Efter omanalysen
pekar båda källans features på 373 och ingen rad i sessionen pekar på ett id som saknas.

Kvar i vyn: acceptera `Vildmarksspåret (gran)` som `Duplicate`, vilket knappen ovan nu
gör i ett klick.

### Vid sidan om: probarna kom in i allowlistan

`/healthz` och `/readyz` lades till i `Program.cs` och är anonyma med flit.
`EndpointAuthorizationTests` är en allowlist över precis vilka endpoints som får vara
öppna, så de fördes in där med motiveringen: healthz svarar bara på liveness
(`Predicate = _ => false`) och readyz kör de checkar som är taggade `ready`. Ingen av dem
lämnar ut data.

Prov: 1334 gröna, `dotnet build backend.sln` 0 varningar, webben ren; granskningsvyn
10,87 kB gzippad.


### Rättelse: knappen kunde göra båda till dubbletter — 2026-08-22

Provkört direkt: båda raderna erbjöd *Accept as duplicate*, och båda gick att trycka. Då
stod 373 med två `Duplicate`-länkar och ingen `Segment` — ingen feature bar ledens
sträckning, och sammanslagningen hade inte haft något att räkna ur.

Varningen tittar nu efter vem som bär rutten. Är någon annan feature på leden beslutad som
`Segment` erbjuds `Duplicate` och texten säger vilken av dem som bär den. Är ingen det
byter knappen till **Accept as segment**, och texten säger att leden annars blir stående
med den linje den redan har.

Det sista är värt att inte kalla ett fel: en led med **enbart** `Duplicate`-länkar är
precis den spärr §5 föreslår för kuraterad geometri — Vänga mosse id 295, där källans
linje är trasig och ersatt av en egen inspelad vandring. Skillnaden är att det ska vara ett
val, inte något som råkar bli så för att en knapp erbjöd samma sak två gånger.

Verkställ ska därför **varna, inte blockera**, på en led vars alla länkar är dubbletter,
och säga vilken led det gäller. Hör hemma i samma förhandsvisning som Banvallen-fallet.


---

## Dagens läge — 2026-08-22, att fortsätta från

Allt nedan är byggt, provkört mot testmiljön och grönt: **1334 tester**, `dotnet build
backend.sln` 0 varningar, webben ren i tsc, eslint, prettier och build. Granskningsvyn
växte 8,53 → 11,16 kB gzippad under dagen.

### Byggt i dag

| Vad | Var det står |
| --- | --- |
| Ångra ett beslut — knapp, `u`, och nollning av granskarens avtryck | "Ångra ett beslut" |
| Namn och längd väljs innan en led skapas; längderbjudande på Accept | "Namn och längd väljs i granskningen" |
| Riktningsregeln förkastad — erbjudandet visas åt båda hållen | "Riktningsregeln är förkastad" |
| Varning när två features siktar på samma led, med rollknapp | "Två features på samma led varnas nu" |
| Knappen visste inte vem som bar rutten — rättat | "Rättelse: knappen kunde göra båda till dubbletter" |
| Dubbletten 373/292 utagerad i databasen | samma avsnitt, "Sidospår" |
| `/healthz` och `/readyz` införda i allowlistan | samma avsnitt, "Vid sidan om" |

Därutöver tre saker i vyn som inte behöver egna avsnitt:

- **Hovertexter på alla beslutsknappar**, plus en info-ikon som öppnar en ruta med alla sex
  besluten, deras tangent och två meningar om vad de skriver. Där står också det som inte
  får plats i en hovertext: att uteslutningen minns linjens form, och att en ärvd
  uteslutning kommer tillbaka vid nästa analys.
- **Kartans färger och teckenförklaring.** Källans feature och den matchade leden var två
  gråskalor som gick i varandra på mörk botten. Nu: varm linje ovanpå ett svalt band, med
  egna toner per tema i stället för genomskinlighet, som dämpas mot svart och bleks mot
  vitt. Förklaringen flyttade in i kartrutan och raderna är klickbara — släck ett lager och
  se vad det andra täcker på egen hand.
- **Beslutade knappar är inaktiva.** En accepterad rad visar *Accepted* i grått, en utesluten
  *Excluded*, en skippad *Skipped*, och `a`, `x`, `s` gör ingenting på dem. Accept tänds
  igen så fort ett klick skulle betyda något — byte av roll eller ikryssad längd — eftersom
  det då är en riktig ändring som ska sparas.

### Näst på tur: steg 8, Verkställ

Underlaget finns nu. Fyra saker ska in i själva steget, alla motiverade i avsnitten ovan:

1. **Namn och längd** läses ur `DecidedName` och `DecidedLengthKm`, inte ur `FeatureName`.
   För `Accept` och `Relink` är `DecidedLengthKm` den enda vägen in i `Trail.TrailLength`.
2. **Förhandsvisning innan knappen blir tryckbar**, med tre uppräkningar: beslut som går
   emot en hög matchning (Banvallen-fallet), leder vars alla länkar är dubbletter (rätt vid
   kuraterad geometri, annars ett misstag), och antalet leder som skapas.
3. **Varning innan en omanalys kastar beslut.** I dag går det utan att någon frågar; det
   spelade ingen roll i testet, men inte den dag 203 rader är genomgångna.
4. **Första synken skriver inga källägda fält** på befintliga leder — §5, "Första synken
   har inget att jämföra med".

### Öppet, dina beslut

- ~~Föräldrarelation led ↔ etapp (Öppna frågor).~~ **Avgjord 2026-08-23**, se "Ledrelationer".
- **Kanotsträckorna: PÅ VÄNT 2026-08-23.** Ska inte tas med i dagsläget. Modellanalysen från
  2026-08-22 står kvar som underlag — de nio är en graf och kan inte bli `Trail` — men
  beslutet om vad som ska hända med dem är inte fattat och ska inte fattas nu.
- `stigvidd-user`-rollen med auth-kollegan.
- Basemap under linjerna — avvaktat med flit; gratisvägen via OSM-raster ligger beskriven.
- De sex lederna med `TrailLength` 0,00 och Kröcklings-trion, som ingen import rör:
  behöver en egen längdgenomgång i admin.

### Ligger kvar sedan tidigare, obyggt

`LastSeenGeometry` på `TrailSourceLink`; `LinkedTrailIdentifier`/`LinkedTrailName`;
`PreviousTrailId`/`PreviousRole`/`PreviousDecidedAt`/`PreviousNote` på förslaget;
konfliktregeln som kapar confidence till `Medium`; förhandsvisning som ritar en andra led.

---

## Ledrelationer — beslutade och byggda 2026-08-23

Avstämt med senior utvecklare: **en generell relationstabell**, inte en `PartOfTrailId` på
`Trail`. Den mindre vägen hade räckt för Sjuhäradsleden men inte för alternativ sträckning,
och båda fallen finns i materialet.

### Två typer, inte tre

```csharp
public enum TrailRelationType
{
    PartOf = 0,       // From är en etapp av To; riktad, ordnad på Sequence
    Alternative = 1,  // From och To är två dragningar av samma led; symmetrisk
}
```

`Nearby` fanns i första skissen och **utgår**. Torpanäset/Hofsnäs (254, 398, 377) är inte en
relation mellan leder utan tre promenader på samma plats, och `CityArea` är redan precis det
— en plats med `ICollection<Trail>`. En `Nearby`-rad per par hade dessutom skalat kvadratiskt
och sagt mindre än områdestillhörigheten redan säger.

Skillnaden mot `PartOf`: etapperna avlöser varandra ände mot ände (0,0 m mellan alla tio,
mätt 2026-08-20). Det är en sekvens, inte en samling.

### Symmetrin lagras som en rad

`Alternative` skrivs som **en** rad och läses ur båda kolumnerna. Två speglade rader hade
gjort en halv relation möjlig — `242 → 359` utan `359 → 242` — och ingenting i databasen
hade fångat det. Priset är att läsfrågan måste titta i `FromTrailId` **och** `ToTrailId` för
symmetriska typer, vilket är synligt i koden i stället för tyst i datan.

`PartOf` har inte problemet: `To` är alltid föräldern, så uppslaget är entydigt åt båda håll.

### Kända fall i den här datan

| Relation | Rader |
| --- | --- |
| `PartOf` | Etapp 01–10 → `Sjuhäradsleden`, `Sequence` 1–10 |
| `Alternative` | 242 `Sjuhäradsrundan` ↔ 359 |

Hyssnaleden och Vildmarksleden nämndes som exempel på samma form men **ligger utanför den här
källan**. Därför räcker `Sequence` som `int` — frågan om grenade eller slingformade etapper
uppstår inte här, och ska den lösas någon gång är det när en sådan led faktiskt ska in.

### Aggregatet blir en led, inte en container

`Sjuhäradsleden Alla Etapper` (366) får **`CreateNew`** med namnet kurerat till
`Sjuhäradsleden` enligt §5. `Exclude` är uteslutet — en förälder måste vara en `Trail` för
att kunna vara mål för en relation. `Duplicate` var aldrig möjlig: rollen kräver en `TrailId`
och aggregatet spänner över tio leder.

Övervägt och förkastat: en egen entitet som liknar `CityArea`, med leden som container för
sina etapper och sina anläggningar. Två skäl.

- `CityArea` har **ingen geometri** — `Location` är en `string`. En områdesliknande förälder
  kunde inte rita de 134,25 km, och lägger man till geometri har man byggt en `Trail`.
- Samma räkning som fällde `WaterRoute` för kanotlederna: hela `Trail`s följe av
  `TrailImage`, `Review`, `TrailObstacle` och `VisitorInformation` hade behövt dupliceras
  eller polymorferas. Sjuhäradsleden ska rimligen gå att önskelista och recensera som helhet.

**Föräldern måste ha egen `GeoPath`.** `TrailRepository` filtrerar på
`t.IsVerified && t.GeoPath != null` på tre ställen — listningen, markörerna och
närhetsrankningen. En geometrilös förälder hade alltså inte funnits för appen, tyst och utan
att något felar. Geometrin kommer från aggregatfeaturen som `Segment`-länk, som vanligt.

### Anläggningar längs en led är en spatial fråga

`Facility.Coordinates` är en `Point` (SRID 4326) och `Trail.GeoPath` en `LineString`, så
"vad finns längs den här leden" besvaras med `ST_DWithin` — ingen container behövs, och
svaret gäller alla 188 lederna, inte bara flerdagslederna. Bad, fiske och naturreservat
saknar medvetet koordinater (de är ytor) och nås via `CityAreas`, som etapperna passerar.

Uppslagningen är **inte byggd**. Visar den sig ta med skräp — en grillplats 150 m bort som
hör till något annat — är svaret en `Facility`↔`Trail`-koppling vid sidan av den spatiala
frågan, inte en container. Men det går inte att veta förrän anläggningarna finns i databasen,
vilket de enligt `docs/anlaggningar-och-omraden.md` ännu inte gör.

### Vad appen ska göra med det

Föräldern får egen detaljvy. Där ritas **barnens** linjer i växlande färg i stället för
förälderns egen, ordnade på `Sequence`, så att skarvarna mellan etapper syns — det är det
som är intressant på en flerdagsled, inte var linjen går utan var man kan sluta för dagen.
Två färger som växlar, inte tio olika; tio blir en färgkarta att avkoda.

Att peka på ett segment ska öppna den etappens egen vy.

Öppet: vyn ska hämta barnens koordinater **i stället för** förälderns, inte utöver. Föräldern
bär 67 594 punkter och barnen 67 608 till, så hämtas båda går det dubbla över nätet för
ingenting. Det är en fråga för endpointen och ska avgöras innan vyn byggs.

### Byggt 2026-08-23

`Infrastructure/Enums/TrailRelationType.cs`, `Infrastructure/Data/Entities/TrailRelation.cs`,
EF-konfigurationen i `StigViddDbContext` och migrationen `20260823093348_AddTrailRelation`.

Migrationen är additiv — en `CreateTable`, inga `ALTER` på befintliga tabeller. SQL:en läst
före körning: två `FOREIGN KEY … ON DELETE CASCADE` mot `dbo."Trails"`, ett unikt index på
`(FromTrailId, ToTrailId, Type)`, ett vanligt på `(ToTrailId, Type)` för uppslag av en
förälders etapper och av den symmetriska relationens fjärrände, och check-villkoret
`"FromTrailId" <> "ToTrailId"`. **Inte körd mot någon databas än.**

Kaskad i båda ändar, till skillnad från `TrailSourceLink`s `SetNull`: en relation betyder
ingenting när endera leden är borta, och en halv relation hade lästs som en hel.

`Sequence` är `int?` och meningsfull bara för `PartOf`.

**Fyra schematester** i `Tests/IntegrationTests/Schema/TrailRelationSchemaTests.cs`. De ligger
i integrationssviten och inte bland enhetstesterna därför att enhetstesterna kör EF InMemory,
som varken hedrar unikt index, check-villkor eller kaskad — en relationstabell som tappat sin
konfiguration hade stannat grön där.

Alla fyra är bevisade genom att konfigurationen bröts, en sak i taget, och exakt ett test
blev rött varje gång:

| Brytning | Rött test |
| --- | --- |
| `.IsUnique()` bort | `SameRelationTwice_ShouldBeRejected` |
| check-villkoret bort | `TrailRelatedToItself_ShouldBeRejected` |
| `Cascade` → `NoAction` i båda ändar | `DeletingEitherTrail_ShouldTakeTheRelationWithIt` |
| `Type` bort ur unika indexet | `SamePairUnderAnotherType_ShouldBeAllowed` |

1368 tester gröna, `dotnet build` 0 varningar.

### Kvar innan steg 8

- Admin-endpoints för att sätta och ta bort en relation — kontraktskedjan följer, alltså
  `OpenApiContractTests` en gång röd med flit och sedan `npm run generate:api`.
- Migrationen körd mot testmiljön, granskad som SQL enligt samma mönster som steg 2 och 4.
- Relationerna satta efter verkställ: tio `PartOf` och en `Alternative`.

---

## Steg 8 — Verkställ, byggt 2026-08-23

Den första destruktiva delen av synken. `POST sessions/{id}/apply` skriver besluten till
`Trails` och `TrailSourceLinks` i en transaktion, och allt som avgör *vad* som skrivs är
uträknat innan transaktionen öppnas.

### Uppdelningen: planera rent, skriv dumt

`Core/Common/ApplyPlanner.cs` är en ren funktion `ApplyInput → ApplyWriteSet`. Den fattar
varenda beslut om vad som får skrivas över; repositoryt äger bara transaktionen och
ordningen. Skälet är att reglerna i §5 är det som är värt att prova, och de går inte att
prova ordentligt så länge de sitter inbakade i en EF-skrivning.

```
GetApplyInputAsync  →  ApplyPlanner.Plan  →  ApplySessionAsync
   (läser)               (bestämmer, rent)      (skriver, i transaktion)
```

`ApplyInput` är avsiktligt tyngre än `ApplyPlan` som `diff` använder: den bär geometrin och
källans properties för varje förslag. Därför läses den bara när en session faktiskt
verkställs, inte varje gång granskaren tittar på förhandsvisningen.

### De fyra punkterna, och var de sitter

| Punkt | Var | Hur |
| --- | --- | --- |
| 1. Namn och längd ur besluten | `ApplyPlanner.Create` / `.Update` | `DecidedName` för `CreateNew`; `DecidedLengthKm` är **enda** vägen in i `TrailLength` för `Accept` och `Relink` — källans `sparlangd` läses aldrig för en befintlig led |
| 2. Förhandsvisning före knappen | `ApplyPanel` i webben | Knappen finns inte förrän `diff` har lästs; den är `disabled` tills `canApply` |
| 3. Varning före omanalys | `QueueAnalysisAsync(force)` | 409 med antalet beslut som skulle kastas; webben frågar och kör om med `force=true` |
| 4. Första synken rör inga källägda fält | `ApplyPlanner.Update` | Två grindar, se nedan |

### Två grindar för trevägs-mergen, och de svarar på olika frågor

```csharp
var hasBaseline = input.TrailsWithBaseline.Contains(target.TrailId)
    && link?.SourceSnapshot is not null;
```

Den **första** är regeln från §5: en led som källan aldrig varit registrerad mot har inget
sätt att skilja en lokal redigering från vad ursprungsimporten lämnade. Den **andra** är
mergens eget krav: utan snapshot finns ingenting att jämföra mot.

Att de behövs båda syns i `Relink`-fallet. En feature kan ha en länk med snapshot — alltså
en baslinje för sina egna properties — och ändå kopplas om till en led källan aldrig rört.
Då gäller regeln, inte datan. Det testet (`Plan_WhenAFeatureIsRelinkedOntoATrailThe...`)
är det enda som skiljer grindarna åt, och det var det som saknades i första omgången: med
bara ett förstasynkstest gick det att ta bort `TrailsWithBaseline` helt utan att något blev
rött.

### Vilka fält som faktiskt merge:as

`Classification`, `Accessibility`, `AccessibilityInfo`, `TrailSymbol` — lästa ur
`SourceTrailFields.Read`, som är `TransmogrifyBorasData`s parsning lyft till `Core/Common/`
så steg 9 har den kvar när importern skrivs om.

`TrailLinks` står i "källan äger" men ligger **utanför** steg 8: det är en samling, och en
trevägs-merge över en samling är inte specad någonstans i planen. Värt att ta när det
behövs, inte innan.

`Name` och `TrailLength` merge:as inte alls — de är våra.

### `GeoPath` härleds, den merge:as inte

Geometrin har ingen baslinje: `LastSeenGeometry` finns inte på länken, och `SourceSnapshot`
bär properties, inte linjen. Men det behövs ingen, för §4 säger att `GeoPath` är ett
*resultat* av ledens `Segment`-länkar. Så:

- ingen `Segment`-feature på leden → linjen står orörd. Det **är** spärren för kuraterad
  geometri som §5 föreslår, och den kostade ingen ny kolumn.
- en `Segment` → den linjen.
- flera → `LineMerger`. Kommer det ut mer än en linje läggs den undan orörd; en led lagrar
  en `LineString`, och att gissa vilken av flera vore värre än att inte röra den.

Den skrivs bara när den härledda linjen **skiljer sig** från den lagrade (`EqualsExact`).
Utan det blir varje andra synk 177 geometriskrivningar som inte ändrar något, och
`TrailsUpdated` i rapporten hade räknat leder som inte rörts.

I dagens data är det ändå tomt arbete: ingen led har mer än en `Segment`-feature, och på
första synken skrivs ingen geometri alls.

### Vilken feature som talar för leden

Ligger två features på samma led — 373 är enda fallet — merge:as fälten ur den som bär
rutten, alltså `Segment`-länken. En `Duplicate` hör till leden men beskriver något annat,
och att låta den bestämma ledens `TrailSymbol` vore att låta fel rad vinna.

### Nya leder publiceras inte

En led som `CreateNew` skapar får `IsVerified = false`. `TrailRepository` filtrerar på
`IsVerified && GeoPath != null` på tre ställen, så den är osynlig i appen tills någon
verifierat den. Det är avsiktligt: en importerad led är ett utkast.

`CreatedBy` sätts till sessionens `Source`, och `CreatedTrailId` skrivs tillbaka på
förslaget — protokollet över vad ett beslut faktiskt producerade.

### Idempotens och kapplöpning

Att verkställa en redan verkställd session är en no-op som ger tillbaka den lagrade
rapporten, inte ett fel. Och statuskontrollen görs **två gånger**: en gång i servicen och
en gång inne i transaktionen, eftersom två anrop hinner passera den första innan någon av
dem skrivit. Den andra är det som håller.

### Rapporten

`ApplyReport` (`Core/Common/`) sparas som jsonb på sessionen och innehåller de fyra
siffrorna plus konflikterna. Den är avsiktligt **inte** responskontraktet: den är en
databaskolumn och överlever varje form admin-vyn råkar vilja ha i dag. Går den inte att
läsa i en senare build returneras en tom rapport i stället för ett fel — den frågan ville
bara titta.

### Bevisat, inte antaget

Alla åtta experiment gjordes genom att bryta koden och räkna rött:

| Brytning | Vad som blev rött |
| --- | --- |
| Grinden `TrailsWithBaseline` bort | `Plan_WhenAFeatureIsRelinkedOntoATrailTheSourceHasNeverTouched` |
| Namnet ur `FeatureName` i stället för `DecidedName` | `Plan_ForANewTrail_ShouldTakeTheReviewersName` |
| Längden faller tillbaka på uppmätt linje vid `Accept` | 6 tester, bland dem `Plan_ForAnAcceptedFeature_ShouldWriteTrailLengthOnly...` |
| Konflikt tar källans värde | `Plan_WhenBothSidesChangedAField_ShouldKeepOursAndReportIt` |
| Ny led publiceras direkt | `ApplyAsync_ForACreateNewFeature_ShouldCreateAnUnpublishedTrail...` |
| Länkuppdateringen blir alltid insert | 2 andrasynkstester |
| `blocked`-kontrollen bort | `ApplyAsync_OnASessionWhereNothingWasDecided_ShouldRefuse` |
| Omanalysvarningen bort | `QueueAnalysisAsync_WhenDecisionsWouldBeDiscarded_ShouldRefuseUntilForced` |
| Statuskontrollen i transaktionen bort | *ingenting* — därför skrevs `ApplySessionAsync_OnASessionThatIsNoLongerAwaitingReview` |

Den sista är poängen med övningen: kontrollen fanns, men ingenting hade märkt om den
försvann.

### Prov

1401 tester gröna (1379 + 22), `dotnet build backend.sln` 0 varningar. `web/openapi.json`
skrevs om av kontraktstestet och klienten är omgenererad — sex nya modellfiler, bland dem
`trailImportApplyResponse` och `trailImportAnalyzeParams`. Webben ren i eslint och
`tsc -b && vite build`.

**Inte körd mot någon databas.** Ingen session har verkställts mot testmiljön; hela steget
är provat mot SQLite och EF InMemory.

### Kvar

- Migrationen `20260823093348_AddTrailRelation` körd mot testmiljön som granskad SQL.
- Verkställ provkört mot testmiljön på riktigt, session 20.
- Admin-endpoints för ledrelationer, och relationerna satta efter verkställ.
- Steg 10: saknade och avpublicerade features (`MissingSinceAt`, `MissingImportCount`).
  Ligger med i §Verkställ-listan men är en egen punkt i §10 och är **inte** byggd här.
- `TrailLinks` i mergen, om det någonsin behövs.

---

## `Core/Common` upplöst — 2026-08-23

Mappen hade blivit 25 filer, och 18 av dem hörde till importen. Orsaken satt i
`GlobalUsings.cs`: **`global using Core.Common;` i fem assemblies**, alltså var allt i
mappen synligt överallt utan att någon någonsin behövde bestämma var en ny typ hörde
hemma. En hög som den blir inte städad, den växer.

```
Core/Results/          Result, RepositoryResult, RepositoryResultStatus, PagedResult
Core/Spatial/          GeoPointFactory, GeoPathSerializer, LocalMetricProjection
Core/TrailImport/
  Source/              SourceFeatureReader, SourceTrailFields, StoredImportFile, TrailLength
  Matching/            GeometryFingerprint, GeometryComparison, TrailMatcher, TrailGeometry
  Review/              ProposalSummary, ProposalIdCheck, ProposalOverrides, TrailForReview
  Apply/               ApplyInput, ApplyPlan, ApplyPlanner, ApplyReport, ApplyWriteSet,
                       SourceFieldMerge
```

Undermapparna följer synkens faser i den ordning de körs, vilket är samma ordning som
pipelinen i §6.

### `TrailImport` är avsiktligt inte global

`Core.Results` och `Core.Spatial` ligger kvar som `global using` — `Result<T>` står i
varenda servicesignatur och `GeoPointFactory` används i fem assemblies. `Core.TrailImport.*`
gör det **inte**: den ska man sträcka sig efter. Det är hela skillnaden mot förut, och det
är det som gör att mappen inte kan glida tillbaka till att bli en hög.

Vad varje assembly faktiskt behöver är mätt, inte gissat — varje rad togs bort och
lösningen byggdes om:

| assembly | `Core.Results` | `Core.Spatial` |
| --- | --- | --- |
| `Core` | ja | ja |
| `MapData` | **nej** | ja |
| `StigviddAPI` | ja | **nej** |
| `Tests/IntegrationTests` | ja | ja |
| `Tests/UnitTests` | ja | ja |

### Vad som placerade varje fil

Mätning, inte magkänsla: för varje typ, vilka mappar utanför importkedjan använder den.
Två fall var inte självklara.

`LocalMetricProjection` ser ut som importmaskineri — `TrailMatcher` är dess tyngsta
användare — men `TrailRepository` anropar den för appens närhetsrankning. Den är alltså
allmän geometri och hamnade i `Spatial/`.

`TrailLength` ser tvärtom allmän ut, men de enda statiska anropen står i
`TrailImportResponseFactory` och `TrailImportService`. Den tolkar källans `sparlangd` i sex
former — det är importens problem, ingen annans. `Trail.TrailLength` är en egenskap med
samma namn, vilket är varför den första mätningen såg fel ut.

### Använda `using`-rader, inte "alla på en gång"

Namespacena härleddes per fil ur vilka typer filen faktiskt nämner, inte genom att lägga
till alla fyra överallt. Två fallgropar dök upp och båda är värda att komma ihåg:

- **BOM.** Fem filer inleds med `﻿` före `using`, så `^using Core.Common;` matchade
  inte dem. De såg ut att inte behöva något alls.
- **Egenskaper som heter som typer.** `TrailLength = 9.5M` och `GeometryFingerprint = "..."`
  i objektinitierare ser ut som typanvändning. Åtta `using`-rader lades in i onödan av
  precis det; alla åtta togs bort och lösningen byggdes om för att bevisa att de var
  överflödiga.

### Testmapparna följde med

`CommonTests` delades i `TrailImportTests/{Apply,Matching,Source}` och `SpatialTests`.
Mapparna under `Tests/UnitTests/` speglar **källans lager**, inte ämnet — därför testar
`ImporterTests` fortfarande bara `MapData/`s engångsimportörer och inte synken, trots att
planen kallar synken "importern". Två olika saker med samma ord.

### Prov

1419 gröna före flytten, 1419 efter — samma tester, ingen ändrad rad utanför `namespace`-
och `using`-rader. `dotnet build backend.sln` 0 varningar, `check-hooks` grön. Strukturen
är införd i `CLAUDE.md` under Layering.

## Session 21 verkställd mot testmiljön — 2026-08-23

Första riktiga körningen. Sessionen (`spar_leder.json`, 203 features, boras-stad) verkställdes
15:12:36 mot testdatabasen 10.240.10.1/stigvidd.

### Vad som faktiskt skrevs

Rapporten sessionen själv lagrade:

```json
{"Conflicts": [], "LinksWritten": 194, "TrailsCreated": 11, "TrailsUpdated": 0, "FeaturesExcluded": 0}
```

Kontrollerat i databasen med read-only SQL:

| | |
| --- | --- |
| `TrailSourceLinks` | 194 (193 Segment, 1 Duplicate), alla med `SourceSnapshot`, alla `ConfirmedByHuman` |
| utan led / dubblerade fingerprints / föräldralösa | 0 / 0 / 0 |
| distinkta led | 193 = 182 befintliga + 11 nya |
| nya `Trails` | 443–453, alla `IsVerified = false`, alla SRID 4326 |
| led med `LastUpdatedAt >= AppliedAt` | **0** |

Noll uppdaterade led är rätt, och det är förstasynkens regel som gör det: utan ett lagrat
snapshot får källan inte skriva ett enda källägt fält. Körningen registrerar baseline. Det
är nästa synk som mergar.

`TrailLength` som importen räknade fram ligger inom ~0,3 % av `st_length` på geografin
(134,25 mot 134,61 km för Sjuhäradsleden).

### Två efterspel som inte är fel i körningen

Sjuhäradsleden finns nu både som eget led på 134 km och som åtta etapper. `TrailRelation`
finns men relationerna är inte satta — kvarstår som eget steg.

Tolv dubblerade ledsnamn i `Trails`, inget av dem från de elva nya. De låg där innan;
`avpubl Svaneholm / Bogryd 2,4 - 5,3 km` ×3 ser ut som gammalt skräp.

## Förhandsvisningen ljög, och applied-vyn fanns inte — 2026-08-23

Två fel som körningen ovan gjorde synliga.

### "What applying would write" räknade kandidater

Panelen lovade skrivningar men `GetDiffAsync` räknade beslut: `TrailsToUpdate` var antalet
distinkta led som Accept/Relink pekade på. Den visade **182** där en apply skrev **0**.

Fixen är att förhandsvisningen kör `ApplyPlanner` — samma funktion som verkställandet — och
rapporterar `ApplyWriteSet`. Det kostar samma geometriläsning som en apply gör, vilket är
priset för att löftet ska vara sant.

`TrailsLinked` är nytt i både diffen och rapporten: antalet led besluten *länkar*, vilket är
siffran som visar att körningen gör något när `TrailsToUpdate` är noll. `ApplyReport.TrailsLinked`
är `int?` — en rapport skriven före fältet fanns läser tillbaka som `null`, inte som noll.
Session 21:s rapport är precis en sådan.

### En verkställd session såg ut som en oavslutad

Efter apply låg man kvar på review-sidan med filter, kryssrutor och beslutsknappar kvar.
Sidan grenade aldrig på status. Backend refuserade redan varje beslut med 409 — knapparna
var alltså rena lögner — och kvittot fanns bara i komponentens state, så en omladdning
tappade det.

Nu bär `TrailImportSessionResponse` ett `Applied`-kvitto, läst ur den lagrade rapporten, och
review-sidan grenar på det: kvittopanelen överlever omladdning, besluts- och bulkkontrollerna
och tangentgenvägarna försvinner, `ProposalDetail` får `readOnly`, och listan blir historik
med "Show the 11 new trail(s)" som väg vidare.

### Prov

Kontraktkedjan kördes (`openapi.json` omskriven, `generate:api`, båda gröna). 1427 gröna,
webben bygger och lintar rent, `check-hooks` grön.

Två brytprov på den nya siffran: `TrailsToUpdate = linkedTrails.Count` (den gamla buggen)
fäller `GetDiffAsync_ForTwoFeaturesOnOneTrail_ShouldCountThatTrailOnce` och inget annat;
`TrailsToUpdate = 0` fäller `GetDiffAsync_ForATrailTheSourceHasWrittenBefore_ShouldCountItAsUpdated`
och inget annat. Ett rött var, åt var sitt håll.

## Kröcklings hage: två källfeatures ska uteslutas — 2026-08-23

Fyra leder i databasen heter `Kröcklings hage` (skiftlägesokänsligt): 271, 305, 311 och 413.
Bara 413 är en led — de andra tre är geometristumpar på 8–52 m som alla bär en påhittad
`TrailLength` på 2,00 km.

Orsaken sitter i källan, inte hos oss. Borås export innehåller **tre** features med det
namnet, och session 21 matchade dem var för sig:

| feature | längd | led | hur |
| --- | --- | --- | --- |
| 183 | 1866 m | 413 | `identical geometry hash` |
| 184 | 25 m | 271 | `identical geometry hash` |
| 269 | 63 m | 305 | 100 % ömsesidig täckning inom 15 m, hausdorff 11 m |

Matchningen gjorde alltså rätt: 413 **är** källans stora led, och stumparna är exakt
källans två småfeatures. Av 203 features i session 21 är de här två de enda under 150 m.

### Beslut: `Exclude`, inte radera

184 och 269 ska få `Exclude` i nästa sessions granskning. Raderar man i stället lederna 271
och 305 nollställs bara länkens `TrailId` (`OnDelete(SetNull)`, `StigViddDbContext.cs:214`)
och nästa synk föreslår samma två stumpar som **nya** leder. Uteslutningen minns sig själv
per fingeravtryck (`GetExcludedFingerprintsAsync`), så de kommer tillbaka avgjorda. Först
därefter kan 271 och 305 tas bort.

311 hade ingen källänk alls och togs bort direkt, liksom en tredje `Tångenleden` (252).

### Varför snuttarna inte läggs på 413

Prövat och förkastat. `GeoPath` härleds vid varje verkställ ur ledens Segment-features, så
en handredigerad linje på 413 skrivs över av nästa synk — 413 har baseline sedan session 21,
och härledningen jämför mot kolumnen. Att i stället koppla snuttarna till 413 som segment
ger heller ingenting: `LineMerger` skarvar bara linjer vars ändpunkter sammanfaller exakt,
184 slutar ~12 m från 413:s startpunkt och 269 tangerar 413 på mitten. Går de inte ihop till
en linje lämnas rutten orörd med flit (`ApplyPlanner.cs:189-201`). Kopplingen skulle alltså
se ut att fungera bara så länge sammanfogningen ger upp — och ändra ledens rutt den dag en
export råkar snappa ihop dem. Geometriskt tillför de inget heller: ~35 % av vardera stumpen
ligger inom 10 m från 413, resten är 10–25 m vid sidan om.

## Användarrollen är borttagen — 2026-08-25

Avstämt med authteamkollegan: realmen ska ha **en enda roll, `stigvidd-admin`**.
`stigvidd-user` skapas alltså aldrig, och seamen som väntade på den är borta.

Det som satt kvar var en konfigurationsswitch: `Authorization:UserRole` var osatt, och
`"User"`-policyn lade på ett rollkrav först om nyckeln fick ett värde. Nyckeln var inte
satt någonstans — varken i `appsettings*.json`, `docker-compose.yml` eller `.env` — så
enda stället den fanns var i koden och i ett test som låtsades att rollen redan fanns.

Med rollen borta faller hela §11:s tredelning. Kvar är två nivåer: **utloggad** och
**inloggad**, plus **admin**. Och "inloggad" är ett naket `[Authorize]` — precis vad de
18 endpointsen hade före 2026-08-20. Steg 3 i §11 är alltså återställt, inte lappat.

| Fil | Vad |
| --- | --- |
| `StigviddAPI/Program.cs` | `userRole`-variabeln, rollgrenen och hela `"User"`-policyn borta. `"Admin"` är den enda policyn kvar |
| 8 controllers, 18 rader | `[Authorize(Policy = "User")]` → `[Authorize]` i `Friends`, `HikeShareRecipient`, `HikeShares`, `Hikes`, `Notifications`, `Reviews`, `TrailObstacles`, `Users` |
| `Tests/IntegrationTests/Authorization/EndpointAuthorizationTests.cs` | vakten omskriven, rolltestet ersatt av en fastspikad admin-lista |
| `Tests/UnitTests/ControllerTests/KeycloakRealmRolesTransformationTests.cs` | negativa assertionen nämner inte längre `stigvidd-user` |

### Vakten som nästan styrde designen åt fel håll

`ProtectedEndpoints_ShouldNameAPolicy` krävde att varje icke-publik endpoint **namnger en
policy**, vilket vid en första anblick tvingar fram att `"User"` behålls som namn. Men
vaktens syfte — den skrevs i §11 steg 4, samma dag som policyn — är att en glömd
attributrad inte ska slinka igenom på `FallbackPolicy`. Ett naket `[Authorize]` är
explicit grindning; det lutar sig inte på fallbacken. Det var villkoret som var för
snävt, inte modellen.

Vakten heter nu `ProtectedEndpoints_ShouldCarryTheirOwnAuthorizationMetadata` och frågar
efter `IAuthorizeData` över huvud taget i stället för efter en policysträng.

Att bara släppa på villkoret hade dock lämnat ett hål: en endpoint kan tappa
`Policy = "Admin"` och bli ett naket `[Authorize]` — fortfarande "grindad", men öppen för
vilken inloggad appanvändare som helst. Därför tillkommer
`AdminEndpoints_ShouldBeExactlyTheApprovedOnes`, som spikar alla 26 admin-endpoints på
samma sätt som den befintliga listan spikar de anonyma. De 26 stämmer mot §11:s tabell:
tio skrivningar på leder och anläggningar, två på mediabiblioteket, `admin/export` och
`admin/import`, och tolv på `admin/trail-import`.

### Prov

1427 gröna, `dotnet build` 0 varningar. Kontraktkedjan rördes inte — `OpenApiContractTests`
skrev inte om `web/openapi.json`, eftersom attributen inte ändrar dokumentet.

Två brytprov, var för sig, och de faller åt var sitt håll:

- `[Authorize(Policy = "Admin")]` → `[Authorize]` på `GET /api/v1/Media` fäller
  `AdminEndpoints_ShouldBeExactlyTheApprovedOnes` (och `GetAllMedia_WithoutAdminRole_ReturnsForbidden`,
  som redan fanns) — men **inte** metadatavakten, som är hela poängen: nedgraderingen är
  osynlig för den.
- `[Authorize]` bortplockat från `NotificationsController` fäller
  `ProtectedEndpoints_ShouldCarryTheirOwnAuthorizationMetadata` och ingenting annat. Den
  släppta vakten fångar alltså fortfarande exakt det den skrevs för.

### Det gamla testet bevisade ingenting

`UserPolicy_WhenTheRoleIsConfigured_ShouldRejectCallersWithoutIt` gick igenom oavsett vad
policyn gjorde. Se [docs/notes/integration-test-auth-is-two-gates.md](docs/notes/integration-test-auth-is-two-gates.md).
