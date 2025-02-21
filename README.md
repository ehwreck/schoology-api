# schoology

Authenticate & send requests to the [Schoology API](https://developers.schoology.com/api-documentation/authentication)

### Installation

`npm i github:ehwreck/schoology-api`

### Usage

To consume the Schoology API, you'll need an API key and secret. Find these by logging in to schoology and navigating to `/api` (typically https://app.schoology.com/api or https://\[your district\].schoology.com/api)

1. Instantiate the client like this:

   ```js
   import SchoologyAPI from 'schoology-api'

   const client = new SchoologyAPI(key, secret,  site_base?, api_host?)
   ```

   `key` and `secret` are required. If you log in to a unique district website eg. https://district123.schoology.com then send that as the third argument.

   You probably don't need to send `api_host` but it can be overridden as the fourth argument here.

2. Obtain a request token

   `await client.getRequestToken()`

   _The SchoologyAPI instance stores the response token for subsequent requests._

3. Complete OAuth flow

   This means redirecting the user to login at their schoology site where they will be prompted to approve access to their schoology account. Use SchoologyAPI to generate the correct redirect URL like this:

   `const url = client.getConnectURL(return_url)`

   After the user approves access, the schoology site will redirect the user back to `return_url`.

4. Exchange the authorized request token for an access token.

   `await client.getAccessToken()`

   _The SchoologyAPI instance stores the response token for subsequent requests._

5. Make requests!

   `const userInfo = await client.fetch('https://api.schoology.com/v1/users/me')`
