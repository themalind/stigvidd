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
import { useAuth } from "@/providers/auth/auth-context";
import {
  InvalidCredentialsError,
  NotAuthorizedError,
} from "@/services/keycloak-auth";
import { useState } from "react";
import { useNavigate } from "react-router";

export function LoginCard() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        setError("Invalid email or password.");
      } else if (err instanceof NotAuthorizedError) {
        setError("Du har inte behörighet till administrationsverktyget.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
      return;
    }

    navigate("/dashboard");
  }

  return (
    <Card className="w-full max-w-sm bg-background gap-0 p-0 overflow-hidden rounded-xs">
      <CardHeader className="py-6">
        <CardTitle>Logga in</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Epost</Label>
              <Input
                id="email"
                type="email"
                placeholder="min-epost@exempel.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 py-6">
        <Button
          type="submit"
          form="login-form"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Loggar in..." : "Logga in"}
        </Button>
      </CardFooter>
    </Card>
  );
}
