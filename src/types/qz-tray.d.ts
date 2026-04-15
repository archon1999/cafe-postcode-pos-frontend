declare module 'qz-tray' {
  type QzCertificatePromise = (resolve: (certificate: string) => void, reject: (reason?: unknown) => void) => void;

  type QzSignaturePromise = (resolve: (signature: string) => void, reject: (reason?: unknown) => void) => void;

  const qz: {
    websocket: {
      isActive(): boolean;
      connect(): Promise<void>;
    };
    security: {
      setCertificatePromise(
        promiseHandler: QzCertificatePromise | (() => Promise<string>) | Promise<string>,
        options?: { rejectOnFailure?: boolean },
      ): void;
      setSignatureAlgorithm(algorithm: 'SHA1' | 'SHA256' | 'SHA512' | string): void;
      setSignaturePromise(promiseFactory: (payload: string) => QzSignaturePromise | Promise<string>): void;
    };
    configs: {
      create(printer: string | { host: string; port?: number | string }, options?: Record<string, unknown>): unknown;
    };
    print(config: unknown, data: unknown[]): Promise<void>;
  };

  export default qz;
}
