export type ObserverScope = "page" | "timeline";

type ObserverOptions = MutationObserverInit & {
  scope: ObserverScope;
  name: string;
};

export class ObserverManager {
  private observers = new Map<string, MutationObserver>();

  observe(
    target: Node,
    options: ObserverOptions,
    callback: MutationCallback
  ): void {
    const { scope, name, ...observerOptions } = options;
    const key = observerKey(scope, name);
    this.disconnect(key);

    const observer = new MutationObserver(callback);
    observer.observe(target, observerOptions);
    this.observers.set(key, observer);
  }

  disconnectScope(scope: ObserverScope): void {
    const prefix = `${scope}:`;
    for (const key of Array.from(this.observers.keys())) {
      if (key.startsWith(prefix)) {
        this.disconnect(key);
      }
    }
  }

  private disconnect(key: string): void {
    const observer = this.observers.get(key);
    if (!observer) {
      return;
    }

    observer.disconnect();
    this.observers.delete(key);
  }
}

function observerKey(scope: ObserverScope, name: string): string {
  return `${scope}:${name}`;
}
