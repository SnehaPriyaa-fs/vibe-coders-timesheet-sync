const axios = require('axios');

// Test script for the holiday timesheet posting endpoint
async function testHolidayEndpoint() {
    const apiUrl = 'http://localhost:3000/api/post-holiday';
    
    // Test data based on your requirements
    const holidayData = {
        projectName: '00-Holiday',
        taskName: 'Holiday/Leave',
        entryDate: '2025-10-08',
        ticketNumber: 'NIL',
        timeSpent: 8,
        details: 'Holiday',
        userId: 'YOUR_USER_ID_HERE' // Replace with actual user ID
    };

    try {
        console.log('🧪 Testing holiday timesheet endpoint...');
        console.log('📝 Test data:', JSON.stringify(holidayData, null, 2));
        
        const response = await axios.post(apiUrl, holidayData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing holiday endpoint:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

// Run the test
if (require.main === module) {
    console.log('🚀 Starting holiday timesheet test...');
    console.log('⚠️  Make sure the API server is running on port 3000');
    console.log('⚠️  Update the userId in the test data before running');
    console.log('');
    
    testHolidayEndpoint();
}

module.exports = { testHolidayEndpoint };
