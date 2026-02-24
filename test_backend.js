// Simple test to check backend connectivity
const http = require('http');

console.log('Testing backend connection...\n');

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/health',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('✅ Backend is responding!');
        console.log('Status Code:', res.statusCode);
        console.log('Response:', data);
        console.log('\nBackend is ready for training!');
    });
});

req.on('error', (error) => {
    console.error('❌ Backend is not running!');
    console.error('Error:', error.message);
    console.log('\nPlease start the backend with: npm run server');
});

req.end();
