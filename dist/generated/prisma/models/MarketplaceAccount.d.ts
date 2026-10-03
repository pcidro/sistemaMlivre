import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
/**
 * Model MarketplaceAccount
 *
 */
export type MarketplaceAccountModel = runtime.Types.Result.DefaultSelection<Prisma.$MarketplaceAccountPayload>;
export type AggregateMarketplaceAccount = {
    _count: MarketplaceAccountCountAggregateOutputType | null;
    _min: MarketplaceAccountMinAggregateOutputType | null;
    _max: MarketplaceAccountMaxAggregateOutputType | null;
};
export type MarketplaceAccountMinAggregateOutputType = {
    id: string | null;
    platform: $Enums.MarketplacePlatform | null;
    name: string | null;
    cnpj: string | null;
    externalAccountId: string | null;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
    isActive: boolean | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    userId: string | null;
};
export type MarketplaceAccountMaxAggregateOutputType = {
    id: string | null;
    platform: $Enums.MarketplacePlatform | null;
    name: string | null;
    cnpj: string | null;
    externalAccountId: string | null;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
    isActive: boolean | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    userId: string | null;
};
export type MarketplaceAccountCountAggregateOutputType = {
    id: number;
    platform: number;
    name: number;
    cnpj: number;
    externalAccountId: number;
    accessTokenEncrypted: number;
    refreshTokenEncrypted: number;
    tokenExpiresAt: number;
    isActive: number;
    createdAt: number;
    updatedAt: number;
    userId: number;
    _all: number;
};
export type MarketplaceAccountMinAggregateInputType = {
    id?: true;
    platform?: true;
    name?: true;
    cnpj?: true;
    externalAccountId?: true;
    accessTokenEncrypted?: true;
    refreshTokenEncrypted?: true;
    tokenExpiresAt?: true;
    isActive?: true;
    createdAt?: true;
    updatedAt?: true;
    userId?: true;
};
export type MarketplaceAccountMaxAggregateInputType = {
    id?: true;
    platform?: true;
    name?: true;
    cnpj?: true;
    externalAccountId?: true;
    accessTokenEncrypted?: true;
    refreshTokenEncrypted?: true;
    tokenExpiresAt?: true;
    isActive?: true;
    createdAt?: true;
    updatedAt?: true;
    userId?: true;
};
export type MarketplaceAccountCountAggregateInputType = {
    id?: true;
    platform?: true;
    name?: true;
    cnpj?: true;
    externalAccountId?: true;
    accessTokenEncrypted?: true;
    refreshTokenEncrypted?: true;
    tokenExpiresAt?: true;
    isActive?: true;
    createdAt?: true;
    updatedAt?: true;
    userId?: true;
    _all?: true;
};
export type MarketplaceAccountAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which MarketplaceAccount to aggregate.
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceAccounts to fetch.
     */
    orderBy?: Prisma.MarketplaceAccountOrderByWithRelationInput | Prisma.MarketplaceAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.MarketplaceAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MarketplaceAccounts
    **/
    _count?: true | MarketplaceAccountCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: MarketplaceAccountMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: MarketplaceAccountMaxAggregateInputType;
};
export type GetMarketplaceAccountAggregateType<T extends MarketplaceAccountAggregateArgs> = {
    [P in keyof T & keyof AggregateMarketplaceAccount]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateMarketplaceAccount[P]> : Prisma.GetScalarType<T[P], AggregateMarketplaceAccount[P]>;
};
export type MarketplaceAccountGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MarketplaceAccountWhereInput;
    orderBy?: Prisma.MarketplaceAccountOrderByWithAggregationInput | Prisma.MarketplaceAccountOrderByWithAggregationInput[];
    by: Prisma.MarketplaceAccountScalarFieldEnum[] | Prisma.MarketplaceAccountScalarFieldEnum;
    having?: Prisma.MarketplaceAccountScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MarketplaceAccountCountAggregateInputType | true;
    _min?: MarketplaceAccountMinAggregateInputType;
    _max?: MarketplaceAccountMaxAggregateInputType;
};
export type MarketplaceAccountGroupByOutputType = {
    id: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    _count: MarketplaceAccountCountAggregateOutputType | null;
    _min: MarketplaceAccountMinAggregateOutputType | null;
    _max: MarketplaceAccountMaxAggregateOutputType | null;
};
export type GetMarketplaceAccountGroupByPayload<T extends MarketplaceAccountGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<MarketplaceAccountGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof MarketplaceAccountGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], MarketplaceAccountGroupByOutputType[P]> : Prisma.GetScalarType<T[P], MarketplaceAccountGroupByOutputType[P]>;
}>>;
export type MarketplaceAccountWhereInput = {
    AND?: Prisma.MarketplaceAccountWhereInput | Prisma.MarketplaceAccountWhereInput[];
    OR?: Prisma.MarketplaceAccountWhereInput[];
    NOT?: Prisma.MarketplaceAccountWhereInput | Prisma.MarketplaceAccountWhereInput[];
    id?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceAccount"> | $Enums.MarketplacePlatform;
    name?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    cnpj?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    externalAccountId?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    accessTokenEncrypted?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    refreshTokenEncrypted?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    tokenExpiresAt?: Prisma.DateTimeNullableFilter<"MarketplaceAccount"> | Date | string | null;
    isActive?: Prisma.BoolFilter<"MarketplaceAccount"> | boolean;
    createdAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    userId?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    user?: Prisma.XOR<Prisma.UserNullableScalarRelationFilter, Prisma.UserWhereInput> | null;
    orders?: Prisma.OrderListRelationFilter;
    imports?: Prisma.ImportListRelationFilter;
};
export type MarketplaceAccountOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    cnpj?: Prisma.SortOrderInput | Prisma.SortOrder;
    externalAccountId?: Prisma.SortOrder;
    accessTokenEncrypted?: Prisma.SortOrder;
    refreshTokenEncrypted?: Prisma.SortOrderInput | Prisma.SortOrder;
    tokenExpiresAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    isActive?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    userId?: Prisma.SortOrderInput | Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
    orders?: Prisma.OrderOrderByRelationAggregateInput;
    imports?: Prisma.ImportOrderByRelationAggregateInput;
};
export type MarketplaceAccountWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    platform_externalAccountId?: Prisma.MarketplaceAccountPlatformExternalAccountIdCompoundUniqueInput;
    AND?: Prisma.MarketplaceAccountWhereInput | Prisma.MarketplaceAccountWhereInput[];
    OR?: Prisma.MarketplaceAccountWhereInput[];
    NOT?: Prisma.MarketplaceAccountWhereInput | Prisma.MarketplaceAccountWhereInput[];
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceAccount"> | $Enums.MarketplacePlatform;
    name?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    cnpj?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    externalAccountId?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    accessTokenEncrypted?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    refreshTokenEncrypted?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    tokenExpiresAt?: Prisma.DateTimeNullableFilter<"MarketplaceAccount"> | Date | string | null;
    isActive?: Prisma.BoolFilter<"MarketplaceAccount"> | boolean;
    createdAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    userId?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    user?: Prisma.XOR<Prisma.UserNullableScalarRelationFilter, Prisma.UserWhereInput> | null;
    orders?: Prisma.OrderListRelationFilter;
    imports?: Prisma.ImportListRelationFilter;
}, "id" | "platform_externalAccountId">;
export type MarketplaceAccountOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    cnpj?: Prisma.SortOrderInput | Prisma.SortOrder;
    externalAccountId?: Prisma.SortOrder;
    accessTokenEncrypted?: Prisma.SortOrder;
    refreshTokenEncrypted?: Prisma.SortOrderInput | Prisma.SortOrder;
    tokenExpiresAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    isActive?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    userId?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.MarketplaceAccountCountOrderByAggregateInput;
    _max?: Prisma.MarketplaceAccountMaxOrderByAggregateInput;
    _min?: Prisma.MarketplaceAccountMinOrderByAggregateInput;
};
export type MarketplaceAccountScalarWhereWithAggregatesInput = {
    AND?: Prisma.MarketplaceAccountScalarWhereWithAggregatesInput | Prisma.MarketplaceAccountScalarWhereWithAggregatesInput[];
    OR?: Prisma.MarketplaceAccountScalarWhereWithAggregatesInput[];
    NOT?: Prisma.MarketplaceAccountScalarWhereWithAggregatesInput | Prisma.MarketplaceAccountScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"MarketplaceAccount"> | string;
    platform?: Prisma.EnumMarketplacePlatformWithAggregatesFilter<"MarketplaceAccount"> | $Enums.MarketplacePlatform;
    name?: Prisma.StringWithAggregatesFilter<"MarketplaceAccount"> | string;
    cnpj?: Prisma.StringNullableWithAggregatesFilter<"MarketplaceAccount"> | string | null;
    externalAccountId?: Prisma.StringWithAggregatesFilter<"MarketplaceAccount"> | string;
    accessTokenEncrypted?: Prisma.StringWithAggregatesFilter<"MarketplaceAccount"> | string;
    refreshTokenEncrypted?: Prisma.StringNullableWithAggregatesFilter<"MarketplaceAccount"> | string | null;
    tokenExpiresAt?: Prisma.DateTimeNullableWithAggregatesFilter<"MarketplaceAccount"> | Date | string | null;
    isActive?: Prisma.BoolWithAggregatesFilter<"MarketplaceAccount"> | boolean;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"MarketplaceAccount"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"MarketplaceAccount"> | Date | string;
    userId?: Prisma.StringNullableWithAggregatesFilter<"MarketplaceAccount"> | string | null;
};
export type MarketplaceAccountCreateInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user?: Prisma.UserCreateNestedOneWithoutMarketplaceAccountsInput;
    orders?: Prisma.OrderCreateNestedManyWithoutMarketplaceAccountInput;
    imports?: Prisma.ImportCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountUncheckedCreateInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    userId?: string | null;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
    imports?: Prisma.ImportUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneWithoutMarketplaceAccountsNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutMarketplaceAccountNestedInput;
    imports?: Prisma.ImportUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
    imports?: Prisma.ImportUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountCreateManyInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    userId?: string | null;
};
export type MarketplaceAccountUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceAccountUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type MarketplaceAccountListRelationFilter = {
    every?: Prisma.MarketplaceAccountWhereInput;
    some?: Prisma.MarketplaceAccountWhereInput;
    none?: Prisma.MarketplaceAccountWhereInput;
};
export type MarketplaceAccountOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type MarketplaceAccountPlatformExternalAccountIdCompoundUniqueInput = {
    platform: $Enums.MarketplacePlatform;
    externalAccountId: string;
};
export type MarketplaceAccountCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    cnpj?: Prisma.SortOrder;
    externalAccountId?: Prisma.SortOrder;
    accessTokenEncrypted?: Prisma.SortOrder;
    refreshTokenEncrypted?: Prisma.SortOrder;
    tokenExpiresAt?: Prisma.SortOrder;
    isActive?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
};
export type MarketplaceAccountMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    cnpj?: Prisma.SortOrder;
    externalAccountId?: Prisma.SortOrder;
    accessTokenEncrypted?: Prisma.SortOrder;
    refreshTokenEncrypted?: Prisma.SortOrder;
    tokenExpiresAt?: Prisma.SortOrder;
    isActive?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
};
export type MarketplaceAccountMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    cnpj?: Prisma.SortOrder;
    externalAccountId?: Prisma.SortOrder;
    accessTokenEncrypted?: Prisma.SortOrder;
    refreshTokenEncrypted?: Prisma.SortOrder;
    tokenExpiresAt?: Prisma.SortOrder;
    isActive?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
};
export type MarketplaceAccountScalarRelationFilter = {
    is?: Prisma.MarketplaceAccountWhereInput;
    isNot?: Prisma.MarketplaceAccountWhereInput;
};
export type MarketplaceAccountCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput> | Prisma.MarketplaceAccountCreateWithoutUserInput[] | Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput | Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.MarketplaceAccountCreateManyUserInputEnvelope;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
};
export type MarketplaceAccountUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput> | Prisma.MarketplaceAccountCreateWithoutUserInput[] | Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput | Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.MarketplaceAccountCreateManyUserInputEnvelope;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
};
export type MarketplaceAccountUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput> | Prisma.MarketplaceAccountCreateWithoutUserInput[] | Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput | Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.MarketplaceAccountUpsertWithWhereUniqueWithoutUserInput | Prisma.MarketplaceAccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.MarketplaceAccountCreateManyUserInputEnvelope;
    set?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    disconnect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    delete?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    connect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    update?: Prisma.MarketplaceAccountUpdateWithWhereUniqueWithoutUserInput | Prisma.MarketplaceAccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.MarketplaceAccountUpdateManyWithWhereWithoutUserInput | Prisma.MarketplaceAccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.MarketplaceAccountScalarWhereInput | Prisma.MarketplaceAccountScalarWhereInput[];
};
export type MarketplaceAccountUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput> | Prisma.MarketplaceAccountCreateWithoutUserInput[] | Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput | Prisma.MarketplaceAccountCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.MarketplaceAccountUpsertWithWhereUniqueWithoutUserInput | Prisma.MarketplaceAccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.MarketplaceAccountCreateManyUserInputEnvelope;
    set?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    disconnect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    delete?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    connect?: Prisma.MarketplaceAccountWhereUniqueInput | Prisma.MarketplaceAccountWhereUniqueInput[];
    update?: Prisma.MarketplaceAccountUpdateWithWhereUniqueWithoutUserInput | Prisma.MarketplaceAccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.MarketplaceAccountUpdateManyWithWhereWithoutUserInput | Prisma.MarketplaceAccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.MarketplaceAccountScalarWhereInput | Prisma.MarketplaceAccountScalarWhereInput[];
};
export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
};
export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
};
export type MarketplaceAccountCreateNestedOneWithoutOrdersInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutOrdersInput;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput;
};
export type MarketplaceAccountUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutOrdersInput;
    upsert?: Prisma.MarketplaceAccountUpsertWithoutOrdersInput;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.MarketplaceAccountUpdateToOneWithWhereWithoutOrdersInput, Prisma.MarketplaceAccountUpdateWithoutOrdersInput>, Prisma.MarketplaceAccountUncheckedUpdateWithoutOrdersInput>;
};
export type MarketplaceAccountCreateNestedOneWithoutImportsInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedCreateWithoutImportsInput>;
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutImportsInput;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput;
};
export type MarketplaceAccountUpdateOneRequiredWithoutImportsNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedCreateWithoutImportsInput>;
    connectOrCreate?: Prisma.MarketplaceAccountCreateOrConnectWithoutImportsInput;
    upsert?: Prisma.MarketplaceAccountUpsertWithoutImportsInput;
    connect?: Prisma.MarketplaceAccountWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.MarketplaceAccountUpdateToOneWithWhereWithoutImportsInput, Prisma.MarketplaceAccountUpdateWithoutImportsInput>, Prisma.MarketplaceAccountUncheckedUpdateWithoutImportsInput>;
};
export type MarketplaceAccountCreateWithoutUserInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    orders?: Prisma.OrderCreateNestedManyWithoutMarketplaceAccountInput;
    imports?: Prisma.ImportCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountUncheckedCreateWithoutUserInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
    imports?: Prisma.ImportUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountCreateOrConnectWithoutUserInput = {
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput>;
};
export type MarketplaceAccountCreateManyUserInputEnvelope = {
    data: Prisma.MarketplaceAccountCreateManyUserInput | Prisma.MarketplaceAccountCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type MarketplaceAccountUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    update: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutUserInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutUserInput, Prisma.MarketplaceAccountUncheckedCreateWithoutUserInput>;
};
export type MarketplaceAccountUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutUserInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutUserInput>;
};
export type MarketplaceAccountUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.MarketplaceAccountScalarWhereInput;
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateManyMutationInput, Prisma.MarketplaceAccountUncheckedUpdateManyWithoutUserInput>;
};
export type MarketplaceAccountScalarWhereInput = {
    AND?: Prisma.MarketplaceAccountScalarWhereInput | Prisma.MarketplaceAccountScalarWhereInput[];
    OR?: Prisma.MarketplaceAccountScalarWhereInput[];
    NOT?: Prisma.MarketplaceAccountScalarWhereInput | Prisma.MarketplaceAccountScalarWhereInput[];
    id?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceAccount"> | $Enums.MarketplacePlatform;
    name?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    cnpj?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    externalAccountId?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    accessTokenEncrypted?: Prisma.StringFilter<"MarketplaceAccount"> | string;
    refreshTokenEncrypted?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
    tokenExpiresAt?: Prisma.DateTimeNullableFilter<"MarketplaceAccount"> | Date | string | null;
    isActive?: Prisma.BoolFilter<"MarketplaceAccount"> | boolean;
    createdAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"MarketplaceAccount"> | Date | string;
    userId?: Prisma.StringNullableFilter<"MarketplaceAccount"> | string | null;
};
export type MarketplaceAccountCreateWithoutOrdersInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user?: Prisma.UserCreateNestedOneWithoutMarketplaceAccountsInput;
    imports?: Prisma.ImportCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountUncheckedCreateWithoutOrdersInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    userId?: string | null;
    imports?: Prisma.ImportUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountCreateOrConnectWithoutOrdersInput = {
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedCreateWithoutOrdersInput>;
};
export type MarketplaceAccountUpsertWithoutOrdersInput = {
    update: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutOrdersInput>;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedCreateWithoutOrdersInput>;
    where?: Prisma.MarketplaceAccountWhereInput;
};
export type MarketplaceAccountUpdateToOneWithWhereWithoutOrdersInput = {
    where?: Prisma.MarketplaceAccountWhereInput;
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutOrdersInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutOrdersInput>;
};
export type MarketplaceAccountUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneWithoutMarketplaceAccountsNestedInput;
    imports?: Prisma.ImportUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountUncheckedUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    imports?: Prisma.ImportUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountCreateWithoutImportsInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user?: Prisma.UserCreateNestedOneWithoutMarketplaceAccountsInput;
    orders?: Prisma.OrderCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountUncheckedCreateWithoutImportsInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    userId?: string | null;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutMarketplaceAccountInput;
};
export type MarketplaceAccountCreateOrConnectWithoutImportsInput = {
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedCreateWithoutImportsInput>;
};
export type MarketplaceAccountUpsertWithoutImportsInput = {
    update: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutImportsInput>;
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedCreateWithoutImportsInput>;
    where?: Prisma.MarketplaceAccountWhereInput;
};
export type MarketplaceAccountUpdateToOneWithWhereWithoutImportsInput = {
    where?: Prisma.MarketplaceAccountWhereInput;
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateWithoutImportsInput, Prisma.MarketplaceAccountUncheckedUpdateWithoutImportsInput>;
};
export type MarketplaceAccountUpdateWithoutImportsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneWithoutMarketplaceAccountsNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountUncheckedUpdateWithoutImportsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountCreateManyUserInput = {
    id?: string;
    platform: $Enums.MarketplacePlatform;
    name: string;
    cnpj?: string | null;
    externalAccountId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type MarketplaceAccountUpdateWithoutUserInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUpdateManyWithoutMarketplaceAccountNestedInput;
    imports?: Prisma.ImportUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountUncheckedUpdateWithoutUserInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
    imports?: Prisma.ImportUncheckedUpdateManyWithoutMarketplaceAccountNestedInput;
};
export type MarketplaceAccountUncheckedUpdateManyWithoutUserInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    cnpj?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    externalAccountId?: Prisma.StringFieldUpdateOperationsInput | string;
    accessTokenEncrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    refreshTokenEncrypted?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tokenExpiresAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    isActive?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
/**
 * Count Type MarketplaceAccountCountOutputType
 */
export type MarketplaceAccountCountOutputType = {
    orders: number;
    imports: number;
};
export type MarketplaceAccountCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    orders?: boolean | MarketplaceAccountCountOutputTypeCountOrdersArgs;
    imports?: boolean | MarketplaceAccountCountOutputTypeCountImportsArgs;
};
/**
 * MarketplaceAccountCountOutputType without action
 */
export type MarketplaceAccountCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccountCountOutputType
     */
    select?: Prisma.MarketplaceAccountCountOutputTypeSelect<ExtArgs> | null;
};
/**
 * MarketplaceAccountCountOutputType without action
 */
export type MarketplaceAccountCountOutputTypeCountOrdersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.OrderWhereInput;
};
/**
 * MarketplaceAccountCountOutputType without action
 */
export type MarketplaceAccountCountOutputTypeCountImportsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ImportWhereInput;
};
export type MarketplaceAccountSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    platform?: boolean;
    name?: boolean;
    cnpj?: boolean;
    externalAccountId?: boolean;
    accessTokenEncrypted?: boolean;
    refreshTokenEncrypted?: boolean;
    tokenExpiresAt?: boolean;
    isActive?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    userId?: boolean;
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
    orders?: boolean | Prisma.MarketplaceAccount$ordersArgs<ExtArgs>;
    imports?: boolean | Prisma.MarketplaceAccount$importsArgs<ExtArgs>;
    _count?: boolean | Prisma.MarketplaceAccountCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceAccount"]>;
export type MarketplaceAccountSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    platform?: boolean;
    name?: boolean;
    cnpj?: boolean;
    externalAccountId?: boolean;
    accessTokenEncrypted?: boolean;
    refreshTokenEncrypted?: boolean;
    tokenExpiresAt?: boolean;
    isActive?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    userId?: boolean;
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceAccount"]>;
export type MarketplaceAccountSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    platform?: boolean;
    name?: boolean;
    cnpj?: boolean;
    externalAccountId?: boolean;
    accessTokenEncrypted?: boolean;
    refreshTokenEncrypted?: boolean;
    tokenExpiresAt?: boolean;
    isActive?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    userId?: boolean;
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceAccount"]>;
export type MarketplaceAccountSelectScalar = {
    id?: boolean;
    platform?: boolean;
    name?: boolean;
    cnpj?: boolean;
    externalAccountId?: boolean;
    accessTokenEncrypted?: boolean;
    refreshTokenEncrypted?: boolean;
    tokenExpiresAt?: boolean;
    isActive?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    userId?: boolean;
};
export type MarketplaceAccountOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "platform" | "name" | "cnpj" | "externalAccountId" | "accessTokenEncrypted" | "refreshTokenEncrypted" | "tokenExpiresAt" | "isActive" | "createdAt" | "updatedAt" | "userId", ExtArgs["result"]["marketplaceAccount"]>;
export type MarketplaceAccountInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
    orders?: boolean | Prisma.MarketplaceAccount$ordersArgs<ExtArgs>;
    imports?: boolean | Prisma.MarketplaceAccount$importsArgs<ExtArgs>;
    _count?: boolean | Prisma.MarketplaceAccountCountOutputTypeDefaultArgs<ExtArgs>;
};
export type MarketplaceAccountIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
};
export type MarketplaceAccountIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.MarketplaceAccount$userArgs<ExtArgs>;
};
export type $MarketplaceAccountPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "MarketplaceAccount";
    objects: {
        user: Prisma.$UserPayload<ExtArgs> | null;
        orders: Prisma.$OrderPayload<ExtArgs>[];
        imports: Prisma.$ImportPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        platform: $Enums.MarketplacePlatform;
        name: string;
        cnpj: string | null;
        externalAccountId: string;
        accessTokenEncrypted: string;
        refreshTokenEncrypted: string | null;
        tokenExpiresAt: Date | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
    }, ExtArgs["result"]["marketplaceAccount"]>;
    composites: {};
};
export type MarketplaceAccountGetPayload<S extends boolean | null | undefined | MarketplaceAccountDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload, S>;
export type MarketplaceAccountCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<MarketplaceAccountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: MarketplaceAccountCountAggregateInputType | true;
};
export interface MarketplaceAccountDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['MarketplaceAccount'];
        meta: {
            name: 'MarketplaceAccount';
        };
    };
    /**
     * Find zero or one MarketplaceAccount that matches the filter.
     * @param {MarketplaceAccountFindUniqueArgs} args - Arguments to find a MarketplaceAccount
     * @example
     * // Get one MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MarketplaceAccountFindUniqueArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountFindUniqueArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one MarketplaceAccount that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MarketplaceAccountFindUniqueOrThrowArgs} args - Arguments to find a MarketplaceAccount
     * @example
     * // Get one MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MarketplaceAccountFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first MarketplaceAccount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountFindFirstArgs} args - Arguments to find a MarketplaceAccount
     * @example
     * // Get one MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MarketplaceAccountFindFirstArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountFindFirstArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first MarketplaceAccount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountFindFirstOrThrowArgs} args - Arguments to find a MarketplaceAccount
     * @example
     * // Get one MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MarketplaceAccountFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more MarketplaceAccounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MarketplaceAccounts
     * const marketplaceAccounts = await prisma.marketplaceAccount.findMany()
     *
     * // Get first 10 MarketplaceAccounts
     * const marketplaceAccounts = await prisma.marketplaceAccount.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const marketplaceAccountWithIdOnly = await prisma.marketplaceAccount.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MarketplaceAccountFindManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a MarketplaceAccount.
     * @param {MarketplaceAccountCreateArgs} args - Arguments to create a MarketplaceAccount.
     * @example
     * // Create one MarketplaceAccount
     * const MarketplaceAccount = await prisma.marketplaceAccount.create({
     *   data: {
     *     // ... data to create a MarketplaceAccount
     *   }
     * })
     *
     */
    create<T extends MarketplaceAccountCreateArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountCreateArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many MarketplaceAccounts.
     * @param {MarketplaceAccountCreateManyArgs} args - Arguments to create many MarketplaceAccounts.
     * @example
     * // Create many MarketplaceAccounts
     * const marketplaceAccount = await prisma.marketplaceAccount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MarketplaceAccountCreateManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many MarketplaceAccounts and returns the data saved in the database.
     * @param {MarketplaceAccountCreateManyAndReturnArgs} args - Arguments to create many MarketplaceAccounts.
     * @example
     * // Create many MarketplaceAccounts
     * const marketplaceAccount = await prisma.marketplaceAccount.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MarketplaceAccounts and only return the `id`
     * const marketplaceAccountWithIdOnly = await prisma.marketplaceAccount.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MarketplaceAccountCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a MarketplaceAccount.
     * @param {MarketplaceAccountDeleteArgs} args - Arguments to delete one MarketplaceAccount.
     * @example
     * // Delete one MarketplaceAccount
     * const MarketplaceAccount = await prisma.marketplaceAccount.delete({
     *   where: {
     *     // ... filter to delete one MarketplaceAccount
     *   }
     * })
     *
     */
    delete<T extends MarketplaceAccountDeleteArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountDeleteArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one MarketplaceAccount.
     * @param {MarketplaceAccountUpdateArgs} args - Arguments to update one MarketplaceAccount.
     * @example
     * // Update one MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MarketplaceAccountUpdateArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountUpdateArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more MarketplaceAccounts.
     * @param {MarketplaceAccountDeleteManyArgs} args - Arguments to filter MarketplaceAccounts to delete.
     * @example
     * // Delete a few MarketplaceAccounts
     * const { count } = await prisma.marketplaceAccount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MarketplaceAccountDeleteManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceAccountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more MarketplaceAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MarketplaceAccounts
     * const marketplaceAccount = await prisma.marketplaceAccount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MarketplaceAccountUpdateManyArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more MarketplaceAccounts and returns the data updated in the database.
     * @param {MarketplaceAccountUpdateManyAndReturnArgs} args - Arguments to update many MarketplaceAccounts.
     * @example
     * // Update many MarketplaceAccounts
     * const marketplaceAccount = await prisma.marketplaceAccount.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more MarketplaceAccounts and only return the `id`
     * const marketplaceAccountWithIdOnly = await prisma.marketplaceAccount.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends MarketplaceAccountUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one MarketplaceAccount.
     * @param {MarketplaceAccountUpsertArgs} args - Arguments to update or create a MarketplaceAccount.
     * @example
     * // Update or create a MarketplaceAccount
     * const marketplaceAccount = await prisma.marketplaceAccount.upsert({
     *   create: {
     *     // ... data to create a MarketplaceAccount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MarketplaceAccount we want to update
     *   }
     * })
     */
    upsert<T extends MarketplaceAccountUpsertArgs>(args: Prisma.SelectSubset<T, MarketplaceAccountUpsertArgs<ExtArgs>>): Prisma.Prisma__MarketplaceAccountClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceAccountPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of MarketplaceAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountCountArgs} args - Arguments to filter MarketplaceAccounts to count.
     * @example
     * // Count the number of MarketplaceAccounts
     * const count = await prisma.marketplaceAccount.count({
     *   where: {
     *     // ... the filter for the MarketplaceAccounts we want to count
     *   }
     * })
    **/
    count<T extends MarketplaceAccountCountArgs>(args?: Prisma.Subset<T, MarketplaceAccountCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], MarketplaceAccountCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a MarketplaceAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MarketplaceAccountAggregateArgs>(args: Prisma.Subset<T, MarketplaceAccountAggregateArgs>): Prisma.PrismaPromise<GetMarketplaceAccountAggregateType<T>>;
    /**
     * Group by MarketplaceAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceAccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
    **/
    groupBy<T extends MarketplaceAccountGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: MarketplaceAccountGroupByArgs['orderBy'];
    } : {
        orderBy?: MarketplaceAccountGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, MarketplaceAccountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMarketplaceAccountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MarketplaceAccount model
     */
    readonly fields: MarketplaceAccountFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for MarketplaceAccount.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__MarketplaceAccountClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.MarketplaceAccount$userArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.MarketplaceAccount$userArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    orders<T extends Prisma.MarketplaceAccount$ordersArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.MarketplaceAccount$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    imports<T extends Prisma.MarketplaceAccount$importsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.MarketplaceAccount$importsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ImportPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the MarketplaceAccount model
 */
export interface MarketplaceAccountFieldRefs {
    readonly id: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly platform: Prisma.FieldRef<"MarketplaceAccount", 'MarketplacePlatform'>;
    readonly name: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly cnpj: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly externalAccountId: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly accessTokenEncrypted: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly refreshTokenEncrypted: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
    readonly tokenExpiresAt: Prisma.FieldRef<"MarketplaceAccount", 'DateTime'>;
    readonly isActive: Prisma.FieldRef<"MarketplaceAccount", 'Boolean'>;
    readonly createdAt: Prisma.FieldRef<"MarketplaceAccount", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"MarketplaceAccount", 'DateTime'>;
    readonly userId: Prisma.FieldRef<"MarketplaceAccount", 'String'>;
}
/**
 * MarketplaceAccount findUnique
 */
export type MarketplaceAccountFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceAccount to fetch.
     */
    where: Prisma.MarketplaceAccountWhereUniqueInput;
};
/**
 * MarketplaceAccount findUniqueOrThrow
 */
export type MarketplaceAccountFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceAccount to fetch.
     */
    where: Prisma.MarketplaceAccountWhereUniqueInput;
};
/**
 * MarketplaceAccount findFirst
 */
export type MarketplaceAccountFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceAccount to fetch.
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceAccounts to fetch.
     */
    orderBy?: Prisma.MarketplaceAccountOrderByWithRelationInput | Prisma.MarketplaceAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MarketplaceAccounts.
     */
    cursor?: Prisma.MarketplaceAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceAccounts.
     */
    distinct?: Prisma.MarketplaceAccountScalarFieldEnum | Prisma.MarketplaceAccountScalarFieldEnum[];
};
/**
 * MarketplaceAccount findFirstOrThrow
 */
export type MarketplaceAccountFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceAccount to fetch.
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceAccounts to fetch.
     */
    orderBy?: Prisma.MarketplaceAccountOrderByWithRelationInput | Prisma.MarketplaceAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MarketplaceAccounts.
     */
    cursor?: Prisma.MarketplaceAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceAccounts.
     */
    distinct?: Prisma.MarketplaceAccountScalarFieldEnum | Prisma.MarketplaceAccountScalarFieldEnum[];
};
/**
 * MarketplaceAccount findMany
 */
export type MarketplaceAccountFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceAccounts to fetch.
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceAccounts to fetch.
     */
    orderBy?: Prisma.MarketplaceAccountOrderByWithRelationInput | Prisma.MarketplaceAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MarketplaceAccounts.
     */
    cursor?: Prisma.MarketplaceAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceAccounts.
     */
    distinct?: Prisma.MarketplaceAccountScalarFieldEnum | Prisma.MarketplaceAccountScalarFieldEnum[];
};
/**
 * MarketplaceAccount create
 */
export type MarketplaceAccountCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * The data needed to create a MarketplaceAccount.
     */
    data: Prisma.XOR<Prisma.MarketplaceAccountCreateInput, Prisma.MarketplaceAccountUncheckedCreateInput>;
};
/**
 * MarketplaceAccount createMany
 */
export type MarketplaceAccountCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many MarketplaceAccounts.
     */
    data: Prisma.MarketplaceAccountCreateManyInput | Prisma.MarketplaceAccountCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * MarketplaceAccount createManyAndReturn
 */
export type MarketplaceAccountCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * The data used to create many MarketplaceAccounts.
     */
    data: Prisma.MarketplaceAccountCreateManyInput | Prisma.MarketplaceAccountCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountIncludeCreateManyAndReturn<ExtArgs> | null;
};
/**
 * MarketplaceAccount update
 */
export type MarketplaceAccountUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * The data needed to update a MarketplaceAccount.
     */
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateInput, Prisma.MarketplaceAccountUncheckedUpdateInput>;
    /**
     * Choose, which MarketplaceAccount to update.
     */
    where: Prisma.MarketplaceAccountWhereUniqueInput;
};
/**
 * MarketplaceAccount updateMany
 */
export type MarketplaceAccountUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update MarketplaceAccounts.
     */
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateManyMutationInput, Prisma.MarketplaceAccountUncheckedUpdateManyInput>;
    /**
     * Filter which MarketplaceAccounts to update
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * Limit how many MarketplaceAccounts to update.
     */
    limit?: number;
};
/**
 * MarketplaceAccount updateManyAndReturn
 */
export type MarketplaceAccountUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * The data used to update MarketplaceAccounts.
     */
    data: Prisma.XOR<Prisma.MarketplaceAccountUpdateManyMutationInput, Prisma.MarketplaceAccountUncheckedUpdateManyInput>;
    /**
     * Filter which MarketplaceAccounts to update
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * Limit how many MarketplaceAccounts to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountIncludeUpdateManyAndReturn<ExtArgs> | null;
};
/**
 * MarketplaceAccount upsert
 */
export type MarketplaceAccountUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * The filter to search for the MarketplaceAccount to update in case it exists.
     */
    where: Prisma.MarketplaceAccountWhereUniqueInput;
    /**
     * In case the MarketplaceAccount found by the `where` argument doesn't exist, create a new MarketplaceAccount with this data.
     */
    create: Prisma.XOR<Prisma.MarketplaceAccountCreateInput, Prisma.MarketplaceAccountUncheckedCreateInput>;
    /**
     * In case the MarketplaceAccount was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.MarketplaceAccountUpdateInput, Prisma.MarketplaceAccountUncheckedUpdateInput>;
};
/**
 * MarketplaceAccount delete
 */
export type MarketplaceAccountDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
    /**
     * Filter which MarketplaceAccount to delete.
     */
    where: Prisma.MarketplaceAccountWhereUniqueInput;
};
/**
 * MarketplaceAccount deleteMany
 */
export type MarketplaceAccountDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which MarketplaceAccounts to delete
     */
    where?: Prisma.MarketplaceAccountWhereInput;
    /**
     * Limit how many MarketplaceAccounts to delete.
     */
    limit?: number;
};
/**
 * MarketplaceAccount.user
 */
export type MarketplaceAccount$userArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: Prisma.UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: Prisma.UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.UserInclude<ExtArgs> | null;
    where?: Prisma.UserWhereInput;
};
/**
 * MarketplaceAccount.orders
 */
export type MarketplaceAccount$ordersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: Prisma.OrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Order
     */
    omit?: Prisma.OrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.OrderInclude<ExtArgs> | null;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[];
    cursor?: Prisma.OrderWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.OrderScalarFieldEnum | Prisma.OrderScalarFieldEnum[];
};
/**
 * MarketplaceAccount.imports
 */
export type MarketplaceAccount$importsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Import
     */
    select?: Prisma.ImportSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Import
     */
    omit?: Prisma.ImportOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.ImportInclude<ExtArgs> | null;
    where?: Prisma.ImportWhereInput;
    orderBy?: Prisma.ImportOrderByWithRelationInput | Prisma.ImportOrderByWithRelationInput[];
    cursor?: Prisma.ImportWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ImportScalarFieldEnum | Prisma.ImportScalarFieldEnum[];
};
/**
 * MarketplaceAccount without action
 */
export type MarketplaceAccountDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceAccount
     */
    select?: Prisma.MarketplaceAccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceAccount
     */
    omit?: Prisma.MarketplaceAccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceAccountInclude<ExtArgs> | null;
};
//# sourceMappingURL=MarketplaceAccount.d.ts.map