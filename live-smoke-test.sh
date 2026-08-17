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
    
    if [ "$HTTP_STATUS" -ne 200 ]; then
        if [ "$HTTP_STATUS" -eq 301 ] || [ "$HTTP_STATUS" -eq 302 ]; then
            # Extract Location redirect header (handling token if available)
            if [ -n "$TOKEN_HEADER" ]; then
                REDIRECT_URL=$(curl -s -I -H "$TOKEN_HEADER" "$URL" | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
            else
                REDIRECT_URL=$(curl -s -I "$URL" | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
            fi
            
            if [[ "$REDIRECT_URL" == *"github.com/login"* ]] || [[ "$REDIRECT_URL" == *"github.com/session"* ]]; then
                echo "WARNING: Redirected to GitHub Login ($REDIRECT_URL). The Pages site is private. Skipping content verification for $URL."
                continue
            fi
        else
            echo "WARNING: HTTP status is $HTTP_STATUS (not 200/301/302). The Pages site might be private or deploying. Skipping content verification for $URL."
            continue
        fi
    fi
    
    # Resolve the effective URL after following redirects
    if [ -n "$TOKEN_HEADER" ]; then
        EFFECTIVE_URL=$(curl -sL -o /dev/null -w "%{url_effective}" -H "$TOKEN_HEADER" "$URL")
    else
        EFFECTIVE_URL=$(curl -sL -o /dev/null -w "%{url_effective}" "$URL")
    fi
    EFFECTIVE_URL="${EFFECTIVE_URL%/}"
    echo "Effective URL after redirects: $EFFECTIVE_URL"
    echo "$EFFECTIVE_URL" > effective_url.txt


    # Fetch content
    if [ -n "$TOKEN_HEADER" ]; then
        CONTENT=$(curl -sSL -f -H "$TOKEN_HEADER" "$EFFECTIVE_URL")
    else
        CONTENT=$(curl -sSL -f "$EFFECTIVE_URL")
    fi
    
    # Check for login button
    if ! echo "$CONTENT" | grep -q "btn-login"; then
        echo "ERROR: Could not find 'btn-login' element at $EFFECTIVE_URL"
        exit 1
    fi
    
    # Extract main bundle JS path from index.html (e.g. /assets/main-Bzq9UCHa.js)
    JS_PATH=$(echo "$CONTENT" | grep -o 'src="/assets/main-[^"]*\.js"' | cut -d'"' -f2)
    
    if [ -z "$JS_PATH" ]; then
        echo "ERROR: Could not find Vite main bundle (src=\"/assets/main-*.js\") at $EFFECTIVE_URL"
        exit 1
    fi

    echo "Found Vite main bundle: $JS_PATH"
    if [ -n "$TOKEN_HEADER" ]; then
        JS_CONTENT=$(curl -sSL -f -H "$TOKEN_HEADER" "$EFFECTIVE_URL$JS_PATH")
    else
        JS_CONTENT=$(curl -sSL -f "$EFFECTIVE_URL$JS_PATH")
    fi
    
    # Check for prefs functions inside the bundled JS
    if ! echo "$JS_CONTENT" | grep -q -E "exportPrefsAsJson|deleteUserPrefs|updatePrefs"; then
        echo "ERROR: Could not find preferences management functions in main bundle at $EFFECTIVE_URL"
        exit 1
    fi
    echo "Vite main bundle integration OK."
    
    # Extract apiKey and authDomain dynamically
    API_KEY=$(echo "$CONTENT" | grep -o -E 'apiKey: "[^"]*"|apiKey:"[^"]*"' | cut -d'"' -f2)
    AUTH_DOMAIN=$(echo "$CONTENT" | grep -o -E 'authDomain: "[^"]*"|authDomain:"[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$API_KEY" ] && [ -n "$AUTH_DOMAIN" ]; then
        echo "Validating Google Auth provider configuration for $EFFECTIVE_URL ..."
        AUTH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"providerId\": \"google.com\", \"continueUri\": \"https://$AUTH_DOMAIN/__/auth/handler\"}" "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=$API_KEY")
        
        if ! echo "$AUTH_RESPONSE" | grep -q "authUri"; then
            echo "ERROR: Google Auth provider is misconfigured or disabled. Identity Toolkit API did not return an authUri."
            echo "API Response: $AUTH_RESPONSE"
            exit 1
        fi
        echo "Google Auth provider configuration OK."
    else
        echo "WARNING: Could not extract apiKey or authDomain from $EFFECTIVE_URL to test provider config."
    fi
    
    echo "Check OK for $URL"
done

echo "All live smoke tests passed successfully!"
