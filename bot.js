const Discord = require('discord.io');
// const SQLite = require("better-sqlite3");
const logger = require('winston');
const auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    logger.info(bot.servers)
});
bot.on('message', function (user, userID, channelID, message, evt) {

    if (evt.d.author.id != bot.id && evt.d.guild_id == null) {
        bot.sendMessage({
            to: channelID,
            message: "Sorry, but I'm a server secretary, not your personal slave"
        });
        return;
    }
    // logger.info(evt.d.)
    // logger.info(bot.permissions)
    // logger.info(evt.d.guild_id)
    logger.info(bot.servers[evt.d.guild_id].members[evt.d.author.id].roles)
    //logger.info(bot.servers[evt.d.guild_id].roles)
    isAdmin(evt.d.author.id, evt.d.guild_id)
    if (message.startsWith(mention(bot.id) + ' ')) {
        var args = message.split(' ');
        var cmd = args[1];
       
        // args = args.splice(1);
        switch(cmd) {
            case 'hi':
                bot.sendMessage({
                    to: channelID,
                    message: 'hiii! :D'
                });
                break;
            case 'let':
                let(channelID, evt, args)
                break;
            case 'revoke':
                revoke(channelID, evt, args)
                break;
            // Just add any case commands if you want to..
         }
     }
});

function mention(user_id) {
    return '<@' + user_id + '>';
}

function idFromMention(evt, mention) {
    if (mention == "me") {
        return evt.d.author.id
    }
    return mention.substring(2, mention.length - 1)
}

const admin = 8
function isAdmin(user_id, guild_id) {
    var roles = bot.servers[guild_id].roles;
    var user_roles = bot.servers[guild_id].members[user_id].roles;
    
    logger.info(user_roles)
    for (i in user_roles) {
        var role = user_roles[i];
        
        logger.info(parseInt(roles[user_roles[i]]._permissions))
        logger.info((parseInt(roles[user_roles[i]]._permissions) & admin) === admin)
        if ((roles[role]._permissions & admin) === admin) {
            return true
        }
    }
    return false
}

function let(channelID, evt, args) {
    if (!isAdmin(evt.d.author.id, evt.d.guild_id)) {
        bot.sendMessage({
            to: channelID,
            message: 'Sorry, but only admins can set managers'
        });
    }
    else if (args.length >= 5 && args[3] === "manage") {
        var manager = bot.users[idFromMention(evt, args[2])]
        var assignee = bot.users[idFromMention(evt, args[4])]
        if (manager == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[2] + ' does not appear to be here...'
            });
        }
        else if (manager.bot) {
            bot.sendMessage({
                to: channelID,
                message: "You can't let bots assign tasks!"
            });
        }
        else if (assignee == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[4] + ' does not appear to be here...'
            });
        }
        else if (assignee.bot) {
            bot.sendMessage({
                to: channelID,
                message: "You can't assign tasks to bots!"
            });
        }
        else if (manager === assignee) {
            bot.sendMessage({
                to: channelID,
                message: "A person doesn't need permission to manage themselves!"
            });
        }
        else {
            
            // code goes here to insert appropriate manage entry into the sql db
            // also check if entry already exists
            
            bot.sendMessage({
                to: channelID,
                message: "Done! " + mention(manager.id) + " can now manage " + mention(assignee.id)
            });
        }    
    }
    else {
        bot.sendMessage({
            to: channelID,
            message: 'let...what?'
        });
    }
}

function revoke(channelID, evt, args) {
    if (!isAdmin(evt.d.author.id, evt.d.guild_id)) {
        bot.sendMessage({
            to: channelID,
            message: 'Sorry, but only admins can set managers'
        });
    }
    else if (args.length >= 5 && args[3] === "manage") {
        var manager = bot.users[idFromMention(evt, args[2])]
        var assignee = bot.users[idFromMention(evt, args[4])]
        if (manager == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[2] + ' does not appear to be here...'
            });
        }
        else if (manager.bot) {
            bot.sendMessage({
                to: channelID,
                message: "Bots can't assign tasks!"
            });
        }
        else if (assignee == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[4] + ' does not appear to be here...'
            });
        }
        else if (assignee.bot) {
            bot.sendMessage({
                to: channelID,
                message: "People can't assign tasks to bots!"
            });
        }
        else if (manager === assignee) {
            bot.sendMessage({
                to: channelID,
                message: "You can't revoke a person's permission to manage themselves!"
            });
        }
        else {
            
            // code goes here to delete appropriate manage entry from the sql db
            // also check if entry exists
            
            bot.sendMessage({
                to: channelID,
                message: "Done! " + mention(manager.id) + " can no longer manage " + mention(assignee.id)
            });
        }    
    }
    else {
        bot.sendMessage({
            to: channelID,
            message: 'revoke...what?'
        });
    }
}

function assign(channelID, evt, args) {
    
}

