import type {
  GoPlusHolder,
  GoPlusMarket,
  GoPlusTokenData,
  MintDetails,
  RiskFlag,
  SupplyComparison,
} from "@solscope/types";

const GOPLUS_API_URL = "https://api.gopluslabs.io/api/v1/solana/token_security";
const REQUEST_TIMEOUT_MS = 10_000;
const SUPPLY_MATCH_TOLERANCE_BPS = 100;
export const TOP_HOLDER_COUNT = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStatus(value: unknown): string | null {
  return isRecord(value) && (typeof value.status === "string" || typeof value.status === "number")
    ? String(value.status)
    : null;
}

function readAuthorities(
  value: unknown,
  key: string,
): GoPlusTokenData["checks"]["mintable"]["authorities"] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return [];
  }

  return value[key].flatMap((authority: unknown) =>
    isRecord(authority) && typeof authority.address === "string"
      ? [
          {
            address: authority.address,
            malicious_address:
              typeof authority.malicious_address === "number" ? authority.malicious_address : null,
          },
        ]
      : [],
  );
}

function readAuthorityCheck(
  value: unknown,
  authorityKey = "authority",
): GoPlusTokenData["checks"]["mintable"] {
  return {
    status: readStatus(value),
    authorities: readAuthorities(value, authorityKey),
  };
}

function readHolder(value: unknown): GoPlusHolder {
  if (
    !isRecord(value) ||
    typeof value.account !== "string" ||
    typeof value.balance !== "string" ||
    (value.percent !== undefined &&
      value.percent !== null &&
      typeof value.percent !== "string" &&
      typeof value.percent !== "number") ||
    (value.token_account !== undefined && typeof value.token_account !== "string")
  ) {
    throw new Error("GoPlus returned a malformed holder record.");
  }

  // GoPlus encodes holder percentages as fractions (for example, 0.1214 means 12.14%).
  const percent =
    typeof value.percent === "string" || typeof value.percent === "number"
      ? Number((Number(value.percent) * 100).toFixed(6))
      : null;
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
    throw new Error("GoPlus returned an invalid holder percentage.");
  }

  return {
    account: value.account,
    balance: value.balance,
    percent,
    tokenAccounts:
      typeof value.token_account === "string"
        ? value.token_account
            .split(",")
            .map((tokenAccount) => tokenAccount.trim())
            .filter(Boolean)
        : [],
    tag: typeof value.tag === "string" && value.tag.length > 0 ? value.tag : null,
    locked:
      value.is_locked === 0 || value.is_locked === "0" || value.is_locked === false
        ? false
        : value.is_locked === 1 || value.is_locked === "1" || value.is_locked === true
          ? true
          : null,
    lockedDetail: value.locked_detail ?? null,
  };
}

function readMarket(value: unknown): GoPlusMarket | null {
  if (!isRecord(value) || typeof value.dex_name !== "string" || typeof value.id !== "string") {
    return null;
  }

  const readString = (item: unknown) => (typeof item === "string" ? item : null);
  const readVolume = (period: unknown) => (isRecord(period) ? readString(period.volume) : null);

  return {
    dex: value.dex_name,
    address: value.id,
    type: readString(value.type),
    price: readString(value.price),
    tvl: readString(value.tvl),
    feeRate: readString(value.fee_rate),
    lpAmount: readString(value.lp_amount),
    burnPercent: readString(value.burn_percent),
    openTime: readString(value.open_time),
    volume24h: readVolume(value.day),
    volume7d: readVolume(value.week),
    volume30d: readVolume(value.month),
  };
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readGoPlusTokenData(value: unknown, mintAddress: string): GoPlusTokenData {
  if (!isRecord(value) || typeof value.total_supply !== "string") {
    throw new Error(`GoPlus returned no token security data for ${mintAddress}.`);
  }
  if (value.holders !== undefined && value.holders !== null && !Array.isArray(value.holders)) {
    throw new Error(`GoPlus returned an invalid holder list for ${mintAddress}.`);
  }
  const holders = Array.isArray(value.holders) ? value.holders.map(readHolder) : [];

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const checks = {
    mintable: readAuthorityCheck(value.mintable),
    freezable: readAuthorityCheck(value.freezable),
    metadataMutable: readAuthorityCheck(value.metadata_mutable, "metadata_upgrade_authority"),
    closable: readAuthorityCheck(value.closable),
    balanceMutable: readAuthorityCheck(value.balance_mutable_authority),
    defaultAccountState:
      typeof value.default_account_state === "string" ||
      typeof value.default_account_state === "number"
        ? value.default_account_state
        : null,
    nonTransferable: typeof value.non_transferable === "string" ? value.non_transferable : null,
    transferFee: value.transfer_fee ?? null,
    transferFeeUpgradable: readAuthorityCheck(value.transfer_fee_upgradable),
    transferHook: value.transfer_hook ?? null,
    transferHookUpgradable: readAuthorityCheck(value.transfer_hook_upgradable),
    defaultAccountStateUpgradable: readAuthorityCheck(value.default_account_state_upgradable),
    trustedToken:
      typeof value.trusted_token === "number" || typeof value.trusted_token === "string"
        ? value.trusted_token
        : null,
  };

  return {
    totalSupply: value.total_supply,
    holderCount:
      (typeof value.holder_count === "string" && /^\d+$/.test(value.holder_count)) ||
      typeof value.holder_count === "number"
        ? Number(value.holder_count)
        : null,
    holders,
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : null,
      symbol: typeof metadata.symbol === "string" ? metadata.symbol : null,
      description: typeof metadata.description === "string" ? metadata.description : null,
      uri: typeof metadata.uri === "string" ? metadata.uri : null,
    },
    checks,
    markets: Array.isArray(value.dex)
      ? value.dex.flatMap((market: unknown) => {
          const parsed = readMarket(market);
          return parsed ? [parsed] : [];
        })
      : [],
    lpHolders: readRecords(value.lp_holders),
    creators: readRecords(value.creators),
  };
}

export async function fetchGoPlusTokenData(mintAddress: string): Promise<GoPlusTokenData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = new URL(GOPLUS_API_URL);
    url.searchParams.set("contract_addresses", mintAddress);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`GoPlus API returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.code !== 1 || !isRecord(payload.result)) {
      const message =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : "Invalid GoPlus API response.";
      throw new Error(`GoPlus API error: ${message}`);
    }

    return readGoPlusTokenData(payload.result[mintAddress], mintAddress);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`GoPlus lookup timed out after ${REQUEST_TIMEOUT_MS / 1_000} seconds.`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function readMintDetails(data: unknown, mintAddress: string): MintDetails {
  if (!isRecord(data) || !isRecord(data.parsed) || data.parsed.type !== "mint") {
    throw new Error(`Account is not a parsed SPL token mint: ${mintAddress}`);
  }

  const info = data.parsed.info;
  if (
    !isRecord(info) ||
    typeof info.decimals !== "number" ||
    typeof info.isInitialized !== "boolean" ||
    (info.mintAuthority !== null && typeof info.mintAuthority !== "string") ||
    (info.freezeAuthority !== null && typeof info.freezeAuthority !== "string")
  ) {
    throw new Error(`Parsed token mint data is malformed: ${mintAddress}`);
  }
  if (!info.isInitialized) {
    throw new Error(`Token mint account is not initialized: ${mintAddress}`);
  }

  return {
    decimals: info.decimals,
    mintAuthority: info.mintAuthority,
    freezeAuthority: info.freezeAuthority,
    extensions: Array.isArray(info.extensions)
      ? info.extensions.flatMap((extension: unknown) =>
          isRecord(extension) && typeof extension.extension === "string"
            ? [extension.extension]
            : [],
        )
      : [],
    extensionsAvailable: Array.isArray(info.extensions),
  };
}

export function parseUiAmount(value: string, decimals: number): bigint {
  const [whole = "0", rawFractional = ""] = value.split(".");
  const fractional = rawFractional.replace(/0+$/, "");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fractional) || fractional.length > decimals) {
    throw new Error("GoPlus returned an invalid token amount.");
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fractional.padEnd(decimals, "0") || "0");
}

export function compareSupply(provider: bigint, onChain: bigint): SupplyComparison {
  if (onChain === 0n) {
    return { differencePercent: null, matchesWithinOnePercent: null };
  }

  const difference = provider > onChain ? provider - onChain : onChain - provider;
  const hundredthsPercent = (difference * 10_000n + onChain / 2n) / onChain;
  return {
    differencePercent: `${hundredthsPercent / 100n}.${(hundredthsPercent % 100n)
      .toString()
      .padStart(2, "0")}`,
    matchesWithinOnePercent: difference * 10_000n <= onChain * BigInt(SUPPLY_MATCH_TOLERANCE_BPS),
  };
}

export function sumPercent(
  holders: GoPlusHolder[],
  count: number,
  holderCount: number | null,
): number | null {
  const required = holderCount === null ? count : Math.min(count, holderCount);
  const selected = holders.slice(0, required);
  if (selected.length < required) {
    return null;
  }
  return selected.length > 0 && selected.every((holder) => holder.percent !== null)
    ? Number(selected.reduce((total, holder) => total + (holder.percent ?? 0), 0).toFixed(2))
    : null;
}

function hasProviderData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return isRecord(value)
    ? Object.keys(value).length > 0
    : typeof value === "string" && value.length > 0;
}

export function createRiskFlags(
  mintAuthority: string | null,
  freezeAuthority: string | null,
  holders: GoPlusHolder[],
  holderCount: number | null,
  supplyMatches: boolean | null,
  extensions: string[],
  goPlusData: GoPlusTokenData,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (mintAuthority) {
    flags.push({
      severity: "medium",
      code: "MINT_AUTHORITY_ACTIVE",
      message: `Mint authority is active: ${mintAuthority}.`,
    });
  }
  if (freezeAuthority) {
    flags.push({
      severity: "medium",
      code: "FREEZE_AUTHORITY_ACTIVE",
      message: `Freeze authority is active: ${freezeAuthority}.`,
    });
  }

  const checks = goPlusData.checks;
  if (checks.metadataMutable.status === "1") {
    flags.push({
      severity: "medium",
      code: "METADATA_MUTABLE",
      message: "GoPlus reports an active metadata upgrade authority.",
    });
  }
  if (checks.closable.status === "1") {
    flags.push({
      severity: "high",
      code: "TOKEN_CLOSABLE",
      message: "GoPlus reports that an authority can close the token.",
    });
  }
  if (checks.balanceMutable.status === "1") {
    flags.push({
      severity: "high",
      code: "BALANCE_MUTABLE",
      message: "GoPlus reports an authority that can modify token balances.",
    });
  }
  if (checks.defaultAccountState === "2" || checks.defaultAccountState === 2) {
    flags.push({
      severity: "medium",
      code: "DEFAULT_ACCOUNT_FROZEN",
      message: "GoPlus reports that new token accounts default to a frozen state.",
    });
  }
  if (checks.nonTransferable === "1") {
    flags.push({
      severity: "info",
      code: "NON_TRANSFERABLE",
      message: "GoPlus reports that this token is non-transferable.",
    });
  }
  if (hasProviderData(checks.transferFee)) {
    flags.push({
      severity: "medium",
      code: "TRANSFER_FEE",
      message: "GoPlus reports a transfer-fee configuration.",
    });
  }
  if (hasProviderData(checks.transferHook)) {
    flags.push({
      severity: "medium",
      code: "TRANSFER_HOOK",
      message: "GoPlus reports a custom transfer hook.",
    });
  }
  for (const [check, code, message] of [
    [
      checks.transferFeeUpgradable,
      "TRANSFER_FEE_UPGRADEABLE",
      "An authority can change transfer fees.",
    ],
    [
      checks.transferHookUpgradable,
      "TRANSFER_HOOK_UPGRADEABLE",
      "An authority can change the transfer hook.",
    ],
    [
      checks.defaultAccountStateUpgradable,
      "DEFAULT_ACCOUNT_STATE_UPGRADEABLE",
      "An authority can change the default token-account state.",
    ],
  ] as const) {
    if (check.status === "1") {
      flags.push({ severity: "medium", code, message });
    }
  }

  const top1 = sumPercent(holders, 1, holderCount);
  const top10 = sumPercent(holders, TOP_HOLDER_COUNT, holderCount);
  if (top1 !== null && top1 >= 50) {
    flags.push({
      severity: "high",
      code: "TOP1_OVER_50",
      message: `Largest GoPlus-reported holder has ${top1}% of supply.`,
    });
  } else if (top1 !== null && top1 >= 20) {
    flags.push({
      severity: "medium",
      code: "TOP1_OVER_20",
      message: `Largest GoPlus-reported holder has ${top1}% of supply.`,
    });
  }
  if (top10 !== null && top10 >= 80) {
    flags.push({
      severity: "medium",
      code: "TOP10_OVER_80",
      message: `Top 10 GoPlus-reported holders have ${top10}% of supply.`,
    });
  }
  if (supplyMatches === false) {
    flags.push({
      severity: "info",
      code: "SUPPLY_DATA_MISMATCH",
      message: "GoPlus and Solana RPC supplies differ by more than 1%.",
    });
  }
  if (!holders.length) {
    flags.push({
      severity: "info",
      code: "HOLDER_DATA_UNAVAILABLE",
      message: "GoPlus did not return ranked holder data.",
    });
  } else {
    const expectedRankedHolders =
      holderCount === null ? TOP_HOLDER_COUNT : Math.min(TOP_HOLDER_COUNT, holderCount);
    if (holders.length < expectedRankedHolders) {
      flags.push({
        severity: "info",
        code: "HOLDER_DATA_INCOMPLETE",
        message: `GoPlus returned ${holders.length} ranked holders; ${expectedRankedHolders} were expected for the available holder count.`,
      });
    }
  }
  for (const extension of extensions) {
    flags.push({
      severity: "info",
      code: `TOKEN_2022_EXTENSION_${extension.toUpperCase()}`,
      message: `The mint uses the Token-2022 ${extension} extension.`,
    });
  }

  return flags.length > 0
    ? flags
    : [{ severity: "info", code: "NO_FLAGS", message: "No heuristic red flags found." }];
}
