import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTokenOwnership } from "@/features/token/use-token-ownership";

const { mockUseTokenOwnershipQuery, mockUseTokenHolderQuery } = vi.hoisted(() => ({
  mockUseTokenOwnershipQuery: vi.fn(),
  mockUseTokenHolderQuery: vi.fn(),
}));

vi.mock("@/lib/marketplace/hooks", () => ({
  useTokenOwnershipQuery: mockUseTokenOwnershipQuery,
  useTokenHolderQuery: mockUseTokenHolderQuery,
}));

function emptyQuery() {
  return { data: null, isFetching: false };
}

function holderQueryWith(accountAddress: string, balance = "1") {
  return {
    data: {
      page: { balances: [{ account_address: accountAddress, balance }] },
    },
    isFetching: false,
  };
}

function ownershipQueryWith(balance: string) {
  return {
    data: { page: { balances: [{ balance }] } },
    isFetching: false,
  };
}

const DEFAULT_PARAMS = {
  collection: "0x123",
  tokenId: "7",
  walletAddress: "0xwallet" as string | undefined,
  isConnected: true,
};

describe("useTokenOwnership", () => {
  beforeEach(() => {
    mockUseTokenOwnershipQuery.mockReset();
    mockUseTokenHolderQuery.mockReset();
    mockUseTokenOwnershipQuery.mockReturnValue(emptyQuery());
    mockUseTokenHolderQuery.mockReturnValue(emptyQuery());
  });

  it("holderAddress_is_null_when_no_balances", () => {
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.holderAddress).toBeNull();
  });

  it("holderAddress_returned_when_balance_greater_than_zero", () => {
    mockUseTokenHolderQuery.mockReturnValue(holderQueryWith("0xholder"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.holderAddress).toBe("0xholder");
  });

  it("holderAddress_null_when_all_balances_are_zero", () => {
    mockUseTokenHolderQuery.mockReturnValue(holderQueryWith("0xholder", "0"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.holderAddress).toBeNull();
  });

  it("isOwner_false_when_not_connected", () => {
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("1"));
    const { result } = renderHook(() =>
      useTokenOwnership({ ...DEFAULT_PARAMS, isConnected: false }),
    );
    expect(result.current.isOwner).toBe(false);
  });

  it("isOwner_false_when_wallet_address_undefined", () => {
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("1"));
    const { result } = renderHook(() =>
      useTokenOwnership({ ...DEFAULT_PARAMS, walletAddress: undefined }),
    );
    expect(result.current.isOwner).toBe(false);
  });

  it("isOwner_true_when_connected_and_has_positive_balance", () => {
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("1"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.isOwner).toBe(true);
  });

  it("isOwner_false_when_balance_is_zero", () => {
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("0"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.isOwner).toBe(false);
  });

  it("effectiveIsOwner_true_when_holderAddress_matches_wallet", () => {
    mockUseTokenHolderQuery.mockReturnValue(holderQueryWith("0xwallet"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.effectiveIsOwner).toBe(true);
  });

  it("effectiveIsOwner_false_when_holderAddress_does_not_match_wallet", () => {
    mockUseTokenHolderQuery.mockReturnValue(holderQueryWith("0xother"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.effectiveIsOwner).toBe(false);
  });

  it("effectiveIsOwner_uses_holderAddress_over_isOwner_when_both_available", () => {
    // holderAddress=0xother (not wallet), but isOwner=true from ownership query
    mockUseTokenHolderQuery.mockReturnValue(holderQueryWith("0xother"));
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("1"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    // Should use holderAddress check (false), not isOwner (true)
    expect(result.current.effectiveIsOwner).toBe(false);
  });

  it("effectiveIsOwner_falls_back_to_isOwner_when_no_holderAddress", () => {
    mockUseTokenOwnershipQuery.mockReturnValue(ownershipQueryWith("1"));
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.effectiveIsOwner).toBe(true);
  });

  it("calls_ownership_query_with_correct_params", () => {
    renderHook(() =>
      useTokenOwnership({ ...DEFAULT_PARAMS, walletAddress: "0xwallet99" }),
    );
    expect(mockUseTokenOwnershipQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "0x123",
        tokenId: "7",
        accountAddress: "0xwallet99",
      }),
    );
  });

  it("calls_holder_query_with_correct_params", () => {
    renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(mockUseTokenHolderQuery).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "0x123", tokenId: "7" }),
    );
  });

  it("exposes_ownershipQuery_and_holderQuery_for_loading_states", () => {
    const ownerQ = { ...emptyQuery(), isFetching: true };
    mockUseTokenOwnershipQuery.mockReturnValue(ownerQ);
    const { result } = renderHook(() => useTokenOwnership(DEFAULT_PARAMS));
    expect(result.current.ownershipQuery.isFetching).toBe(true);
  });
});
