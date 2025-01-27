"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchoologyAPI = void 0;
const uuid_1 = require("uuid");
const is_in_browser_1 = require("is-in-browser");
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
        if (is_in_browser_1.isBrowser) {
            this.fetch = window.fetch;
        }
        else {
            this.fetch = require("node-fetch");
        }
        this.client_key = client_key;
        this.client_secret = client_secret;
        this.site_base = site_base;
        this.api_base = `${(api_host !== null && api_host !== void 0 ? api_host : ((site_base.indexOf('schoologytest') !== -1) ? SCHOOLOGYTEST_API_HOST : SCHOOLOGY_API_HOST))}/v1`;
        this.redirectLoop = is_in_browser_1.isBrowser;
    }
    getAuthHeaderComponents(signatureMethod = 'PLAINTEXT', token = '') {
        const nonce = (0, uuid_1.v4)();
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
        return headerFormat(Object.assign(Object.assign(Object.assign({}, REALM_PARAM), this.getAuthHeaderComponents()), { oauth_signature: this.client_secret + '%26' }));
    }
    getPlaintextAuthHeader() {
        const authHeaderComponents = this.getAuthHeaderComponents('PLAINTEXT', this.oauth_token);
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        return headerFormat(Object.assign(Object.assign(Object.assign({}, REALM_PARAM), authHeaderComponents), { oauth_signature: key }));
    }
    getSignedAuthHeader(method, url) {
        const authHeaderComponents = this.getAuthHeaderComponents('HMAC-SHA1', this.oauth_token);
        const baseString = [method.toUpperCase(), url, baseStringFormat(authHeaderComponents)]
            .map(encodeURIComponent)
            .join('&');
        const key = [this.client_secret, this.oauth_token_secret].join('&');
        const signature = ((is_in_browser_1.isBrowser) ? require("create-hmac") : require("crypto").createHmac)('sha1', key).update(baseString).digest('base64');
        return headerFormat(Object.assign(Object.assign(Object.assign({}, REALM_PARAM), authHeaderComponents), { oauth_signature: signature }));
    }
    setToken(token) {
        this.oauth_token = token.oauth_token;
        this.oauth_token_secret = token.oauth_token_secret;
    }
    getRequestToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const Authorization = this.getUnsignedAuthHeader();
            let res = yield (yield this.fetch(this.api_base + '/oauth/request_token', {
                headers: { Authorization }
            })).text();
            const token = qsParse(res);
            this.setToken(token);
            return token;
        });
    }
    getConnectURL(returnUrl) {
        return `${this.site_base}/oauth/authorize?oauth_token=${this.oauth_token}&oauth_callback=${returnUrl}`;
    }
    getAccessToken(requestToken) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield (yield this.fetch(this.api_base + '/oauth/access_token', {
                headers: {
                    "Authorization": this.getPlaintextAuthHeader()
                }
            })).text();
            const token = qsParse(res);
            this.setToken(token);
            return token;
        });
    }
    getUserData() {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield (yield this.fetch(this.api_base + '/app-user-info', {
                headers: {
                    "Authorization": this.getPlaintextAuthHeader()
                }
            })).text();
            return res;
        });
    }
    easyFetch(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, init = {}) {
            const that = this;
            const { fetch, getPlaintextAuthHeader } = that;
            if (!that.redirectLoop) {
                let res = yield fetch(url, Object.assign(Object.assign({}, init), { "headers": {
                        "Authorization": getPlaintextAuthHeader.call(that)
                    }, "redirect": "manual" }));
                let checkRes = () => __awaiter(this, void 0, void 0, function* () {
                    if (res.status.toString().indexOf("30") == 0 && res.headers.has("location")) {
                        res = yield fetch(res.headers.get("location"), Object.assign(Object.assign({}, init), { "headers": {
                                "Authorization": getPlaintextAuthHeader.call(that)
                            }, "redirect": "manual" }));
                        return checkRes();
                    }
                    else {
                        return yield res.text();
                    }
                });
                return checkRes();
            }
            else {
                let res;
                let tryFetch = (cUrl) => __awaiter(this, void 0, void 0, function* () {
                    res = yield fetch(cUrl, Object.assign(Object.assign({}, init), { "headers": {
                            "Authorization": getPlaintextAuthHeader.call(that)
                        }, "redirect": "follow" }));
                    if (res.status == 401 && (yield res.text()) == "Duplicate timestamp/nonce combination, possible replay attack.  Request rejected." && res.url != url) {
                        return tryFetch(res.url);
                    }
                    else {
                        return yield res.text();
                    }
                });
                return tryFetch(url);
            }
        });
    }
}
exports.SchoologyAPI = SchoologyAPI;
//# sourceMappingURL=index.js.map