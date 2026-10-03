export type MagaluEnvironment = "sandbox" | "production";
export interface MagaluConfig {
    environment: MagaluEnvironment;
    apiBaseUrl: string;
    channelId: string;
}
/** Apenas configuração de ambiente; não exige credenciais nem consulta APIs. */
export declare function getMagaluConfig(env?: Readonly<Record<string, string | undefined>>): MagaluConfig;
//# sourceMappingURL=magaluConfig.d.ts.map