// healthcheck.js
import net from 'net';

const args = process.argv.slice(2);
const port = args.includes('--port') ? 
    parseInt(args[args.indexOf('--port') + 1]) : 40404;
const timeout = args.includes('--timeout') ? 
    parseInt(args[args.indexOf('--timeout') + 1]) : 10;

const client = new net.Socket();
client.setTimeout(timeout * 1000);

client.connect(port, '127.0.0.1', () => {
    console.log('Connected to health check server');
});

client.on('data', (data) => {
    if (data.toString() === 'healthy') {
        console.log('Healthy!');
        process.exit(0);
    } else {
        console.log('Not healthy');
        process.exit(1);
    }
});

client.on('timeout', () => {
    console.log('Connection timeout');
    process.exit(1);
});

client.on('error', (err) => {
    console.log('Exception:', err.message);
    process.exit(1);
});