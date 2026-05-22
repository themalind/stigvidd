import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useCityName } from "@/hooks/useCityName";
import { useWeather } from "@/hooks/useWeather";
import { MaterialIcons } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { MD3Theme, Text, useTheme } from "react-native-paper";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return "God morgon";
  if (h >= 10 && h < 18) return "Hej";
  if (h >= 18 && h < 22) return "God kväll";
  return "God natt";
}

function getWeatherIcon(code: number): keyof typeof Ionicons.glyphMap {
  if (code === 1) return "sunny";
  if (code <= 3) return "partly-sunny";
  if (code <= 6) return "cloudy";
  if (code === 7) return "cloud";
  if (code === 11 || code === 21) return "thunderstorm";
  if ((code >= 15 && code <= 17) || code >= 25) return "snow";
  return "rainy";
}

type WeatherStyle = { tint: string; accent: string };

function getWeatherStyle(code: number, theme: MD3Theme): WeatherStyle {
  if (code === 1) return { tint: theme.colors.primaryContainer, accent: theme.colors.primary };
  if (code <= 3) return { tint: theme.colors.secondaryContainer, accent: theme.colors.secondary };
  if (code === 11 || code === 21 || (code >= 15 && code <= 17) || code >= 25)
    return { tint: theme.colors.tertiaryContainer, accent: theme.colors.tertiary };
  return { tint: theme.colors.surfaceVariant, accent: theme.colors.onSurfaceVariant };
}

interface Props {
  lat?: number;
  lon?: number;
}

export default function HeroBanner({ lat, lon }: Props) {
  const theme = useTheme();
  const { data: weather } = useWeather(lat, lon);
  const { data: cityName } = useCityName({ latitude: lat ? lat : 0, longitude: lon ? lon : 0 });
  const { tint, accent } = weather
    ? getWeatherStyle(weather.symbolCode, theme)
    : { tint: theme.colors.surfaceVariant, accent: theme.colors.onSurfaceVariant };

  return (
    <View style={[s.card, { backgroundColor: tint }]}>
      <View style={s.left}>
        <Text style={[s.greeting, { color: theme.colors.onSurface }]}>{getGreeting()}!</Text>
        <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>Dags för en promenad?</Text>
      </View>
      <View style={s.rightColumn}>
        {weather && (
          <View style={s.right}>
            <Ionicons name={getWeatherIcon(weather.symbolCode)} size={30} color={accent} />
            <Text style={[s.temp, { color: theme.colors.onSurface }]}>{weather.temperature}°</Text>
          </View>
        )}
        <View style={s.location}>
          <MaterialIcons name="location-pin" size={15} color={accent} />
          <Text style={{ color: theme.colors.onSurface }}>{cityName}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: SURFACE_BORDER_RADIUS,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginTop: 12,
    marginHorizontal: 12,
  },
  rightColumn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  left: {
    flex: 1,
    gap: 6,
  },
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
  },
  temp: {
    fontSize: 20,
    fontWeight: "600",
  },
});
