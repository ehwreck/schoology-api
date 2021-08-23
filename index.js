const { v4 } = require("uuid");
const { isBrowser: IS_BROWSER } = require("is-in-browser");
const qsParse = (search) => {
    return Object.fromEntries(new URLSearchParams(search).entries());
};
const DEFAULT_SITE_BASE = 'https://www.schoology.com';
const SCHOOLOGY_API_HOST = 'https://api.schoology.com';
const SCHOOLOGYTEST_API_HOST = 'https://api.schoologytest.com';
const REALM_PARAM = { 'OAuth realm': 'Schoology API' };
const headerFormat = (components) => {
    const parts = [];
    Object.keys(components).forEach(key => parts.push(key + '="' + components[key] + '"'));
    return parts.join(',');
};
const baseStringFormat = (components) => {
    const parts = [];
    Object.keys(components).forEach(key => parts.push(key + '=' + components[key]));
    return parts.join('&');
};
class SchoologyAPI {
    constructor(client_key, client_secret, site_base = DEFAULT_SITE_BASE, api_host = null) {
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
    getAuthHeaderComponents(signatureMethod = 'PLAINTEXT', token = '') {
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
    getUnsignedAuthHeader() {
        return headerFormat({
            ...REALM_PARAM,
            ...this.getAuthHeaderComponents(),
            oauth_signature: this.client_secret + '%26'
        });
    }
    getPlaintextAuthHeader() {
        const authHeaderComponents = this.getAuthHeaderComponents('PLAINTEXT', this.oauth_token);
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        return headerFormat({
            ...REALM_PARAM,
            ...authHeaderComponents,
            oauth_signature: key
        });
    }
    getSignedAuthHeader(method, url) {
        const authHeaderComponents = this.getAuthHeaderComponents('HMAC-SHA1', this.oauth_token);
        const baseString = [method.toUpperCase(), url, baseStringFormat(authHeaderComponents)]
            .map(encodeURIComponent)
            .join('&');
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        const signature = ((isBrowser) ? require("create-hmac") : require("crypto").createHmac)('sha1', key).update(baseString).digest('base64');
        return headerFormat({
            ...REALM_PARAM,
            ...authHeaderComponents,
            oauth_signature: signature
        });
    }
    setToken(token) {
        this.oauth_token = token.oauth_token;
        this.oauth_token_secret = token.oauth_token_secret;
    }
    async getRequestToken() {
        const Authorization = this.getUnsignedAuthHeader();
        let res = await (await this.fetch(this.api_base + '/oauth/request_token', {
            headers: { Authorization }
        })).text();
        const token = qsParse(res);
        this.setToken(token);
        return token;
    }
    getConnectURL(returnUrl) {
        return `${this.site_base}/oauth/authorize?oauth_token=${this.oauth_token}&return_url=${returnUrl}`;
    }
    async getAccessToken(requestToken) {
        this.setToken(requestToken);
        let res = await (await this.fetch(this.api_base + '/oauth/access_token', {
            headers: {
                "Authorization": this.getPlaintextAuthHeader()
            }
        })).text();
        const token = qsParse(res);
        this.setToken(token);
        return token;
    }
    async easyFetch(url, init = {}) {
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
            let checkRes = async () => {
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
                    return await res.json();
                }
            };
            return checkRes();
        } else {
            let res;
            let tryFetch = async (cUrl) => {
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
                    return await res.json();
                }
            };
            return tryFetch(url);
        }
    }
}
module.exports = { SchoologyAPI };