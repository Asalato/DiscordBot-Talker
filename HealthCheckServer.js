import { Client } from 'discord.js';
import net from 'net';

export default class HealthCheckServer {
    constructor(client, botMaxLatency = 0.5) {
        this.client = client;
        this.botMaxLatency = botMaxLatency;
    }

    handleSocketClient(socket) {
        let message = 'healthy';

        // Check bot's health status
        if (
            this.client.ws.ping > this.botMaxLatency * 1000 || // Latency too high (convert to ms)
            !this.client.user || // Not logged in
            !this.client.isReady() || // Client's internal cache not ready
            this.client.ws.status === 6 // WebSocket closed (6 = WebSocket.CLOSED)
        ) {
            message = 'unhealthy';
        }

        socket.write(message);
        socket.end();
    }

    start(port = 40404) {
        const server = net.createServer((socket) => {
            this.handleSocketClient(socket);
        });

        return new Promise((resolve, reject) => {
            server.listen(port, '127.0.0.1', () => {
                console.log(`Health check server listening on port ${port}`);
                resolve(server);
            });

            server.on('error', (err) => {
                reject(err);
            });
        });
    }
}

// 使用例:
/*
const client = new Client({
    intents: [...] // 必要なintentsを指定
});

const healthCheck = new HealthCheckServer(client);

client.once('ready', async () => {
    try {
        await healthCheck.start();
        console.log('Health check server started');
    } catch (error) {
        console.error('Failed to start health check server:', error);
    }
});

client.login('YOUR_BOT_TOKEN');
*/