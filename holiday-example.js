const axios = require('axios');

/**
 * Example script showing how to post a holiday timesheet entry
 * using the new /api/post-holiday endpoint
 */

async function postHolidayEntry() {
    const apiUrl = 'http://localhost:3000/api/post-holiday';
    
    // Your exact requirements
    const holidayEntry = {
        projectName: '00-Holiday',
        taskName: 'Holiday/Leave', 
        entryDate: '2025-10-08',
        ticketNumber: 'NIL',
        timeSpent: 8,
        details: 'Holiday',
        userId: 'YOUR_USER_ID_HERE' // You need to provide the actual user ID
    };

    try {
        console.log('📅 Posting holiday timesheet entry...');
        console.log('📊 Entry details:');
        console.log(`   Project: ${holidayEntry.projectName}`);
        console.log(`   Task: ${holidayEntry.taskName}`);
        console.log(`   Date: ${holidayEntry.entryDate}`);
        console.log(`   Hours: ${holidayEntry.timeSpent}`);
        console.log(`   Details: ${holidayEntry.details}`);
        console.log('');

        const response = await axios.post(apiUrl, holidayEntry, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('✅ Holiday entry posted successfully!');
        console.log('📋 Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Failed to post holiday entry:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error('   No response received. Is the API server running?');
            console.error(`   Make sure the server is running on: ${apiUrl}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
    }
}

/**
 * Example with minimal required fields (uses defaults)
 */
async function postHolidayEntryMinimal() {
    const apiUrl = 'http://localhost:3000/api/post-holiday';
    
    // Minimal required fields - others will use defaults
    const minimalEntry = {
        entryDate: '2025-10-08',
        userId: 'YOUR_USER_ID_HERE'
    };

    try {
        console.log('📅 Posting minimal holiday entry...');
        
        const response = await axios.post(apiUrl, minimalEntry, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('✅ Minimal holiday entry posted successfully!');
        console.log('📋 Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Failed to post minimal holiday entry:', error.message);
    }
}

// Usage examples
if (require.main === module) {
    console.log('🎯 Holiday Timesheet Posting Examples');
    console.log('=====================================');
    console.log('');
    console.log('Before running this script:');
    console.log('1. Start the API server: node timesheet-api.js');
    console.log('2. Update the userId in the script with your actual user ID');
    console.log('3. Run: node holiday-example.js');
    console.log('');
    
    // Uncomment the function you want to test:
    // postHolidayEntry();
    // postHolidayEntryMinimal();
    
    console.log('💡 Uncomment one of the functions above to test the endpoint');
}

module.exports = { postHolidayEntry, postHolidayEntryMinimal };
