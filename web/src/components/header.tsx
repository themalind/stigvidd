import { Link } from "react-router";
import { DarkModeToggle } from "./dark-mode-toggle";
import { Button } from "./ui/button";

export default function Header() {
  return (
    <header className="flex border-b items-center">
      <div className="flex p-2 items-center mr-auto">
        <Button variant="ghost">
          <Link to={"/dashboard"}>Dashboard</Link>
        </Button>
        <Button variant="ghost">
          <Link to={"/users"}>Users</Link>
        </Button>
        <Button variant="ghost">
          <Link to={"/trails"}>Trails</Link>
        </Button>
      </div>
      <div className="p-2">
        <DarkModeToggle />
      </div>
    </header>
  );
}
