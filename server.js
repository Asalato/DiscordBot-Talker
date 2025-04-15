import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'node:path';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import register from "./register.js";
import GuildStore from "./guildStore.js";
import HealthCheckServer from './HealthCheckServer.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ 
    autoReconnect: true,
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] 
});
client.commands = new Collection();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (command.data) client.commands.set(command.data.name, command);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    import(pathToFileURL(path.join(eventsPath, file)).href).then(event => {
        if (!event.default.name) return;
        if (event.default.once) {
            client.once(event.default.name, async (...args) => await event.default.execute(client, ...args));
        } else {
            client.on(event.default.name, async (...args) => await event.default.execute(client, ...args));
        }
    })
}

const healthCheck = new HealthCheckServer(client);

client.once('ready', async () => {
    try {
        await healthCheck.start();
        console.log('Health check server started');
    } catch (error) {
        console.error('Failed to start health check server:', error);
    }
});

client.on('interactionCreate', async interaction => {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction: ${interaction.commandName}`);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.on('guildCreate', async guild => {
    const { id } = guild;
    await GuildStore.setId(id);
    await register.registerCommands(id);
});

(async () => {
    const ids = await GuildStore.getAllIds();
    for (const id of ids) {
        await register.registerCommands(id);
    }
})();

client.login(process.env.DISCORD_TOKEN);
