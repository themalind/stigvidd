import { useMatches } from "react-router";
import { DarkModeToggle } from "./dark-mode-toggle";
import { SidebarTrigger } from "./ui/sidebar";

type RouteHandle = {
  title?: string;
};

export default function Header() {
  const matches = useMatches() as Array<{ handle: RouteHandle }>;

  const currentTitle =
    [...matches].reverse().find((match) => match.handle?.title)?.handle
      ?.title ?? "Stigvidd";

  return (
    <header className="flex justify-between items-center p-2">
      <div className="flex pl-1 items-center">
        <SidebarTrigger />
      </div>
      <div>
        <h1 className="text-2xl">{currentTitle}</h1>
      </div>
      <div className="pr-1">
        <DarkModeToggle />
      </div>
    </header>
  );
}
