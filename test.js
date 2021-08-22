(async () => {
    require("dotenv").config();
    const { SchoologyAPI } = require(".");
    let schoology = new SchoologyAPI(process.env.client_key, process.env.client_secret, process.env.site_base);
    await schoology.getRequestToken();
    await new Promise((resolve) => {
        // For testing purposes...
        const Express = require("express");
        const app = Express();
        app.get("/", (req, res) => {
            if (req.query.oauth_token == schoology.oauth_token) {
                res.status(200).type("text").send("Logged in");
                resolve();
            } else res.status(400).send();
        });
        let listener = app.listen(0, () => {
            console.log(schoology.getConnectURL(`http://localhost:${listener.address().port}`));
        });
    });
    await schoology.getAccessToken({
        "oauth_token": schoology.oauth_token,
        "oauth_token_secret": schoology.oauth_token_secret
    });
    const fetch = schoology.easyFetch.bind(schoology);
    // Should log your user info to console!
    console.log(await fetch("https://api.schoology.com/v1/users/me"));
})();