import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models.js';
export type * from './prismaNamespace.js';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly User: 'User';
    readonly MarketplaceAccount: 'MarketplaceAccount';
    readonly Customer: 'Customer';
    readonly Order: 'Order';
    readonly Invoice: 'Invoice';
    readonly OrderItem: 'OrderItem';
    readonly Import: 'Import';
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: 'ReadUncommitted';
    readonly ReadCommitted: 'ReadCommitted';
    readonly RepeatableRead: 'RepeatableRead';
    readonly Serializable: 'Serializable';
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: 'id';
    readonly name: 'name';
    readonly username: 'username';
    readonly email: 'email';
    readonly passwordHash: 'passwordHash';
    readonly avatarUrl: 'avatarUrl';
    readonly role: 'role';
    readonly createdAt: 'createdAt';
    readonly updatedAt: 'updatedAt';
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const MarketplaceAccountScalarFieldEnum: {
    readonly id: 'id';
    readonly platform: 'platform';
    readonly name: 'name';
    readonly cnpj: 'cnpj';
    readonly externalAccountId: 'externalAccountId';
    readonly accessTokenEncrypted: 'accessTokenEncrypted';
    readonly refreshTokenEncrypted: 'refreshTokenEncrypted';
    readonly tokenExpiresAt: 'tokenExpiresAt';
    readonly isActive: 'isActive';
    readonly createdAt: 'createdAt';
    readonly updatedAt: 'updatedAt';
    readonly userId: 'userId';
};
export type MarketplaceAccountScalarFieldEnum = (typeof MarketplaceAccountScalarFieldEnum)[keyof typeof MarketplaceAccountScalarFieldEnum];
export declare const CustomerScalarFieldEnum: {
    readonly id: 'id';
    readonly name: 'name';
    readonly phone: 'phone';
    readonly normalizedPhone: 'normalizedPhone';
    readonly createdAt: 'createdAt';
    readonly updatedAt: 'updatedAt';
};
export type CustomerScalarFieldEnum = (typeof CustomerScalarFieldEnum)[keyof typeof CustomerScalarFieldEnum];
export declare const OrderScalarFieldEnum: {
    readonly id: 'id';
    readonly externalOrderId: 'externalOrderId';
    readonly platform: 'platform';
    readonly orderDate: 'orderDate';
    readonly status: 'status';
    readonly customerId: 'customerId';
    readonly marketplaceAccountId: 'marketplaceAccountId';
    readonly createdAt: 'createdAt';
    readonly updatedAt: 'updatedAt';
};
export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum];
export declare const InvoiceScalarFieldEnum: {
    readonly id: 'id';
    readonly invoiceKey: 'invoiceKey';
    readonly invoiceNumber: 'invoiceNumber';
    readonly customerName: 'customerName';
    readonly phone: 'phone';
    readonly processedAt: 'processedAt';
    readonly orderId: 'orderId';
};
export type InvoiceScalarFieldEnum = (typeof InvoiceScalarFieldEnum)[keyof typeof InvoiceScalarFieldEnum];
export declare const OrderItemScalarFieldEnum: {
    readonly id: 'id';
    readonly productName: 'productName';
    readonly externalProductId: 'externalProductId';
    readonly quantity: 'quantity';
    readonly unitPrice: 'unitPrice';
    readonly orderId: 'orderId';
};
export type OrderItemScalarFieldEnum = (typeof OrderItemScalarFieldEnum)[keyof typeof OrderItemScalarFieldEnum];
export declare const ImportScalarFieldEnum: {
    readonly id: 'id';
    readonly platform: 'platform';
    readonly status: 'status';
    readonly startedAt: 'startedAt';
    readonly finishedAt: 'finishedAt';
    readonly ordersFound: 'ordersFound';
    readonly ordersProcessed: 'ordersProcessed';
    readonly customersWithPhone: 'customersWithPhone';
    readonly customersWithoutPhone: 'customersWithoutPhone';
    readonly errorsCount: 'errorsCount';
    readonly marketplaceAccountId: 'marketplaceAccountId';
};
export type ImportScalarFieldEnum = (typeof ImportScalarFieldEnum)[keyof typeof ImportScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: 'asc';
    readonly desc: 'desc';
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const QueryMode: {
    readonly default: 'default';
    readonly insensitive: 'insensitive';
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: 'first';
    readonly last: 'last';
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
//# sourceMappingURL=prismaNamespaceBrowser.d.ts.map