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
    
    # Check for Firebase app initialization script
    if ! echo "$CONTENT" | grep -q "firebase-app.js"; then
        echo "ERROR: Could not find 'firebase-app.js' at $URL"
        exit 1
    fi
    
    # Check for Firebase auth script
    if ! echo "$CONTENT" | grep -q "firebase-auth.js"; then
        echo "ERROR: Could not find 'firebase-auth.js' at $URL"
        exit 1
    fi
    
    echo "Check OK for $URL"
done

echo "All live smoke tests passed successfully!"
