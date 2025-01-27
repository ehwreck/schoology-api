import { v4 } from "uuid";
import { isBrowser as IS_BROWSER } from "is-in-browser";
const qsParse = (search: string): any => {
    return Object.fromEntries(new URLSearchParams(search).entries());
};
const DEFAULT_SITE_BASE = 'https://www.schoology.com';
const SCHOOLOGY_API_HOST = 'https://api.schoology.com';
const SCHOOLOGYTEST_API_HOST = 'https://api.schoologytest.com';
const REALM_PARAM = { 'OAuth realm': 'Schoology API' };

type SigMethod = 'HMAC-SHA1' | 'PLAINTEXT';

type FullToken = {
    oauth_consumer_key: string,
    oauth_nonce: string,
    oauth_signature_method: SigMethod,
    oauth_timestamp: number,
    oauth_token: string,
    oauth_version: '1.0',
};

type Token = {
    oauth_token: string;
    oauth_token_secret: string;
};

const headerFormat = (components: Record<string, string | number>) => {
    const parts: string[] = []
    Object.keys(components).forEach(key => parts.push(key + '="' + components[key] + '"'))
    return parts.join(',')
};

const baseStringFormat = (components: Record<string, string | number>) => {
    const parts: string[] = []
    Object.keys(components).forEach(key => parts.push(key + '=' + components[key]))
    return parts.join('&')
};

export class SchoologyAPI {
    client_key: string
    client_secret: string
    site_base: string
    api_base: string
    oauth_token: string
    oauth_token_secret: string
    redirectLoop: boolean;
    fetch: (url: any, init: any) => any;

    constructor(client_key: string, client_secret: string, site_base = DEFAULT_SITE_BASE, api_host: string = null) {
        if (IS_BROWSER) {
            this.fetch = window.fetch;
        } else {
            this.fetch = require("node-fetch");
        }
        this.client_key = client_key;
        this.client_secret = client_secret;
        this.site_base = site_base;
        this.api_base = `${(api_host ?? ((site_base.indexOf('schoologytest') !== -1) ? SCHOOLOGYTEST_API_HOST : SCHOOLOGY_API_HOST))}/v1`;
        this.redirectLoop = IS_BROWSER;
    }

    getAuthHeaderComponents(signatureMethod: SigMethod = 'PLAINTEXT', token = ''): FullToken {
        const nonce = v4();
        const timestamp = Math.round(Date.now() / 1000);
        return {
            oauth_consumer_key: this.client_key,
            oauth_nonce: nonce,
            oauth_signature_method: signatureMethod,
            oauth_timestamp: timestamp,
            oauth_token: token,
            oauth_version: '1.0',
        };
    }

    getUnsignedAuthHeader(): string {
        return headerFormat({
            ...REALM_PARAM,
            ...this.getAuthHeaderComponents(),
            oauth_signature: this.client_secret + '%26'
        });
    }

    getPlaintextAuthHeader(): string {
        const authHeaderComponents = this.getAuthHeaderComponents('PLAINTEXT', this.oauth_token);
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        return headerFormat({
            ...REALM_PARAM,
            ...authHeaderComponents,
            oauth_signature: key
        });
    }

    getSignedAuthHeader(method: string, url: string): string {
        const authHeaderComponents = this.getAuthHeaderComponents('HMAC-SHA1', this.oauth_token);
        const baseString = [method.toUpperCase(), url, baseStringFormat(authHeaderComponents)]
            .map(encodeURIComponent)
            .join('&');
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        const signature = ((IS_BROWSER) ? require("create-hmac") : require("crypto").createHmac)('sha1', key).update(baseString).digest('base64');
        return headerFormat({
            ...REALM_PARAM,
            ...authHeaderComponents,
            oauth_signature: signature
        });
    }

    setToken(token: Token) {
        this.oauth_token = token.oauth_token;
        this.oauth_token_secret = token.oauth_token_secret;
    }

    async getRequestToken(): Promise<Token> {
        const Authorization = this.getUnsignedAuthHeader();
        let res = await (await this.fetch(this.api_base + '/oauth/request_token', {
            headers: { Authorization }
        })).text();
        const token = qsParse(res);
        this.setToken(token);
        return token;
    }

    getConnectURL(returnUrl: string): string {
        return `${this.site_base}/oauth/authorize?oauth_token=${this.oauth_token}&oauth_callback=${returnUrl}`;
    }

    async getAccessToken(requestToken: any): Promise<string> {
        let res = await (await this.fetch(this.api_base + '/oauth/access_token', {
            headers: {
                "Authorization": this.getPlaintextAuthHeader()
            }
        })).text();
        const access_token = qsParse(res);
        return access_token;
    }

    async getUserData(): Promise<string> {
        let res = await this.fetch(this.api_base + '/app-user-info', {
            headers: {
                "Authorization": this.getPlaintextAuthHeader()
            }
        });
        return res;
    }

    async easyFetch(url: string, init = {}) {
        const that = this;
        const { fetch, getPlaintextAuthHeader } = that;
        if (!that.redirectLoop) {
            let res = await fetch(url, {
                ...init,
                "headers": {
                    "Authorization": getPlaintextAuthHeader.call(that)
                },
                "redirect": "manual"
            });
            let checkRes = async (): Promise<any> => {
                if (res.status.toString().indexOf("30") == 0 && res.headers.has("location")) {
                    res = await fetch(res.headers.get("location"), {
                        ...init,
                        "headers": {
                            "Authorization": getPlaintextAuthHeader.call(that)
                        },
                        "redirect": "manual"
                    });
                    return checkRes();
                } else {
                    return await res.text();
                }
            };
            return checkRes();
        } else {
            let res;
            let tryFetch = async (cUrl: RequestInfo): Promise<any> => {
                res = await fetch(cUrl, {
                    ...init,
                    "headers": {
                        "Authorization": getPlaintextAuthHeader.call(that)
                    },
                    "redirect": "follow"
                });
                if (res.status == 401 && await res.text() == "Duplicate timestamp/nonce combination, possible replay attack.  Request rejected." && res.url != url) {
                    return tryFetch(res.url);
                } else {
                    return await res.text();
                }
            };
            return tryFetch(url);
        }
    }
}
