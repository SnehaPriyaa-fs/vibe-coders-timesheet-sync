const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

class TimesheetAPI {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.apiUrl = process.env.TIMESHEET_API_URL || 'https://timesheet-be.fleetstudio.com/api/user/reports/filter';
        this.minimumHours = parseInt(process.env.MINIMUM_HOURS_THRESHOLD) || 32;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                service: 'Timesheet Monitor API'
            });
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

    start() {
        this.app.listen(this.port, () => {
            console.log(' Timesheet Monitor API Server Started');
            console.log(` App is running on port ${this.port}`);
            console.log(` Health check: http://localhost:${this.port}/health`);
            console.log('');
            console.log('🔧 Ready for N8N integration!');
        });
    }
}

if (require.main === module) {
    const api = new TimesheetAPI();
    api.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        process.exit(0);
    });
}

module.exports = TimesheetAPI;
