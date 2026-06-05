declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;

    function sendMessage(message: unknown, callback: (response: unknown) => void): void;
    function openOptionsPage(): void;

    namespace onMessage {
      function addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => true | void
      ): void;
    }
  }

  namespace storage {
    type StorageAreaName = "local" | "sync" | "managed" | "session";

    type StorageChange = {
      oldValue?: unknown;
      newValue?: unknown;
    };

    namespace local {
      function get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void
      ): void;
      function set(items: Record<string, unknown>, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
    }

    namespace onChanged {
      function addListener(
        callback: (changes: Record<string, StorageChange>, areaName: StorageAreaName) => void
      ): void;
    }
  }

  namespace tabs {
    type Tab = {
      id?: number;
    };

    function query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: Tab[]) => void
    ): void;

    function sendMessage(tabId: number, message: unknown, callback: (response: unknown) => void): void;
  }
}
