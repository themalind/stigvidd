# Ledbeståndet mot produktion

Vad som tagits bort ur ledtabellen sedan ledimporten började, vad som ska vara kvar, och i
vilken ordning produktionsdatabasen ska behandlas när funktionen sätts i drift.

**Produktionsdatabasen är orörd.** Allt nedan är gjort mot testmiljön, som är en kopia av
produktion. Ingen av städningarna, ingen synk och ingen radering har körts mot produktion.

Sammanställt 2026-08-23, mätt mot testdatabasen samma kväll.

## Utgångsläge och nuläge

| | test |
| --- | --- |
| Leder vid start (2026-08-20) | 228 |
| Raderade sedan dess | 44 |
| Skapade av synken (session 21) | 11 |
| **Leder i dag** | **195** |
| Publicerade (`IsVerified`) | 152 |

Användarinnehåll i testmiljön i dag: 28 recensioner, 26 favoriter, 26 önskelistor, 148
besöksinformationer, 328 länkar, 887 bilder, 162 områdeskopplingar. **Produktion har sina
egna siffror och sitt eget användarinnehåll** — de här talen är referens, inte facit.

## Vad som tagits bort, och varför

| Vad | Antal | Hur | När |
| --- | --- | --- | --- |
| MOCK-startdata, id 1, 2, 4–9 | 8 | `backend/cleanup-mock-trails.sql` | 2026-08-20 |
| Sjuhäradsleden: dubbletter, importfragment, inaktuella aggregat | 32 | `backend/cleanup-sjuharadsleden.sql` | 2026-08-20 |
| Id 280, den namnlösa | 1 | för hand | 2026-08-21 |
| Id 292, dubblett av 373 | 1 | för hand | 2026-08-22 |
| Id 252, tredje `Tångenleden` | 1 | för hand | 2026-08-23 |
| Id 311, 8,6 m-fragment av `Kröcklings Hage` | 1 | för hand | 2026-08-23 |

De två första har skript med torrkörning och rapport. **De fyra sista har det inte** — de
gjordes för hand och har fått ett skript i efterhand, `backend/cleanup-manual-deletions.sql`.

Grunderna, kort:

- **MOCK-raderna** var startdata som inte längre finns i källan, och sex av dem var exakta
  geometriska dubbletter av riktiga leder. De var de enda fingeravtryckskollisionerna i
  tabellen, vilket blockerade det unika indexet på `(Source, GeometryFingerprint)`.
- **De 32 Sjuhärad-raderna** var 21 `Olsfors-kommungränsen` med 6–33 punkter var, plus
  dubbletter och aggregat. 35 av 36 var opublicerade, noll användarinnehåll stod på spel,
  och 221:s unika `FullDescription` flyttades till 302 före raderingen.
- **280** saknade namn helt, 60,56 km och 30 402 punkter, opublicerad. Den slapp
  Sjuhärad-städningen bara för att den frågan filtrerade på namn. Fyra av de nya etapperna
  ligger 100 % inuti den.
- **292** var samma stig som 373, 9,00 km, 100 % ömsesidig täckning, 5 m isär. 292:s
  kortbeskrivning var den bättre och flyttades till 373 först.
- **252** var 100 % inuti led 3 `Tångenleden`, olänkad och opublicerad.
- **311** var ett 8,6 m långt fragment som till 100 % ligger inom 25 m från 305.

## Vad som ska vara kvar

Besluten är fattade på kart- och geometrianalys och är samtidigt testfall för matchningen:
går en synk igenom utan att bryta något av dem fungerar den.

| Leder | Beslut |
| --- | --- |
| 3 `Tångenleden` | Behålls. Var MOCK men är riktigt innehåll: 2 recensioner, 1 favorit, 1 önskelista, besöksinformation. `CreatedBy` rättad till `Borås Stad`, symbolvägen gjord relativ. |
| 242 `Sjuhäradsrundan` | **Behålls, raderas inte.** Den är publicerad och har unik text. Feature 148 matchar 90,7 % / 99,2 %, så synken kopplar om den och uppdaterar geometrin — id, text och användarinnehåll följer med. `TrailLength` rörs inte: källan och den kurerade siffran är båda 130 km. |
| 254, 377, 398 `Hofsnäs Torpanäset` | Tre **olika** leder. Alla behålls, alla publicerade. Källan har fortfarande tre features. |
| 298 och 365 `Aplareds IF Elljusspår` | Två olika slingor. |
| 299 och 347 `Rydboholms SK Elljusspår` | Två separata spår, överlapp 5,8 % / 1,8 %. |
| 313 `Vänga Mosse` | Korrekt sluten slinga, 2,345 km. Bär 2 recensioner, 1 favorit, 1 önskelista. |
| 295 `Vänga Mosse` | Behålls — **bär 3 recensioner**. Geometrin är trasig (öppen med 1 218 m glapp) och ska lagas med `Hikes` id 32, inte raderas. |
| 302, 318, 359 | Klarar sig genom exakt geometrimatchning mot `Etapp 04`, `Etapp 02` respektive `Sjuhäradsrundan (alternativ sträckning)`. |
| 413 `Kröcklings hage` | Den riktiga leden, 1,87 km. Är exakt källans feature 183. |
| `avpubl Svaneholm / Bogryd`, `Avpublicerad Naturstig` | Lämnas orörda — avpublicerade av källan, inte av oss. |

## Kvar att avgöra

Inget av det här är gjort, och inget av det bör göras mot produktion utan beslut.

1. **Feature 184 och 269 ska få `Exclude`** i nästa granskning — de är 25 m och 63 m långa
   anslutningssnuttar vid 413 och ligger i dag på lederna 271 och 305. Radera inte lederna
   först: `TrailSourceLink.TrailId` är `ON DELETE SET NULL`, så featuren kommer tillbaka som
   ett förslag om ny led. Uteslut först, radera sedan.
2. **Texten på 271.** Leden bär 988 tecken `FullDescription` som *inte* finns i 413 — 413 har
   714 egna tecken om samma naturreservat. Ingen av dem innehåller den andra; det är två
   olika texter, inte en trunkerad. Ett redaktionellt val, inte en kopiering.
3. **268 `Älmåsspåret`** ingår enligt kartanalysen inte i leden (överlapp 9 % / 1,6 %), är
   olänkad och opublicerad. Raderingskandidat.
4. **309 `Tångenleden`** ligger 100 % inuti led 3, är olänkad och opublicerad.
   Raderingskandidat på samma grund som 252.
5. **253 och 406 `Rya åsar Utsiktsstigen`** är enligt analysen samma led (`ST_Equals`).
   Dubbletten är inte utagerad.
6. **295:s geometri** ska lagas med `Hikes` id 32. Kräver `ST_SetSRID(...,4326)` — 18 av 42
   `Hikes` har SRID 0.
7. **Sex leder har `TrailLength` 0,00** och rörs inte av någon import. Egen genomgång.
8. **Ledrelationerna** är inte satta: tio `PartOf` och en `Alternative`. Entiteten och
   migrationen finns, endpoints saknas.

## Ordningen mot produktion

Stegen förutsätter psql-åtkomst till produktion. Utvecklingsmaskinen når bara testmiljön.

**0. Färsk säkerhetskopia, och helst en återställd kopia att öva på.** Alla åtta
främmande nycklar mot `dbo."Trails"` är `ON DELETE CASCADE`: `VisitorInformations`,
`TrailImages`, `TrailLinks`, `Reviews`, `TrailObstacles`, `CityAreaTrail`, `UserFavorites`,
`UserWishList`. En `DELETE` på fel rad tar kurerat innehåll och användarnas sparade leder
med sig utan ett felmeddelande.

**1. Verifiera att id:na betyder samma sak.** Alla tre städskripten raderar på hårdkodade
id. Testmiljön är en kopia av produktion, men kopian är tagen vid en tidpunkt. Kör
torrkörningens `SELECT` först och läs **namnen**, inte bara antalet:

```sql
SELECT "Id", "Name", "IsVerified", ST_NPoints("GeoPath") AS npoints
FROM dbo."Trails" WHERE "Id" IN (1,2,4,5,6,7,8,9) ORDER BY "Id";
```

Stämmer inte namnen mot listan i det här dokumentet: **stopp**. Då måste raderingarna
göras om på kriterier i stället för på id.

**2. `backend/reseed-identity-sequences.sql`.** Måste köras före den första inserten.
Flytten från SQL Server bulkkopierade rader med sina id utan att räkna upp sekvenserna, så
nästa insert annars kolliderar med 23505. Skriptet är idempotent.

**3. `backend/cleanup-mock-trails.sql`** — torrkörning först. Rapporten skriver ut de
recensioner som `CASCADE` tar med sig. I testmiljön var de få och ointressanta; **i
produktion kan de vara riktiga användares**. Läs dem innan `ROLLBACK` byts mot `COMMIT`.

**4. `backend/cleanup-sjuharadsleden.sql`** — torrkörning först. Grinden är
`total_user_content = 0`. Är den inte noll i produktion är listan fel för produktion, och
raderingen ska inte köras som den är.

**5. `backend/cleanup-manual-deletions.sql`** — de fyra raderingar som gjordes för hand i
test. Samma mönster: torrkörning, läs rapporten, byt till `COMMIT`. Skriptet flyttar 292:s
kortbeskrivning till 373 innan raderingen, precis som gjordes i test.

**6. Driftsätt API:t.** `DbMigrationRunner` kör migrationerna vid uppstart, inklusive
`20260823093348_AddTrailRelation`. Inget test applicerar en migration, så det här är första
gången de möter produktionens schema.

**7. Ladda upp exporten och granska.** Uteslut feature 184 och 269 enligt punkt 1 i "Kvar
att avgöra". Granskningen är hela poängen med steget — inget skrivs innan `Verkställ`.

**8. Verifiera efter verkställandet.** Frågorna nedan är de som kördes mot test.

## Verifiering efter en synk

```sql
-- rapporten sessionen själv lagrade
SELECT "Id", "Status", "AppliedAt", "ApplyReport" FROM dbo."TrailImportSessions"
WHERE "ApplyReport" IS NOT NULL ORDER BY "Id";

-- länkarnas integritet: alla tre ska vara 0
SELECT (SELECT count(*) FROM dbo."TrailSourceLinks" l
        LEFT JOIN dbo."Trails" t ON t."Id" = l."TrailId" WHERE t."Id" IS NULL)     AS orphan_links,
       (SELECT count(*) FROM (SELECT "Source", "GeometryFingerprint"
                              FROM dbo."TrailSourceLinks" GROUP BY 1,2 HAVING count(*) > 1) x) AS dup_fingerprints,
       (SELECT count(*) FROM dbo."TrailSourceLinks" WHERE "SourceSnapshot" IS NULL) AS missing_snapshot;

-- geometrin: fel SRID ska vara 0
SELECT count(*) FILTER (WHERE "GeoPath" IS NOT NULL AND ST_SRID("GeoPath") <> 4326) AS wrong_srid,
       count(*) FILTER (WHERE "GeoPath" IS NULL) AS missing_geo
FROM dbo."Trails";

-- nya leder ska vara opublicerade
SELECT "Id", "Name", "IsVerified" FROM dbo."Trails"
WHERE "Id" IN (SELECT "CreatedTrailId" FROM dbo."TrailImportProposals" WHERE "CreatedTrailId" IS NOT NULL);
```

## Fällor som redan kostat tid

- **Schemat heter `dbo`**, inte `public`. Undantaget är `__EFMigrationsHistory`, som ligger
  i `public`.
- **Första synken skriver inga källägda fält** på befintliga leder: utan lagrat snapshot får
  källan inte skriva. Session 21 uppdaterade därför noll leder trots 194 länkar. Det är
  **andra** synken som mergar — och det är då 242:s geometri faktiskt byts ut.
- **`GeoPath` härleds** ur ledens Segment-länkar vid varje verkställ. En handredigerad
  ledgeometri skrivs över av nästa synk.
- **`properties.id` i källan är inte stabil** mellan exporter. Synken nycklar på geometri.
  Ett id i det här dokumentet som pekar på en källfeature gäller den export det står i.
- **Anslutningen till testmiljön kapas slumpmässigt.** En kapad skrivning lämnar
  transaktionen öppen och låser tabellen tills TCP-keepalive löser ut. Svaret är omförsök,
  inte mindre batchar.
