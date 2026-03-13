/**
 * Quick test — checks if the test wallet gets free access via NFT membership gate.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { privateKeyToAccount } from "viem/accounts";
import {
  encodeSIWxHeader,
  createSIWxPayload,
} from "@x402/extensions/sign-in-with-x";

const ENDPOINT = "http://localhost:3000/api/random";
const PRIVATE_KEY = process.env.X402_WALLET_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error("Missing X402_WALLET_PRIVATE_KEY in .env.local");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

function decode402(header: string) {
  return JSON.parse(Buffer.from(header, "base64").toString());
}

async function main() {
  console.log(`Wallet: ${account.address}`);

  // Step 1: Get 402 + SIWX challenge
  const res402 = await fetch(ENDPOINT);
  if (res402.status !== 402) {
    console.log(`Expected 402, got ${res402.status}`);
    return;
  }

  const header = res402.headers.get("payment-required");
  if (!header) {
    console.log("No payment-required header");
    return;
  }

  const decoded = decode402(header);
  const siwxExt = decoded?.extensions?.["sign-in-with-x"];
  if (!siwxExt?.info) {
    console.log("No SIWX extension in 402 response");
    return;
  }

  const membershipPass = decoded?.extensions?.["membership-pass"];
  if (membershipPass) {
    console.log(`Membership pass: ${membershipPass.nftName} (${membershipPass.standard}) on ${membershipPass.network}`);
    console.log(`Rule: ${membershipPass.rule}`);
    console.log(`Contract: ${membershipPass.nftContract}`);
  }

  // Step 2: Sign SIWX
  const chain = siwxExt.supportedChains[0];
  const completeInfo = { ...siwxExt.info, chainId: chain.chainId, type: chain.type };
  const payload = await createSIWxPayload(completeInfo, account);
  const siwxHeader = encodeSIWxHeader(payload);

  // Step 3: Send SIWX-only request
  const res = await fetch(ENDPOINT, {
    headers: { "SIGN-IN-WITH-X": siwxHeader },
  });

  console.log(`Status: ${res.status}`);

  if (res.ok) {
    const data = await res.json();
    console.log(`Free access granted! (Member) Result: ${JSON.stringify(data)}`);
  } else {
    console.log("No membership NFT found — payment required.");
  }
}

main().catch(console.error);
