import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { LoginCard } from "@/components/login/login-card";
import { Link } from "react-router";

export default function LoginPage() {
  return (
    <main className="flex flex-col h-full bg-background">
      <div className="flex justify-end">
        <DarkModeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center items-center">
        <LoginCard />
        <div className="flex justify-center align-middle w-full max-w-sm mt-4 p-1 pb-2 rounded-xs bg-red-200 dark:bg-red-800">
          <p className="pr-2">debug:</p>
          <Link to={"/dashboard"} className="text-foreground">
            dashboard
          </Link>
          <p className="px-2">-</p>
          <Link to={"/trails"} className="text-foreground">
            trails
          </Link>
          <p className="px-2">-</p>
          <Link to={"/users"} className="text-foreground">
            users
          </Link>
          <p className="px-2">-</p>
          <Link to={"/fail"} className="text-foreground">
            404
          </Link>
        </div>
      </div>
    </main>
  );
}
