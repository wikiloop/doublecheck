import { EventEmitter } from "node:events";
import type { JudgementEvent } from "@doublecheck/core";

class TypedEventBus extends EventEmitter {
  private eventCounter = 0;

  emitJudgement(data: JudgementEvent["data"]): void {
    this.eventCounter++;
    const event: JudgementEvent & { id: number } = {
      type: "judgement",
      data,
      id: this.eventCounter,
    };
    this.emit("sse", event);
  }

  getLastEventId(): number {
    return this.eventCounter;
  }
}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(1000);
