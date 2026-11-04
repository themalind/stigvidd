// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useState } from "react";
import { acceptImages } from "@/features/media/utils/media-upload";
import { loadStagedFiles, saveStagedFiles } from "@/features/media/utils/staged-media";

export function useStagedFiles(single: boolean) {
  const [files, setFiles] = useState<File[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadStagedFiles().then((stored) => {
      if (cancelled) return;
      // keep-comment: anything picked while the read was in flight wins over the stored set
      setFiles((current) => (current.length > 0 ? current : stored));
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // keep-comment: not before the read has finished, or the empty first render deletes what it is about to restore
  useEffect(() => {
    if (restored) void saveStagedFiles(files);
  }, [files, restored]);

  const staged = useMemo(() => (single ? files.slice(0, 1) : files), [files, single]);

  return {
    files: staged,
    add: (incoming: FileList | File[]) => setFiles((current) => acceptImages(current, incoming, !single)),
    remove: (index: number) => setFiles((current) => current.filter((_, i) => i !== index)),
    clear: () => setFiles([]),
  };
}
