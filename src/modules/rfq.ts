import Pusher, { Channel } from "pusher-js";
import { RfqRequest, RfqResponse } from "../types";

export class iLayerRfqHelper {
  private pusher: Pusher;
  private channel: Channel;
  private callbacks = new Map<string, (response: RfqResponse) => void>();

  constructor(key: string, host: string, port: number, user: string) {
    this.pusher = new Pusher(key, {
      wsHost: host,
      wsPort: port,
      forceTLS: false,
      disableStats: true,
      enabledTransports: ["ws", "wss"],
      cluster: "ilayer",
    });

    this.channel = this.pusher.subscribe("rfq");

    this.channel.bind(user, (data: RfqResponse) => {
      const callback = this.callbacks.get(data.id);
      if (callback) {
        callback(data);
        this.callbacks.delete(data.id);
      }
    });
  }

  async sendOrder(order: RfqRequest): Promise<RfqResponse> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.callbacks.delete(orderId);
        reject(new Error("RFQ timeout"));
      }, 30000);

      this.callbacks.set(orderId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.channel.trigger("client-rfq-submit", order);
    });
  }

  onOrderUpdate(callback: (response: RfqResponse) => void): () => void {
    this.channel.bind("rfq-update", callback);
    return () => this.channel.unbind("rfq-update", callback);
  }

  disconnect(): void {
    this.pusher.disconnect();
  }
}
