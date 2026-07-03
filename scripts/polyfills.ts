/**
 * Runtime polyfills for Node 18.
 * `CustomEvent` only became a global in Node 19; pglite-socket relies on it.
 * Import this module *before* anything that uses CustomEvent.
 */
if (
  typeof (globalThis as { CustomEvent?: unknown }).CustomEvent !== "function"
) {
  class CustomEventPolyfill<T = unknown> extends Event {
    readonly detail: T | null;
    constructor(type: string, params: { detail?: T } & EventInit = {}) {
      super(type, params);
      this.detail = params.detail ?? null;
    }
  }
  (globalThis as { CustomEvent?: unknown }).CustomEvent = CustomEventPolyfill;
}

export {};
