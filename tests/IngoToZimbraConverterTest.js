'use strict';

require('mocha');
const IngoToZimbraConverter = require('../src/IngoToZimbraRuleConverter');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// noinspection JSUnresolvedVariable
const expect = chai.expect;

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
    });

    before(() => {
        sandbox = sinon.sandbox.create();
        commandLineInterface = {
            version: sandbox.stub().returnsThis(),
            description: sandbox.stub().returnsThis(),
            arguments: sandbox.stub().returnsThis(),
            option: sandbox.stub().returnsThis(),
            action: sandbox.stub().callsFake((action) => {
                actionFunction = action
            }).returnsThis(),
            parse: sandbox.stub().callsFake(() => {
                actionFunction();
            }).returnsThis()
        };
        mySqlClient = sandbox.stub();
        phpSerializer = sandbox.stub();
        converter = new IngoToZimbraConverter(commandLineInterface, mySqlClient, phpSerializer);
    });

    after(() => {
        sandbox.reset();
    });

    let sandbox;
    let commandLineInterface;
    let mySqlClient;
    let phpSerializer;
    let converter;
    let actionFunction;
});