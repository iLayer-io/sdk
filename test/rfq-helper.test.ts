import Pusher, { Channel } from "pusher-js";
import { iLayerRfqHelper } from "../src/index";
import { RfqRequest, RfqResponse } from "../src/types";

jest.mock("pusher-js");

describe("iLayerRfqHelper", () => {
  let mockChannel: jest.Mocked<Channel>;
  let mockDisconnect: jest.Mock;
  let helper: iLayerRfqHelper;
  const USER_ID = "0xtestuser";

  beforeEach(() => {
    // Create a fresh channel stub for each test
    mockChannel = {
      bind: jest.fn(),
      unbind: jest.fn(),
      trigger: jest.fn(),
    } as any;

    // Mock Pusher constructor to return an object that subscribes to our stub channel
    mockDisconnect = jest.fn();
    (Pusher as any).mockImplementation(() => ({
      subscribe: jest.fn().mockReturnValue(mockChannel),
      disconnect: mockDisconnect,
    }));

    helper = new iLayerRfqHelper("dummyKey", "localhost", 6001, USER_ID);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("should subscribe to 'rfq' channel and bind to user events", () => {
    // subscribe called with 'rfq'
    expect(
      (Pusher as any).mock.results[0].value.subscribe,
    ).toHaveBeenCalledWith("rfq");
    // bind called with user ID channel
    expect(mockChannel.bind).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
  });

  describe("sendOrder", () => {
    const dummyRequest: RfqRequest = {
      id: "test-id", // even though code ignores this, TS requires it
      user: USER_ID,
      recipient: "0xrecipient",
      inputs: [],
      sourceChainId: 1,
      destinationChainId: 2,
      sponsored: false,
      primaryFillerDeadline: BigInt(0),
      deadline: BigInt(0),
      callRecipient: "0xcall",
      callData: "0x",
      callValue: BigInt(0),
    };

    it("resolves when a matching response arrives", async () => {
      // Make timestamp and random predictable
      jest.spyOn(Date, "now").mockReturnValue(1000);
      jest.spyOn(Math, "random").mockReturnValue(0.123456789);

      // Capture the user-bound callback
      expect(mockChannel.bind).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Function),
      );
      const userCallback = mockChannel.bind.mock.calls.find(
        (call) => call[0] === USER_ID,
      )![1];

      // Call sendOrder
      const promise = helper.sendOrder(dummyRequest);
      // Should trigger client-rfq-submit
      expect(mockChannel.trigger).toHaveBeenCalledWith(
        "client-rfq-submit",
        dummyRequest,
      );

      // Construct expected orderId matching implementation
      const expectedId = `order_1000_${Math.random().toString(36).substr(2, 9)}`;
      // Simulate incoming server event
      const responsePayload = { id: expectedId } as unknown as RfqResponse;
      userCallback(responsePayload);

      await expect(promise).resolves.toBe(responsePayload);
    });

    it("rejects with timeout error after 30s", async () => {
      jest.useFakeTimers();
      const promise = helper.sendOrder(dummyRequest);
      jest.advanceTimersByTime(30000);
      await expect(promise).rejects.toThrow("RFQ timeout");
    });
  });

  describe("onOrderUpdate", () => {
    it("binds and unbinds the 'rfq-update' event", () => {
      const callback = jest.fn();
      const unsubscribe = helper.onOrderUpdate(callback);

      expect(mockChannel.bind).toHaveBeenCalledWith("rfq-update", callback);
      // Call the returned unbind function
      unsubscribe();
      expect(mockChannel.unbind).toHaveBeenCalledWith("rfq-update", callback);
    });
  });

  it("disconnect calls pusher.disconnect", () => {
    helper.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
