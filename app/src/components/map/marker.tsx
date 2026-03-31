import { MapMarkerProps, Marker as MarkerRNM } from "react-native-maps";

interface Props extends MapMarkerProps {
  children?: React.ReactNode;
  variant?: "trailLight" | "trailDark" | "shelter" | "campsite" | "favourite";
}

const icon = {
  trailLight: require("@/assets/map/marker/vandringsled-90-143.png"),
  trailDark: require("@/assets/map/marker/vandringsled-dark-90-143.png"),
  shelter: require("@/assets/map/marker/vindskydd-100-159.png"),
  campsite: require("@/assets/map/marker/taltplats-101-159.png"),
  favourite: require("@/assets/map/marker/smultronstalle-101-159.png"),
};

export default function Marker({ variant = "trailLight", children, ...props }: Props) {
  return (
    <MarkerRNM image={icon[variant]} {...props}>
      {children}
    </MarkerRNM>
  );
}
