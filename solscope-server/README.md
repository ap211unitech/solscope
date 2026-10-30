# SolScope MCP server

This is a TypeScript MCP server using the official MCP TypeScript SDK and stdio transport.

## Get started

```sh
cp -n ../.env.example ../.env
pnpm install
pnpm dev
```

Set `SOLANA_RPC_URL` in the project root `.env` file to a Solana HTTP(S) RPC endpoint. The example uses Solana mainnet-beta's public RPC URL; a provider endpoint can be used instead.

The server exposes `get_wallet_snapshot`, `get_wallet_portfolio`, `explain_transaction`, `token_risk_check`, and `wallet_activity_digest` read-only tools. The wallet snapshot validates the supplied Solana address and returns its SOL balance and combined SPL Token/Token-2022 account count. The portfolio aggregates non-zero token holdings by mint and returns their amounts and on-chain Metaplex names/symbols when available, falling back to the mint address when metadata is missing. Wallet tools cache results in memory for 15 seconds. `explain_transaction` retrieves a confirmed transaction (up to version 1), reports status, fee, signers, involved programs, and observed SOL/token balance changes. `wallet_activity_digest` analyzes up to 50 recent confirmed transactions (20 by default), reports counts by heuristic category, failed transactions, SOL fees paid by the wallet as fee payer, top non-boilerplate programs, frequent counterparties inferred from balance changes, and a short recent-activity list. It fetches transactions in small batches to limit RPC concurrency. Transactions unavailable from the configured RPC are counted and excluded from analysis; fee totals include only transactions with available metadata, and the report counts fee data that could not be retrieved. Activity categories and counterparties are heuristic and may include pools, vaults, exchanges, or other transaction accounts; token changes are attributed to token-account owners when the RPC supplies them.

`token_risk_check` uses GoPlus's Solana Token Security API (Beta) for ranked holders and percentages, holder count, authority/security checks, metadata, DEX markets, liquidity-provider records, and creators. Risk flags include provider-reported controls such as mutable metadata, closable tokens, mutable balances, transfer fees/hooks, and Token-2022-specific behavior. It does not rescan token accounts. Solana RPC independently verifies mint validity, token program, supply, decimals, authorities, and parsed Token-2022 extensions. The report compares GoPlus and RPC supply and authority status; discrepancies are surfaced, and supply differences greater than 1%, incomplete holder rankings, or authority mismatches can make the overall risk level inconclusive. Holder concentration uses GoPlus's returned percentages and is not represented as a complete holder-set scan. GoPlus calls time out after 10 seconds, and results are cached for 15 seconds. Token account owners may not be unique beneficial owners. Parsed extensions are null if the RPC does not return them. This is not investment advice. Paid access and x402 are not implemented.

To build the server and launch it in the MCP Inspector:

```sh
pnpm inspect
```

## Commands

- `pnpm dev` — run the TypeScript server directly during development
- `pnpm typecheck` — type-check without emitting files
- `pnpm build` — compile the server to `dist/`
- `pnpm start` — run the compiled server
- `pnpm lint` — lint all TypeScript files in the repository
- `pnpm lint:fix` — automatically fix lint issues where possible
- `pnpm format` — format supported source, config, and documentation files across the repository
- `pnpm format:check` — check formatting across the repository without changing files

When connecting an MCP client over stdio, configure it to launch `node` with the absolute path to `server/dist/index.js` after building. Keep standard output reserved for MCP messages; write logs to standard error.
