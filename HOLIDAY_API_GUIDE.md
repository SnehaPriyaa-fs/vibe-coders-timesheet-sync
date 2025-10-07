# Holiday Timesheet API Guide

## Overview
This guide explains how to use the new `/api/post-holiday` endpoint to post holiday timesheet entries with 8 hours for declared holidays.

## Quick Start

### 1. Start the API Server

**Option A: Normal Mode (connects to real timesheet API)**
```bash
node timesheet-api.js
```

**Option B: Mock Mode (for testing)**
```bash
MOCK_MODE=true node timesheet-api.js
```

### 2. Post a Holiday Entry

```bash
curl -X POST http://localhost:3000/api/post-holiday \
  -H "Content-Type: application/json" \
  -d '{
    "entryDate": "2025-10-08",
    "userId": "YOUR_USER_ID_HERE",
    "projectName": "00-Holiday",
    "taskName": "Holiday/Leave",
    "ticketNumber": "NIL",
    "timeSpent": 8,
    "details": "Holiday"
  }'
```

## API Endpoint Details

### POST `/api/post-holiday`

**Purpose**: Post a holiday timesheet entry with 8 hours for declared holidays.

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `entryDate` | string | ✅ | - | Date of the holiday (YYYY-MM-DD format) |
| `userId` | string | ✅ | - | User ID for the timesheet entry |
| `projectName` | string | ❌ | "00-Holiday" | Project name for the holiday |
| `taskName` | string | ❌ | "Holiday/Leave" | Task name for the holiday |
| `ticketNumber` | string | ❌ | "NIL" | Ticket number (usually NIL for holidays) |
| `timeSpent` | number | ❌ | 8 | Hours to log (default 8 for holidays) |
| `details` | string | ❌ | "Holiday" | Description of the holiday entry |

#### Response

**Success Response (200)**
```json
{
  "success": true,
  "message": "Holiday timesheet entry posted successfully",
  "data": {
    "entryDate": "2025-10-08",
    "timeSpent": 8,
    "projectName": "00-Holiday",
    "taskName": "Holiday/Leave",
    "details": "Holiday",
    "timesheetId": "generated_id_or_mock_id"
  }
}
```

**Error Response (400/500)**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Usage Examples

### Example 1: Minimal Request (uses defaults)
```bash
curl -X POST http://localhost:3000/api/post-holiday \
  -H "Content-Type: application/json" \
  -d '{
    "entryDate": "2025-10-08",
    "userId": "user123"
  }'
```

### Example 2: Full Request (your exact requirements)
```bash
curl -X POST http://localhost:3000/api/post-holiday \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "00-Holiday",
    "taskName": "Holiday/Leave",
    "entryDate": "2025-10-08",
    "ticketNumber": "NIL",
    "timeSpent": 8,
    "details": "Holiday",
    "userId": "user123"
  }'
```

### Example 3: Using the Test Script
```bash
# Update the userId in holiday-example.js first
node holiday-example.js
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file with the following variables:

```bash
# Timesheet API Configuration
TIMESHEET_API_URL=https://timesheet-be.fleetstudio.com/api/user/reports/filter
TIMESHEET_POST_URL=http://172.104.26.247:3999/api/create/timesheet

# Development/Testing
MOCK_MODE=false
```

### Mock Mode

When `MOCK_MODE=true`, the API will simulate successful timesheet entries without actually posting to the external API. This is useful for:
- Testing the API functionality
- Development and debugging
- When the external timesheet API is unavailable

## Error Handling

The API handles various error scenarios:

1. **Missing Required Fields**: Returns 400 with specific field requirements
2. **External API Errors**: Returns 500 with detailed error information
3. **Network Issues**: Returns 500 with network error details
4. **Invalid Data**: Returns 400 with validation errors

## Integration with N8N

This endpoint is designed to work seamlessly with N8N workflows:

1. **HTTP Request Node**: Use POST method to `/api/post-holiday`
2. **JSON Body**: Include the required fields in the request body
3. **Error Handling**: Check the `success` field in the response
4. **Scheduling**: Use N8N's cron trigger to automate holiday entries

## Troubleshooting

### Common Issues

1. **"Cannot find module" error**: Make sure you're in the correct directory
2. **"Endpoint not found" error**: Restart the server to load the latest code
3. **External API 500 error**: The external timesheet API might be down
4. **Network errors**: Check if the external API URL is accessible

### Debug Steps

1. Check if the server is running: `curl http://localhost:3000/health`
2. Test in mock mode: `MOCK_MODE=true node timesheet-api.js`
3. Check server logs for detailed error information
4. Verify environment variables are set correctly

## API Server Information

When the server starts, you'll see:
```
🚀 Timesheet Monitor API Server Started
📡 Server running on port 3000
🌐 Health check: http://localhost:3000/health
📊 API Documentation:
   GET  /health - Health check
   POST /api/post-holiday - Post holiday timesheet entry
   ... (other endpoints)
```

## Support

For issues or questions:
1. Check the server logs for detailed error messages
2. Test in mock mode to isolate API issues
3. Verify all required fields are provided
4. Ensure the external timesheet API is accessible

