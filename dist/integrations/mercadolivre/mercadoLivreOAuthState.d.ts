export declare const MERCADO_LIVRE_OAUTH_STATE_COOKIE = "ml_oauth_state";
export declare const MERCADO_LIVRE_OAUTH_STATE_COOKIE_PATH = "/api/marketplace-accounts/mercadolivre/callback";
export declare const MERCADO_LIVRE_OAUTH_STATE_MAX_AGE: number;
interface OAuthStateSession {
    state: string;
    cookieValue: string;
}
export declare function createMercadoLivreOAuthState(userId: string): OAuthStateSession;
export declare function validateMercadoLivreOAuthState(receivedState: string, cookieValue: string | undefined): {
    userId: string;
};
export {};
//# sourceMappingURL=mercadoLivreOAuthState.d.ts.map