#!/usr/bin/env node
'use strict';

// noinspection JSUnresolvedFunction
const application = require("commander");

const validateArguments = () => {
    let hasError = false;
    if (hostname === undefined) {
        console.error('  Database hostname is required');
        hasError = true;
    }

    if (databaseName === undefined) {
        console.error('  Database name is required');
        hasError = true;
    }

    if (username === undefined) {
        console.error('  Database user is required');
        hasError = true;
    }

    if (password === undefined) {
        console.error('  Database password is required');
        hasError = true;
    }

    if (hasError) {
        application.help();

        // noinspection JSUnresolvedFunction, JSUnresolvedVariable
        process.exit(1);
    }
};

const configureApplication = () => {
    application.version('0.0.1')
        .description("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.")
        .option('-H, --database-host <host>', 'Database host (with optional port)')
        .option('-d, --database <database>', 'Database name')
        .option('-u, --database-user <user>', 'Database user name')
        .option('-p, --database-password <password>', 'Database password');
};
const parseArguments = () => {
// noinspection JSUnresolvedVariable
    application.parse(process.argv);
// noinspection JSUnresolvedVariable
    const hostname = application.databaseHost;
// noinspection JSUnresolvedVariable
    const databaseName = application.database;

// noinspection JSUnresolvedVariable
    const username = application.databaseUser;
// noinspection JSUnresolvedVariable
    const password = application.databasePassword;
    return {hostname, databaseName, username, password};
};

configureApplication();
const {hostname, databaseName, username, password} = parseArguments();
validateArguments();

