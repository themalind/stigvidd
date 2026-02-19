import { FontAwesome6, Ionicons, MaterialIcons } from "@expo/vector-icons";

export function getDifficultyIcon(classification: string) {
  switch (classification) {
    case "Svår":
      return <Ionicons name="triangle" size={12} color="#f50" />;
    case "Medel":
      return <FontAwesome6 name="diamond" size={10} color="#bbaa00" />;
    case "Lätt":
      return <MaterialIcons name="circle" size={10} color="green" />;
    default:
      return <MaterialIcons name="circle" size={10} color="grey" />;
  }
}
