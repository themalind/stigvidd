import { Marker as MarkerRNM, MapMarkerProps } from "react-native-maps";

interface Props extends MapMarkerProps {
  children?: React.ReactNode;
  variant?: "trail" | "shelter" | "campsite" | "favourite";
}

const icon = {
  trail: require("@/assets/map/marker/vandringsled-100-159.png"),
  shelter: require("@/assets/map/marker/vindskydd-100-159.png"),
  campsite: require("@/assets/map/marker/taltplats-101-159.png"),
  favourite: require("@/assets/map/marker/smultronstalle-101-159.png"),
};

export default function Marker({
  variant = "trail",
  children,
  ...props
}: Props) {
  return (
    <MarkerRNM image={icon[variant]} {...props}>
      {children}
    </MarkerRNM>
  );
}
