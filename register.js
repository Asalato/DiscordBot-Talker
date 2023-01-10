const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('node:fs');
require('dotenv').config();

const commands = [];
if (fs.existsSync('./commands')) {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if (command.data) commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

module.exports = {
    registerCommands: async (guildId) => {
        try {
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
                {body: commands},
            );

            console.log(`Successfully reloaded application (/) commands to guild-${guildId}`);
        } catch (error) {
            console.error(error);
        }
    }
}
