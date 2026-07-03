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
    
    # Check that app.js imports firebase-app.js and firebase-auth.js
    echo "Checking $URL/app.js for Firebase imports ..."
    APP_CONTENT=$(curl -sSL -f "$URL/app.js")
    if ! echo "$APP_CONTENT" | grep -q "firebase-app.js"; then
        echo "ERROR: Could not find 'firebase-app.js' import in app.js at $URL"
        exit 1
    fi
    if ! echo "$APP_CONTENT" | grep -q "firebase-auth.js"; then
        echo "ERROR: Could not find 'firebase-auth.js' import in app.js at $URL"
        exit 1
    fi
    echo "app.js Firebase imports OK."

    # 1. Check prefs.js for exportPrefsAsJson
    echo "Checking $URL/prefs.js for exportPrefsAsJson ..."
    PREFS_CONTENT=$(curl -sSL -f "$URL/prefs.js")
    if ! echo "$PREFS_CONTENT" | grep -q "export function exportPrefsAsJson"; then
        echo "ERROR: Could not find 'exportPrefsAsJson' export in prefs.js at $URL"
        exit 1
    fi
    echo "prefs.js export OK."

    # 2. Check profile.js for exportPrefsAsJson usage
    echo "Checking $URL/profile.js for exportPrefsAsJson usage ..."
    PROFILE_CONTENT=$(curl -sSL -f "$URL/profile.js")
    if ! echo "$PROFILE_CONTENT" | grep -q "exportPrefsAsJson"; then
        echo "ERROR: Could not find 'exportPrefsAsJson' import in profile.js at $URL"
        exit 1
    fi
    if ! echo "$PROFILE_CONTENT" | grep -q "#btn-export-json"; then
        echo "ERROR: Could not find '#btn-export-json' element listener in profile.js at $URL"
        exit 1
    fi
    echo "profile.js integration OK."
    
    # Extract apiKey and authDomain dynamically
    API_KEY=$(echo "$CONTENT" | grep -o 'apiKey: "[^"]*"' | cut -d'"' -f2)
    AUTH_DOMAIN=$(echo "$CONTENT" | grep -o 'authDomain: "[^"]*"' | cut -d'"' -f2)
    
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
