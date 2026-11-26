import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk/base";
import type { SyntheticConsent } from "./agreements.js";
import { canonicalJson } from "./canonical-json.js";

export interface SignedConsent extends SyntheticConsent {
  signature: string;
}

export function consentMessage(consent: SyntheticConsent): Buffer {
  const { roundId, version, agreementHash, participantId, decision } = consent;
  return Buffer.from(canonicalJson({
    domain: "codember-consent-v1",
    agreementId: roundId,
    version,
    agreementHash,
    participantId,
    decision,
  }), "utf8");
}

export function signConsent(consent: SyntheticConsent, signer: Keypair): SignedConsent {
  return { ...consent, signature: signer.sign(consentMessage(consent)).toString("base64") };
}

export function verifySep53(publicKey: string, message: Buffer, encoded: string): boolean {
  const signature = Buffer.from(encoded, "base64");
  const digest = createHash("sha256").update("Stellar Signed Message:\n").update(message).digest();
  return signature.length === 64 && signature.toString("base64") === encoded
    && Keypair.fromPublicKey(publicKey).verify(digest, signature);
}

export function verifiesConsent(publicKey: string, consent: SignedConsent, scheme?: "SEP-53"): boolean {
  if (scheme === "SEP-53") return verifySep53(publicKey, consentMessage(consent), consent.signature);
  if (scheme !== undefined) return false;
  const signature = Buffer.from(consent.signature, "base64");
  return signature.length === 64 && signature.toString("base64") === consent.signature
    && Keypair.fromPublicKey(publicKey).verify(consentMessage(consent), signature);
}
