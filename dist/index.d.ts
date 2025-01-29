type SigMethod = 'HMAC-SHA1' | 'PLAINTEXT';
type FullToken = {
    oauth_consumer_key: string;
    oauth_nonce: string;
    oauth_signature_method: SigMethod;
    oauth_timestamp: number;
    oauth_token: string;
    oauth_version: '1.0';
};
type Token = {
    oauth_token: string;
    oauth_token_secret: string;
};
export declare class SchoologyAPI {
    client_key: string;
    client_secret: string;
    site_base: string;
    api_base: string;
    oauth_token: string;
    oauth_token_secret: string;
    redirectLoop: boolean;
    fetch: (url: any, init: any) => any;
    constructor(client_key: string, client_secret: string, site_base?: string, api_host?: string);
    getAuthHeaderComponents(signatureMethod?: SigMethod, token?: string): FullToken;
    getUnsignedAuthHeader(): string;
    getPlaintextAuthHeader(): string;
    getSignedAuthHeader(method: string, url: string): string;
    setToken(token: Token): void;
    getRequestToken(): Promise<Token>;
    getConnectURL(returnUrl: string): string;
    getAccessToken(): Promise<string>;
    getUserId(): Promise<string>;
    getUserData(id: string): Promise<string>;
    easyFetch(url: string, init?: {}): Promise<any>;
}
export {};
//# sourceMappingURL=index.d.ts.map