// Filename: index.js

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

// --- "Database" (In-memory storage) ---
const verificationCodes = new Map(); // Stores: { code -> robloxId }
const verifiedUsers = new Map();     // Stores: { robloxId -> discordId }

// --- Discord Bot Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => console.log(`Bot ${client.user.tag} is ready!`));

// Listen for the slash command from Discord
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'verify') return;

    const code = interaction.options.getString('code');
    const discordId = interaction.user.id;
    const discordTag = interaction.user.tag;

    await interaction.deferReply({ ephemeral: true });

    // The bot will talk to its own web server to process the code.
    // On Render, the server runs on a specific port provided by the PORT env var.
    // Internally, we can still think of it as localhost.
    try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/submit-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discordId, discordTag })
        });
        const data = await res.json();

        if (data.status === 'success') {
            await interaction.editReply('✅ Success! Your account is now verified.');
        } else {
            await interaction.editReply(`❌ Error: ${data.message}`);
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('❌ An internal error occurred. Please try again later.');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);


// --- Web Server Setup ---
const app = express();
const PORT = process.env.PORT || 3000; // Use port provided by Render or default to 3000
app.use(express.json());

// A simple home page to know the server is running
app.get('/', (req, res) => {
  res.send('Verification server is online! Your bot should be ready.');
});

// Endpoint for Roblox to request a new verification code
app.post('/generate-code', (req, res) => {
    const { robloxId } = req.body;
    if (!robloxId) {
        return res.status(400).json({ status: 'error', message: 'Roblox ID not provided.' });
    }

    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (verificationCodes.has(code));

    verificationCodes.set(code, robloxId);
    console.log(`Generated code ${code} for Roblox ID ${robloxId}`);

    // Codes expire after 5 minutes
    setTimeout(() => {
        if (verificationCodes.get(code) === robloxId) {
            verificationCodes.delete(code);
            console.log(`Code ${code} for ${robloxId} expired.`);
        }
    }, 300000);

    res.status(200).json({ status: 'success', code: code });
});

// Endpoint for the Discord bot to submit the code for verification
app.post('/submit-code', (req, res) => {
    const { code, discordId, discordTag } = req.body;
    
    if (!verificationCodes.has(code)) {
        return res.status(200).json({ status: 'failure', message: 'Invalid or expired code.' });
    }

    const robloxId = verificationCodes.get(code);

    verifiedUsers.set(robloxId.toString(), discordId);
    verificationCodes.delete(code);

    console.log(`SUCCESS: Roblox ID ${robloxId} linked to Discord User ${discordTag} (${discordId})`);
    res.status(200).json({ status: 'success', message: 'Verification successful.' });
});

// Endpoint for Roblox to check if a player is verified (e.g., when they join)
app.get('/check-status/:robloxId', (req, res) => {
    const { robloxId } = req.params;
    if (verifiedUsers.has(robloxId)) {
        res.json({ verified: true, discordId: verifiedUsers.get(robloxId) });
    } else {
        res.json({ verified: false });
    }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));