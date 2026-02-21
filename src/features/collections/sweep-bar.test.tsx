import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SweepBar } from "@/features/collections/sweep-bar";
import type { CartItem } from "@/features/cart/store/cart-store";

vi.mock("@/components/ui/slider", () => ({
  Slider: (props: {
    value?: number[];
    max?: number;
    onValueChange?: (value: number[]) => void;
  }) => (
    <input
      aria-label="Sweep count"
      data-testid="sweep-slider"
      max={props.max}
      min={0}
      onChange={(event) => props.onValueChange?.([Number(event.currentTarget.value)])}
      type="range"
      value={props.value?.[0] ?? 0}
    />
  ),
}));

function candidate(orderId: string, tokenId: string, price: string, currency = "0xfee"): CartItem {
  return {
    orderId,
    collection: "0xabc",
    tokenId,
    price,
    currency,
    quantity: "1",
  };
}

describe("sweep bar", () => {
  it("renders_selected_count_total_and_currency", () => {
    render(
      <SweepBar
        candidates={[candidate("11", "1", "100"), candidate("12", "2", "200")]}
        count={2}
        maxCount={2}
        onCountChange={vi.fn()}
        onSweep={vi.fn()}
      />,
    );

    expect(screen.getByText("Sweep")).toBeVisible();
    expect(screen.getByText("300")).toBeVisible();
    expect(screen.getByText("0xfee")).toBeVisible();
    expect(screen.getByRole("button", { name: /add 2 to cart/i })).toBeEnabled();
  });

  it("updates_count_from_slider_and_runs_sweep_action", async () => {
    const user = userEvent.setup();
    const onCountChange = vi.fn();
    const onSweep = vi.fn();

    const { rerender } = render(
      <SweepBar
        candidates={[candidate("11", "1", "100"), candidate("12", "2", "200")]}
        count={0}
        maxCount={2}
        onCountChange={onCountChange}
        onSweep={onSweep}
      />,
    );

    fireEvent.change(screen.getByTestId("sweep-slider"), {
      target: { value: "2" },
    });
    expect(onCountChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: /add 0 to cart/i })).toBeDisabled();

    rerender(
      <SweepBar
        candidates={[candidate("11", "1", "100"), candidate("12", "2", "200")]}
        count={2}
        maxCount={2}
        onCountChange={onCountChange}
        onSweep={onSweep}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add 2 to cart/i }));
    expect(onSweep).toHaveBeenCalledTimes(1);
  });

  it("hides_when_no_sweep_candidates_exist", () => {
    const { container } = render(
      <SweepBar candidates={[]} count={0} maxCount={0} onCountChange={vi.fn()} onSweep={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
