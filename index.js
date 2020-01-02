#!/usr/bin/env node
/*
TODO:
- Upload files
- Upload only file that changed (Maybe compress..?)
- Live reload
- Proxy Integration
- When the command is run, connect to a socket server that way it knows when the site should go down
- Confirm authorization token on setup
    = Also, send the auth token on every sync request to make sure. 
*/
const program   = require('commander');
const co        = require('co');
const prompt    = require('co-prompt');
const chalk     = require('chalk');
const fs        = require('fs');
const nodeWatch = require('node-watch');

// Config Stuff
const confStore     = require('configstore');
const packageJson   = require('./package.json');
const config        = new confStore(packageJson.name);

const projName = 'KVStatic';

const generateUniqueName = (opts = "abcdefghijklmnopqrstuvwxyz123456789") => {
    let name = "";
    for(i = 0; i < 5; i++) {
        name += opts[Math.floor(Math.random() * opts.length)];
    }

    return name;
}

const askInput = () => {
    co(function *() {
    const cmd = yield prompt("> ")

    switch(cmd) {
        case "": 
            break;
        case "snapshot":
            console.log(chalk.yellow("Snapshot Taken @ NOW"));
            break;
        case "revert":
            console.log(chalk.green("Reverting to previous snapshot.."));
            break;
        case "help":
            console.log(chalk.green("snapshot") + " create a snapshot of your code. You can revert whenever (creates a zip)");
            console.log(chalk.green("revert") + " reverts to said snapshot");
            break;
        default:
            console.log(chalk.red("Unknown command, type 'help' for help."));
            break;
    }
    
    askInput();
    })
}


const doStuff = (apiIP, authToken, directory, name, type) => {
    console.log(chalk.cyan.bold(`Access URL: `) + chalk.green(`${name}.${apiIP}`));

    nodeWatch(directory, {recursive: true}, (event, filename) => {
        if(event == 'update') {
            console.log(chalk.blue("Updating file: ") + chalk.green(filename));
        }

        if(event == 'remove') {
            console.log(chalk.red("Deleting file: ") + chalk.green(filename));
        }
    })

    askInput();
}

console.log(chalk.blue(`${projName}`))

program.arguments('<directory>')
       .option('-t, --type <static|node>', 'Say if this is a static or node test site') // Port is automatically generated randomly on creation
       .option('-p, --project <project>', 'Provide a project name. This will be used in the url instead of a random string')
       .option('-a, --authorization <none|required>', 'Specifies whether or not the site should be publicly accessible.')
       .option('-r, --reset', 'This will reset your configuration')
       .action((directory) => {
            co(function *() {
                if(program.reset) {
                    config.delete('apitoken');
                    config.delete('apiip');
                }
                let apiIP;
                let authToken;
                if(!config.has("apitoken")) {
                    apiIP       = yield prompt(chalk.green("Serivce URL (what you use to access the home page, ex: static.example.com): "));
                    authToken   = yield prompt.password(chalk.green("Authorization Token: "));
                    config.set("apitoken", authToken);
                    config.set("apiip", apiIP);
                }
                if(config.has("apitoken")) {
                    authToken   = config.get("apitoken");
                    apiIP       = config.get("apiip");
                }

                const name      = program.project || generateUniqueName();

                fs.copyFileSync(`${__dirname}/config-template.json`, `${directory}/${projName.toLowerCase()}-config.json`);

                const newConfFile = JSON.parse(fs.readFileSync(`${directory}/${projName.toLowerCase()}-config.json`));
                      newConfFile.name = name;
                      newConfFile.type = program.type || "static";
                      newConfFile.requiresAuthentication = program.authorization == "required" ? true : false;
                      newConfFile.directory = directory;

                fs.writeFileSync(`${directory}/${projName.toLowerCase()}-config.json`, JSON.stringify(newConfFile));

                console.log(chalk.green(`Project directory setup, from now on you can just run '${projName}' in this directory to start it.`))

                doStuff(apiIP, authToken, directory, name, program.type);

            });
       })
       .parse(process.argv);

if (process.argv.length == 2) {
    if(fs.existsSync(`./${projName}-config.json`)) {
        const localConf = JSON.parse(fs.readFileSync(`./${projName.toLowerCase()}-config.json`));
        const apiIP     = config.get("apiip");
        const apiToken  = config.get("apitoken");
        const directory = localConf.directory;
        const name      = localConf.name;
        const type      = localConf.type;

        console.log(chalk.green + "Starting from configuration file.");

        co(function *() {
            doStuff(apiIP, apiToken, directory, name, type);
        })
    } else {
        program.help();
    }
}
