import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
/**
 * Model MarketplaceOAuthState
 *
 */
export type MarketplaceOAuthStateModel = runtime.Types.Result.DefaultSelection<Prisma.$MarketplaceOAuthStatePayload>;
export type AggregateMarketplaceOAuthState = {
    _count: MarketplaceOAuthStateCountAggregateOutputType | null;
    _min: MarketplaceOAuthStateMinAggregateOutputType | null;
    _max: MarketplaceOAuthStateMaxAggregateOutputType | null;
};
export type MarketplaceOAuthStateMinAggregateOutputType = {
    stateHash: string | null;
    platform: $Enums.MarketplacePlatform | null;
    userId: string | null;
    configFingerprint: string | null;
    expiresAt: Date | null;
};
export type MarketplaceOAuthStateMaxAggregateOutputType = {
    stateHash: string | null;
    platform: $Enums.MarketplacePlatform | null;
    userId: string | null;
    configFingerprint: string | null;
    expiresAt: Date | null;
};
export type MarketplaceOAuthStateCountAggregateOutputType = {
    stateHash: number;
    platform: number;
    userId: number;
    configFingerprint: number;
    expiresAt: number;
    _all: number;
};
export type MarketplaceOAuthStateMinAggregateInputType = {
    stateHash?: true;
    platform?: true;
    userId?: true;
    configFingerprint?: true;
    expiresAt?: true;
};
export type MarketplaceOAuthStateMaxAggregateInputType = {
    stateHash?: true;
    platform?: true;
    userId?: true;
    configFingerprint?: true;
    expiresAt?: true;
};
export type MarketplaceOAuthStateCountAggregateInputType = {
    stateHash?: true;
    platform?: true;
    userId?: true;
    configFingerprint?: true;
    expiresAt?: true;
    _all?: true;
};
export type MarketplaceOAuthStateAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which MarketplaceOAuthState to aggregate.
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceOAuthStates to fetch.
     */
    orderBy?: Prisma.MarketplaceOAuthStateOrderByWithRelationInput | Prisma.MarketplaceOAuthStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceOAuthStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceOAuthStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MarketplaceOAuthStates
    **/
    _count?: true | MarketplaceOAuthStateCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: MarketplaceOAuthStateMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: MarketplaceOAuthStateMaxAggregateInputType;
};
export type GetMarketplaceOAuthStateAggregateType<T extends MarketplaceOAuthStateAggregateArgs> = {
    [P in keyof T & keyof AggregateMarketplaceOAuthState]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateMarketplaceOAuthState[P]> : Prisma.GetScalarType<T[P], AggregateMarketplaceOAuthState[P]>;
};
export type MarketplaceOAuthStateGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    orderBy?: Prisma.MarketplaceOAuthStateOrderByWithAggregationInput | Prisma.MarketplaceOAuthStateOrderByWithAggregationInput[];
    by: Prisma.MarketplaceOAuthStateScalarFieldEnum[] | Prisma.MarketplaceOAuthStateScalarFieldEnum;
    having?: Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MarketplaceOAuthStateCountAggregateInputType | true;
    _min?: MarketplaceOAuthStateMinAggregateInputType;
    _max?: MarketplaceOAuthStateMaxAggregateInputType;
};
export type MarketplaceOAuthStateGroupByOutputType = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    userId: string;
    configFingerprint: string;
    expiresAt: Date;
    _count: MarketplaceOAuthStateCountAggregateOutputType | null;
    _min: MarketplaceOAuthStateMinAggregateOutputType | null;
    _max: MarketplaceOAuthStateMaxAggregateOutputType | null;
};
export type GetMarketplaceOAuthStateGroupByPayload<T extends MarketplaceOAuthStateGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<MarketplaceOAuthStateGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof MarketplaceOAuthStateGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], MarketplaceOAuthStateGroupByOutputType[P]> : Prisma.GetScalarType<T[P], MarketplaceOAuthStateGroupByOutputType[P]>;
}>>;
export type MarketplaceOAuthStateWhereInput = {
    AND?: Prisma.MarketplaceOAuthStateWhereInput | Prisma.MarketplaceOAuthStateWhereInput[];
    OR?: Prisma.MarketplaceOAuthStateWhereInput[];
    NOT?: Prisma.MarketplaceOAuthStateWhereInput | Prisma.MarketplaceOAuthStateWhereInput[];
    stateHash?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceOAuthState"> | $Enums.MarketplacePlatform;
    userId?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    configFingerprint?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    expiresAt?: Prisma.DateTimeFilter<"MarketplaceOAuthState"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
};
export type MarketplaceOAuthStateOrderByWithRelationInput = {
    stateHash?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    configFingerprint?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
};
export type MarketplaceOAuthStateWhereUniqueInput = Prisma.AtLeast<{
    stateHash?: string;
    AND?: Prisma.MarketplaceOAuthStateWhereInput | Prisma.MarketplaceOAuthStateWhereInput[];
    OR?: Prisma.MarketplaceOAuthStateWhereInput[];
    NOT?: Prisma.MarketplaceOAuthStateWhereInput | Prisma.MarketplaceOAuthStateWhereInput[];
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceOAuthState"> | $Enums.MarketplacePlatform;
    userId?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    configFingerprint?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    expiresAt?: Prisma.DateTimeFilter<"MarketplaceOAuthState"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
}, "stateHash">;
export type MarketplaceOAuthStateOrderByWithAggregationInput = {
    stateHash?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    configFingerprint?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    _count?: Prisma.MarketplaceOAuthStateCountOrderByAggregateInput;
    _max?: Prisma.MarketplaceOAuthStateMaxOrderByAggregateInput;
    _min?: Prisma.MarketplaceOAuthStateMinOrderByAggregateInput;
};
export type MarketplaceOAuthStateScalarWhereWithAggregatesInput = {
    AND?: Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput | Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput[];
    OR?: Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput[];
    NOT?: Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput | Prisma.MarketplaceOAuthStateScalarWhereWithAggregatesInput[];
    stateHash?: Prisma.StringWithAggregatesFilter<"MarketplaceOAuthState"> | string;
    platform?: Prisma.EnumMarketplacePlatformWithAggregatesFilter<"MarketplaceOAuthState"> | $Enums.MarketplacePlatform;
    userId?: Prisma.StringWithAggregatesFilter<"MarketplaceOAuthState"> | string;
    configFingerprint?: Prisma.StringWithAggregatesFilter<"MarketplaceOAuthState"> | string;
    expiresAt?: Prisma.DateTimeWithAggregatesFilter<"MarketplaceOAuthState"> | Date | string;
};
export type MarketplaceOAuthStateCreateInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    configFingerprint: string;
    expiresAt: Date | string;
    user: Prisma.UserCreateNestedOneWithoutMarketplaceOAuthStatesInput;
};
export type MarketplaceOAuthStateUncheckedCreateInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    userId: string;
    configFingerprint: string;
    expiresAt: Date | string;
};
export type MarketplaceOAuthStateUpdateInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutMarketplaceOAuthStatesNestedInput;
};
export type MarketplaceOAuthStateUncheckedUpdateInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateCreateManyInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    userId: string;
    configFingerprint: string;
    expiresAt: Date | string;
};
export type MarketplaceOAuthStateUpdateManyMutationInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateUncheckedUpdateManyInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateListRelationFilter = {
    every?: Prisma.MarketplaceOAuthStateWhereInput;
    some?: Prisma.MarketplaceOAuthStateWhereInput;
    none?: Prisma.MarketplaceOAuthStateWhereInput;
};
export type MarketplaceOAuthStateOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type MarketplaceOAuthStateCountOrderByAggregateInput = {
    stateHash?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    configFingerprint?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
};
export type MarketplaceOAuthStateMaxOrderByAggregateInput = {
    stateHash?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    configFingerprint?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
};
export type MarketplaceOAuthStateMinOrderByAggregateInput = {
    stateHash?: Prisma.SortOrder;
    platform?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    configFingerprint?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
};
export type MarketplaceOAuthStateCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput> | Prisma.MarketplaceOAuthStateCreateWithoutUserInput[] | Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput | Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.MarketplaceOAuthStateCreateManyUserInputEnvelope;
    connect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
};
export type MarketplaceOAuthStateUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput> | Prisma.MarketplaceOAuthStateCreateWithoutUserInput[] | Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput | Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.MarketplaceOAuthStateCreateManyUserInputEnvelope;
    connect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
};
export type MarketplaceOAuthStateUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput> | Prisma.MarketplaceOAuthStateCreateWithoutUserInput[] | Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput | Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.MarketplaceOAuthStateUpsertWithWhereUniqueWithoutUserInput | Prisma.MarketplaceOAuthStateUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.MarketplaceOAuthStateCreateManyUserInputEnvelope;
    set?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    disconnect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    delete?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    connect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    update?: Prisma.MarketplaceOAuthStateUpdateWithWhereUniqueWithoutUserInput | Prisma.MarketplaceOAuthStateUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.MarketplaceOAuthStateUpdateManyWithWhereWithoutUserInput | Prisma.MarketplaceOAuthStateUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.MarketplaceOAuthStateScalarWhereInput | Prisma.MarketplaceOAuthStateScalarWhereInput[];
};
export type MarketplaceOAuthStateUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput> | Prisma.MarketplaceOAuthStateCreateWithoutUserInput[] | Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput | Prisma.MarketplaceOAuthStateCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.MarketplaceOAuthStateUpsertWithWhereUniqueWithoutUserInput | Prisma.MarketplaceOAuthStateUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.MarketplaceOAuthStateCreateManyUserInputEnvelope;
    set?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    disconnect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    delete?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    connect?: Prisma.MarketplaceOAuthStateWhereUniqueInput | Prisma.MarketplaceOAuthStateWhereUniqueInput[];
    update?: Prisma.MarketplaceOAuthStateUpdateWithWhereUniqueWithoutUserInput | Prisma.MarketplaceOAuthStateUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.MarketplaceOAuthStateUpdateManyWithWhereWithoutUserInput | Prisma.MarketplaceOAuthStateUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.MarketplaceOAuthStateScalarWhereInput | Prisma.MarketplaceOAuthStateScalarWhereInput[];
};
export type EnumMarketplacePlatformFieldUpdateOperationsInput = {
    set?: $Enums.MarketplacePlatform;
};
export type MarketplaceOAuthStateCreateWithoutUserInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    configFingerprint: string;
    expiresAt: Date | string;
};
export type MarketplaceOAuthStateUncheckedCreateWithoutUserInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    configFingerprint: string;
    expiresAt: Date | string;
};
export type MarketplaceOAuthStateCreateOrConnectWithoutUserInput = {
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    create: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput>;
};
export type MarketplaceOAuthStateCreateManyUserInputEnvelope = {
    data: Prisma.MarketplaceOAuthStateCreateManyUserInput | Prisma.MarketplaceOAuthStateCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type MarketplaceOAuthStateUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    update: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedCreateWithoutUserInput>;
};
export type MarketplaceOAuthStateUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateWithoutUserInput, Prisma.MarketplaceOAuthStateUncheckedUpdateWithoutUserInput>;
};
export type MarketplaceOAuthStateUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.MarketplaceOAuthStateScalarWhereInput;
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateManyMutationInput, Prisma.MarketplaceOAuthStateUncheckedUpdateManyWithoutUserInput>;
};
export type MarketplaceOAuthStateScalarWhereInput = {
    AND?: Prisma.MarketplaceOAuthStateScalarWhereInput | Prisma.MarketplaceOAuthStateScalarWhereInput[];
    OR?: Prisma.MarketplaceOAuthStateScalarWhereInput[];
    NOT?: Prisma.MarketplaceOAuthStateScalarWhereInput | Prisma.MarketplaceOAuthStateScalarWhereInput[];
    stateHash?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    platform?: Prisma.EnumMarketplacePlatformFilter<"MarketplaceOAuthState"> | $Enums.MarketplacePlatform;
    userId?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    configFingerprint?: Prisma.StringFilter<"MarketplaceOAuthState"> | string;
    expiresAt?: Prisma.DateTimeFilter<"MarketplaceOAuthState"> | Date | string;
};
export type MarketplaceOAuthStateCreateManyUserInput = {
    stateHash: string;
    platform: $Enums.MarketplacePlatform;
    configFingerprint: string;
    expiresAt: Date | string;
};
export type MarketplaceOAuthStateUpdateWithoutUserInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateUncheckedUpdateWithoutUserInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateUncheckedUpdateManyWithoutUserInput = {
    stateHash?: Prisma.StringFieldUpdateOperationsInput | string;
    platform?: Prisma.EnumMarketplacePlatformFieldUpdateOperationsInput | $Enums.MarketplacePlatform;
    configFingerprint?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type MarketplaceOAuthStateSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    stateHash?: boolean;
    platform?: boolean;
    userId?: boolean;
    configFingerprint?: boolean;
    expiresAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceOAuthState"]>;
export type MarketplaceOAuthStateSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    stateHash?: boolean;
    platform?: boolean;
    userId?: boolean;
    configFingerprint?: boolean;
    expiresAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceOAuthState"]>;
export type MarketplaceOAuthStateSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    stateHash?: boolean;
    platform?: boolean;
    userId?: boolean;
    configFingerprint?: boolean;
    expiresAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["marketplaceOAuthState"]>;
export type MarketplaceOAuthStateSelectScalar = {
    stateHash?: boolean;
    platform?: boolean;
    userId?: boolean;
    configFingerprint?: boolean;
    expiresAt?: boolean;
};
export type MarketplaceOAuthStateOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"stateHash" | "platform" | "userId" | "configFingerprint" | "expiresAt", ExtArgs["result"]["marketplaceOAuthState"]>;
export type MarketplaceOAuthStateInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type MarketplaceOAuthStateIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type MarketplaceOAuthStateIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type $MarketplaceOAuthStatePayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "MarketplaceOAuthState";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        stateHash: string;
        platform: $Enums.MarketplacePlatform;
        userId: string;
        configFingerprint: string;
        expiresAt: Date;
    }, ExtArgs["result"]["marketplaceOAuthState"]>;
    composites: {};
};
export type MarketplaceOAuthStateGetPayload<S extends boolean | null | undefined | MarketplaceOAuthStateDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload, S>;
export type MarketplaceOAuthStateCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<MarketplaceOAuthStateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: MarketplaceOAuthStateCountAggregateInputType | true;
};
export interface MarketplaceOAuthStateDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['MarketplaceOAuthState'];
        meta: {
            name: 'MarketplaceOAuthState';
        };
    };
    /**
     * Find zero or one MarketplaceOAuthState that matches the filter.
     * @param {MarketplaceOAuthStateFindUniqueArgs} args - Arguments to find a MarketplaceOAuthState
     * @example
     * // Get one MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MarketplaceOAuthStateFindUniqueArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateFindUniqueArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one MarketplaceOAuthState that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MarketplaceOAuthStateFindUniqueOrThrowArgs} args - Arguments to find a MarketplaceOAuthState
     * @example
     * // Get one MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MarketplaceOAuthStateFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first MarketplaceOAuthState that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateFindFirstArgs} args - Arguments to find a MarketplaceOAuthState
     * @example
     * // Get one MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MarketplaceOAuthStateFindFirstArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateFindFirstArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first MarketplaceOAuthState that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateFindFirstOrThrowArgs} args - Arguments to find a MarketplaceOAuthState
     * @example
     * // Get one MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MarketplaceOAuthStateFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more MarketplaceOAuthStates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MarketplaceOAuthStates
     * const marketplaceOAuthStates = await prisma.marketplaceOAuthState.findMany()
     *
     * // Get first 10 MarketplaceOAuthStates
     * const marketplaceOAuthStates = await prisma.marketplaceOAuthState.findMany({ take: 10 })
     *
     * // Only select the `stateHash`
     * const marketplaceOAuthStateWithStateHashOnly = await prisma.marketplaceOAuthState.findMany({ select: { stateHash: true } })
     *
     */
    findMany<T extends MarketplaceOAuthStateFindManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a MarketplaceOAuthState.
     * @param {MarketplaceOAuthStateCreateArgs} args - Arguments to create a MarketplaceOAuthState.
     * @example
     * // Create one MarketplaceOAuthState
     * const MarketplaceOAuthState = await prisma.marketplaceOAuthState.create({
     *   data: {
     *     // ... data to create a MarketplaceOAuthState
     *   }
     * })
     *
     */
    create<T extends MarketplaceOAuthStateCreateArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateCreateArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many MarketplaceOAuthStates.
     * @param {MarketplaceOAuthStateCreateManyArgs} args - Arguments to create many MarketplaceOAuthStates.
     * @example
     * // Create many MarketplaceOAuthStates
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MarketplaceOAuthStateCreateManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many MarketplaceOAuthStates and returns the data saved in the database.
     * @param {MarketplaceOAuthStateCreateManyAndReturnArgs} args - Arguments to create many MarketplaceOAuthStates.
     * @example
     * // Create many MarketplaceOAuthStates
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MarketplaceOAuthStates and only return the `stateHash`
     * const marketplaceOAuthStateWithStateHashOnly = await prisma.marketplaceOAuthState.createManyAndReturn({
     *   select: { stateHash: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MarketplaceOAuthStateCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a MarketplaceOAuthState.
     * @param {MarketplaceOAuthStateDeleteArgs} args - Arguments to delete one MarketplaceOAuthState.
     * @example
     * // Delete one MarketplaceOAuthState
     * const MarketplaceOAuthState = await prisma.marketplaceOAuthState.delete({
     *   where: {
     *     // ... filter to delete one MarketplaceOAuthState
     *   }
     * })
     *
     */
    delete<T extends MarketplaceOAuthStateDeleteArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateDeleteArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one MarketplaceOAuthState.
     * @param {MarketplaceOAuthStateUpdateArgs} args - Arguments to update one MarketplaceOAuthState.
     * @example
     * // Update one MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MarketplaceOAuthStateUpdateArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateUpdateArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more MarketplaceOAuthStates.
     * @param {MarketplaceOAuthStateDeleteManyArgs} args - Arguments to filter MarketplaceOAuthStates to delete.
     * @example
     * // Delete a few MarketplaceOAuthStates
     * const { count } = await prisma.marketplaceOAuthState.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MarketplaceOAuthStateDeleteManyArgs>(args?: Prisma.SelectSubset<T, MarketplaceOAuthStateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more MarketplaceOAuthStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MarketplaceOAuthStates
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MarketplaceOAuthStateUpdateManyArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more MarketplaceOAuthStates and returns the data updated in the database.
     * @param {MarketplaceOAuthStateUpdateManyAndReturnArgs} args - Arguments to update many MarketplaceOAuthStates.
     * @example
     * // Update many MarketplaceOAuthStates
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more MarketplaceOAuthStates and only return the `stateHash`
     * const marketplaceOAuthStateWithStateHashOnly = await prisma.marketplaceOAuthState.updateManyAndReturn({
     *   select: { stateHash: true },
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
    updateManyAndReturn<T extends MarketplaceOAuthStateUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one MarketplaceOAuthState.
     * @param {MarketplaceOAuthStateUpsertArgs} args - Arguments to update or create a MarketplaceOAuthState.
     * @example
     * // Update or create a MarketplaceOAuthState
     * const marketplaceOAuthState = await prisma.marketplaceOAuthState.upsert({
     *   create: {
     *     // ... data to create a MarketplaceOAuthState
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MarketplaceOAuthState we want to update
     *   }
     * })
     */
    upsert<T extends MarketplaceOAuthStateUpsertArgs>(args: Prisma.SelectSubset<T, MarketplaceOAuthStateUpsertArgs<ExtArgs>>): Prisma.Prisma__MarketplaceOAuthStateClient<runtime.Types.Result.GetResult<Prisma.$MarketplaceOAuthStatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of MarketplaceOAuthStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateCountArgs} args - Arguments to filter MarketplaceOAuthStates to count.
     * @example
     * // Count the number of MarketplaceOAuthStates
     * const count = await prisma.marketplaceOAuthState.count({
     *   where: {
     *     // ... the filter for the MarketplaceOAuthStates we want to count
     *   }
     * })
    **/
    count<T extends MarketplaceOAuthStateCountArgs>(args?: Prisma.Subset<T, MarketplaceOAuthStateCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], MarketplaceOAuthStateCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a MarketplaceOAuthState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MarketplaceOAuthStateAggregateArgs>(args: Prisma.Subset<T, MarketplaceOAuthStateAggregateArgs>): Prisma.PrismaPromise<GetMarketplaceOAuthStateAggregateType<T>>;
    /**
     * Group by MarketplaceOAuthState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MarketplaceOAuthStateGroupByArgs} args - Group by arguments.
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
    groupBy<T extends MarketplaceOAuthStateGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: MarketplaceOAuthStateGroupByArgs['orderBy'];
    } : {
        orderBy?: MarketplaceOAuthStateGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, MarketplaceOAuthStateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMarketplaceOAuthStateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MarketplaceOAuthState model
     */
    readonly fields: MarketplaceOAuthStateFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for MarketplaceOAuthState.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__MarketplaceOAuthStateClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
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
 * Fields of the MarketplaceOAuthState model
 */
export interface MarketplaceOAuthStateFieldRefs {
    readonly stateHash: Prisma.FieldRef<"MarketplaceOAuthState", 'String'>;
    readonly platform: Prisma.FieldRef<"MarketplaceOAuthState", 'MarketplacePlatform'>;
    readonly userId: Prisma.FieldRef<"MarketplaceOAuthState", 'String'>;
    readonly configFingerprint: Prisma.FieldRef<"MarketplaceOAuthState", 'String'>;
    readonly expiresAt: Prisma.FieldRef<"MarketplaceOAuthState", 'DateTime'>;
}
/**
 * MarketplaceOAuthState findUnique
 */
export type MarketplaceOAuthStateFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceOAuthState to fetch.
     */
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
};
/**
 * MarketplaceOAuthState findUniqueOrThrow
 */
export type MarketplaceOAuthStateFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceOAuthState to fetch.
     */
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
};
/**
 * MarketplaceOAuthState findFirst
 */
export type MarketplaceOAuthStateFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceOAuthState to fetch.
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceOAuthStates to fetch.
     */
    orderBy?: Prisma.MarketplaceOAuthStateOrderByWithRelationInput | Prisma.MarketplaceOAuthStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MarketplaceOAuthStates.
     */
    cursor?: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceOAuthStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceOAuthStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceOAuthStates.
     */
    distinct?: Prisma.MarketplaceOAuthStateScalarFieldEnum | Prisma.MarketplaceOAuthStateScalarFieldEnum[];
};
/**
 * MarketplaceOAuthState findFirstOrThrow
 */
export type MarketplaceOAuthStateFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceOAuthState to fetch.
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceOAuthStates to fetch.
     */
    orderBy?: Prisma.MarketplaceOAuthStateOrderByWithRelationInput | Prisma.MarketplaceOAuthStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MarketplaceOAuthStates.
     */
    cursor?: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceOAuthStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceOAuthStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceOAuthStates.
     */
    distinct?: Prisma.MarketplaceOAuthStateScalarFieldEnum | Prisma.MarketplaceOAuthStateScalarFieldEnum[];
};
/**
 * MarketplaceOAuthState findMany
 */
export type MarketplaceOAuthStateFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter, which MarketplaceOAuthStates to fetch.
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MarketplaceOAuthStates to fetch.
     */
    orderBy?: Prisma.MarketplaceOAuthStateOrderByWithRelationInput | Prisma.MarketplaceOAuthStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MarketplaceOAuthStates.
     */
    cursor?: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MarketplaceOAuthStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MarketplaceOAuthStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MarketplaceOAuthStates.
     */
    distinct?: Prisma.MarketplaceOAuthStateScalarFieldEnum | Prisma.MarketplaceOAuthStateScalarFieldEnum[];
};
/**
 * MarketplaceOAuthState create
 */
export type MarketplaceOAuthStateCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * The data needed to create a MarketplaceOAuthState.
     */
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateInput, Prisma.MarketplaceOAuthStateUncheckedCreateInput>;
};
/**
 * MarketplaceOAuthState createMany
 */
export type MarketplaceOAuthStateCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many MarketplaceOAuthStates.
     */
    data: Prisma.MarketplaceOAuthStateCreateManyInput | Prisma.MarketplaceOAuthStateCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * MarketplaceOAuthState createManyAndReturn
 */
export type MarketplaceOAuthStateCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * The data used to create many MarketplaceOAuthStates.
     */
    data: Prisma.MarketplaceOAuthStateCreateManyInput | Prisma.MarketplaceOAuthStateCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateIncludeCreateManyAndReturn<ExtArgs> | null;
};
/**
 * MarketplaceOAuthState update
 */
export type MarketplaceOAuthStateUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * The data needed to update a MarketplaceOAuthState.
     */
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateInput, Prisma.MarketplaceOAuthStateUncheckedUpdateInput>;
    /**
     * Choose, which MarketplaceOAuthState to update.
     */
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
};
/**
 * MarketplaceOAuthState updateMany
 */
export type MarketplaceOAuthStateUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update MarketplaceOAuthStates.
     */
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateManyMutationInput, Prisma.MarketplaceOAuthStateUncheckedUpdateManyInput>;
    /**
     * Filter which MarketplaceOAuthStates to update
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * Limit how many MarketplaceOAuthStates to update.
     */
    limit?: number;
};
/**
 * MarketplaceOAuthState updateManyAndReturn
 */
export type MarketplaceOAuthStateUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * The data used to update MarketplaceOAuthStates.
     */
    data: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateManyMutationInput, Prisma.MarketplaceOAuthStateUncheckedUpdateManyInput>;
    /**
     * Filter which MarketplaceOAuthStates to update
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * Limit how many MarketplaceOAuthStates to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateIncludeUpdateManyAndReturn<ExtArgs> | null;
};
/**
 * MarketplaceOAuthState upsert
 */
export type MarketplaceOAuthStateUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * The filter to search for the MarketplaceOAuthState to update in case it exists.
     */
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
    /**
     * In case the MarketplaceOAuthState found by the `where` argument doesn't exist, create a new MarketplaceOAuthState with this data.
     */
    create: Prisma.XOR<Prisma.MarketplaceOAuthStateCreateInput, Prisma.MarketplaceOAuthStateUncheckedCreateInput>;
    /**
     * In case the MarketplaceOAuthState was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.MarketplaceOAuthStateUpdateInput, Prisma.MarketplaceOAuthStateUncheckedUpdateInput>;
};
/**
 * MarketplaceOAuthState delete
 */
export type MarketplaceOAuthStateDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
    /**
     * Filter which MarketplaceOAuthState to delete.
     */
    where: Prisma.MarketplaceOAuthStateWhereUniqueInput;
};
/**
 * MarketplaceOAuthState deleteMany
 */
export type MarketplaceOAuthStateDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which MarketplaceOAuthStates to delete
     */
    where?: Prisma.MarketplaceOAuthStateWhereInput;
    /**
     * Limit how many MarketplaceOAuthStates to delete.
     */
    limit?: number;
};
/**
 * MarketplaceOAuthState without action
 */
export type MarketplaceOAuthStateDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MarketplaceOAuthState
     */
    select?: Prisma.MarketplaceOAuthStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MarketplaceOAuthState
     */
    omit?: Prisma.MarketplaceOAuthStateOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.MarketplaceOAuthStateInclude<ExtArgs> | null;
};
//# sourceMappingURL=MarketplaceOAuthState.d.ts.map