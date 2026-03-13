import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { LoginCard } from "@/components/login/login-card";

export default function LoginPage() {
  return (
    <main className="flex flex-col h-full bg-background">
      <div className="flex justify-end">
        <DarkModeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center items-center">
        <div className="flex items-center pr-5 pb-10">
          <div className="aspect-square max-w-40">
            <img src="icon.png" />
          </div>
          <div>
            <h1 className="text-foreground text-4xl pt-4">Stigvidd</h1>
          </div>
        </div>
        <LoginCard />
      </div>
    </main>
  );
}
