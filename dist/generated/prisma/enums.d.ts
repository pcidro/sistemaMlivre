export declare const UserRole: {
    readonly USER: 'USER';
    readonly ADMIN: 'ADMIN';
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const MarketplacePlatform: {
    readonly MERCADO_LIVRE: 'MERCADO_LIVRE';
    readonly MAGALU: 'MAGALU';
};
export type MarketplacePlatform = (typeof MarketplacePlatform)[keyof typeof MarketplacePlatform];
export declare const ImportStatus: {
    readonly PROCESSING: 'PROCESSING';
    readonly SUCCESS: 'SUCCESS';
    readonly PARTIAL_SUCCESS: 'PARTIAL_SUCCESS';
    readonly ERROR: 'ERROR';
};
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];
export declare const DocumentType: {
    readonly CPF: 'CPF';
    readonly CNPJ: 'CNPJ';
};
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
//# sourceMappingURL=enums.d.ts.map