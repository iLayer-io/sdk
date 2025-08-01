export enum Type {
  NULL = 0,
  NATIVE = 1,
  FUNGIBLE_TOKEN = 2,
  NON_FUNGIBLE_TOKEN = 3,
  SEMI_FUNGIBLE_TOKEN = 4,
}

export type Token = {
  tokenType: Type;
  tokenAddress: `0x${string}`; // hex‐encoded bytes32
  tokenId: bigint; // uint256
  amount: bigint; // uint256
};

export type Order = {
  user: `0x${string}`; // bytes32
  recipient: `0x${string}`; // bytes32
  filler: `0x${string}`; // bytes32
  inputs: Token[];
  outputs: Token[];
  sourceChainId: number; // uint32
  destinationChainId: number; // uint32
  sponsored: boolean;
  primaryFillerDeadline: bigint; // uint64
  deadline: bigint; // uint64
  callRecipient: `0x${string}`; // bytes32
  callData: `0x${string}`; // hex‐encoded bytes
  callValue: bigint; // uint256
};

export type OrderRequest = {
  deadline: bigint;
  nonce: bigint;
  order: Order;
};

export type RfqRequest = {
  id: string;
  user: `0x${string}`;
  recipient: `0x${string}`;
  inputs: Token[];
  sourceChainId: number;
  destinationChainId: number;
  sponsored: boolean;
  primaryFillerDeadline: bigint;
  deadline: bigint;
  callRecipient: `0x${string}`;
  callData: `0x${string}`;
  callValue: bigint;
};

export type RfqResponse = Order & {
  id: string;
};
