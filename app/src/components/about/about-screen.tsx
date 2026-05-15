import BackButton from "@/components/back-button";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const features = [
  "Utforska och filtrera vandringsleder (svårighetsgrad, tillgänglighet, längd, stad)",
  "Interaktiv karta med ledermarkeringar och GPS-koordinater",
  "GPS-spårning i bakgrunden under vandring med avståndsmätning",
  "Lederrecensioner med stjärnbetyg och foton",
  "Favoriter och önskelista med optimistisk UI-uppdatering",
  "Rapportera hinder/faror med ett röstningssystem",
  "Användarprofiler med vandringhistorik och statistik",
  "Dela inspelade vandringar med vänner",
];

const techStack = [
  { label: "App", value: "React Native · Expo SDK 54 · TypeScript" },
  { label: "Routing", value: "Expo Router (filbaserad)" },
  { label: "Karta & GPS", value: "React Native Maps · Expo Location" },
  { label: "State", value: "TanStack Query · Jotai" },
  { label: "UI", value: "React Native Paper (Material Design 3)" },
  { label: "Backend", value: "ASP.NET Core 10 · C# · EF Core · SQL Server" },
  { label: "Auth", value: "Firebase Authentication (JWT)" },
];

export default function AboutScreen() {
  const theme = useTheme();

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <Text variant="headlineMedium" style={[s.appName, { color: theme.colors.primary }]}>
          Stigvidd
        </Text>

        <Text variant="bodyMedium" style={[s.description, { color: theme.colors.onBackground }]}>
          Stigvidd är en fullstack-app för vandring och ledupptäckt, byggd som ett examensarbete. Utforska
          vandringsleder i Boråsområdet, spela in egna vandringar med GPS, betygsätt leder och rapportera hinder längs
          vägen.
        </Text>

        <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
            Funktioner
          </Text>
          {features.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={{ color: theme.colors.onSecondaryContainer }}>{"•"}</Text>
              <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
                {f}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
            Teknik
          </Text>
          {techStack.map(({ label, value }) => (
            <View key={label} style={s.techRow}>
              <Text variant="bodySmall" style={[s.techLabel, { color: theme.colors.onSecondaryContainer }]}>
                {label}
              </Text>
              <Text variant="bodySmall" style={[s.techValue, { color: theme.colors.onSecondaryContainer }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
            Datakälla
          </Text>
          <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
            Leddata för Boråsområdet hämtas från Borås Stads öppna dataportal i GeoJSON-format och importeras via eget
            ETL-verktyg.
          </Text>
        </View>

        <Text variant="bodySmall" style={[s.footer, { color: theme.colors.outline }]}>
          Examensarbete · SUVNET24
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  appName: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  description: {
    lineHeight: 22,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  featureText: {
    flex: 1,
    lineHeight: 20,
  },
  techRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  techLabel: {
    fontWeight: "600",
    width: 70,
  },
  techValue: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    textAlign: "center",
    marginTop: 8,
  },
});
