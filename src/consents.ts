import { Keypair } from "@stellar/stellar-sdk/base";
import type { SyntheticConsent } from "./agreements.js";
import { canonicalJson } from "./canonical-json.js";

export interface SignedConsent extends SyntheticConsent {
  signature: string;
}

function consentMessage(consent: SyntheticConsent): Buffer {
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

export function verifiesConsent(publicKey: string, consent: SignedConsent): boolean {
  const signature = Buffer.from(consent.signature, "base64");
  return signature.length === 64 && signature.toString("base64") === consent.signature
    && Keypair.fromPublicKey(publicKey).verify(consentMessage(consent), signature);
}
