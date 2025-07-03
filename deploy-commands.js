// Filename: deploy-commands.js

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
	new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Verifies your Roblox account with a code.')
		.addStringOption(option =>
			option.setName('code')
				.setDescription('The 6-digit code you received in-game.')
				.setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
        return console.error("Error: Missing required environment variables (DISCORD_BOT_TOKEN, CLIENT_ID, or GUILD_ID).");
    }
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error("Failed to deploy commands:", error);
	}
})();