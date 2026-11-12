// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PickOrAdd } from "./pick-or-add";

function Harness() {
  const [value, setValue] = useState("boras");

  return (
    <PickOrAdd
      label="Municipality"
      value={value}
      options={[
        { value: "boras", label: "Borås" },
        { value: "ulricehamn", label: "Ulricehamn" },
      ]}
      placeholder="Choose a municipality"
      addLabel="+ Add municipality"
      newLabel="New municipality"
      addPlaceholder="Name"
      disabled={false}
      onChange={setValue}
      onAdd={() => Promise.resolve("new")}
    />
  );
}

describe("PickOrAdd", () => {
  it("goes back to the earlier choice when adding is cancelled", async () => {
    render(<Harness />);
    const select = screen.getByLabelText("Municipality");

    await userEvent.selectOptions(select, "+ Add municipality");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(select).toHaveValue("boras");
    expect(screen.queryByLabelText("New municipality")).toBeNull();
  });
});
