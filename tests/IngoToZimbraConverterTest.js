'use strict';

require('mocha');
const IngoToZimbraConverter = require('../src/IngoToZimbraRuleConverter');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const sinonStubPromse = require('sinon-stub-promise');

// noinspection JSUnresolvedVariable
const expect = chai.expect;
sinonStubPromse(sinon);
chai.use(sinonChai);
// noinspection JSUnresolvedVariable
sinon.assert.expose(chai.assert, {prefix: ""});

describe('IngoToZimbraConverter', () => {
    context('when initialised with a command line interface', () => {
        it('sets the script version', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator, BadExpressionStatementJS
            expect(commandLineInterface.version).to.have.been.called;
        });

        it('sets the application description version', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.description).to.have.been.calledWith("Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.");
        });

        it('expects the mailbox argument', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.arguments).to.have.been.calledWith('<mailbox>');
        });

        it('expects the database host option', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-H, --database-host <host>', 'Database host (default localhost)');
        });

        it('expects the database port option', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-P, --database-port <port>', 'Database port (default 3306)');
        });

        it('expects the database option', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-d, --database <database>', 'Database name (default horde)');
        });

        it('expects the database user option', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-u, --database-user <user>', 'Database user name');
        });

        it('expects the database password option', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-p, --database-password <password>', 'Database password');
        });

        it('expects the debug flag', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator
            expect(commandLineInterface.option).to.have.been.calledWith('-D, --debug', 'Write warnings when skipping invalid or unwanted rules');
        });

        it('sets a callback action for the command line interface', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator, BadExpressionStatementJS
            expect(commandLineInterface.action).to.have.been.called;
        });

        it('parses the command line arguments', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable, JSAnnotator, BadExpressionStatementJS
            expect(commandLineInterface.parse).to.have.been.calledWith(process.argv);
        });
    });

    context('when valid rules are returned', () => {
        it('writes out a command to set the mailbox', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('sm foo@bar.com \n');
        });

        it('includes two exit statements to make sure that zmprov exits automatically', () => {
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('exit\nexit\n');
        });

        it('translates action 1 to a keep rule', () => {
            returnedRules = [
                {
                    action: '1',
                    'action-value': null,
                    combine: '1',
                    conditions: [
                        {
                            field: 'From',
                            match: 'is',
                            value: 'bar@baz.com'
                        }
                    ],
                    name: 'The Rule',
                    stop: null
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "The Rule" active all address "From" all is "bar@baz.com"  keep  \n');
        });

        it('translates action 1 with stop to a keep rule with stop', () => {
            returnedRules = [
                {
                    action: '1',
                    'action-value': null,
                    combine: '2',
                    conditions: [
                        {
                            field: 'From',
                            match: 'contains',
                            value: 'baz@baz.com'
                        }
                    ],
                    name: 'Another Rule',
                    stop: '1'
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "Another Rule" active any address "From" all contains "baz@baz.com"  keep  stop\n');
        });

        it('translates action 2 to a fileinto rule', () => {
            returnedRules = [
                {
                    action: '2',
                    'action-value': 'Some/Folder',
                    combine: '2',
                    conditions: [
                        {
                            field: 'From',
                            match: 'contains',
                            value: 'baz@baz.com'
                        },
                        {
                            field: 'Subject',
                            match: 'contains',
                            value: 'SOMETHING'
                        }
                    ],
                    name: 'A Rule',
                    stop: null
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "A Rule" active any address "From" all contains "baz@baz.com" header "subject"  contains "SOMETHING"  fileinto "Some/Folder" \n');
        });

        it('translates action 3 to a discard rule', () => {
            returnedRules = [
                {
                    action: '3',
                    'action-value': null,
                    combine: '2',
                    conditions: [
                        {
                            field: 'From',
                            match: 'contains',
                            value: 'baz@baz.com'
                        },
                        {
                            field: 'Subject',
                            match: 'contains',
                            value: 'SOMETHING'
                        }
                    ],
                    name: 'A Rule',
                    stop: '1'
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "A Rule" active any address "From" all contains "baz@baz.com" header "subject"  contains "SOMETHING"  discard  stop\n');
        });

        it('translates action 4 to a discard rule', () => {
            returnedRules = [
                {
                    action: '4',
                    'action-value': 'foo@foo.com',
                    combine: '1',
                    conditions: [
                        {
                            field: 'Subject',
                            match: 'contains',
                            value: 'SOMETHING'
                        }
                    ],
                    name: 'A Rule',
                    stop: '1'
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "A Rule" active all header "subject"  contains "SOMETHING"  redirect "foo@foo.com" stop\n');
        });

        it('translates action 5 to a keep redirect rule', () => {
            returnedRules = [
                {
                    action: '5',
                    'action-value': 'foo@foo.com',
                    combine: '1',
                    conditions: [
                        {
                            field: 'Subject',
                            match: 'contains',
                            value: 'SOMETHING'
                        }
                    ],
                    name: 'A Rule',
                    stop: '1'
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "A Rule" active all header "subject"  contains "SOMETHING"  keep redirect "foo@foo.com" stop\n');
        });

        it('translates action 6 to a discard rule', () => {
            returnedRules = [
                {
                    action: '6',
                    'action-value': 'foo@foo.com',
                    combine: '1',
                    conditions: [
                        {
                            field: 'Subject',
                            match: 'contains',
                            value: 'SOMETHING'
                        }
                    ],
                    name: 'A Rule',
                    stop: '1'
                }
            ];
            phpSerializer.unserialize = () => {
                return returnedRules;
            };
            converter.initialiseApplication();
            // noinspection JSUnresolvedVariable
            expect(process.stdout.write).to.have.been.calledWith('afrl "A Rule" active all header "subject"  contains "SOMETHING"  discard  stop\n');
        });
    });

    const prepareStubs = () => {
        returnedRules = [
            {
                action: '2',
                'action-value': 'SomeFolder',
                combine: '2',
                conditions: [
                    {
                        field: 'Subject',
                        match: 'contains',
                        value: 'something'
                    },
                    {
                        field: 'From',
                        match: 'is',
                        value: 'foo@bar.com'
                    }
                ],
                name: 'Some Rule',
                stop: '1'
            }
        ];

        sandbox = sinon.sandbox.create();
        realExit = process.exit;
        process.exit = sandbox.spy();
        process.stdout.write = sandbox.spy();
        commandLineInterface = {
            version: sandbox.stub().returnsThis(),
            description: sandbox.stub().returnsThis(),
            arguments: sandbox.stub().returnsThis(),
            option: sandbox.stub().returnsThis(),
            action: sandbox.stub().callsFake((action) => {
                actionFunction = action;

                return this;
            }),
            parse: sandbox.stub().callsFake(() => {
                actionFunction('foo@bar.com');

                return this;
            }),
            databaseHost: 'localhost',
            databasePost: 3306,
            database: 'something',
            databaseUser: 'somebody',
            databasePassword: 'somePassword',
            help: sandbox.stub()
        };
        databaseInstance = {
            exec: sandbox.stub().returnsPromise().resolves([{rules: '{s:5:"Rules"}'}])
        };
        mySqlClient = {
            getInstance: sandbox.stub().returns(databaseInstance)
        };
        phpSerializer = {
            unserialize: () => {
                return returnedRules;
            }
        };
        converter = new IngoToZimbraConverter(commandLineInterface, mySqlClient, phpSerializer);
    };

    before(prepareStubs);

    after(() => {
        sandbox.reset();
        process.stdout.write = realStdoutWrite;
        process.exit = realExit;
    });

    let realStdoutWrite = process.stdout.write;
    let realExit;
    let returnedRules;
    let sandbox;
    let commandLineInterface;
    let mySqlClient;
    let databaseInstance;
    let phpSerializer;
    let converter;
    let actionFunction;
});