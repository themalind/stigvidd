import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { exportData, importData } from "@/api/admin";

export default function MigrationPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Operator must type this host's name to arm the destructive import.
  const confirmPhrase = window.location.hostname;
  const canImport = file !== null && confirmText === confirmPhrase && !importing;

  async function handleExport() {
    setExporting(true);
    try {
      await exportData();
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const message = await importData(file);
      toast.success(message, { duration: 10000 });
      setFile(null);
      setConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main>
      <div className="container mx-auto max-w-3xl space-y-6 py-10">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>
              Download a complete snapshot of this host — the database, all
              referenced media, and the Keycloak realm (users, clients) — as a
              single archive to move to another host.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              {exporting ? "Preparing archive…" : "Export all data"}
            </Button>
          </CardFooter>
        </Card>

        {/* Import */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Import (replace all data)
            </CardTitle>
            <CardDescription>
              Restores an archive exported from another host.{" "}
              <strong>
                This permanently overwrites ALL data on this host
              </strong>{" "}
              (database, media and Keycloak). Run it on a freshly deployed
              target. Afterwards, restart the <code>api</code> and{" "}
              <code>keycloak</code> services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="archive">Migration archive (.zip)</Label>
              <Input
                id="archive"
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={importing}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type <code className="font-mono">{confirmPhrase}</code> to
                confirm you want to overwrite this host
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                disabled={importing}
                autoComplete="off"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="destructive"
              onClick={handleImport}
              disabled={!canImport}
            >
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing ? "Importing…" : "Import and replace"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
