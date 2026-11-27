import type { Horizon } from "@stellar/stellar-sdk";

export function lookupTransactionByHash(server: Pick<Horizon.Server, "transactions">, hash: string) {
  return server.transactions().transaction(hash).call();
}
