# solscope-server

MCP server for Solana wallet and token intelligence. It speaks Streamable HTTP and charges for most tools in devnet USDC using [x402](https://docs.x402.org).

## Run

```sh
cp -n .env.example .env   # then fill in the values
pnpm install
pnpm dev
```

The server listens on `http://localhost:<port>/mcp`. It is stateless: each `POST /mcp` request gets a fresh server and transport. `GET` and `DELETE` return 405.

## Configuration

Set these in `.env` (see `.env.example` for the full list):

| Variable         | Purpose                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| `SOLANA_RPC_URL` | Solana HTTP(S) RPC endpoint. A provider endpoint is recommended over the public one. |
| Pay-to address   | Public Solana address that receives USDC payments. Never put a private key here.     |

## Tools

| Tool                     | Description                                                                                                            | Price  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| `get_wallet_snapshot`    | SOL balance and SPL Token / Token-2022 account count                                                                   | Free   |
| `get_wallet_portfolio`   | Non-zero token holdings by mint, with Metaplex names and symbols when available                                        | $0.005 |
| `explain_transaction`    | Status, fee, signers, programs, and SOL/token balance changes of a confirmed transaction                               | $0.01  |
| `token_risk_check`       | Heuristic risk report from GoPlus data, cross-checked against RPC mint, supply, authorities, and Token-2022 extensions | $0.02  |
| `wallet_activity_digest` | Summary of up to 50 recent transactions (20 by default): categories, fees, top programs, frequent counterparties       | $0.02  |

Categories, counterparties, and risk levels are heuristic. Nothing here is investment advice.

Behavior worth knowing:

- Wallet tools and `token_risk_check` cache results in memory for 15 seconds.
- GoPlus calls time out after 10 seconds. If GoPlus and RPC disagree (supply off by more than 1%, authority mismatch, or incomplete holder rankings), the risk level can be reported as inconclusive.
- `wallet_activity_digest` fetches transactions in small batches. Transactions the RPC can't return are counted and excluded.

## Payments

Prices live in one table, `TOOL_PRICES` in `src/x402.ts`. Paid tools are registered with `registerPaidTool`, which adds the paywall, appends the price to the tool description, and adapts the MCP SDK context for the x402 wrapper:

```ts
registerPaidTool(
  server,
  "token_risk_check",
  { description: "...", inputSchema: tokenRiskCheckSchema },
  checkTokenRisk,
);
```

To add a paid tool: add its price to `TOOL_PRICES`, then register it as above.

|             |                                                             |
| ----------- | ----------------------------------------------------------- |
| Network     | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet)          |
| Asset       | devnet USDC, `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Facilitator | `https://x402.org/facilitator` (sponsors the network fee)   |

Agents can't pay on their own. Use [`solscope-pay-proxy`](../solscope-pay-proxy) between the agent and this server.

## Test

Start the server, then open the MCP Inspector and connect with **Streamable HTTP** to `http://localhost:<port>/mcp`:

```sh
npx @modelcontextprotocol/inspector
```

Paid tools return a payment-required result here, since the Inspector can't pay. To test a real payment, run the Inspector through the proxy.

## Commands

- `pnpm dev`: run the server directly during development
- `pnpm typecheck`: type-check without emitting files
- `pnpm build`: compile to `dist/`
- `pnpm start`: run the compiled server
- `pnpm lint` / `pnpm lint:fix`: lint, and auto-fix where possible
- `pnpm format` / `pnpm format:check`: format, or check formatting

Write logs to standard error, never standard output.
