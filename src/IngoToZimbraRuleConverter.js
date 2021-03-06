'use strict';

require('module');
const utf8length = require('utf8-length');

class IngoToZimbraRuleConverter {
    constructor(commandLineInterface, mySqlClient, phpSerializer) {
        this.commandLineInterface = commandLineInterface;
        this.mySqlClient = mySqlClient;
        this.phpSerializer = phpSerializer;
    }

    static handleConversionError(e) {
        console.error('Error while trying to fetch rules from database: ' + e);
        IngoToZimbraRuleConverter.exitWithErrorState();
    }

    static fixBrokenSerializedData(results) {
        return results[0].rules.normalize('NFC').replace(/s:(\d+):"(.*?)";/gu, (match, length, value) => `s:${utf8length(value)}:"${value}";`);
    }

    static validConditionFilter(condition) {
        return IngoToZimbraRuleConverter.isConditionComplete(condition) &&
            (IngoToZimbraRuleConverter.isSizeCondition(condition)
                ? IngoToZimbraRuleConverter.conditionHasSizeMatcher(condition)
                : IngoToZimbraRuleConverter.conditionHasSupportedMatcher(condition));
    };

    static isConditionComplete(condition) {
        return condition.field !== '' && condition.value !== '';
    }

    static isSizeCondition(condition) {
        return (condition.field.toLowerCase() === 'size');
    }

    static conditionHasSizeMatcher(condition) {
        const sizeMatchers = ['greater than', 'less than'];
        return sizeMatchers.includes(condition.match);
    }

    static conditionHasSupportedMatcher(condition) {
        const unsupportedMatchers = ['regex', 'less', 'greater', 'less than or equal to', 'greater than or equal to', 'over', 'under', 'greater than'];
        return !unsupportedMatchers.includes(condition.match);
    }

    static conditionSubject(condition) {
        const addressFields = ['from', 'to', 'cc'];
        const lowerCaseFields = ['subject'];

        // noinspection JSUnresolvedVariable
        let fieldName = condition.field;

        if (lowerCaseFields.includes(fieldName.toLowerCase())) {
            fieldName = fieldName.toLowerCase();
        }

        if (fieldName.toLowerCase() === 'size') {
            return `size`
        }

        return `${addressFields.includes(fieldName.toLowerCase()) ? 'address' : 'header'} "${fieldName}" ${addressFields.includes(fieldName.toLowerCase()) ? 'all' : ''}`
    }

    static conditionValue(condition) {
        return condition.field.toLowerCase() === 'size' ? this.properlyFormattedSizeComparator(condition) : this.properlyEscapedValueComparator(condition);
    }

    static properlyFormattedSizeComparator(condition) {
        return condition.value.toUpperCase().replace(/([A-Za-z])+/g, (match) => match.charAt(0)).replace(/[B\s]/g, '').replace(/[0-9.]+/g, (number) => Math.ceil(number));
    }

    static properlyEscapedValueComparator(condition) {
        return condition.value.replace(/\\?"/g, '\\"');
    }

    static actionValue(rule) {
        const actionTypeWhichRequireActionValues = ['1', '3', '6'];

        if (this.isNotificationRule(rule)) {
            return `"${rule['action-value']}" "Delivery notification" "A message has been delivered to your account which matched notification rule \\"${rule.name}\\""`
        }

        return !actionTypeWhichRequireActionValues.includes(rule.action) ? `"${rule['action-value']}"` : '';
    }

    static isNotificationRule(rule) {
        return rule.action === '13';
    }

    static exitWithNormalState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(0);
    }

    static exitWithErrorState() {
        // noinspection JSUnresolvedVariable, JSUnresolvedFunction
        process.exit(1);
    }

    static escapeRuleNamesEndingWithBackslashes(ruleName) {
        if (ruleName.slice(-1) === '\\') {
            ruleName += '\\';
        }
        return ruleName;
    }

    initialiseApplication() {
        this.bindExecutionContexts();
        this.configureCommandLineInterface();
        this.parseCommandLineArguments();
        this.outputHelpIfNoMailboxWasSpecified();
    }

    bindExecutionContexts() {
        this.prepareToFetchMailboxData = this.prepareToFetchMailboxData.bind(this);
        this.convertIngoRecordsToZimbraFilters = this.convertIngoRecordsToZimbraFilters.bind(this);
        this.rulesFromResults = this.rulesFromResults.bind(this);
        this.validRuleFilter = this.validRuleFilter.bind(this);
        this.writeRuleBody = this.writeRuleBody.bind(this);
        this.writeMailboxFooter = this.writeMailboxFooter.bind(this);
    }

    configureCommandLineInterface() {
        // noinspection JSAnnotator
        this.commandLineInterface.version('1.0.3')
            .description("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.")
            .arguments('<mailbox>')
            .option('-H, --database-host <host>', 'Database host (default localhost)')
            .option('-P, --database-port <port>', 'Database port (default 3306)')
            .option('-d, --database <database>', 'Database name (default horde)')
            .option('-u, --database-user <user>', 'Database user name')
            .option('-p, --database-password <password>', 'Database password')
            .option('-n, --no-exit', 'Suppress writing of exit statements')
            .option('-D, --debug', 'Write warnings when skipping invalid or unwanted rules')
            .action(this.prepareToFetchMailboxData);
    }

    parseCommandLineArguments() {
        // noinspection JSUnresolvedVariable
        this.commandLineInterface.parse(process.argv);
    }

    prepareToFetchMailboxData(mailbox) {
        this.initialiseMailbox(mailbox);
        this.initialiseConfiguration();
        this.validateConfiguration();
        this.initialiseDatabaseConnection();
        this.initialiseMaps();
        this.initialiseFlags();
        this.convertIngoPreferencesInDatabaseToZimbraRules();
    }

    outputHelpIfNoMailboxWasSpecified() {
        if (!process.argv.slice(2).length) {
            this.commandLineInterface.help();
        }
    }

    initialiseMailbox(mailbox) {
        const mailboxAddressParts = mailbox.split('@');
        this.mailboxId = mailboxAddressParts[0];
        this.mailbox = mailbox;
    }

    initialiseConfiguration() {
        this.config = {};

        // noinspection JSUnresolvedVariable
        this.config.host = this.commandLineInterface.databaseHost || 'localhost';
        // noinspection JSUnresolvedVariable
        this.config.port = this.commandLineInterface.databasePort || 3306;
        // noinspection JSUnresolvedVariable
        this.config.database = this.commandLineInterface.database || 'horde';
        // noinspection JSUnresolvedVariable
        this.config.user = this.commandLineInterface.databaseUser;
        // noinspection JSUnresolvedVariable
        this.config.password = this.commandLineInterface.databasePassword;
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
            this.commandLineInterface.help();
        }
    }

    initialiseDatabaseConnection() {
        this.db = this.mySqlClient.getInstance(this.config);
    }

    initialiseMaps() {
        this.initialiseRuleCombinationMap();
        this.initialiseActionMap();
        this.initialiseConditionMatcherMap();
        this.initialiseUniqueRuleNameMap();
    }

    initialiseRuleCombinationMap() {
        this.combineMap = new Map();
        this.combineMap.set('1', 'all');
        this.combineMap.set('2', 'any');
    }

    initialiseActionMap() {
        this.actionMap = new Map();
        this.actionMap.set('1', 'keep');
        this.actionMap.set('2', 'fileinto');
        this.actionMap.set('3', 'discard');
        this.actionMap.set('4', 'redirect');
        this.actionMap.set('5', 'keep redirect');
        this.actionMap.set('6', 'discard');
        this.actionMap.set('11', 'keep fileinto');
        this.actionMap.set('13', 'notify');
    }

    initialiseConditionMatcherMap() {
        this.matcherMap = new Map();
        this.matcherMap.set('equal', 'is');
        this.matcherMap.set('not contain', 'not_contains');
        this.matcherMap.set('not exist', 'not_contains');
        this.matcherMap.set('exists', 'contains');
        this.matcherMap.set('greater than', 'over');
        this.matcherMap.set('less than', 'under');
        this.matcherMap.set('begins with', 'contains');
        this.matcherMap.set('ends with', 'contains');
        this.matcherMap.set('not begins with', 'not_contains');
        this.matcherMap.set('not ends with', 'not_contains');
    }

    initialiseUniqueRuleNameMap() {
        this.uniqueRuleNameMap = new Map();
    }

    initialiseFlags() {
        // noinspection JSUnresolvedVariable
        this.debug = this.commandLineInterface.debug;
    }

    convertIngoPreferencesInDatabaseToZimbraRules() {
        this.fetchIngoPreferencesFromDatabase()
            .then(this.convertIngoRecordsToZimbraFilters)
            .catch(IngoToZimbraRuleConverter.handleConversionError);
    }

    fetchIngoPreferencesFromDatabase() {
        const query = 'SELECT pref_uid AS mailbox_id, pref_value as rules ' +
            'FROM horde_prefs ' +
            'WHERE pref_uid = ? ' +
            'AND pref_scope = ? ' +
            'AND pref_name = ?';

        // noinspection JSUnresolvedVariable
        return this.db.exec(query, [this.mailboxId, 'ingo', 'rules'])
    }

    convertIngoRecordsToZimbraFilters(results) {
        this.writeRuleScript(this.rulesFromResults(results));
        IngoToZimbraRuleConverter.exitWithNormalState();
    }

    rulesFromResults(results) {
        this.guardThatResultsWereReturned(results);
        const rules = this.arrayOfRulesFromRawResults(results);
        this.guardThatAtLeastOneRuleWasReturned(rules);
        return rules;
    }

    guardThatResultsWereReturned(results) {
        if (results.length === 0) {
            this.writeToDebugLog(`# No Ingo preferences found for ${this.mailbox}`);
            if (this.commandLineInterface.exit) {
                process.stdout.write('exit\n');
            }
            IngoToZimbraRuleConverter.exitWithNormalState();
        }
    }

    arrayOfRulesFromRawResults(results) {
        // noinspection JSUnresolvedVariable
        const data = IngoToZimbraRuleConverter.fixBrokenSerializedData(results);
        return this.convertSerializedRulesToArray(data);
    }

    guardThatAtLeastOneRuleWasReturned(rules) {
        if (rules.length === 0) {
            this.writeToDebugLog(`# No rules found for ${this.mailbox}`);
            if (this.commandLineInterface.exit) {
                process.stdout.write('exit\n');
            }
            IngoToZimbraRuleConverter.exitWithNormalState();
        }
    }

    writeRuleScript(rules) {
        this.writeMailboxHeader();
        this.writeAllValidRules(rules);
        this.writeMailboxFooter();
    }

    writeMailboxHeader() {
        // noinspection JSUnresolvedVariable
        process.stdout.write(`sm ${this.mailbox} \n`);
    }

    writeAllValidRules(rules) {
        rules.filter(this.validRuleFilter).forEach(this.writeRuleBody);
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

        if (rule.action === '12') {
            this.writeToDebugLog(`# Skipping flag rule "${rule.name}" because Zimbra rejects flag rules, even though they are claimed to be valid in the documentation`);

            return false;
        }

        if (!this.actionMap.has(rule.action)) {
            this.writeToDebugLog(`# Skipping rule "${rule.name}" which requires unsupported action ${rule.action}`);

            return false;
        }

        // noinspection EqualityComparisonWithCoercionJS
        if (['2', '4', '11'].includes(rule.action) && rule['action-value'] == '') {
            this.writeToDebugLog(`# Skipping rule "${rule.name}" because it requires an action value but provided none`);

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

    writeRuleBody(rule) {
        let conditionsString = '';
        // noinspection JSUnresolvedVariable
        rule.conditions.filter(IngoToZimbraRuleConverter.validConditionFilter).forEach((condition) => {
            // noinspection JSUnresolvedVariable
            conditionsString += `${IngoToZimbraRuleConverter.conditionSubject(condition)} ${this.conditionMatcher(condition)} "${IngoToZimbraRuleConverter.conditionValue(condition)}" `
        });

        // noinspection JSUnresolvedVariable
        process.stdout.write(`afrl "${this.uniqueRuleName(rule.name)}" ${rule.disable === true ? 'inactive' : 'active'} ${this.combineMap.get(rule.combine)} ${conditionsString} ${this.actionMap.get(rule.action)} ${IngoToZimbraRuleConverter.actionValue(rule)} ${rule.stop === '1' ? 'stop' : ''}\n`);
    }

    writeMailboxFooter() {
        // noinspection JSUnresolvedVariable
        if (this.commandLineInterface.exit) {
            process.stdout.write('exit\nexit\n');
        }
    }

    convertSerializedRulesToArray(data) {
        return this.phpSerializer.unserialize(data);
    }

    conditionMatcher(condition) {
        const matcher = condition.match;
        return this.matcherMap.has(matcher) ? this.matcherMap.get(matcher) : matcher;
    }

    uniqueRuleName(ruleName) {
        ruleName = IngoToZimbraRuleConverter.escapeRuleNamesEndingWithBackslashes(ruleName);

        const ruleNumber = this.nextRuleNumberForRuleName(ruleName);
        this.setCurrentNumberForRuleNameToNumber(ruleName, ruleNumber);

        return ruleName + (ruleNumber > 1 ? ` ${ruleNumber}` : '');
    }

    setCurrentNumberForRuleNameToNumber(ruleName, ruleNumber) {
        this.uniqueRuleNameMap.set(ruleName, ruleNumber);
    }

    nextRuleNumberForRuleName(ruleName) {
        return this.uniqueRuleNameMap.has(ruleName) ? this.uniqueRuleNameMap.get(ruleName) + 1 : 1;
    }

    writeToDebugLog(message) {
        if (this.debug) {
            console.warn(message);
        }
    };
}

module.exports = IngoToZimbraRuleConverter;