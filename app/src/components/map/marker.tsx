import { MapMarkerProps, Marker as MarkerRNM } from "react-native-maps";

interface Props extends MapMarkerProps {
  children?: React.ReactNode;
  variant?: "trailLight" | "trailDark" | "shelter" | "campsite" | "favourite";
}

const icon = {
  trailLight: require("@/assets/map/marker/vandringsled.png"),
  trailDark: require("@/assets/map/marker/vandringsled-dark.png"),
  shelter: require("@/assets/map/marker/vindskydd.png"),
  campsite: require("@/assets/map/marker/taltplats.png"),
  favourite: require("@/assets/map/marker/smultronstalle.png"),
};

export default function Marker({ variant = "trailLight", children, ...props }: Props) {
  return (
    <MarkerRNM image={icon[variant]} {...props}>
      {children}
    </MarkerRNM>
  );
}
