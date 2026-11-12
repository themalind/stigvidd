// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDrop } from "./file-drop";

function Harness() {
  const [file, setFile] = useState<File | null>(null);

  return <FileDrop label="Export" accept=".geojson" hint="GeoJSON" file={file} onChange={setFile} />;
}

const geojson = () => new File(["{}".repeat(1024)], "badplatser.geojson", { type: "application/geo+json" });

describe("FileDrop", () => {
  it("asks for a file until one is chosen, then shows its name and size", async () => {
    render(<Harness />);
    expect(screen.getByText("Drop a file here or click to choose")).toBeInTheDocument();

    await userEvent.upload(screen.getByLabelText("Export"), geojson());

    expect(screen.getByText("badplatser.geojson")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.queryByText("Drop a file here or click to choose")).not.toBeInTheDocument();
  });

  it("takes a dropped file", () => {
    render(<Harness />);

    fireEvent.drop(screen.getByRole("button", { name: /Drop a file here/ }), {
      dataTransfer: { files: [geojson()] },
    });

    expect(screen.getByText("badplatser.geojson")).toBeInTheDocument();
  });

  it("lets the chosen file be removed", async () => {
    render(<Harness />);
    await userEvent.upload(screen.getByLabelText("Export"), geojson());

    await userEvent.click(screen.getByRole("button", { name: "Remove badplatser.geojson" }));

    expect(screen.getByText("Drop a file here or click to choose")).toBeInTheDocument();
  });
});
