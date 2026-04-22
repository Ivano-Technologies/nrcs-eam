import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ModuleFiltersCard } from "./ModuleFiltersCard";

afterEach(() => {
  cleanup();
});

describe("ModuleFiltersCard", () => {
  it('renders title "Filters" by default', () => {
    render(<ModuleFiltersCard filterRow={<span>Q</span>} />);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("places filterRow in row 1", () => {
    render(
      <ModuleFiltersCard
        filterRow={
          <button type="button" data-testid="filter-a">
            A
          </button>
        }
      />,
    );
    const row = screen.getByTestId("module-filters-filter-row");
    expect(within(row).getByTestId("filter-a")).toBeInTheDocument();
  });

  it("does not render row 2 when both toolbar slots are absent", () => {
    render(<ModuleFiltersCard filterRow={<span>x</span>} />);
    expect(screen.queryByTestId("module-filters-toolbar-row")).not.toBeInTheDocument();
  });

  it("renders row 2 with only toolbarEnd (right-aligned group)", () => {
    const { container } = render(
      <ModuleFiltersCard
        filterRow={<span>q</span>}
        toolbarEnd={
          <button type="button" data-testid="end-only">
            End
          </button>
        }
      />,
    );
    const toolbar = screen.getByTestId("module-filters-toolbar-row");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.querySelectorAll(":scope > div")).toHaveLength(1);
    expect(toolbar).toHaveClass("md:justify-end");
    expect(within(toolbar).getByTestId("end-only")).toBeInTheDocument();
    expect(container.querySelector(".border-t")).toBeInTheDocument();
  });

  it("uses justify-between on md when both toolbar slots are set", () => {
    render(
      <ModuleFiltersCard
        filterRow={<span>q</span>}
        toolbarStart={<button type="button">L</button>}
        toolbarEnd={<button type="button">R</button>}
      />,
    );
    const toolbar = screen.getByTestId("module-filters-toolbar-row");
    expect(toolbar).toHaveClass("md:justify-between");
  });

  it("tab order: filterRow then toolbarStart then toolbarEnd", async () => {
    const user = userEvent.setup();
    render(
      <ModuleFiltersCard
        filterRow={
          <button type="button" data-testid="tab-a">
            A
          </button>
        }
        toolbarStart={
          <button type="button" data-testid="tab-b">
            B
          </button>
        }
        toolbarEnd={
          <button type="button" data-testid="tab-c">
            C
          </button>
        }
      />,
    );

    await user.tab();
    expect(screen.getByTestId("tab-a")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("tab-b")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("tab-c")).toHaveFocus();
  });
});
