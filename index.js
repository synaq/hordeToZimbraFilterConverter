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
        this.validRuleFilter = this.validRuleFilter.bind(this);

        application.version('0.0.1')
            .description("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.")
            .arguments('<mailbox>')
            .option('-H, --database-host <host>', 'Database host (default localhost)')
            .option('-P, --database-port <port>', 'Database port (default 3306)')
            .option('-d, --database <database>', 'Database name (default horde)')
            .option('-u, --database-user <user>', 'Database user name')
            .option('-p, --database-password <password>', 'Database password')
            .option('-D, --debug', 'Write warnings when skipping invalid or unwanted rules')
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
        this.mailbox = mailbox;
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
        this.actionMap.set('6', 'discard');
        this.actionMap.set('11', 'keep fileinto');
        this.actionMap.set('12', 'flag');

        this.matcherMap = new Map();
        this.matcherMap.set('equal', 'is');

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

                // noinspection JSUnresolvedVariable
                process.stdout.write(`sm ${this.mailbox} \n`);

                rules.filter(this.validRuleFilter).forEach((rule) => {
                    let conditionsString = '';
                    // noinspection JSUnresolvedVariable
                    rule.conditions.filter(IngoToZimbraRuleConverter.validConditionFilter).forEach((condition) => {
                        // noinspection JSUnresolvedVariable
                        conditionsString += `${IngoToZimbraRuleConverter.conditionSubject(condition)} ${this.conditionMatcher(condition)} "${condition.value}" `
                    });

                    // noinspection JSUnresolvedVariable
                    process.stdout.write(`afrl "${this.uniqueRuleName(rule.name)}" ${rule.disable === true ? 'inactive' : 'active'} ${this.combineMap.get(rule.combine)} ${conditionsString} ${this.actionMap.get(rule.action)} ${IngoToZimbraRuleConverter.actionValue(rule)} ${rule.stop === '1' ? 'stop' : ''}\n`);
                });

                // noinspection JSUnresolvedVariable
                process.stdout.write('exit\nexit\n');
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
        return results[0].rules.normalize('NFKD').replace(/s:(\d+):"(.*?)";/gu, (match, length, value) => `s:${value.length}:"${value}";`);
    }

    validRuleFilter(rule) {
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

        // noinspection JSUnresolvedVariable
        if (rule.conditions === undefined || rule.conditions.filter(IngoToZimbraRuleConverter.validConditionFilter).length === 0) {
            this.writeToDebugLog(`# Skipping rule "${rule.name}" because it has no valid conditions`);

            return false;
        }

        // noinspection JSUnresolvedVariable
        if (rule.name === 'spam' && rule.combine === '1' && rule.conditions[0].field === 'X-Spam-Flag' && rule.conditions[0].match === 'contains' && rule.conditions[0].value === 'YES' && rule.action === '2' && rule['action-value'] === 'INBOX.spam') {
            this.writeToDebugLog(`# Skipping redundant spam rule "${rule.name}"`);

            return false;
        }

        return true;
    };

    static validConditionFilter(condition) {
        return condition.value !== ''
    };

    static conditionSubject(condition) {
        const addressFields = ['from', 'to', 'cc'];
        const lowerCaseFields = ['subject'];

        // noinspection JSUnresolvedVariable
        let fieldName = condition.field;

        if (lowerCaseFields.includes(fieldName.toLowerCase())) {
            fieldName = fieldName.toLowerCase();
        }

        return `${addressFields.includes(fieldName.toLowerCase()) ? 'address' : 'header'} "${fieldName}" ${addressFields.includes(fieldName.toLowerCase()) ? 'all' : ''}`
    }

    conditionMatcher(condition) {
        let matcher = condition.match;
        matcher = this.matcherMap.has(matcher) ? this.matcherMap.get(matcher) : matcher;

        return matcher.match(/.* with$/) ? 'contains' : matcher;
    }

    static actionValue(rule) {
        return !['1', '3'].includes(rule.action) ? `"${rule['action-value']}"` : '';
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