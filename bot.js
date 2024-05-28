require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events, ChannelType, PermissionFlagsBits, EmbedBuilder, OverwriteType, ShardingManager} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const mongoUri = process.env.MONGO_URI;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const rest = new REST({ version: '9' }).setToken(token);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
});

const mongoClient = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
const validGenders = ['Female', 'Male', 'Non Binary', 'Trans F', 'Trans M'];
const validGendersPreference = ['Female', 'Male', 'Non Binary', 'Trans F', 'Trans M', 'All', 'all'];

function normalizeGender(input) {
    const lowerInput = input.toLowerCase();
    if (['female', 'f'].includes(lowerInput)) return 'Female';
    if (['male', 'm'].includes(lowerInput)) return 'Male';
    if (['trans f', 'transf', 'trans female', 'transfemale'].includes(lowerInput)) return 'Trans F';
    if (['trans m', 'transm', 'trans male', 'transmale'].includes(lowerInput)) return 'Trans M';
    if (['non binary', 'nonbinary', 'non-binary', 'non binary', 'nonbinary'].includes(lowerInput)) return 'Non Binary';
    return input; // Return the input as-is if it doesn't match any known patterns
}

const registrationEmbed = new EmbedBuilder()
    .setTitle('Blind Dating Rules')
    .setDescription('Here are the rules for participating in the Blind Date event:')
    .addFields(
        { name: '1. Asking for in real life information', value: 'Allowed however if the other user rejects it you are not allowed to force them.' },
        { name: '2. Server main rules', value: 'Also apply <#1212649444584067082>.' },
        { name: '3. Run /welp', value: 'To list all the commands.' },
        { name: '4. Pick roles', value: 'From <#1212657177773342750> for your dating partner to know more basic information about you.' },
        { name: '5. Pick kinks', value: 'From <#1212666865969659955>.' }
    )
    .setColor('#0099ff');

const commands = [
    {
        name: 'match',
        description: 'Find a match based on your gender preference',
    },
    {
        name: 'reject',
        description: 'Reject from your current match and delete the private channel',
    },
    {
        name: 'info',
        description: 'Get information about your current match',
    },
    {
        name: 'date',
        description: 'Confirm a successful date and start officially dating',
    },
    {
        name: 'welp',
        description: 'List all available commands',
    },
    {
        name: 'unmatch',
        description: 'End the current match and delete the private channel without rejecting',
    },
    {
        name: 'removequeue',
        description: 'Remove yourself from the matching queue',
    }
];


client.once('ready', async () => {
    console.log('Ready!');

    client.user.setActivity('https://anime--empire.web.app/', { type: 'PLAYING' });

    // Connect to MongoDB
    try {
        await mongoClient.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }

    try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Slash commands registered.');
    } catch (error) {
        console.error(error);
    }

    // Send a message with a button in the specified channel
    const channelId = '1241818135921688657'; // The channel ID where the message will be sent
    const channel = await client.channels.fetch(channelId);

    if (channel) {
        const messages = await channel.messages.fetch({ limit: 10 }); // Fetch the last 100 messages
        const messageExists = messages.some(msg => msg.embeds.length && msg.embeds[0].title === registrationEmbed.title);

        if (!messageExists) {
            const button = new ButtonBuilder()
                .setCustomId('openModal')
                .setLabel('REGISTER')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            await channel.send({ embeds: [registrationEmbed], components: [row] });
        } else {
            console.log('Message already exists in the channel.');
        }
    } else {
        console.error('Channel not found.');
    }
});

function isValidGender(gender) {
    return validGenders.includes(normalizeGender(gender));
}

// Function to get invalid preferences after normalization
function getInvalidPreferences(preferences) {
    return preferences.map(normalizeGender).filter(pref => !validGendersPreference.includes(pref));
}

async function safeSendMessage(userId, message) {
    try {
        const user = await client.users.fetch(userId);
        if (user) {
            console.log("User:", user); // This will only log if the user is defined
            await user.send(message);
        } else {
            console.error(`User with ID ${userId} not found.`);
        }
    } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
    }
}




client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isButton() && interaction.customId === 'openModal') {
            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const registrations = db.collection('registrations');
            
            const userData = await registrations.findOne({ userId });

            const modal = new ModalBuilder()
                .setCustomId('registration')
                .setTitle('Blind Date Registration');

            const name = new TextInputBuilder()
                .setCustomId('name')
                .setLabel("Your Name")
                .setStyle(TextInputStyle.Short)
                .setValue(userData ? userData.name : '');

            const age = new TextInputBuilder()
                .setCustomId('age')
                .setLabel("Your Age")
                .setStyle(TextInputStyle.Short)
                .setValue(userData ? userData.age : '');

            const gender = new TextInputBuilder()
                .setCustomId('gender')
                .setLabel("Your Gender")
                .setStyle(TextInputStyle.Short)
                .setValue(userData ? userData.gender : '');

            const genderPreference = new TextInputBuilder()
                .setCustomId('genderPreference')
                .setLabel("Your Gender Preference (comma-separated)")
                .setStyle(TextInputStyle.Short)
                .setValue(userData ? userData.genderPreference.join(', ') : '');

            const bio = new TextInputBuilder()
                .setCustomId('bio')
                .setLabel("Extra Information")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(userData ? userData.bio : '');

            modal.addComponents(
                new ActionRowBuilder().addComponents(name),
                new ActionRowBuilder().addComponents(age),
                new ActionRowBuilder().addComponents(gender),
                new ActionRowBuilder().addComponents(genderPreference),
                new ActionRowBuilder().addComponents(bio)
            );

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'registration') {
            await interaction.deferReply({ ephemeral: true });

            const name = interaction.fields.getTextInputValue('name');
            const age = interaction.fields.getTextInputValue('age');
            const gender = normalizeGender(interaction.fields.getTextInputValue('gender'));
            const genderPreference = interaction.fields.getTextInputValue('genderPreference');
            const bio = interaction.fields.getTextInputValue('bio');
            const userId = interaction.user.id;

            // Ensure user variable is properly scoped
            const user = interaction.user;

            if (!isValidGender(gender)) {
                await interaction.editReply({ content: 'Invalid gender entered. Please enter one of the following: Female, Male, Non Binary, Trans F, Trans M.' });
                return;
            }

            const preferences = genderPreference.split(',').map(pref => normalizeGender(pref.trim()));
            const invalidPreferences = getInvalidPreferences(preferences);

            if (invalidPreferences.length > 0) {
                await interaction.editReply({ content: `Invalid gender preferences entered: ${invalidPreferences.join(', ')}. Please enter one of the following: Female, Male, Non Binary, Trans F, Trans M, All.` });
                return;
            }

            try {
                const db = mongoClient.db('blind_date');
                const registrations = db.collection('registrations');
                const queue = db.collection('queue'); // Access the queue collection
                const matches = db.collection('matches'); // Define the matches collection here

                // Check if the user is already registered
                const existingRegistration = await registrations.findOne({ userId });

                if (existingRegistration) {
                    // Update the existing registration
                    await registrations.updateOne(
                        { userId },
                        {
                            $set: {
                                name,
                                age,
                                gender,
                                genderPreference: preferences,
                                bio
                            }
                        }
                    );

                    // Check if the user is in the queue and update their queue data as well
                    const isInQueue = await queue.findOne({ userId });
                    if (isInQueue) {
                        await queue.updateOne(
                            { userId },
                            {
                                $set: {
                                    name,
                                    gender,
                                    genderPreference: preferences,
                                    timestamp: new Date() // Optionally update the timestamp
                                }
                            }
                        );

                        // Check for potential matches in the queue after updating
                        const preference = preferences.includes('All') || preferences.includes('all') ? validGenders : preferences;
                        const match = await queue.findOne({
                            gender: { $in: preference },
                            genderPreference: { $in: [gender, 'All', 'all'] },
                            userId: { $ne: userId }
                        });

                        if (match) {
                            // Remove both users from the queue
                            await queue.deleteOne({ userId: userId });
                            await queue.deleteOne({ userId: match.userId });

                            // Create a private channel for the match
                            const guild = await client.guilds.fetch(guildId);
                            const category = guild.channels.cache.get('1241805059801743540'); // Fetch the category channel by its ID

                            const channel = await guild.channels.create({
                                name: `blind-date-${user.username}-${match.name}`, // Updated variable to use username instead of user
                                type: ChannelType.GuildText,
                                parent: category.id,
                                permissionOverwrites: [
                                    {
                                        id: guild.id,
                                        deny: [PermissionFlagsBits.ViewChannel],
                                        type: OverwriteType.Role
                                    },
                                    {
                                        id: userId,
                                        allow: [PermissionFlagsBits.ViewChannel],
                                        type: OverwriteType.Member
                                    },
                                    {
                                        id: match.userId,
                                        allow: [PermissionFlagsBits.ViewChannel],
                                        type: OverwriteType.Member
                                    },
                                ],
                            });

                            await matches.insertOne({
                                user1: userId,
                                user2: match.userId,
                                channelId: channel.id,
                                timestamp: new Date()
                            });

                            // Notify users about the new match
                            await safeSendMessage(userId, `A new match is available: ${match.name}.`);
                            await safeSendMessage(match.userId, `A new match is available: ${user.username}.`); // Updated variable to use username instead of user
                        }
                    }

                    await interaction.editReply({ content: 'Registration updated successfully! Your data has been updated.' });
                } else {
                    // Insert new registration
                    await registrations.insertOne({
                        userId,
                        name,
                        age,
                        gender,
                        genderPreference: preferences,
                        bio
                    });
                    await interaction.editReply({ content: 'Registration successful! Your data has been saved.' });
                }

            } catch (error) {
                console.error('Error saving registration data', error);
                await interaction.editReply({ content: 'There was an error saving your registration. Please try again later.' });
            }
        }
        
        

        if (interaction.isCommand() && interaction.commandName === 'welp') {
            await interaction.deferReply({ ephemeral: true });

            const helpMessage = "Available commands:\n\n" +
                "/match - Find a match based on your gender preference\n" +
                "/unmatch - End the current match and delete the private channel without rejecting\n" +
                "/reject - Reject from your current match and delete the private channel\n" +
                "/info - Get information about your current match\n" +
                "/date - Confirm a successful date and start officially dating\n" +
                "/welp - List all available commands\n" +
                "/removequeue - Remove yourself from the matching queue";

            await interaction.editReply({ content: helpMessage });
        }

        if (interaction.isCommand() && interaction.commandName === 'match') {
            await interaction.deferReply({ ephemeral: true });
        
            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const registrations = db.collection('registrations');
            const matches = db.collection('matches');
            const queue = db.collection('queue');
            const rejectedPairs = db.collection('rejected_pairs');
        
            const user = await registrations.findOne({ userId });
            if (!user) {
                await interaction.editReply({ content: 'You are not registered. Please register first using the registration button.' });
                return;
            }
        
            // Check if the user is already matched
            const isMatched = await matches.findOne({ $or: [{ user1: userId }, { user2: userId }] });
            if (isMatched) {
                await interaction.editReply({ content: 'You are already matched with another user. Please check your existing match.' });
                return;
            }
        
            // Check if the user is already in the queue
            const isInQueue = await queue.findOne({ userId });
            if (isInQueue) {
                await interaction.editReply({ content: 'You are already in queue.' });
                return;
            }
        
            const preference = user.genderPreference.includes('All') || user.genderPreference.includes('all') ? validGenders : user.genderPreference;
        
            // Fetch rejected user IDs where the user has rejected or has been rejected
            const rejectedUsers = await rejectedPairs.find({ $or: [{ user1: userId }, { user2: userId }] }).toArray();
            const rejectedUserIds = rejectedUsers.map(rejection => (rejection.user1 === userId ? rejection.user2 : rejection.user1));
        
            const match = await queue.findOne({
                gender: { $in: preference },
                genderPreference: { $in: [user.gender, 'All', 'all'] },
                userId: { $ne: userId, $nin: rejectedUserIds } // Exclude rejected users
            });
        
            if (match) {
                // Check if the potential match has rejected the current user
                const matchRejectedUsers = await rejectedPairs.find({ user1: match.userId, user2: userId }).toArray();
                if (matchRejectedUsers.length > 0) {
                    // If the potential match has rejected the current user, remove from queue and try to find another match
                    await queue.deleteOne({ userId: match.userId });
                    await interaction.editReply({ content: 'Found a user who has rejected you, retry the match command to find another match.' });
                    return;
                }
        
                // Check if the potential match is already matched
                const matchIsMatched = await matches.findOne({ $or: [{ user1: match.userId }, { user2: match.userId }] });
                if (matchIsMatched) {
                    // Remove from queue and try to find another match
                    await queue.deleteOne({ userId: match.userId });
                    await interaction.editReply({ content: 'Found a user already matched, retry the match command to find another match.' });
                    return;
                }
        
                // Found a match, create a private channel
                const guild = await client.guilds.fetch(guildId);
                const category = guild.channels.cache.get('1241805059801743540'); // Fetch the category channel by its ID
        
                const channel = await guild.channels.create({
                    name: `blind-date-${user.name}-${match.name}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                            type: OverwriteType.Role
                        },
                        {
                            id: userId,
                            allow: [PermissionFlagsBits.ViewChannel],
                            type: OverwriteType.Member
                        },
                        {
                            id: match.userId,
                            allow: [PermissionFlagsBits.ViewChannel],
                            type: OverwriteType.Member
                        },
                    ],
                });
        
                await matches.insertOne({
                    user1: userId,
                    user2: match.userId,
                    channelId: channel.id,
                    timestamp: new Date()
                });
        
                await queue.deleteOne({ userId: match.userId });
        
                await interaction.editReply({ content: `You have been matched! Your private channel is: ${channel}` });
                await client.users.send(match.userId,`You have been matched! Your private channel is: ${channel}`);
            } else {
                // No match found, add to queue
                await queue.insertOne({
                    userId,
                    name: user.name,
                    gender: user.gender,
                    genderPreference: user.genderPreference,
                    timestamp: new Date()
                });
        
                await interaction.editReply({ content: 'No match found at the moment. You have been added to the queue. We will notify you once a match is found.' });
            }
        }
        
        
        

        if (interaction.isCommand()) {
            if (interaction.commandName === 'info') {
                await interaction.deferReply({ ephemeral: true });
        
                const userId = interaction.user.id;
                const db = mongoClient.db('blind_date');
                const matches = db.collection('matches');
                const registrations = db.collection('registrations');
        
                // Find the current match
                const match = await matches.findOne({ $or: [{ user1: userId }, { user2: userId }] });
                if (!match) {
                    await interaction.editReply({ content: 'You are not currently matched with anyone.' });
                    return;
                }
        
                // Determine the ID of the matched user
                const matchedUserId = (match.user1 === userId) ? match.user2 : match.user1;
        
                // Fetch registration info of the matched user
                const matchedUser = await registrations.findOne({ userId: matchedUserId });
                if (!matchedUser) {
                    await interaction.editReply({ content: 'Error fetching information about your match.' });
                    return;
                }
        
                // Construct the reply message with details about the matched user
                const replyContent = `**Name:** ${matchedUser.name}\n**Age:** ${matchedUser.age}\n**Gender:** ${matchedUser.gender}\n**Bio:** ${matchedUser.bio}`;
                await interaction.editReply({ content: replyContent });
            }
        }

        if (interaction.isCommand() && interaction.commandName === 'date') {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const matches = db.collection('matches');

            // Find the match involving the user
            const match = await matches.findOne({ $or: [{ user1: userId }, { user2: userId }] });
            if (!match) {
                await interaction.editReply({ content: 'You are not currently matched with anyone to confirm the date.' });
                return;
            }

            const { user1, user2, channelId } = match;
            const otherUserId = userId === user1 ? user2 : user1;

            const channel = await client.channels.fetch(channelId);

            // Delete the channel
            if (channel) {
                await channel.delete();
            }

            // Remove the match from the database
            await matches.deleteOne({ _id: match._id });

            // Send a DM to both users
            const user = await client.users.fetch(userId);
            const otherUser = await client.users.fetch(otherUserId);

            await user.send(`Congratulations! You and ${otherUser.username} are now officially dating!`);
            await otherUser.send(`Congratulations! You and ${user.username} are now officially dating!`);

        }

        if (interaction.isCommand() && interaction.commandName === 'unmatch') {
            await interaction.deferReply({ ephemeral: true });
        
            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const matches = db.collection('matches');
        
            // Find the match involving the user
            const match = await matches.findOne({ $or: [{ user1: userId }, { user2: userId }] });
            if (!match) {
                await interaction.editReply({ content: 'You are not currently matched with anyone to unmatch.' });
                return;
            }
        
            const { user1, user2, channelId } = match;
            const channel = await client.channels.fetch(channelId);
        
            // Delete the channel
            if (channel) {
                await channel.delete();
            }
        
            // Remove the match from the database
            await matches.deleteOne({ _id: match._id });
        
            // Send a DM to both users
            await client.users.send(user1,'You have been rejected. You will no longer match with this user again.');
            await client.users.send(user2,'You have been rejected. You will no longer match with this user again.');
        
        }
        
        

        if (interaction.isCommand() && interaction.commandName === 'reject') {
            await interaction.deferReply({ ephemeral: true });
        
            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const matches = db.collection('matches');
            const rejectedPairs = db.collection('rejected_pairs');  // Initialize earlier in the logic
        
            // Find the match involving the user
            const match = await matches.findOne({ $or: [{ user1: userId }, { user2: userId }] });
            if (!match) {
                await interaction.editReply({ content: 'You are not currently matched with anyone.' });
                return;
            }
        
            const { user1, user2, channelId } = match;
        
            // Insert into rejectedPairs before performing deletions
            await rejectedPairs.insertOne({ user1: userId, user2: (userId === user1 ? user2 : user1) });
        
            try {
                const channel = await client.channels.fetch(channelId);
        
                // Delete the channel
                if (channel) {
                    await channel.delete();
                }
        
                // Remove the match from the database
                await matches.deleteOne({ _id: match._id });
        
                await client.users.cache.get(user1).send('You have been rejected. You will no longer match with this user again.');
                await client.users.cache.get(user2).send('You have been rejected. You will no longer match with this user again.');
        
                await interaction.editReply({ content: 'You have rejected the match. You will no longer match with this user again.' });
            } catch (error) {
                console.error('Error handling rejection:', error);
                await interaction.editReply({ content: 'An error occurred while processing your rejection. Please try again.' });
            }
        }

        if (interaction.isCommand() && interaction.commandName === 'removequeue') {
            await interaction.deferReply({ ephemeral: true });
        
            const userId = interaction.user.id;
            const db = mongoClient.db('blind_date');
            const queue = db.collection('queue');
        
            // Check if the user is in the queue
            const isInQueue = await queue.findOne({ userId });
            if (!isInQueue) {
                await interaction.editReply({ content: 'You are not in the queue.' });
                return;
            }
        
            // Remove the user from the queue
            await queue.deleteOne({ userId });
        
            await interaction.editReply({ content: 'You have been removed from the queue.' });
        }
        
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: 'There was an error processing your request. Please try again in 5 seconds.' });
        } else {
            await interaction.deferReply({ content: 'There was an error processing your request. Please try again in 5 seconds.', ephemeral: true });
        }
    }
});

client.login(token);
