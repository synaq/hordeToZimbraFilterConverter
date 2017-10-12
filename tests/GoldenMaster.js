'use strict';

require('mocha');
require('chai');
const fs = require('fs');
const exec = require('child_process').exec;

describe('ingo2zimbra', () => {
    context('when run with known parameters on the staging test database', () => {
        it('produces the same output as the master file', () => {
            const master = fs.readFileSync('tests/fixtures/93_rules.txt');

            exec('../index.js -D -H 10.1.5.2 -u devuser -p !@synaqIMPORT 0834127047@mymtnmail.co.za', (error, stdout) => {
                // noinspection JSUnresolvedVariable
                expect(stdout).to.equal(master);
            });
        });

        it('produces the same warnings as the master set', () => {
            const master = fs.readFileSync('tests/fixtures/93_rules_warnings.txt');

            exec('../index.js -D -H 10.1.5.2 -u devuser -p !@synaqIMPORT 0834127047@mymtnmail.co.za', (error, stdout, stderr) => {
                // noinspection JSUnresolvedVariable
                expect(stderr).to.equal(master);
            });
        });
    });
});