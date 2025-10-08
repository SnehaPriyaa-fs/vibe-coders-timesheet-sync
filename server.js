const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

class TimesheetAPI {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.apiUrl = process.env.TIMESHEET_API_URL || 'https://timesheet-be.fleetstudio.com/api/user/reports/filter';
        this.minimumHours = parseInt(process.env.MINIMUM_HOURS_THRESHOLD) || 32;
        
        // Email configuration
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        this.adminEmail = process.env.ADMIN_EMAIL || 'admin@fleetstudio.com';
        this.hrEmail = process.env.HR_EMAIL || 'hr@fleetstudio.com';
        
        // Slack configuration
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.slackChannel = process.env.SLACK_CHANNEL || '#timesheet-alerts';
        this.slackUser = process.env.SLACK_USER || '<@U0935J5RUG3>'; // Default user from the URL you provided
        
        // Slack Bot configuration for direct messages
        this.slackBotToken = process.env.SLACK_BOT_TOKEN;
        this.slackAppToken = process.env.SLACK_APP_TOKEN;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                service: 'Timesheet Monitor API'
            });
        });

        // Serve holiday timesheet UI
        this.app.get('/holiday-ui', (req, res) => {
            res.sendFile(__dirname + '/holiday-timesheet-ui.html');
        });

        // Get previous week's date range
        this.app.get('/api/week-info', (req, res) => {
            try {
                const weekInfo = this.getPreviousWeekRange();
                res.json({
                    success: true,
                    data: weekInfo
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

       this.app.post('/api/missing-by-day', async (req, res) => {
            try {
                const { startDate, endDate, previousWeek = false } = req.body;

                let range;
                if (previousWeek) {
                    range = this.getPreviousWeekRange();
                } else if (!startDate || !endDate) {
                    return res.status(400).json({
                        success: false,
                        error: 'Either provide startDate and endDate, or set previousWeek to true'
                    });
                } else {
                    range = { startDate, endDate };
                }

                const daily = await this.analyzeTimesheetDataByWorkingDays(range.startDate, range.endDate);

                // Build per-employee map of missed days
                const userIdToSummary = new Map();

                daily.dailyAnalysis.forEach(day => {
                    if (!day.analysis) return;
                    const missed = day.analysis.noSubmission || [];
                    missed.forEach(emp => {
                        if (!userIdToSummary.has(emp.userId)) {
                            userIdToSummary.set(emp.userId, {
                                name: emp.name,
                                userId: emp.userId,
                                email: emp.email || 'N/A',
                                employementStatus: emp.employementStatus,
                                daysWithNoSubmission: [],
                            });
                        }
                        const entry = userIdToSummary.get(emp.userId);
                        entry.daysWithNoSubmission.push({ date: day.date, dayName: day.dayName });
                    });
                });

                const result = Array.from(userIdToSummary.values())
                    .map(emp => ({
                        ...emp,
                        totalDaysMissed: emp.daysWithNoSubmission.length
                    }))
                    .sort((a, b) => b.totalDaysMissed - a.totalDaysMissed || a.name.localeCompare(b.name));

                res.json({
                    success: true,
                    data: {
                        weekInfo: {
                            ...daily.weekInfo
                        },
                        workingDays: daily.workingDays,
                        summary: result,
                        totalEmployeesWithMisses: result.length,
                        analyzedAt: new Date().toISOString()
                    }
                });
            } catch (error) {
                console.error(' Error in missing-by-day:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Post holiday timesheet entry
        // this.app.post('/api/post-holiday', async (req, res) => {
        //     try {
        //         const { 
        //             projectName = '00-Holiday', 
        //             taskName = 'Holiday/Leave', 
        //             entryDate, 
        //             ticketNumber = 'NIL', 
        //             timeSpent = 8, 
        //             details = 'Holiday',
        //             userId 
        //         } = req.body;
                
        //         if (!entryDate) {
        //             return res.status(400).json({
        //                 success: false,
        //                 error: 'entryDate is required'
        //             });
        //         }

        //         if (!userId) {
        //             return res.status(400).json({
        //                 success: false,
        //                 error: 'userId is required'
        //             });
        //         }

        //         // Create the timesheet entry payload
        //         const timesheetEntry = {
        //             title: `${projectName}-${taskName}-${Date.now()}`,
        //             uid: userId,
        //             field_entrydate: entryDate,
        //             field_ticket_number: ticketNumber,
        //             field_proj: projectName, // Using project name as project ID for holiday
        //             field_entrytask: taskName,
        //             body: details,
        //             field_time_spent: timeSpent.toString()
        //         };

        //         // Post to the timesheet API
        //         const response = await this.postTimesheetEntry(timesheetEntry);
                
        //         res.json({
        //             success: true,
        //             message: 'Holiday timesheet entry posted successfully',
        //             data: {
        //                 entryDate,
        //                 timeSpent,
        //                 projectName,
        //                 taskName,
        //                 details,
        //                 timesheetId: response.id || 'N/A'
        //             }
        //         });
                
        //     } catch (error) {
        //         console.error(' Error posting holiday entry:', error.message);
        //         res.status(500).json({
        //             success: false,
        //             error: error.message
        //         });
        //     }
        // });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error(' Unhandled error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });
    }

    /**
     * Get the previous week's date range
     */
    getPreviousWeekRange() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Get last Monday
        const lastMonday = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
        lastMonday.setDate(today.getDate() - daysToSubtract - 7);
        
        // Get last Sunday
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        
        return {
            startDate: this.formatDate(lastMonday),
            endDate: this.formatDate(lastSunday),
            weekNumber: this.getWeekNumber(lastMonday)
        };
    }

    /**
     * Format date to YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get week number of the year
     */
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    /**
     * Generate sample user data for testing
     */
    generateSampleUserData(startDate, endDate) {
        // Create multiple sample users with different scenarios
        const sampleUsers = [
            {
                name: "Sneha Priyaa",
                userId: "SAMPLE001",
                email: "sneha.priyaa@fleetstudio.com",
                allocatedHours: 40,
                loggedHours: 0, // No submission for testing
                flaggedHours: 0,
                isActive: true,
                employementStatus: "Full-time",
                department: "Engineering",
                manager: "John Manager",
                joinDate: "2023-01-15",
                lastLogin: "2025-09-20",
                timesheetStatus: "Not Submitted",
                weekStart: startDate,
                weekEnd: endDate,
                sampleData: true
            },
            {
                name: "Test User - Partial Submission",
                userId: "SAMPLE002",
                email: "test.partial@fleetstudio.com",
                allocatedHours: 40,
                loggedHours: 25, // Partial submission
                flaggedHours: 0,
                isActive: true,
                employementStatus: "Full-time",
                department: "Design",
                manager: "Jane Manager",
                joinDate: "2023-06-01",
                lastLogin: "2025-09-21",
                timesheetStatus: "Partially Submitted",
                weekStart: startDate,
                weekEnd: endDate,
                sampleData: true
            },
            {
                name: "Test User - Flagged Hours",
                userId: "SAMPLE003",
                email: "test.flagged@fleetstudio.com",
                allocatedHours: 40,
                loggedHours: 40,
                flaggedHours: 8, // Flagged hours
                isActive: true,
                employementStatus: "Full-time",
                department: "Marketing",
                manager: "Bob Manager",
                joinDate: "2023-03-15",
                lastLogin: "2025-09-22",
                timesheetStatus: "Submitted with Flags",
                weekStart: startDate,
                weekEnd: endDate,
                sampleData: true
            }
        ];

        return sampleUsers;
    }

    /**
     * Fetch timesheet data from API
     */
    async fetchTimesheetData(startDate, endDate) {
        try {
            
            const response = await axios.get(`${this.apiUrl}/${startDate}/${endDate}`, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'TimesheetMonitor-API/1.0'
                }
            });

            if (response.status === 200) {
                
                // Add sample user data
                const sampleUsers = this.generateSampleUserData(startDate, endDate);
                const dataWithSample = [...response.data, ...sampleUsers];             
                
                return dataWithSample;
            } else {
                throw new Error(`API returned status ${response.status}`);
            }
        } catch (error) {
            console.error(' Error fetching timesheet data:', error.message);
            throw error;
        }
    }

    /**
     * Analyze timesheet data and identify issues for a specific day
     */
    analyzeTimesheetData(timesheetData, targetDate = null) {
        const issues = {
            noSubmission: [],
            partialSubmission: [],
            flaggedHours: [],
            totalEmployees: timesheetData.length,
            analyzedAt: new Date().toISOString(),
            targetDate: targetDate
        };

        timesheetData.forEach(employee => {
            const { name, userId, email, loggedHours, allocatedHours, flaggedHours, isActive, employementStatus } = employee;
            
            // Skip inactive employees
            if (!isActive) {
                return;
            }

            // Check for no submission (0 hours logged for the day)
            if (loggedHours === 0) {
                issues.noSubmission.push({
                    name,
                    userId,
                    email: email || 'N/A',
                    allocatedHours,
                    loggedHours,
                    employementStatus,
                    issue: targetDate ? `No timesheet submission for ${targetDate}` : 'No timesheet submission'
                });
            }

            // Check for flagged hours
            if (flaggedHours > 0) {
                issues.flaggedHours.push({
                    name,
                    userId,
                    email: email || 'N/A',
                    flaggedHours,
                    loggedHours,
                    issue: 'Timesheet has flagged hours requiring review'
                });
            }
        });

        return issues;
    }

    /**
     * Get all working days (Monday to Friday) for a given week
     */
    getWorkingDaysForWeek(startDate, endDate) {
        const workingDays = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.getDay();
            // Monday = 1, Tuesday = 2, ..., Friday = 5
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                workingDays.push(this.formatDate(date));
            }
        }
        
        return workingDays;
    }

    /**
     * Analyze timesheet data for each working day of the week
     */
    async analyzeTimesheetDataByWorkingDays(startDate, endDate) {
        const workingDays = this.getWorkingDaysForWeek(startDate, endDate);
        const dailyAnalysis = [];
        
        for (const day of workingDays) {
            try {
                
                // Fetch timesheet data for this specific day
                const timesheetData = await this.fetchTimesheetData(day, day);
                
                // Analyze data for this day
                const analysis = this.analyzeTimesheetData(timesheetData, day);
                
                dailyAnalysis.push({
                    date: day,
                    dayName: this.getDayName(day),
                    analysis,
                    totalEmployees: timesheetData.length,
                    issuesFound: analysis.noSubmission.length + analysis.flaggedHours.length
                });
                
            } catch (error) {
                console.error(` Error analyzing ${day}:`, error.message);
                dailyAnalysis.push({
                    date: day,
                    dayName: this.getDayName(day),
                    error: error.message,
                    analysis: null
                });
            }
        }
        
        return {
            weekInfo: {
                startDate,
                endDate,
                weekNumber: this.getWeekNumber(new Date(startDate))
            },
            workingDays,
            dailyAnalysis,
            totalDaysAnalyzed: workingDays.length,
            analyzedAt: new Date().toISOString()
        };
    }

    /**
     * Get day name from date string
     */
    getDayName(dateString) {
        const date = new Date(dateString);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }

    /**
     * Create summary analysis from daily analysis for notifications
     */
    createSummaryAnalysis(dailyAnalysis) {
        const summary = {
            noSubmission: [],
            partialSubmission: [], // Not used in daily analysis
            flaggedHours: [],
            totalEmployees: 0,
            analyzedAt: new Date().toISOString()
        };

        // Collect all unique employees with issues across all days
        const employeeIssues = new Map();

        dailyAnalysis.dailyAnalysis.forEach(day => {
            if (day.analysis) {
                // Add no submission employees
                day.analysis.noSubmission.forEach(emp => {
                    const key = emp.userId;
                    if (!employeeIssues.has(key)) {
                        employeeIssues.set(key, {
                            ...emp,
                            daysWithIssues: [],
                            totalDaysWithNoSubmission: 0
                        });
                    }
                    const employee = employeeIssues.get(key);
                    employee.daysWithIssues.push(day.date);
                    employee.totalDaysWithNoSubmission++;
                });

                // Add flagged hours employees
                day.analysis.flaggedHours.forEach(emp => {
                    const key = emp.userId;
                    if (!employeeIssues.has(key)) {
                        employeeIssues.set(key, {
                            ...emp,
                            daysWithIssues: [],
                            totalDaysWithNoSubmission: 0
                        });
                    }
                    const employee = employeeIssues.get(key);
                    if (!employee.daysWithIssues.includes(day.date)) {
                        employee.daysWithIssues.push(day.date);
                    }
                });

                // Update total employees count
                summary.totalEmployees = Math.max(summary.totalEmployees, day.totalEmployees);
            }
        });

        // Convert map to arrays
        employeeIssues.forEach(employee => {
            if (employee.totalDaysWithNoSubmission > 0) {
                summary.noSubmission.push({
                    ...employee,
                    issue: `No timesheet submission for ${employee.totalDaysWithNoSubmission} day(s): ${employee.daysWithIssues.join(', ')}`
                });
            }
            if (employee.flaggedHours > 0) {
                summary.flaggedHours.push({
                    ...employee,
                    issue: `Flagged hours on ${employee.daysWithIssues.length} day(s): ${employee.daysWithIssues.join(', ')}`
                });
            }
        });

        return summary;
    }

    /**
     * Generate email report
     */
    generateEmailReport(issues, weekInfo) {
        const { startDate, endDate, weekNumber } = weekInfo;
        
        let htmlContent = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background-color: #f4f4f4; padding: 15px; border-radius: 5px; }
                .section { margin: 20px 0; }
                .issue-list { background-color: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
                .employee { background-color: #f8f9fa; padding: 8px; margin: 5px 0; border-radius: 3px; }
                .summary { background-color: #d1ecf1; padding: 15px; border-radius: 5px; }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2> Weekly Timesheet Monitoring Report</h2>
                <p><strong>Week:</strong> ${weekNumber} (${startDate} to ${endDate})</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div class="summary">
                <h3> Summary</h3>
                <ul>
                    <li><strong>Total Employees:</strong> ${issues.totalEmployees}</li>
                    <li><strong>No Submission:</strong> ${issues.noSubmission.length}</li>
                    <li><strong>Partial Submission:</strong> ${issues.partialSubmission.length}</li>
                    <li><strong>Flagged Hours:</strong> ${issues.flaggedHours.length}</li>
                </ul>
            </div>
        `;

        // No submission section
        if (issues.noSubmission.length > 0) {
            htmlContent += `
                <div class="section">
                    <h3>No Timesheet Submission (${issues.noSubmission.length} employees)</h3>
                    <div class="issue-list">
            `;
            issues.noSubmission.forEach(emp => {
                htmlContent += `
                    <div class="employee">
                        <strong>${emp.name}</strong> (${emp.employementStatus})<br>
                        <small>User ID: ${emp.userId} | Allocated: ${emp.allocatedHours}h | Logged: ${emp.loggedHours}h</small>
                    </div>
                `;
            });
            htmlContent += `</div></div>`;
        }

        // Partial submission section
        if (issues.partialSubmission.length > 0) {
            htmlContent += `
                <div class="section">
                    <h3> Incomplete Timesheet Submission (${issues.partialSubmission.length} employees)</h3>
                    <div class="issue-list">
            `;
            issues.partialSubmission.forEach(emp => {
                htmlContent += `
                    <div class="employee">
                        <strong>${emp.name}</strong> (${emp.employementStatus})<br>
                        <small>User ID: ${emp.userId} | Allocated: ${emp.allocatedHours}h | Logged: ${emp.loggedHours}h | Shortfall: ${emp.shortfall}h</small>
                    </div>
                `;
            });
            htmlContent += `</div></div>`;
        }

        // Flagged hours section
        if (issues.flaggedHours.length > 0) {
            htmlContent += `
                <div class="section">
                    <h3> Flagged Hours Requiring Review (${issues.flaggedHours.length} employees)</h3>
                    <div class="issue-list">
            `;
            issues.flaggedHours.forEach(emp => {
                htmlContent += `
                    <div class="employee">
                        <strong>${emp.name}</strong><br>
                        <small>User ID: ${emp.userId} | Flagged Hours: ${emp.flaggedHours}h | Total Logged: ${emp.loggedHours}h</small>
                    </div>
                `;
            });
            htmlContent += `</div></div>`;
        }

        htmlContent += `
            <div class="footer">
                <p>This is an automated report generated by the Timesheet Monitoring System.</p>
                <p>For questions or issues, please contact the IT team.</p>
            </div>
        </body>
        </html>
        `;

        return htmlContent;
    }

    /**
     * Send Slack notification
     */
    async sendSlackNotification(issues, weekInfo) {
        if (!this.slackWebhookUrl) {
            return;
        }

        try {
            const { startDate, endDate, weekNumber } = weekInfo;
            const totalIssues = issues.noSubmission.length + issues.partialSubmission.length + issues.flaggedHours.length;
            
            let slackMessage = {
                channel: this.slackChannel,
                username: "Timesheet Monitor",
                icon_emoji: ":chart_with_upwards_trend:",
                text: ` Weekly Timesheet Report - Week ${weekNumber}`,
                attachments: [
                    {
                        color: totalIssues > 0 ? "warning" : "good",
                        fields: [
                            {
                                title: "Week Period",
                                value: `${startDate} to ${endDate}`,
                                short: true
                            },
                            {
                                title: "Total Employees",
                                value: issues.totalEmployees.toString(),
                                short: true
                            },
                            {
                                title: "No Submission",
                                value: issues.noSubmission.length.toString(),
                                short: true
                            },
                            {
                                title: "Partial Submission",
                                value: issues.partialSubmission.length.toString(),
                                short: true
                            },
                            {
                                title: "Flagged Hours",
                                value: issues.flaggedHours.length.toString(),
                                short: true
                            }
                        ],
                        footer: "Timesheet Monitoring System",
                        ts: Math.floor(Date.now() / 1000)
                    }
                ]
            };

            // Add detailed issues if any exist
            if (totalIssues > 0) {
                let issueDetails = [];
                
                // No submission details
                if (issues.noSubmission.length > 0) {
                    issueDetails.push({
                        title: `No Timesheet Submission (${issues.noSubmission.length})`,
                        value: issues.noSubmission.slice(0, 5).map(emp => 
                            `• ${emp.name} (${emp.employementStatus}) - ${emp.loggedHours}h logged`
                        ).join('\n') + (issues.noSubmission.length > 5 ? `\n... and ${issues.noSubmission.length - 5} more` : ''),
                        short: false
                    });
                }

                // Partial submission details
                if (issues.partialSubmission.length > 0) {
                    issueDetails.push({
                        title: ` Incomplete Submission (${issues.partialSubmission.length})`,
                        value: issues.partialSubmission.slice(0, 5).map(emp => 
                            `• ${emp.name} (${emp.employementStatus}) - ${emp.loggedHours}h logged (${emp.shortfall}h short)`
                        ).join('\n') + (issues.partialSubmission.length > 5 ? `\n... and ${issues.partialSubmission.length - 5} more` : ''),
                        short: false
                    });
                }

                // Flagged hours details
                if (issues.flaggedHours.length > 0) {
                    issueDetails.push({
                        title: ` Flagged Hours (${issues.flaggedHours.length})`,
                        value: issues.flaggedHours.slice(0, 5).map(emp => 
                            `• ${emp.name} - ${emp.flaggedHours}h flagged`
                        ).join('\n') + (issues.flaggedHours.length > 5 ? `\n... and ${issues.flaggedHours.length - 5} more` : ''),
                        short: false
                    });
                }

                slackMessage.attachments[0].fields = slackMessage.attachments[0].fields.concat(issueDetails);
            }

            const response = await axios.post(this.slackWebhookUrl, slackMessage, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                console.log('Slack notification sent successfully');
            } else {
                console.log('Slack notification may not have been delivered');
            }
        } catch (error) {
            console.error('Error sending Slack notification:', error.message);
            throw error;
        }
    }

    /**
     * Send direct message to a specific Slack user
     */
    async sendSlackDM(userId, message) {
        if (!this.slackBotToken) {
            return false;
        }

        try {
            const response = await axios.post('https://slack.com/api/chat.postMessage', {
                channel: userId,
                text: message,
                as_user: false
            }, {
                headers: {
                    'Authorization': `Bearer ${this.slackBotToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.ok) {
                return true;
            } else {
                console.error(` Failed to send DM to ${userId}:`, response.data.error);
                return false;
            }
        } catch (error) {
            console.error(' Error sending Slack DM:', error.message);
            return false;
        }
    }

    /**
     * Send DMs to users with missing timesheets
     */
    async sendMissingTimesheetDMs(issues, weekInfo) {
        if (!this.slackBotToken) {
            return;
        }

        const { startDate, endDate, weekNumber } = weekInfo;
        const dmPromises = [];

        // Send DMs to users with no submission
        issues.noSubmission.forEach(employee => {
            const message = `*Timesheet Reminder*\n\nHi ${employee.name}!\n\nYou haven't submitted your timesheet for Week ${weekNumber} (${startDate} to ${endDate}).\n\nPlease submit your timesheet as soon as possible.\n\nIf you have any questions, please contact HR.\n\nThanks!`;
            
            dmPromises.push(
                this.sendSlackDM(employee.userId, message).catch(error => {
                    console.error(` Failed to send DM to ${employee.name}:`, error.message);
                })
            );
        });

        // Send DMs to users with partial submission
        issues.partialSubmission.forEach(employee => {
            const message = ` *Incomplete Timesheet Reminder*\n\nHi ${employee.name}!\n\nYour timesheet for Week ${weekNumber} (${startDate} to ${endDate}) is incomplete.\n\nYou've logged ${employee.loggedHours} hours but need ${employee.allocatedHours} hours.\n\nPlease complete your timesheet submission.\n\nThanks!`;
            
            dmPromises.push(
                this.sendSlackDM(employee.userId, message).catch(error => {
                    console.error(` Failed to send DM to ${employee.name}:`, error.message);
                })
            );
        });

        // Send DMs to users with flagged hours
        issues.flaggedHours.forEach(employee => {
            const message = ` *Flagged Hours Alert*\n\nHi ${employee.name}!\n\nYour timesheet for Week ${weekNumber} (${startDate} to ${endDate}) has ${employee.flaggedHours} flagged hours that require review.\n\nPlease review and correct any flagged entries.\n\nThanks!`;
            
            dmPromises.push(
                this.sendSlackDM(employee.userId, message).catch(error => {
                    console.error(` Failed to send DM to ${employee.name}:`, error.message);
                })
            );
        });

        await Promise.all(dmPromises);
    }

    /**
     * Send both email and Slack notifications
     */
    async sendAllNotifications(issues, weekInfo) {
        const notifications = [];
        
        // Send email notification
        notifications.push(
            this.sendNotification(issues, weekInfo).catch(error => {
                console.error(' Email notification failed:', error.message);
            })
        );
        
        // Send Slack notification
        notifications.push(
            this.sendSlackNotification(issues, weekInfo).catch(error => {
                console.error(' Slack notification failed:', error.message);
            })
        );
        
        // Send DMs to individual users
        notifications.push(
            this.sendMissingTimesheetDMs(issues, weekInfo).catch(error => {
                console.error(' Slack DMs failed:', error.message);
            })
        );
        
        await Promise.all(notifications);
    }

    /**
     * Post timesheet entry to the timesheet API
     */
    async postTimesheetEntry(timesheetEntry) {
        try {
            // Check if we're in mock mode
            const mockMode = process.env.MOCK_MODE === 'true';
            
            if (mockMode) {
                
                // Simulate a successful response
                return {
                    id: `mock-${Date.now()}`,
                    status: 'success',
                    message: 'Mock timesheet entry created successfully',
                    entry: timesheetEntry
                };
            }
            
            // Get the timesheet API URL from environment or use default
            const timesheetPostUrl = process.env.TIMESHEET_POST_URL || 'http://172.104.26.247:3999/api/create/timesheet';
            
            const response = await axios.post(timesheetPostUrl, [timesheetEntry], {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'TimesheetMonitor-API/1.0'
                }
            });

            if (response.status === 200 || response.status === 201) {
                return response.data;
            } else {
                throw new Error(`API returned status ${response.status}`);
            }
        } catch (error) {
            console.error(' Error posting timesheet entry:');
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
                throw new Error(`External API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error(`   No response received from: ${timesheetPostUrl}`);
                console.error(`   This might be a network issue or the API server is down`);
                throw new Error(`Network error: Unable to reach timesheet API at ${timesheetPostUrl}`);
            } else {
                console.error(`   Error: ${error.message}`);
                throw error;
            }
        }
    }

    /**
     * Start the API server
     */
    start() {
        this.app.listen(this.port, () => {
        });
    }
}

// Initialize and start the API server
if (require.main === module) {
    const api = new TimesheetAPI();
    api.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        process.exit(0);
    });
}

module.exports = TimesheetAPI;
