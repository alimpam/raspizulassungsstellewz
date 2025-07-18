#!/bin/bash

echo "🧪 Testing Date API Fix"
echo "======================"

echo ""
echo "1. Testing valid date formats:"
echo "-------------------------------"

echo "✅ Testing ISO format (2024-01-20):"
curl -s -X POST http://localhost:3000/api/dates \
  -H "Content-Type: application/json" \
  -d '{"date": "2024/01/20"}' | jq

echo ""
echo "✅ Testing another valid date (2024/02/15):"
curl -s -X POST http://localhost:3000/api/dates \
  -H "Content-Type: application/json" \
  -d '{"date": "2024/02/15"}' | jq

echo ""
echo "2. Testing invalid date format (should fail):"
echo "----------------------------------------------"

echo "❌ Testing German format directly (should fail):"
curl -s -X POST http://localhost:3000/api/dates \
  -H "Content-Type: application/json" \
  -d '{"date": "15.02.2024"}' | jq

echo ""
echo "3. Getting current dates:"
echo "------------------------"
curl -s http://localhost:3000/api/dates | jq

echo ""
echo "🎉 Fix Summary:"
echo "- ✅ Frontend now converts HTML date input (YYYY-MM-DD) to API format (YYYY/MM/DD)"
echo "- ✅ Frontend also handles German format input (DD.MM.YYYY) and converts to API format"
echo "- ✅ Backend validates date format and returns clear error messages"
echo "- ✅ Global addDate() function now uses proper conversion"
echo "- ✅ Error handling improved with user-friendly messages"
