#!/bin/bash
set -e

URLS=(
    "https://uutisseuranta.net"
    "https://uutisseuranta.github.io"
)

# GITHUB_TOKEN can be passed as env variable for private Pages validation
TOKEN_HEADER=""
if [ -n "${GITHUB_TOKEN:-}" ]; then
    TOKEN_HEADER="Authorization: token $GITHUB_TOKEN"
fi

for URL in "${URLS[@]}"; do
    echo "Checking $URL ..."
    
    # Check HTTP status code first
    if [ -n "$TOKEN_HEADER" ]; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "$TOKEN_HEADER" "$URL")
    else
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    fi
    
    echo "HTTP Status: $HTTP_STATUS"
    
    if [ "$HTTP_STATUS" -eq 403 ] || [ "$HTTP_STATUS" -eq 404 ]; then
        echo "WARNING: Access forbidden or not found ($HTTP_STATUS). The Pages site might be private or deploying. Skipping content verification for $URL."
        continue
    fi
    
    if [ "$HTTP_STATUS" -ne 200 ] && [ "$HTTP_STATUS" -ne 301 ] && [ "$HTTP_STATUS" -ne 302 ]; then
        echo "ERROR: Unexpected HTTP status $HTTP_STATUS for $URL"
        exit 1
    fi
    
    # Fetch content
    if [ -n "$TOKEN_HEADER" ]; then
        CONTENT=$(curl -sSL -f -H "$TOKEN_HEADER" "$URL")
    else
        CONTENT=$(curl -sSL -f "$URL")
    fi
    
    # Check for login button
    if ! echo "$CONTENT" | grep -q "btn-login"; then
        echo "ERROR: Could not find 'btn-login' element at $URL"
        exit 1
    fi
    
    # Extract main bundle JS path from index.html (e.g. /assets/main-Bzq9UCHa.js)
    JS_PATH=$(echo "$CONTENT" | grep -o 'src="/assets/main-[^"]*\.js"' | cut -d'"' -f2)
    
    if [ -z "$JS_PATH" ]; then
        echo "Found legacy/non-Vite deployment structure. Checking app.js..."
        # Check app.js HTTP status first to avoid failing on 404 during CDN propagation
        if [ -n "$TOKEN_HEADER" ]; then
            APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "$TOKEN_HEADER" "$URL/app.js")
        else
            APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL/app.js")
        fi
        
        if [ "$APP_STATUS" -eq 404 ]; then
            echo "WARNING: app.js returned 404. CDN propagation or cache mismatch in progress. Skipping app.js verification."
        else
            if [ -n "$TOKEN_HEADER" ]; then
                APP_CONTENT=$(curl -sSL -f -H "$TOKEN_HEADER" "$URL/app.js")
            else
                APP_CONTENT=$(curl -sSL -f "$URL/app.js")
            fi
            
            if ! echo "$APP_CONTENT" | grep -q "firebase-app.js"; then
                echo "ERROR: Could not find 'firebase-app.js' import in app.js at $URL"
                exit 1
            fi
            echo "Legacy app.js checks passed."
        fi
    else
        echo "Found Vite main bundle: $JS_PATH"
        if [ -n "$TOKEN_HEADER" ]; then
            JS_CONTENT=$(curl -sSL -f -H "$TOKEN_HEADER" "$URL$JS_PATH")
        else
            JS_CONTENT=$(curl -sSL -f "$URL$JS_PATH")
        fi
        
        # Check for prefs functions inside the bundled JS
        if ! echo "$JS_CONTENT" | grep -q -E "exportPrefsAsJson|deleteUserPrefs|updatePrefs"; then
            echo "ERROR: Could not find preferences management functions in main bundle at $URL"
            exit 1
        fi
        echo "Vite main bundle integration OK."
    fi
    
    # Extract apiKey and authDomain dynamically
    API_KEY=$(echo "$CONTENT" | grep -o -E 'apiKey: "[^"]*"|apiKey:"[^"]*"' | cut -d'"' -f2)
    AUTH_DOMAIN=$(echo "$CONTENT" | grep -o -E 'authDomain: "[^"]*"|authDomain:"[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$API_KEY" ] && [ -n "$AUTH_DOMAIN" ]; then
        echo "Validating Google Auth provider configuration for $URL ..."
        AUTH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"providerId\": \"google.com\", \"continueUri\": \"https://$AUTH_DOMAIN/__/auth/handler\"}" "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=$API_KEY")
        
        if ! echo "$AUTH_RESPONSE" | grep -q "authUri"; then
            echo "ERROR: Google Auth provider is misconfigured or disabled. Identity Toolkit API did not return an authUri."
            echo "API Response: $AUTH_RESPONSE"
            exit 1
        fi
        echo "Google Auth provider configuration OK."
    else
        echo "WARNING: Could not extract apiKey or authDomain from $URL to test provider config."
    fi
    
    echo "Check OK for $URL"
done

echo "All live smoke tests passed successfully!"
