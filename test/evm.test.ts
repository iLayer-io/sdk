import * as viem from "viem";
import { iLayerContractHelper } from "../src/index";
import { Order, OrderRequest, Type } from "../src/types";
import { HUB_ABI } from "../src/abi/hub";
import { LZ_ROUTER_ABI } from "../src/abi/lzRouter";
import { NULL_STRING } from "../src/constants";

describe("iLayerContractHelper", () => {
  let helper: iLayerContractHelper;

  beforeEach(() => {
    helper = new iLayerContractHelper();
    jest.spyOn(viem, "encodeFunctionData").mockReturnValue("0xdeadbeef");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createOrder", () => {
    const nowSec = 1_000;
    let orderRequest: OrderRequest;
    const permits = ["0xpermit1"] as `0x${string}`[];
    const signature = "0xsig" as `0x${string}`;
    const bridgeSelector = 1;

    beforeEach(() => {
      // Fixed time: Date.now() -> nowSec * 1000 ms
      jest.spyOn(Date, "now").mockReturnValue(nowSec * 1000);
      // Build a valid order template
      const padded = helper.formatAddressToBytes32("0x1");
      orderRequest = {
        deadline: BigInt(nowSec + 120),
        nonce: BigInt(42),
        order: {
          user: padded,
          recipient: padded,
          filler: padded,
          inputs: [],
          outputs: [],
          sourceChainId: 1,
          destinationChainId: 1,
          sponsored: false,
          primaryFillerDeadline: BigInt(nowSec + 60),
          deadline: BigInt(nowSec + 120),
          callRecipient: padded,
          callData: "0x",
          callValue: BigInt(0),
        },
      };
    });

    it("throws if any address fields are invalid", () => {
      const badOrder = {
        ...orderRequest,
        order: { ...orderRequest.order, user: "0x123" as any },
      };
      expect(() =>
        helper.createOrder(badOrder, permits, signature, bridgeSelector),
      ).toThrow("user address is not a valid bytes32-padded string");
    });

    it("throws if tokenAddress in inputs is invalid", () => {
      const padded = helper.formatAddressToBytes32("0x1");
      const invalidToken = {
        tokenType: Type.NATIVE,
        tokenAddress: "0x123" as any,
        tokenId: 1n,
        amount: 1n,
      };
      orderRequest.order.inputs = [invalidToken];
      expect(() =>
        helper.createOrder(orderRequest, permits, signature, bridgeSelector),
      ).toThrow(
        /tokenAddress at inputs\[0\] is not a valid bytes32-padded string/,
      );
    });

    it("throws if primaryFillerDeadline is not in the future", () => {
      orderRequest.order.primaryFillerDeadline = BigInt(nowSec - 10);
      expect(() =>
        helper.createOrder(orderRequest, permits, signature, bridgeSelector),
      ).toThrow("primaryFillerDeadline must be in the future");
    });

    it("throws if deadline is not in the future", () => {
      orderRequest.order.deadline = BigInt(nowSec - 10);
      expect(() =>
        helper.createOrder(orderRequest, permits, signature, bridgeSelector),
      ).toThrow("deadline must be in the future");
    });

    it("throws if primaryFillerDeadline >= overall deadline", () => {
      orderRequest.order.primaryFillerDeadline = BigInt(nowSec + 200);
      orderRequest.order.deadline = BigInt(nowSec + 100);
      expect(() =>
        helper.createOrder(orderRequest, permits, signature, bridgeSelector),
      ).toThrow(
        "primaryFillerDeadline must be strictly less than the overall order deadline",
      );
    });

    it("returns encoded data on success (with extra)", () => {
      const extra = "0xextra" as `0x${string}`;
      const data = helper.createOrder(
        orderRequest,
        permits,
        signature,
        bridgeSelector,
        extra,
      );
      expect(data).toBe("0xdeadbeef");
      expect(viem.encodeFunctionData).toHaveBeenCalledWith({
        abi: HUB_ABI,
        functionName: "createOrder",
        args: [orderRequest, permits, signature, bridgeSelector, extra],
      });
    });

    it("uses NULL_STRING when extra is undefined", () => {
      const data = helper.createOrder(
        orderRequest,
        permits,
        signature,
        bridgeSelector,
      );
      expect(data).toBe("0xdeadbeef");
      expect(viem.encodeFunctionData).toHaveBeenCalledWith({
        abi: HUB_ABI,
        functionName: "createOrder",
        args: [orderRequest, permits, signature, bridgeSelector, NULL_STRING],
      });
    });
  });

  describe("withdrawOrder", () => {
    const order: Order = {
      user: "0x0" as any,
      recipient: "0x0" as any,
      filler: "0x0" as any,
      inputs: [],
      outputs: [],
      sourceChainId: 1,
      destinationChainId: 1,
      sponsored: false,
      primaryFillerDeadline: 0n,
      deadline: 0n,
      callRecipient: "0x0" as any,
      callData: "0x",
      callValue: 0n,
    };
    const orderNonce = BigInt(99);
    const nowSec = 2_000;

    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(nowSec * 1000);
    });

    it("throws if order deadline has not passed", () => {
      order.deadline = BigInt(nowSec + 10);
      expect(() => helper.withdrawOrder(order, orderNonce)).toThrow(
        "Order not withdrawable yet",
      );
    });

    it("returns encoded data when withdrawable", () => {
      order.deadline = BigInt(nowSec - 10);
      const data = helper.withdrawOrder(order, orderNonce);
      expect(data).toBe("0xdeadbeef");
      expect(viem.encodeFunctionData).toHaveBeenCalledWith({
        abi: HUB_ABI,
        functionName: "withdrawOrder",
        args: [order, orderNonce],
      });
    });
  });

  describe("computeOrderNativeValue", () => {
    const baseOrder: Order = {
      user: "0x0" as any,
      recipient: "0x0" as any,
      filler: "0x0" as any,
      inputs: [],
      outputs: [],
      sourceChainId: 1,
      destinationChainId: 2,
      sponsored: false,
      primaryFillerDeadline: 0n,
      deadline: 0n,
      callRecipient: "0x0" as any,
      callData: "0x",
      callValue: 0n,
    };

    it("throws if same chainId with bridgingFee provided", () => {
      const order = { ...baseOrder, sourceChainId: 1, destinationChainId: 1 };
      expect(() => helper.computeOrderNativeValue(order, 5n)).toThrow(
        "Invalid order, chain IDs are the same",
      );
    });

    it("throws if cross-chain without bridgingFee", () => {
      expect(() => helper.computeOrderNativeValue(baseOrder)).toThrow(
        "Must specify the bridging fee parameter for crosschain orders",
      );
    });

    it("calculates native sum without fee on same chain", () => {
      const order = { ...baseOrder, sourceChainId: 1, destinationChainId: 1 };
      order.inputs = [
        {
          tokenType: Type.NATIVE,
          tokenAddress: "0x0" as any,
          tokenId: 0n,
          amount: 10n,
        },
        {
          tokenType: Type.FUNGIBLE_TOKEN,
          tokenAddress: "0x0" as any,
          tokenId: 0n,
          amount: 5n,
        },
      ];
      const total = helper.computeOrderNativeValue(order);
      expect(total).toBe(10n);
    });

    it("calculates native sum plus bridgingFee on cross-chain", () => {
      const order = { ...baseOrder };
      order.inputs = [
        {
          tokenType: Type.NATIVE,
          tokenAddress: "0x0" as any,
          tokenId: 0n,
          amount: 7n,
        },
      ];
      const total = helper.computeOrderNativeValue(order, 3n);
      expect(total).toBe(10n);
    });
  });

  describe("address formatting utilities", () => {
    it("pads address to 32 bytes hex", () => {
      const short = "0x1234";
      const padded = helper.formatAddressToBytes32(short);
      expect(padded.startsWith("0x")).toBe(true);
      // 2 chars for '0x' + 64 hex chars
      expect(padded.length).toBe(66);
      expect(padded.endsWith(short.slice(2))).toBe(true);
    });

    it("extracts bytes32-padded address back to short form", () => {
      const suffix = "abcdef";
      const padded = "0x" + "00".repeat(29) + suffix;
      const extracted = helper.formatBytes32ToAddress(padded);
      expect(extracted).toBe(padded.slice(26));
    });
  });

  describe("estimateLzBridgingFee", () => {
    it("encodes call with router ABI and estimation data", () => {
      // Stub private estimation data
      const stub = { payload: "0xpay", options: "0xopt" };
      jest.spyOn(helper as any, "getLzEstimationData").mockReturnValue(stub);

      const result = helper.estimateLzBridgingFee(42);
      expect(result).toBe("0xdeadbeef");
      expect(viem.encodeFunctionData).toHaveBeenCalledWith({
        abi: LZ_ROUTER_ABI,
        functionName: "estimateLzBridgingFee",
        args: [42, stub.payload, stub.options],
      });
    });
  });
});
