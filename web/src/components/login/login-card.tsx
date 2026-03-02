import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  return (
    <Card className="w-full max-w-sm bg-background gap-0 p-0 overflow-hidden rounded-xs">
      <CardHeader className="py-6">
        <CardTitle>Logga in</CardTitle>
      </CardHeader>
      <CardContent>
        <form>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Epost</Label>
              <Input
                id="email"
                type="email"
                placeholder="min-epost@exempel.se"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Lösenord</Label>
              </div>
              <Input id="password" type="password" required />
            </div>
          </div>
        </form>
        <div>
          <a
            href="#"
            className="ml-auto inline-block text-sm underline-offset-4 hover:underline not-hover:text-gray-400 dark:not-hover:text-gray-500"
          >
            Jag har glömt mitt lösenord...
          </a>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 py-6">
        <Button type="submit" className="w-full">
          Logga in
        </Button>
        <Button variant="outline" className="w-full">
          Skapa konto
        </Button>
      </CardFooter>
    </Card>
  );
}
