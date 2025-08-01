import {
  encodeAbiParameters,
  encodeFunctionData,
  pad,
  parseAbiParameters,
} from "viem";
import { Order, OrderRequest, Type } from "../types";
import { HUB_ABI } from "../abi/hub";
import { NULL_STRING } from "../constants";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { LZ_ROUTER_ABI } from "../abi/lzRouter";

export class iLayerContractHelper {
  createOrder(
    orderRequest: OrderRequest,
    permits: `0x${string}`[],
    signature: `0x${string}`,
    bridgeSelector: number,
    extra?: `0x${string}`,
  ) {
    const {
      user,
      recipient,
      filler,
      inputs,
      outputs,
      primaryFillerDeadline,
      deadline,
    } = orderRequest.order;

    [
      ["user", user],
      ["recipient", recipient],
      ["filler", filler] as const,
    ].forEach(([name, addr]) => {
      if (!this.checkAddress(addr)) {
        throw new Error(`${name} address is not a valid bytes32-padded string`);
      }
    });

    [...inputs, ...outputs].forEach((token, idx) => {
      if (!this.checkAddress(token.tokenAddress)) {
        throw new Error(
          `tokenAddress at ${inputs.includes(token) ? "inputs" : "outputs"}[${idx}] is not a valid bytes32-padded string`,
        );
      }
    });

    const now = Math.floor(Date.now() / 1000);
    if (primaryFillerDeadline <= now) {
      throw new Error("primaryFillerDeadline must be in the future");
    }
    if (deadline <= now) {
      throw new Error("deadline must be in the future");
    }
    if (primaryFillerDeadline >= deadline) {
      throw new Error(
        "primaryFillerDeadline must be strictly less than the overall order deadline",
      );
    }

    return encodeFunctionData({
      abi: HUB_ABI,
      functionName: "createOrder",
      args: [
        orderRequest,
        permits,
        signature,
        bridgeSelector,
        extra || NULL_STRING,
      ] as const,
    });
  }

  withdrawOrder(order: Order, orderNonce: bigint) {
    const now = Math.floor(Date.now() / 1000);
    if (order.deadline > now) {
      throw new Error("Order not withdrawable yet");
    }

    return encodeFunctionData({
      abi: HUB_ABI,
      functionName: "withdrawOrder",
      args: [order, orderNonce] as const,
    });
  }

  computeOrderNativeValue(order: Order, bridgingFee?: bigint): bigint {
    if (bridgingFee && order.sourceChainId == order.destinationChainId) {
      throw new Error("Invalid order, chain IDs are the same");
    }
    if (!bridgingFee && order.sourceChainId != order.destinationChainId) {
      throw new Error(
        "Must specify the bridging fee parameter for crosschain orders",
      );
    }

    let nativeValue = order.inputs
      .filter((input) => input.tokenType === Type.NATIVE)
      .reduce((total, input) => total + input.amount, 0n);

    if (bridgingFee) return nativeValue + bridgingFee;
    else return nativeValue;
  }

  formatAddressToBytes32(addr: string): `0x${string}` {
    return pad(addr as `0x${string}`, { size: 32 });
  }

  formatBytes32ToAddress(paddedAddr: string): `0x${string}` {
    return paddedAddr.slice(26) as `0x${string}`;
  }

  estimateLzBridgingFee(destinationId: number) {
    const lzData = this.getLzEstimationData();

    return encodeFunctionData({
      abi: LZ_ROUTER_ABI,
      functionName: "estimateLzBridgingFee",
      args: [destinationId, lzData.payload, lzData.options],
    });
  }

  private checkAddress(addr: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test(addr);
  }

  private getLzEstimationData(): {
    payload: `0x${string}`;
    options: `0x${string}`;
  } {
    const options = Options.newOptions()
      .addExecutorLzReceiveOption(2000000, 0)
      .toHex() as `0x${string}`;

    // Encode payload: abi.encode(bytes32(0)) then abi.encode(address(1), payload)
    const randomBytes32 =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const innerPayload = encodeAbiParameters(parseAbiParameters("bytes32"), [
      randomBytes32,
    ]);
    const payload = encodeAbiParameters(parseAbiParameters("address, bytes"), [
      "0x0000000000000000000000000000000000000001",
      innerPayload,
    ]);

    return { payload, options };
  }
}
