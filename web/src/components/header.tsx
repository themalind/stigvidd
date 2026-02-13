import { DarkModeToggle } from "./dark-mode-toggle";

export default function Header() {
  return (
    <header>
      <div>
        <p>Logo</p>
        <p>Dashboard</p>
        <p>Users</p>
        <p>Trails</p>
      </div>
      <DarkModeToggle />
    </header>
  );
}
