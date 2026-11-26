// Keep the endpoint fixed. Construct the SDK client only for an explicit user action.
import { Horizon, Networks, NotFoundError } from '@stellar/stellar-sdk';
import { lookupTransactionByHash } from '../dist/horizon-settlement.js';

export function testnetTransport(createServer = () => new Horizon.Server('https://horizon-testnet.stellar.org')) {
  let server;
  const client = () => server ??= createServer();
  return {
    async parameters(address) {
      try {
        const [account, fee] = await Promise.all([client().loadAccount(address), client().fetchBaseFee()]);
        return { sequence: account.sequenceNumber(), fee: String(fee) };
      } catch {
        throw Error('Horizon testnet: no se pudo leer la cuenta fuente o la comisión.');
      }
    },
    submit(transaction) {
      if (transaction.networkPassphrase !== Networks.TESTNET) throw Error('Red incorrecta');
      return client().submitTransaction(transaction);
    },
    lookup(hash) { return lookupTransactionByHash(client(), hash); },
    isAbsent(error) { return error instanceof NotFoundError; }
  };
}
