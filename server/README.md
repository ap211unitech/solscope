# SolScope MCP server

This is a TypeScript MCP server using the official MCP TypeScript SDK and stdio transport.

## Get started

```sh
cp -n ../.env.example ../.env
pnpm install
pnpm dev
```

Set `SOLANA_RPC_URL` in the project root `.env` file to a Solana HTTP(S) RPC endpoint. The example uses Solana mainnet-beta's public RPC URL; a provider endpoint can be used instead.

The server exposes `get_wallet_snapshot`, `get_wallet_portfolio`, and `explain_transaction` read-only tools. The wallet snapshot validates the supplied Solana address and returns its SOL balance and combined SPL Token/Token-2022 account count. The portfolio aggregates non-zero token holdings by mint and returns their amounts and on-chain Metaplex names/symbols when available, falling back to the mint address when metadata is missing. Both wallet tools cache results in memory for 15 seconds. `explain_transaction` retrieves a confirmed transaction (up to version 0), reports status, fee, signers, involved programs, and observed SOL/token balance changes. Its category is heuristic and may misclassify complex transactions; token changes are attributed to the account owner when the RPC supplies it. Paid access and x402 are not implemented.

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
