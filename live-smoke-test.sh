#!/bin/bash
set -e

URLS=(
    "https://uutisseuranta.net"
    "https://uutisseuranta.github.io"
)

for URL in "${URLS[@]}"; do
    echo "Checking $URL ..."
    
    # Fetch content, fail on HTTP errors (like 404), follow redirects
    CONTENT=$(curl -sSL -f "$URL")
    
    # Check for login button
    if ! echo "$CONTENT" | grep -q "btn-login"; then
        echo "ERROR: Could not find 'btn-login' element at $URL"
        exit 1
    fi
    
    # Extract main javascript asset dynamically in Vite context (Issue #62 / L-009)
    echo "Extracting JavaScript bundle path from $URL ..."
    JS_PATH=$(echo "$CONTENT" | grep -o 'src="[^"]*/assets/main-[^"]*\.js"' | cut -d'"' -f2)
    if [ -z "$JS_PATH" ]; then
        # Try finding it without leading slash
        JS_PATH=$(echo "$CONTENT" | grep -o 'src="assets/main-[^"]*\.js"' | cut -d'"' -f2)
    fi

    if [ -z "$JS_PATH" ]; then
        echo "ERROR: Could not extract Vite JS asset bundle path from index.html at $URL"
        exit 1
    fi

    # Ensure JS_PATH starts with correct slash
    if [[ ! "$JS_PATH" == /* ]]; then
        JS_PATH="/$JS_PATH"
    fi

    echo "Found bundle: $URL$JS_PATH"
    BUNDLE_CONTENT=$(curl -sSL -f "$URL$JS_PATH")

    # Check that main bundle contains key Firebase and integration exports/logic (Issue #12)
    echo "Checking bundle for Firebase and prefs exports ..."
    if ! echo "$BUNDLE_CONTENT" | grep -q -E "initializeFirestore|deleteUserPrefs"; then
        echo "ERROR: Could not verify Firestore/prefs offline persistence logic in main bundle at $URL"
        exit 1
    fi
    if ! echo "$BUNDLE_CONTENT" | grep -q "exportPrefsAsJson"; then
        echo "ERROR: Could not find exportPrefsAsJson integration in main bundle at $URL"
        exit 1
    fi
    echo "Bundle integration checks OK."
    
    # Extract apiKey and authDomain dynamically
    API_KEY=$(echo "$CONTENT" | grep -o 'apiKey: "[^"]*"' | cut -d'"' -f2 || true)
    AUTH_DOMAIN=$(echo "$CONTENT" | grep -o 'authDomain: "[^"]*"' | cut -d'"' -f2 || true)
    
    # In Vite environment, variables may be inline compiled or inside env variables.
    # Try looking in the bundle if not found in index.html
    if [ -z "$API_KEY" ]; then
        API_KEY=$(echo "$BUNDLE_CONTENT" | grep -o 'apiKey:"[^"]*"' | cut -d'"' -f2 | head -n 1 || true)
    fi
    if [ -z "$AUTH_DOMAIN" ]; then
        AUTH_DOMAIN=$(echo "$BUNDLE_CONTENT" | grep -o 'authDomain:"[^"]*"' | cut -d'"' -f2 | head -n 1 || true)
    fi

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
