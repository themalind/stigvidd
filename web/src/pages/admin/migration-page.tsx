// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { exportData, getTransferInfo, importData } from "@/api/admin";
import type { DataTransferInfoResponse } from "@/api/generated/model";

export default function MigrationPage() {
  const [exporting, setExporting] = useState(false);
  const [anonymize, setAnonymize] = useState(false);
  const [info, setInfo] = useState<DataTransferInfoResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTransferInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const sharedServices = info?.sharedServices === true;

  // Operator must type this host's name to arm the destructive import.
  const confirmPhrase = window.location.hostname;
  const canImport = file !== null && confirmText === confirmPhrase && !importing;

  async function handleExport() {
    setExporting(true);
    try {
      await exportData({ anonymize });
      toast.success(anonymize ? "Anonymized export downloaded." : "Export downloaded.");
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
      const { message, notes } = await importData(file);
      toast.success(message, { description: notes.join(" ") || undefined, duration: 15000 });
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
              Download a snapshot of this host — the database, all referenced media and trail-import files
              {sharedServices ? "" : ", and the Keycloak realm (users, clients)"} — as a single archive to move to
              another host.
              {sharedServices &&
                " This host uses another host's Keycloak, so the archive never contains Keycloak users."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <Checkbox
                id="anonymize"
                checked={anonymize}
                onCheckedChange={(checked) => setAnonymize(checked === true)}
                disabled={exporting}
              />
              <div className="space-y-1">
                <Label htmlFor="anonymize">Anonymize personal data (for staging/test)</Label>
                <p className="text-sm text-muted-foreground">
                  Replaces every user&apos;s name, email address and login identity with a placeholder, removes push
                  tokens, verification and reset codes and the mail log, clears moderation notes, and leaves out
                  Keycloak. Hikes, reviews and photos are kept as they are.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? "Preparing archive…" : anonymize ? "Export anonymized data" : "Export all data"}
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
              {sharedServices ? (
                <>
                  <strong>This permanently overwrites the database and media on this host.</strong> This host uses
                  production&apos;s Keycloak, mail server and observatory: Keycloak users in the archive are not
                  restored, and queued mail, push tokens and verification/reset codes are cleared so nobody is contacted
                  from here. Afterwards, restart the <code>api</code> service.
                </>
              ) : (
                <>
                  <strong>This permanently overwrites ALL data on this host</strong> (database, media and Keycloak). Run
                  it on a freshly deployed target. Afterwards, restart the <code>api</code> and <code>keycloak</code>{" "}
                  services.
                </>
              )}
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
                Type <code className="font-mono">{confirmPhrase}</code> to confirm you want to overwrite this host
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
            <Button variant="destructive" onClick={handleImport} disabled={!canImport}>
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing ? "Importing…" : "Import and replace"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
