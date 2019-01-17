const Discord = require('discord.io');
const sql = require('sql.js');
const fs = require("fs");
const logger = require('winston');
const auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Help the bot remember its conversation
var currentUser = null;
var currentTopic = "";
var currentMemory = "";

// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    //logger.info(bot.servers)
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
    logger.info(bot.servers[evt.d.guild_id].members)
    //logger.info(bot.servers[evt.d.guild_id].roles)

    if (currentUser != null && evt.d.author.id == currentUser.id) {
        
        if (message.startsWith("nvm") || message.startsWith("jk")) {
            
            endConversation();
            
            bot.sendMessage({
                to: channelID,
                message: "Okay no problem! I'll just cross that out then"
            });
            return;
        }
         
        switch(currentTopic) {
            case 'describe task':
                // store description in json
                currentMemory = currentMemory.concat('"description":"' + message + '"}')
                logger.info(currentMemory);
                currentTopic = "prioritize task";
                
                bot.sendMessage({
                    to: channelID,
                    message: "Okay! How important is this task?"
                });
                break;
                
            case 'prioritize task':
                var priority = message.split(' ')[0];
                var priorityInt = -1;
                switch(priority) {
                    case 'high':
                        priorityInt++;
                    case 'medium':
                        priorityInt++;
                    case 'low':
                        priorityInt++;
                    default:
                        if (priorityInt < 0) {
                            bot.sendMessage({
                                to: channelID,
                                message: "Right...so is that low, medium, or high?"
                            });
                        }
                        else {
                            var memory = JSON.parse(currentMemory);
                            addTask(channelID, evt.d.guild_id, currentUser.id, memory.assignee_id, memory.description, priorityInt);
                            endConversation();
                            bot.sendMessage({
                                to: channelID,
                                message: "Done! This task has been assigned to " + mention(memory.assignee_id)
                            });
                        }
                }
                break;
            
            default:
                bot.sendMessage({
                    to: channelID,
                    message: "What were we talking about again?"
                });
                endConversation();
        }
    }
    else if (message.startsWith(mention(bot.id) + ' ')) {
        
        if (currentUser != null) {
            bot.sendMessage({
                to: channelID,
                message: "I'm currently talking to " + mention(currentUser.id) + ". If it is really that urgent, then tell them to hurry!"
            });
            return;
        }

        var args = message.split(' ');
        var cmd = args[1];
       
        // args = args.splice(1);
        switch(cmd) {
            case 'prepare':
                prepare(channelID, evt.d.guild_id);
                break;
                
            case 'hi':
                bot.sendMessage({
                    to: channelID,
                    message: 'hiii! :D'
                });
                break;
                
            case 'let':
                let(channelID, evt, args);
                break;
                
            case 'revoke':
                revoke(channelID, evt, args);
                break;
                
            case 'assign':
                assign(channelID, evt, args);
                break;
                
            case 'list':
                list(channelID, evt, args);
            // Just add any case commands if you want to..
        }
    }
    else if (currentUser != null && message.startsWith(mention(currentUser.id) + ' hurry')) {
        bot.sendMessage({
            to: channelID,
            message: mention(currentUser.id) + "If you don't hurry up, I'll have to drop our conversation. There are people waiting in line!"
        });
        // start a timer /////////////////////////
    }
});

function mention(user_id) {
    return '<@' + user_id + '>';
}

function idFromMention(evt, mention) {
    if (mention == "me" || mention == "my") {
        return evt.d.author.id
    }
    return mention.substring(2, mention.length - 1)
}

const admin = 8
function isAdmin(user_id, guild_id) {
    var roles = bot.servers[guild_id].roles;
    var user_roles = bot.servers[guild_id].members[user_id].roles;
    
    //logger.info(user_roles)
    for (i in user_roles) {
        var role = user_roles[i];
        
        //logger.info(parseInt(roles[user_roles[i]]._permissions))
        //logger.info((parseInt(roles[user_roles[i]]._permissions) & admin) === admin)
        if ((roles[role]._permissions & admin) === admin) {
            return true
        }
    }
    return false
}

function let(channelID, evt, args) {
    
    var db = getDB(channelID, evt.d.guild_id);
    if (db == null) return;
    
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
            var stmt = db.prepare("SELECT * FROM management WHERE manager_id=$m AND assignee_id=$a");
            stmt.bind({$m:manager.id, $a:assignee.id});
            if (stmt.step()) {
                bot.sendMessage({
                    to: channelID,
                    message: mention(manager.id) + " already manages " + mention(assignee.id)
                });
                stmt.free();
                return;
            }
            stmt.free();

            var insert = "INSERT INTO management (manager_id, assignee_id) values (?, ?);";
            db.run(insert, [manager.id, assignee.id]);
            saveDB(evt.d.guild_id, db);

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
    
    var db = getDB(channelID, evt.d.guild_id);
    if (db == null) return;
    
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
            var stmt = db.prepare("SELECT * FROM management WHERE manager_id=$m AND assignee_id=$a");
            stmt.bind({$m:manager.id, $a:assignee.id});
            if (!stmt.step()) {
                bot.sendMessage({
                    to: channelID,
                    message: mention(manager.id) + " doesn't even manage " + mention(assignee.id)
                });
                stmt.free();
                return;
            }
            stmt.free();
            
            var deletion = "DELETE FROM management WHERE manager_id = ? AND assignee_id = ?;";
            db.run(deletion, [manager.id, assignee.id]);
            saveDB(evt.d.guild_id, db);
            
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
    
    var db = getDB(channelID, evt.d.guild_id);
    if (db == null) return;
    
    else if (args.length >= 5 && args[3] === "to" && (args[2] == "task" || !isNaN(args[2]))) {
        var manager = evt.d.author;
        var assignee = bot.users[idFromMention(evt, args[4])]
        if (assignee == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[4] + ' does not appear to be here...'
            });
        }
        else if (assignee.bot) {
            bot.sendMessage({
                to: channelID,
                message: "You can't assign tasks to a bot!"
            });
        }
        else {
            if (manager.id != assignee.id) {
                var stmt = db.prepare("SELECT * FROM management WHERE manager_id=$m AND assignee_id=$a");
                stmt.bind({$m:manager.id, $a:assignee.id});
                if (!stmt.step()) {
                    bot.sendMessage({
                        to: channelID,
                        message: "You can only assign tasks to people you manage"
                    });
                    stmt.free();
                    return;
                }
                stmt.free();
            }
            if (!isNaN(args[2])) {
                var stmt = db.prepare("SELECT * FROM tasks WHERE task_id = $t");
                stmt.bind({$t:parseInt(args[2])});
                if (!stmt.step()) {
                    bot.sendMessage({
                        to: channelID,
                        message: "That task does not exist"
                    });
                    stmt.free();
                    return;
                }
                else if (stmt.getAsObject().manager_id != manager.id) {
                    bot.sendMessage({
                        to: channelID,
                        message: "You can only reassign tasks that you've created"
                    });
                    stmt.free();
                    return;
                }
                else if (stmt.getAsObject().assignee_id == assignee.id) {
                    bot.sendMessage({
                        to: channelID,
                        message: "That person is already assigned to this task!"
                    });
                    stmt.free();
                    return;
                }
                else if (stmt.getAsObject().status == 2) {
                    bot.sendMessage({
                        to: channelID,
                        message: "You can't reassign completed tasks!"
                    });
                    stmt.free();
                    return;
                }
                var task = stmt.getAsObject();
                logger.info(task);
                stmt.free();
                var update = "UPDATE tasks SET assignee_id = ? WHERE task_id = ?;";
                db.run(update, [assignee.id, task.task_id]);
                saveDB(evt.d.guild_id, db);
                
                bot.sendMessage({
                    to: channelID,
                    message: "Done! Task#" + task.task_id + " has been reassigned from " + mention(task.assignee_id) + " to " + mention(assignee.id)
                });
                
            }
            else {
                currentUser = manager;
                currentTopic = "describe task";
                currentMemory = '{"assignee_id":"' + assignee.id + '", ';
                logger.info(currentUser);
                logger.info(currentTopic);
                logger.info(currentMemory);
                bot.sendMessage({
                    to: channelID,
                    message: "Sure! What should the task be?"
                });
            }
        }    
    }
    else {
        bot.sendMessage({
            to: channelID,
            message: 'assign...what?'
        });
    }
}

function addTask(channelID, guild_id, manager_id, assignee_id, description, priorityInt) {
    
    db = getDB(channelID, guild_id)
    
    var insert = "INSERT INTO tasks (manager_id, assignee_id, description, priority) values (?, ?, ?, ?);";
    db.run(insert, [manager_id, assignee_id, description, priorityInt]);
    saveDB(guild_id, db);
}

function list(channelID, evt, args) {
    var db = getDB(channelID, evt.d.guild_id);
    if (db == null) return;
    if (args.length >= 4 && args[3] === "tasks") {
        args.splice(3, 0, "current");
    }
    if (args.length >= 5 && args[4] === "tasks") {
        var assignee = bot.users[idFromMention(evt, args[2])]
        if (assignee == null) {
            bot.sendMessage({
                to: channelID,
                message: 'User ' + args[2] + ' does not appear to be here...'
            });
        }
        else if (assignee.bot) {
            bot.sendMessage({
                to: channelID,
                message: "Bots don't have tasks!"
            });
        }
        else {
            var query = "";
            switch(args[3]) {
                case "completed":
                    query = "SELECT * FROM tasks WHERE assignee_id=$a AND status = 2 ORDER BY status, priority";
                    break;
                case "current":
                    query = "SELECT * FROM tasks WHERE assignee_id=$a AND status < 2 ORDER BY status, priority";
                    break;
                case "started":
                    query = "SELECT * FROM tasks WHERE assignee_id=$a AND status = 1 ORDER BY status, priority";
                    break;
                case "todo":
                    query = "SELECT * FROM tasks WHERE assignee_id=$a AND status = 0 ORDER BY status, priority";
                    break;
                default:
                    query = "SELECT * FROM tasks WHERE assignee_id=$a ORDER BY status, priority";
            }
            var stmt = db.prepare(query);
            stmt.bind({$a:assignee.id});
            var taskList = "Okay! Here are the tasks assigned to " + mention(assignee.id) + ":\n\n";
            var notStarted = 0;
            var inProgress = 0;
            var completed = 0;
            while (stmt.step()) {
                var task = stmt.getAsObject();
                var priorityArr = ["Low", "Medium", "High"];
                var statusArr = ["Not Started", "In Progress", "Completed"];
                taskList = taskList.concat(
                    "Task#" + task.task_id + "\n" + 
                    "Assigned by " + mention(task.manager_id) + "\n" + 
                    task.description + "\n" + 
                    "Priority: " + priorityArr[task.priority] + "\n" + 
                    "Status: " + statusArr[task.status] + "\n\n"
                );
                switch(task.status) {
                    case 0:
                        notStarted++;
                        break;
                    case 1:
                        inProgress++;
                        break;
                    case 2:
                        completed++;
                        break;
                }
            }
            stmt.free();
            
            if (notStarted > 0) {
                taskList = taskList.concat(notStarted + " tasks not started\n");
            }
            if (inProgress > 0) {
                taskList = taskList.concat(inProgress + " tasks in progress\n");
            }
            if (completed > 0) {
                taskList = taskList.concat(completed + " tasks completed\n");
            }
            
            bot.sendMessage({
                to: channelID,
                message: taskList
            });
        }
    }
    else {
        bot.sendMessage({
            to: channelID,
            message: 'list...what?'
        });
    }
}

function getDB(channelID, guild_id) {
    if (!fs.existsSync('sql/' + guild_id + '.sql')) {
        bot.sendMessage({
            to: channelID,
            message: 'I have not prepared the server yet! Please tell me to do that'
        });
        return null;
    }
    return new SQL.Database(fs.readFileSync('sql/' + guild_id + '.sql'));
}

function saveDB(guild_id, db) {
    var buffer = Buffer.from(db.export());
    fs.writeFileSync("sql/" + guild_id + ".sql", buffer);
}

function prepare(channelID, guild_id) {
    
    // check if db already exists for guild_id
    
    // database
    var db = new sql.Database();
    
    // tables
    var tables = "CREATE TABLE management (manager_id varchar(50), assignee_id varchar(50));";
    tables += "CREATE TABLE tasks (task_id INTEGER PRIMARY KEY, manager_id varchar(50), assignee_id varchar(50), priority tinyint(1), description text, status tinyint(1) DEFAULT 0);";
    db.run(tables)
    
    
    // stmt = db.prepare("SELECT * FROM tasks");
    // while (stmt.step()) logger.info(stmt.get());
    
    // stmt.free();
    
    // export
    saveDB(guild_id, db);
    
    bot.sendMessage({
        to: channelID,
        message: "Server has been prepared! I'm ready to organize tasks!"
    });
}

function endConversation() {
    currentUser = null;
    currentTopic = "";
    currentMemory = "";
}