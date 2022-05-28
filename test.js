(async () => {
    require("dotenv").config();
    const { SchoologyAPI } = require(".");
    let schoology = new SchoologyAPI(process.env.client_key, process.env.client_secret, process.env.site_base);
    await schoology.getRequestToken();
    await new Promise((resolve) => {
        // For testing purposes...
        const Express = require("express");
        const app = Express();
        let port;
        app.get("/", (req, res) => {
            if (req.query.oauth_token == schoology.oauth_token) {
                res.status(200).type("text").send("Logged in");
                resolve();
            } else
                res.redirect(schoology.site_base + "/oauth/authorize?oauth_token=" + encodeURIComponent(schoology.oauth_token) + "&oauth_callback=" + encodeURIComponent(`http://localhost:${port}/`));
        });
        let listener = app.listen(0, () => {
            port = listener.address().port;
            console.log("http://localhost:" + port);
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