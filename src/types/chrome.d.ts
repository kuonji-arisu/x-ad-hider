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
    namespace local {
      function get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void
      ): void;
      function set(items: Record<string, unknown>, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
    }
  }
}
