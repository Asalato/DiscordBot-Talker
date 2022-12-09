const {SlashCommandBuilder} = require("discord.js");
const ky = require('ky-universal');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cat')
        .setDescription('猫が出ます'),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        await interaction.deferReply();

        const res = await ky.get("https://api.thecatapi.com/v1/images/search?size=small").json();

        await interaction.editReply({files: [res[0].url]});
    },
};
