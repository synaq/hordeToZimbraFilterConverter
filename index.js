#!/usr/bin/env node
'use strict';

// noinspection JSUnresolvedFunction
const application = require("commander");
// noinspection JSUnresolvedFunction
const mysql = require('nodejs-mysql').default;

class IngoToZimbraRuleConverter {
    initialiseApplication() {
        this.prepareToFetchMailboxData = this.prepareToFetchMailboxData.bind(this);

        application.version('0.0.1')
            .description("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.")
            .arguments('<mailboxId>')
            .option('-H, --database-host <host>', 'Database host (default localhost)')
            .option('-P, --database-port <port>', 'Database port (default 3306)')
            .option('-d, --database <database>', 'Database name (default horde)')
            .option('-u, --database-user <user>', 'Database user name')
            .option('-p, --database-password <password>', 'Database password')
            .action(this.prepareToFetchMailboxData);

        // noinspection JSUnresolvedVariable
        application.parse(process.argv);
    }

    initialiseConfiguration() {
        this.config = {};

        // noinspection JSUnresolvedVariable
        this.config.host = application.databaseHost || 'localhost';
        // noinspection JSUnresolvedVariable
        this.config.port = application.databasePort || 3306;
        // noinspection JSUnresolvedVariable
        this.config.database = application.database || 'horde';
        // noinspection JSUnresolvedVariable
        this.config.user = application.databaseUser;
        // noinspection JSUnresolvedVariable
        this.config.password = application.databasePassword;
    }

    validateConfiguration() {
        let hasError = false;
        if (this.config.user === undefined) {
            console.error('  Database user is required');
            hasError = true;
        }

        if (this.config.password === undefined) {
            console.error('  Database password is required');
            hasError = true;
        }

        if (hasError) {
            application.help();
            this.exitWithErrorState();
        }
    }

    initialiseDatabaseConnection() {
        this.db = mysql.getInstance(this.config);
    }

    prepareToFetchMailboxData(mailboxId) {
        this.initialiseConfiguration();
        this.validateConfiguration();
        this.initialiseDatabaseConnection();
        this.fetchMailboxData(mailboxId)
    }

    fetchMailboxData(mailboxId) {
        const query = 'SELECT pref_uid AS mailbox_id, pref_value as rules ' +
            'FROM horde_prefs ' +
            'WHERE pref_uid = ? ' +
            'AND pref_scope = ? ' +
            'AND pref_name = ?';
        // noinspection JSUnresolvedVariable
        this.db.exec(query, [mailboxId, 'ingo', 'rules'])
            .then(results => {
                console.log(results);
                this.exitWithNormalState();
            })
            .catch(e => {
                console.log('Error while trying to fetch rules from database: ' + e);
                this.exitWithErrorState();
            });
    }

    exitWithNormalState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(0);
    }

    exitWithErrorState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(1);
    }
}

const converter = new IngoToZimbraRuleConverter();
converter.initialiseApplication();

