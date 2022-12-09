const {SlashCommandBuilder} = require("discord.js");
const ky = require('ky-universal');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dog')
        .setDescription('犬が出ます'),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        await interaction.deferReply();

        const res = await ky.get("https://api.thedogapi.com/v1/images/search?size=small").json();

        await interaction.editReply({files: [res[0].url]});
    },
};
