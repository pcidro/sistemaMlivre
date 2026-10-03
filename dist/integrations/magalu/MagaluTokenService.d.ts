import { MagaluOAuthClient } from "./magaluOAuthClient";
import type { MagaluOAuthConfig } from "./magaluOAuthConfig";
import { type MagaluTokenAccount, type MagaluTokenStorage } from "./magaluTokenStorage";
/** Compartilhar uma instância entre clients para coordenar refresh e recuperação. */
export declare class MagaluTokenService {
    private readonly oauthClient;
    private readonly storage;
    private readonly now;
    private readonly refreshes;
    private readonly pendingSaves;
    constructor(oauthClient?: MagaluOAuthClient, storage?: MagaluTokenStorage, now?: () => number);
    getAccessToken(expected: MagaluTokenAccount, config: MagaluOAuthConfig, rejectedToken?: string): Promise<string>;
    private refresh;
    private usable;
    private assertAccount;
    private decrypt;
    private sameTokens;
}
export declare const magaluTokenService: MagaluTokenService;
//# sourceMappingURL=MagaluTokenService.d.ts.map