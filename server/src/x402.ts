import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPaymentWrapper } from "@x402/mcp";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { APP_CONFIG } from "./config";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // CAIP-2 id for devnet
const PAY_TO = APP_CONFIG.solana.paytoAddress; // your Solana wallet that receives USDC

const facilitator = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator", // free public facilitator, supports devnet
});

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register(SOLANA_DEVNET, new ExactSvmScheme());
await resourceServer.initialize();

const tokenRiskAccepts = await resourceServer.buildPaymentRequirements({
  scheme: "exact",
  network: SOLANA_DEVNET,
  payTo: PAY_TO,
  price: "$0.01",
});

export const paidTokenRisk = createPaymentWrapper(resourceServer, {
  accepts: tokenRiskAccepts,
});
