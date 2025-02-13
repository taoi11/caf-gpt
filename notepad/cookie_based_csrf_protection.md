# Cookie-Based Anti-CSRF Token (Synchronizer Token Pattern)

This approach leverages cookies and a server-side check to make it harder for automated scripts to make requests. It's based on the principle of preventing Cross-Site Request Forgery (CSRF) attacks.

**How it works:**

1.  **Initial Page Load:** When the user loads your page (e.g., `index.html`, `paceNotes.html`, `policyFoo.html`), the server sets a unique, random token in a cookie (e.g., `csrfToken`).
2.  **Frontend Inclusion:** The frontend JavaScript reads this cookie and includes the token as a header (e.g., `X-CSRF-Token`) in every API request.
3.  **Server Validation:** The server checks for the presence of this header and verifies that its value matches the token stored in the cookie. If they don't match, the request is rejected.

**Implementation Steps:**

*   **Backend (Node.js):**

    ```typescript
    import { randomBytes } from 'crypto';
    import { parse, serialize } from 'cookie'; // npm install cookie

    // Middleware to set the CSRF token on initial page load
    function setCSRFToken(req: any, res: any, next: any) {
        if (req.url === '/' || req.url.endsWith('.html')) { // Apply to your HTML pages
            const csrfToken = randomBytes(32).toString('hex');
            res.setHeader('Set-Cookie', serialize('csrfToken', csrfToken, {
                httpOnly: true, // Important for security
                secure: !IS_DEV, // Only send over HTTPS in production
                sameSite: 'Strict', // Recommended for CSRF protection
                path: '/',
            }));
            // Attach the token to the response so the frontend can read it
            res.locals.csrfToken = csrfToken;
        }
        next();
    }

    // Middleware to validate the CSRF token on API requests
    function validateCSRFToken(req: any, res: any, next: any) {
        if (req.method === 'GET' || req.url === '/health' || req.url === '/api/costs') {
            return next(); // Skip CSRF check for GET requests
        }

        const csrfTokenHeader = req.headers['x-csrf-token'];
        const cookies = parse(req.headers.cookie || '');
        const csrfTokenCookie = cookies.csrfToken;

        if (!csrfTokenHeader || !csrfTokenCookie || csrfTokenHeader !== csrfTokenCookie) {
            console.warn('CSRF token validation failed');
            return res.status(403).send('CSRF token validation failed');
        }

        next();
    }

    // Apply the middlewares in src/index.ts
    // Before your API routes and static file serving
    server.use(setCSRFToken);
    server.use(validateCSRFToken);
    ```

*   **Frontend (JavaScript):**

    ```typescript
    // Function to get the CSRF token from the cookie
    function getCSRFToken() {
        const name = "csrfToken=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for(let i = 0; i <ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }

    // Modify your API request function to include the CSRF token header
    async function apiRequest(url: string, data: any) {
        const csrfToken = getCSRFToken();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken, // Include the CSRF token
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }
    ```

**Explanation:**

*   **`setCSRFToken` Middleware:** This middleware is applied to requests for your HTML pages. It generates a random CSRF token, sets it as a cookie (`csrfToken`), and also makes it available in `res.locals` so the frontend can access it.
*   **`validateCSRFToken` Middleware:** This middleware is applied to your API endpoints. It retrieves the CSRF token from the `X-CSRF-Token` header and the `csrfToken` cookie. It compares the two values. If they match, the request is considered valid.
*   **`getCSRFToken` Function:** This JavaScript function retrieves the CSRF token from the cookie.
*   **`apiRequest` Function:** This function is a placeholder for your actual API request logic. It's modified to include the `X-CSRF-Token` header in every request.

**Advantages:**

*   **Reasonably Effective:** Makes it significantly harder for simple bots to make requests, as they would need to parse the initial HTML response to get the CSRF token.
*   **Relatively Easy to Implement:**  Less complex than full authentication.
*   **Good Security Practice:**  Protects against CSRF attacks, which are a common web security vulnerability.

**Disadvantages:**

*   **Not Perfect:** More sophisticated bots can still be programmed to extract the CSRF token.
*   **Adds Complexity:** Requires modifying both the frontend and backend code.
*   **Cookie Dependency:** Relies on cookies being enabled in the user's browser.

**Important Considerations:**

*   **`httpOnly` Cookie Attribute:**  Setting the `httpOnly` attribute to `true` prevents client-side JavaScript from accessing the cookie directly (except for reading it to include in the header). This helps to mitigate XSS attacks.
*   **`secure` Cookie Attribute:**  Setting the `secure` attribute to `true` ensures that the cookie is only sent over HTTPS.
*   **`sameSite` Cookie Attribute:**  Setting the `sameSite` attribute to `Strict` or `Lax` provides additional CSRF protection.  `Strict` is generally recommended, but `Lax` might be necessary if you have legitimate cross-site requests.
*   **GET Requests:** The example skips CSRF validation for GET requests. This is generally safe, as GET requests should not have any side effects. However, if your GET requests modify data, you should also protect them with CSRF validation.
*   **Error Handling:**  Provide informative error messages to the user if the CSRF token validation fails.

This cookie-based anti-CSRF token approach provides a good balance between security and ease of implementation. It's not a foolproof solution, but it will deter many simple bots and improve the overall security of your application. Remember to always use HTTPS and follow other security best practices.
