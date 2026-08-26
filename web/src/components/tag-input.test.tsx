import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./tag-input";

// The value is the wire format: a JSON array as a string, which is what the field holds
// on the trail. Parsing is forgiving because the column has held both shapes.
function renderTags(value: string) {
  const onChange = vi.fn();

  render(<TagInput value={value} onChange={onChange} />);

  return { onChange };
}

const field = () => screen.getByPlaceholderText("Add tag and press Enter");
const remove = (tag: string) =>
  screen.getByText(tag).parentElement!.querySelector("button")!;

describe("reading the stored value", () => {
  it("shows the tags in a JSON array", () => {
    renderTags('["forest","lake"]');

    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.getByText("lake")).toBeInTheDocument();
  });

  it("reads a bare comma-separated value too", () => {
    renderTags("forest, lake");

    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.getByText("lake")).toBeInTheDocument();
  });

  it("trims the whitespace around each tag", () => {
    renderTags('[ "forest" ,  "lake" ]');

    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.getByText("lake")).toBeInTheDocument();
  });

  it("shows nothing for an empty value", () => {
    renderTags("");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("drops the empty entries a trailing comma leaves behind", () => {
    renderTags("forest,,lake,");

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("adding a tag", () => {
  it("writes the value back as a JSON array", async () => {
    const { onChange } = renderTags('["forest"]');

    await userEvent.type(field(), "lake{Enter}");

    expect(onChange).toHaveBeenCalledWith('["forest","lake"]');
  });

  it("starts an array from an empty value", async () => {
    const { onChange } = renderTags("");

    await userEvent.type(field(), "forest{Enter}");

    expect(onChange).toHaveBeenCalledWith('["forest"]');
  });

  it("normalises a comma-separated value into JSON on the first edit", async () => {
    const { onChange } = renderTags("forest, lake");

    await userEvent.type(field(), "ridge{Enter}");

    expect(onChange).toHaveBeenCalledWith('["forest","lake","ridge"]');
  });

  it("refuses a duplicate", async () => {
    const { onChange } = renderTags('["forest"]');

    await userEvent.type(field(), "forest{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses whitespace on its own", async () => {
    const { onChange } = renderTags('["forest"]');

    await userEvent.type(field(), "   {Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not submit the surrounding form", async () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <TagInput value="" onChange={vi.fn()} />
      </form>,
    );

    await userEvent.type(field(), "forest{Enter}");

    expect(submit).not.toHaveBeenCalled();
  });

  it("clears the field so the next tag can be typed straight away", async () => {
    renderTags("");

    await userEvent.type(field(), "forest{Enter}");

    expect(field()).toHaveValue("");
  });
});

describe("removing a tag", () => {
  it("writes back the remaining ones", async () => {
    const { onChange } = renderTags('["forest","lake"]');

    await userEvent.click(remove("forest"));

    expect(onChange).toHaveBeenCalledWith('["lake"]');
  });

  it("writes an empty array when the last one goes", async () => {
    const { onChange } = renderTags('["forest"]');

    await userEvent.click(remove("forest"));

    expect(onChange).toHaveBeenCalledWith("[]");
  });
});
