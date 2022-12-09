const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const {registerCommands} = require("./register");
const GuildStore = require("./guildStore");
const {temporaryMethodThatGetMessageByFetchingLatestChannelPost} = require("./utils");
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, async (...args) => await event.execute(client, ...args));
    } else {
        client.on(event.name, async (...args) => await event.execute(client, ...args));
    }
}

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
    await registerCommands(id);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return false;
    await temporaryMethodThatGetMessageByFetchingLatestChannelPost(message);
    console.log(`${message.author.tag} in #${message.channel.name} send a message: ${message.content} at ${message.createdAt.toLocaleString()}`);
});

(async () => {
    const ids = await GuildStore.getAllIds();
    for (const id of ids) {
        await registerCommands(id);
    }
})();

client.login(process.env.DISCORD_TOKEN);
