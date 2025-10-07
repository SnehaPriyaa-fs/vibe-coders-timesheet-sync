# Timesheet Monitoring System

An automated system that monitors employee timesheet submissions and sends notifications for incomplete or missing timesheets.

## Features

- ⏰ **Automated Scheduling**: Runs every Monday at 12:00 PM and 5:00 PM
- 📊 **Smart Analysis**: Identifies employees with no submission, partial submission, or flagged hours
- 📧 **Email Notifications**: Sends detailed reports to admin and HR teams
- 🔧 **Configurable**: Customizable thresholds and notification settings
- 🧪 **Testing**: Built-in test functionality

## Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Timesheet API Configuration
   TIMESHEET_API_URL=https://timesheet-be.fleetstudio.com/api/user/reports/filter
   
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@fleetstudio.com
   SMTP_PASS=your-app-password
   
   # Notification Recipients
   ADMIN_EMAIL=admin@fleetstudio.com
   HR_EMAIL=hr@fleetstudio.com
   
   # Monitoring Configuration
   MINIMUM_HOURS_THRESHOLD=32
   ALERT_ON_PARTIAL_SUBMISSION=true
   ALERT_ON_NO_SUBMISSION=true
   ```

## Usage

### Start the Monitoring System

```bash
npm start
```

The system will:
- Start monitoring for scheduled times (Monday 12 PM & 5 PM)
- Display configuration information
- Run continuously until stopped

### Test the System

```bash
npm test
```

This will:
- Run a one-time check of the previous week's timesheets
- Show analysis results
- Send test notifications (if configured)

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `TIMESHEET_API_URL` | API endpoint for timesheet data | Production API |
| `MINIMUM_HOURS_THRESHOLD` | Minimum hours required per week | 32 |
| `ALERT_ON_PARTIAL_SUBMISSION` | Alert for incomplete timesheets | true |
| `ALERT_ON_NO_SUBMISSION` | Alert for missing timesheets | true |
| `SMTP_HOST` | Email server hostname | smtp.gmail.com |
| `SMTP_PORT` | Email server port | 587 |
| `SMTP_USER` | Email username | - |
| `SMTP_PASS` | Email password/app password | - |
| `ADMIN_EMAIL` | Admin notification email | - |
| `HR_EMAIL` | HR notification email | - |

## How It Works

### 1. **Scheduling**
- Uses `node-cron` to schedule tasks
- Runs every Monday at 12:00 PM and 5:00 PM (IST)
- Automatically calculates previous week's date range

### 2. **Data Fetching**
- Connects to Fleet Studio timesheet API
- Fetches all employee data for the previous week
- Handles API errors gracefully

### 3. **Analysis**
- **No Submission**: Employees with 0 hours logged
- **Partial Submission**: Employees with less than minimum threshold
- **Flagged Hours**: Employees with flagged timesheet entries
- Skips inactive employees

### 4. **Notifications**
- Sends HTML email reports to admin and HR
- Includes detailed employee information
- Only sends notifications when issues are found

## Email Report Format

The system generates detailed HTML email reports including:

- **Summary**: Total employees, issues count
- **No Submission**: List of employees with 0 hours
- **Partial Submission**: List of employees with incomplete timesheets
- **Flagged Hours**: List of employees with flagged entries

## Monitoring and Logs

The system provides comprehensive logging:

```
🔄 Starting timesheet monitoring check...
📅 Checking week 36: 2024-09-01 to 2024-09-07
📊 Fetching timesheet data for 2024-09-01 to 2024-09-07
✅ Successfully fetched 45 employee records
📊 Analysis Complete:
   - Total Employees: 45
   - No Submission: 3
   - Partial Submission: 2
   - Flagged Hours: 1
📧 Sending notification for 6 issues...
✅ Email notification sent successfully
✅ Timesheet monitoring check completed successfully
```

## Deployment

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start timesheet-monitor.js --name "timesheet-monitor"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Option 2: System Service

Create a systemd service file:

```ini
[Unit]
Description=Timesheet Monitoring System
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/timesheet-monitor
ExecStart=/usr/bin/node timesheet-monitor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "timesheet-monitor.js"]
```

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check if the timesheet API is accessible
   - Verify the API URL in configuration
   - Check network connectivity

2. **Email Not Sent**
   - Verify SMTP credentials
   - Check if app passwords are enabled for Gmail
   - Test email configuration manually

3. **Cron Jobs Not Running**
   - Check system timezone settings
   - Verify the cron schedule syntax
   - Ensure the process is running

### Testing Email Configuration

```bash
# Test email sending
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});
transporter.sendMail({
  from: 'your-email@gmail.com',
  to: 'test@example.com',
  subject: 'Test Email',
  text: 'This is a test email'
}).then(console.log).catch(console.error);
"
```

## Security Considerations

- Store sensitive configuration in environment variables
- Use app passwords for Gmail authentication
- Restrict file permissions on configuration files
- Monitor system logs for any suspicious activity

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify configuration settings
3. Test individual components using the test script
4. Contact the IT team for assistance

## License

MIT License - See LICENSE file for details
