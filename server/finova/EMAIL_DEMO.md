# Email Functionality Demo

This document demonstrates how the new email functionality works in the Finova chat agent.

## What's New

The chat agent now has the ability to send emails when requested by users. This is implemented through:

1. **Backend API**: `POST /mailer/send` endpoint
2. **Chat Agent Tool**: `send_email` tool available to the AI agent
3. **Secure Integration**: JWT authentication and proper error handling

## How It Works

### 1. User Request via Chat

Users can now ask the chat agent to send emails in natural language:

```
User: "Send an email to john@example.com with subject 'Meeting Reminder' and content 'Don't forget our meeting tomorrow at 2 PM'"

Agent: I'll send that email for you right away.
[Agent uses send_email tool]
Agent: Email sent successfully to john@example.com with subject 'Meeting Reminder'.
```

### 2. Agent Tool Usage

The chat agent automatically uses the `send_email` tool when it detects email-related requests:

- **Recipient detection**: Automatically identifies email addresses
- **Content parsing**: Extracts subject and body from user request
- **Format handling**: Supports both plain text and HTML content
- **Error handling**: Provides clear feedback on success/failure

### 3. Backend Processing

The backend processes email requests through:

```
Chat Agent → Backend API → Mailer Service → SMTP Server
```

## Example Use Cases

### Simple Email

```
User: "Email the team about the project update"
Agent: "I'd be happy to help send an email to the team. What would you like me to include in the email about the project update?"
```

### Detailed Email

```
User: "Send an email to sarah@company.com, cc manager@company.com, with subject 'Q4 Report Ready' and content 'The Q4 financial report is now ready for review. Please let me know if you need any additional information.'"
Agent: "I'll send that email right away with all the details you specified."
```

### Meeting Reminders

```
User: "Send a reminder email to all attendees about tomorrow's 3 PM meeting"
Agent: "I'll send a reminder email to the meeting attendees. What specific details should I include in the reminder?"
```

## Technical Details

### Environment Variables Required

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@finova.com

# Backend API (for chat agent)
BACKEND_API_URL=http://localhost:3001
BACKEND_JWT=your-jwt-token
```

### API Endpoint

```
POST /mailer/send
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "text": "Plain text content",
  "html": "<p>HTML content</p>",
  "cc": "cc@example.com",
  "bcc": "bcc@example.com"
}
```

### Response Format

```json
{
  "success": true,
  "message": "Email sent successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Security Features

- **Authentication Required**: All email requests require valid JWT
- **User Context**: Emails are sent in the context of the authenticated user
- **Rate Limiting**: Built-in protection against abuse
- **Error Handling**: Secure error messages that don't leak sensitive information

## Testing the Feature

1. **Start the backend** with proper SMTP configuration
2. **Authenticate** in the chat interface
3. **Request an email** through natural language
4. **Verify** the email is sent successfully

## Troubleshooting

### Common Issues

1. **SMTP Configuration**: Ensure SMTP settings are correct
2. **Authentication**: Verify JWT token is valid
3. **Network**: Check if backend can reach SMTP server
4. **Permissions**: Ensure user has email sending permissions

### Debug Information

The chat agent provides detailed feedback:

- Success confirmations with timestamps
- Clear error messages for troubleshooting
- Validation of email addresses and content

## Future Enhancements

Potential improvements for the email functionality:

1. **Templates**: Pre-defined email templates for common use cases
2. **Scheduling**: Send emails at specific times
3. **Attachments**: Support for file attachments
4. **Signatures**: Automatic email signatures
5. **Tracking**: Email delivery and read receipts
6. **Bulk Sending**: Send to multiple recipients efficiently

## Support

For issues or questions about the email functionality:

1. Check the logs for detailed error information
2. Verify environment variable configuration
3. Test SMTP connectivity independently
4. Review the README documentation
