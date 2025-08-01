# iLayer SDK

A TypeScript library for interacting with the iLayer smart contracts and RFQ network.

## Installation

Simply install the package using npm, yarn or pnpm:

```bash
npm install @ilayer/sdk
```

## Usage

The RFQ is used to send order requests to the solver network and receive quotes from solver bots.
The contract helper exposes utilities that encode data to send on-chain transactions to the smart contracts on an EVM-compatible blockchain.

### RFQ

First import the `iLayerRFQ` from the SDK and create an instance of it. This class provides methods to interact with the iLayer RFQ network.

```typescript
import { iLayerRFQ } from "@ilayer/sdk";
const rfq = iLayerRfqHelper();
```

Then subscribe to the RFQ network to receive quotes.

```typescript
const rfqResponse = await rfq.sendOrder(rfqRequest);
```

Or you can subscribe to the RFQ network to receive quotes in real-time.

```typescript
const unsubscribe = rfq.onOrderUpdate((update) => {
  console.log("Order quote updated:", update);
});

// later, when you no longer need updates
unsubscribe();
```

### Contracts (EVM)

First import the `iLayerContractHelper` from the SDK and create an instance of it. This helper provides methods to interact with the iLayer smart contracts.

```typescript
import { iLayerContractHelper } from "@ilayer/sdk";

const contractHelper = iLayerContractHelper();
```

Now you can use the `contractHelper` to interact directly with the iLayer smart contracts. For example, you can get create a new order with:

```typescript
const data = contractHelper.createOrder(
  orderRequest,
  permits,
  signature,
  primaryFillerDeadline,
  deadline,
);
```

Or you can withdraw an order with:

```typescript
const data = contractHelper.withdrawOrder(order, orderNonce);
```

The helper also exposes methods to format EVM `address` into `bytes32` and vice versa, which is useful for interacting with the iLayer smart contracts:

```typescript
const address = "0x1234567890abcdef1234567890abcdef12345678";
const bytes32address = contractHelper.formatAddressToBytes32(address);
const formattedAddress = contractHelper.formatBytes32ToAddress(bytes32address);
```
