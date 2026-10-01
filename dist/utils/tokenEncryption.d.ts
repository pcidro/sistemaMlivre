export declare class TokenEncryptionConfigurationError extends Error {
    constructor(message: string);
}
export declare class TokenDecryptionError extends Error {
    constructor();
}
export declare function encryptToken(value: string): string;
export declare function decryptToken(encryptedValue: string): string;
//# sourceMappingURL=tokenEncryption.d.ts.map