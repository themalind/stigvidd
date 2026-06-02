import BackButton from "@/components/back-button";
import { BORDER_RADIUS } from "@/constants/constants";
import { DIFFICULTIES } from "@/data/trail-content";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

interface Link {
  label: string;
  url: string;
}

const LINKS: Link[] = [
  {
    label: "Allemansrätten — Naturvårdsverket",
    url: "https://www.naturvardsverket.se/allemansratten",
  },
  {
    label: "Naturreservat — Naturvårdsverket",
    url: "https://www.naturvardsverket.se/amnesomraden/skyddad-natur/olika-former-av-naturskydd/naturreservat/",
  },
  {
    label: "Vett och etikett — Borås Stad",
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/vettochallemansratt.4.1601545718c38a990ab44564.html",
  },
  {
    label: "Tillgängligt friluftsliv — Borås Stad ",
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/tillgangligtfriluftslivochtillganglignatur.4.6ef5a1031900c68011c55207.html",
  },
  {
    label: "Friluftsliv & natur — Borås Stad",
    url: "https://www.boras.se/upplevaochgora/friluftslivochnatur/platserforfriluftslivochnatur.4.1601545718c38a990ab4455a.html",
  },
  {
    label: "Vandringsleder — Borås.com",
    url: "https://www.boras.com/lista/vandringsleder/",
  },
  {
    label: "SMHI — väderprognos",
    url: "https://www.smhi.se/",
  },
  {
    label: "Friluftsfrämjandet",
    url: "https://www.friluftsframjandet.se/",
  },
];

interface AccordionProps {
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ icon, title, summary, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <View
      style={[
        s.accordion,
        {
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Pressable onPress={toggle} style={[s.accordionHeader, { backgroundColor: theme.colors.surface }]}>
        <View style={s.accordionHeaderLeft}>
          <View style={[s.iconWrap, { backgroundColor: theme.colors.secondaryContainer }]}>{icon}</View>
          <View style={s.titleGroup}>
            <Text style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>{title}</Text>
            {!open && (
              <Text
                style={[s.summaryText, { color: theme.colors.onSecondaryContainer }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {summary}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.onSecondaryContainer} />
      </Pressable>

      {open && (
        <>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <View style={s.accordionContent}>{children}</View>
        </>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const theme = useTheme();
  const cardText = theme.colors.onSurface;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BackButton />
          <Text variant="headlineMedium" style={[s.pageTitle, { color: theme.colors.primary }]}>
            Naturguide
          </Text>
        </View>
        <View style={s.content}>
          <AccordionSection
            icon={<MaterialCommunityIcons name="walk" size={18} color={theme.colors.primary} />}
            title="Allemansrätten"
            summary="Rätten att röra sig fritt i naturen"
            defaultOpen
          >
            <Text style={[s.bodyText, { color: cardText }]}>
              Allemansrätten är en unik svensk lag som ger alla rätt att vistas i naturen, oavsett vem som äger marken.
              Med den rätten följer också ett ansvar: att inte störa och inte förstöra.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>Du får </Text>
              vandra, cykla och rida nästan överallt i naturen, och du får övernatta ett par nätter utomhus. Du får
              plocka bär, svamp och blommor som inte är fridlysta.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>Du får inte </Text>
              gå in i privata trädgårdar, köra motorfordon på barmark, skada träd eller buskar, eller övernatta på samma
              plats mer än ett par nätter. Vid torka kan länsstyrelsen eller kommunen utfärda eldningsförbud. Håll
              alltid koll på om sådant råder i området.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>Hund </Text>
              ska hållas kopplad 1 mars–20 augusti så att vilda djur inte störs under sin reproduktionstid.
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<MaterialCommunityIcons name="shield-check-outline" size={18} color={theme.colors.primary} />}
            title="Naturreservat"
            summary="Skyddade områden med egna föreskrifter"
          >
            <Text style={[s.bodyText, { color: cardText }]}>
              Ett naturreservat är ett område som skyddas av lag för att bevara värdefull natur eller ge människor
              möjlighet till friluftsliv. Beslut fattas av länsstyrelsen eller kommunen.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              Varje reservat har <Text style={[s.bold, { color: cardText }]}>egna föreskrifter</Text> som kan vara
              strängare än allemansrätten. Läs alltid skyltarna vid ingången. De gäller framför allt för eldning,
              tältning, hundar och motorfordon.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              Det är alltid förbjudet att{" "}
              <Text style={[s.bold, { color: cardText }]}>skada träd, buskar eller mark</Text>, och att ta med sig jord,
              sten eller andra naturmaterial från reservatet.
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<MaterialCommunityIcons name="wheelchair-accessibility" size={18} color={theme.colors.primary} />}
            title="Tillgänglighet"
            summary="Vad tillgänglighetsanpassad innebär i appen"
          >
            <Text style={[s.bodyText, { color: cardText }]}>
              I appen är leder märkta som <Text style={[s.bold, { color: cardText }]}>tillgänglighetsanpassade</Text> om
              de är framkomliga med rullstol, rollator eller barnvagn. Det innebär jämnt och fast underlag med begränsad
              lutning och tillräcklig bredd.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              På vissa platser finns även anpassade rastplatser, ramper, parkeringar för rörelsehindrade eller
              tillgänglig toalett. Vad som erbjuds på varje enskild led framgår av ledens informationssida.
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              Leder som <Text style={[s.bold, { color: cardText }]}>inte är tillgänglighetsanpassade</Text> utgår från
              naturens egna förutsättningar. Underlaget kan vara ojämnt med stenar, rötter och lera, och sträckan kan
              innehålla branta partier eller smala passager.
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<Ionicons name="trail-sign-outline" size={18} color={theme.colors.primary} />}
            title="Svårighetsgrader"
            summary="Lätt, medel, svår och oklassificerad"
          >
            <View style={s.cardStack}>
              {DIFFICULTIES.map((item) => (
                <View key={item.value} style={[s.difficultyCard, { borderColor: theme.colors.outlineVariant }]}>
                  <View style={s.difficultyCardHeader}>
                    {getDifficultyIcon(classificationParser(item.value))}
                    <Text style={[s.cardLabel, { color: cardText }]}>{item.label}</Text>
                  </View>
                  <Text style={[s.bodyText, { color: cardText }]}>{item.description}</Text>
                </View>
              ))}
            </View>
          </AccordionSection>

          <AccordionSection
            icon={<Ionicons name="book-outline" size={18} color={theme.colors.primary} />}
            title="Läs mer"
            summary="Externa källor och vidare läsning"
          >
            {LINKS.map(({ label, url }, index) => (
              <View key={url}>
                {index > 0 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                <Pressable style={s.linkRow} onPress={() => Linking.openURL(url)}>
                  <View
                    style={[
                      s.linkIconBox,
                      { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary },
                    ]}
                  >
                    <MaterialCommunityIcons name="link-variant" size={20} color={theme.colors.onTertiaryContainer} />
                  </View>
                  <Text style={[s.linkText, { color: theme.colors.onSurface }]}>{label}</Text>
                </Pressable>
              </View>
            ))}
          </AccordionSection>

          <Text variant="bodySmall" style={[s.footer, { color: theme.colors.outline }]}>
            Källa: Naturvårdsverket · Borås Stad · Länsstyrelsen Västra Götaland
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: Platform.select({ ios: 0, default: 12 }),
  },
  container: {
    paddingTop: 8,
    paddingBottom: 48,
    gap: 8,
  },
  content: {
    paddingHorizontal: 12,
    gap: 12,
  },
  pageTitle: {
    fontWeight: "bold",
  },
  accordion: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryText: {
    fontSize: 12,
    opacity: 0.65,
  },
  accordionContent: {
    padding: 14,
    gap: 12,
  },
  cardStack: {
    gap: 8,
  },
  difficultyCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 6,
  },
  difficultyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingVertical: 10,
  },
  linkIconBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 8,
  },
  linkText: {
    flex: 1,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    marginTop: 4,
  },
});
