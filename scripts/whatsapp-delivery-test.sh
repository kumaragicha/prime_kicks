#!/usr/bin/env bash
# Proves a WhatsApp message physically reaches a handset from the Prime Kicks
# test WABA. Uses `hello_world` because the test WABA has no Authentication
# template and cannot create one — so this tests the CHANNEL, not the OTP payload.
#
#   ./scripts/whatsapp-delivery-test.sh 919876543210
#
# The number must be on the test number's allowed-recipient list:
# Meta for Developers → primekicks → WhatsApp → Step 1 "Try it out" → To.
set -euo pipefail

TO="${1:-}"
[ -n "$TO" ] || { echo "usage: $0 <recipient E.164 digits, no +>"; exit 1; }
[ -n "${WA_TOKEN:-}" ] || { echo "Set WA_TOKEN first:  read -rs WA_TOKEN && export WA_TOKEN"; exit 1; }

PHONE_NUMBER_ID="1268449313024551"

curl -s -X POST "https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"${TO}\",\"type\":\"template\",\"template\":{\"name\":\"hello_world\",\"language\":{\"code\":\"en_US\"}}}" \
  | python3 -m json.tool
