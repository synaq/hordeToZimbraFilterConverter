#!/usr/bin/env node
'use strict';

// noinspection JSUnresolvedFunction
const application = require("commander");
// noinspection JSUnresolvedFunction
const mysql = require('nodejs-mysql').default;
// noinspection JSUnresolvedVariable, JSUnresolvedFunction
const phpSerializer = require("serialize-like-php");

class IngoToZimbraRuleConverter {
    initialiseApplication() {
        this.prepareToFetchMailboxData = this.prepareToFetchMailboxData.bind(this);
        this.invalidRuleFilter = this.invalidRuleFilter.bind(this);

        application.version('0.0.1')
            .description("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.")
            .arguments('<mailbox>')
            .option('-H, --database-host <host>', 'Database host (default localhost)')
            .option('-P, --database-port <port>', 'Database port (default 3306)')
            .option('-d, --database <database>', 'Database name (default horde)')
            .option('-u, --database-user <user>', 'Database user name')
            .option('-p, --database-password <password>', 'Database password')
            .option('-d, --debug', 'Write warnings when skipping invalid or unwanted rules')
            .action(this.prepareToFetchMailboxData);

        // noinspection JSUnresolvedVariable
        application.parse(process.argv);
    }

    prepareToFetchMailboxData(mailbox) {
        this.initialiseMailbox(mailbox);
        this.initialiseConfiguration();
        this.validateConfiguration();
        this.initialiseDatabaseConnection();
        this.initialiseMaps();
        this.initialiseFlags();
        this.fetchMailboxData();
    }

    initialiseMailbox(mailbox) {
        const mailboxAddressParts = mailbox.split('@');
        this.mailboxId = mailboxAddressParts[0];
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

    initialiseMaps() {
        this.combineMap = new Map();
        this.combineMap.set('1', 'all');
        this.combineMap.set('2', 'any');

        this.actionMap = new Map();
        this.actionMap.set('1', 'keep');
        this.actionMap.set('2', 'fileinto');
        this.actionMap.set('3', 'discard');
        this.actionMap.set('4', 'redirect');
        this.actionMap.set('5', 'keep redirect');
        this.actionMap.set('11', 'keep fileinto');
        this.actionMap.set('12', 'flag');

        this.uniqueRuleNameMap = new Map();
    }

    initialiseFlags() {
        // noinspection JSUnresolvedVariable
        this.debug = application.debug;
    }

    fetchMailboxData() {
        const query = 'SELECT pref_uid AS mailbox_id, pref_value as rules ' +
            'FROM horde_prefs ' +
            'WHERE pref_uid = ? ' +
            'AND pref_scope = ? ' +
            'AND pref_name = ?';
        // noinspection JSUnresolvedVariable
        this.db.exec(query, [this.mailboxId, 'ingo', 'rules'])
            .then(results => {
                // noinspection JSUnresolvedVariable
                const data = IngoToZimbraRuleConverter.fixBrokenSerializedData(results);
                const rules = IngoToZimbraRuleConverter.convertSerializedRulesToArray(data);

                rules.filter(this.invalidRuleFilter).forEach((rule) => {
                    let conditionsString = '';
                    // noinspection JSUnresolvedVariable
                    rule.conditions.forEach((condition) => {
                        // noinspection JSUnresolvedVariable
                        conditionsString += `header "${condition.field.toLowerCase()}" all ${condition.match} "${condition.value}" `
                    });

                    // noinspection JSUnresolvedVariable
                    process.stdout.write(`afrl "${this.uniqueRuleName(rule.name)}" ${rule.disable === true ? 'inactive' : 'active'} ${this.combineMap.get(rule.combine)} ${conditionsString} ${this.actionMap.get(rule.action)} ${IngoToZimbraRuleConverter.actionValue(rule)} \n`);
                });
                this.exitWithNormalState();
            })
            .catch(e => {
                console.error('Error while trying to fetch rules from database: ' + e);
                this.exitWithErrorState();
            });
    }

    static convertSerializedRulesToArray(data) {
        return phpSerializer.unserialize(data);
    }

    static fixBrokenSerializedData(results) {
        return results[0].rules.replace(/s:(\d+):"(.*?)";/gu, (match, length, value) => `s:${value.length}:"${value}";`);
    }

    invalidRuleFilter(rule) {
        // noinspection JSUnresolvedVariable
        if (rule.conditions.length === 0) {
            this.writeToDebugLog(`# Skipping invalid rule "${rule.name}" with zero length conditions`);

            return false;
        }

        if (['Whitelist', 'Blacklist', 'Vacation', 'Forward'].includes(rule.name)) {
            this.writeToDebugLog(`# Skipping Ingo default rule "${rule.name}"`);

            return false;
        }

        if (rule.action === '14') {
            this.writeToDebugLog(`# Skipping SMS notification rule "${rule.name}"`);

            return false;
        }

        if (!this.actionMap.has(rule.action)) {
            this.writeToDebugLog(`# Skipping rule "${rule.name}" which requires unsupported action ${rule.action}`);

            return false;
        }

        return true;
    };

    static actionValue(rule) {
        return !['1', '3'].includes(rule.action) ? rule['action-value'] : '';
    }

    uniqueRuleName(ruleName) {
        const ruleNumber = this.uniqueRuleNameMap.has(ruleName) ? this.uniqueRuleNameMap.get(ruleName) + 1 : 1;
        this.uniqueRuleNameMap.set(ruleName, ruleNumber);

        return ruleName + (ruleNumber > 1 ? ` ${ruleNumber}` : '');
    }

    exitWithNormalState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(0);
    }

    exitWithErrorState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(1);
    }

    writeToDebugLog(message) {
        if (this.debug) {
            console.warn(message);
        }
    }
}

const converter = new IngoToZimbraRuleConverter();
converter.initialiseApplication();