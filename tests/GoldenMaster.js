'use strict';

require('mocha');
const assert = require("assert");
const fs = require('fs');
const exec = require('child_process').exec;

describe('ingo2zimbra', () => {
    context('when run with known parameters on the staging test database', () => {
        it('does not exit with an error status', (done) => {
            exec('tests/../index.js -D -H 10.1.5.2 -u devuser -p !@synaqIMPORT 0834127047@mymtnmail.co.za', (error) => {
                assert.equal(null, error);
                done();
            });
        });

        it('produces the same output as the master file', (done) => {
            const master = fs.readFileSync('tests/fixtures/93_rules.txt');

            exec('tests/../index.js -D -H 10.1.5.2 -u devuser -p !@synaqIMPORT 0834127047@mymtnmail.co.za', (error, stdout) => {
                assert.equal(stdout, master);
                done();
            });
        });

        it('produces the same warnings as the master set', (done) => {
            const master = fs.readFileSync('tests/fixtures/93_rules_warnings.txt');

            exec('tests/../index.js -D -H 10.1.5.2 -u devuser -p !@synaqIMPORT 0834127047@mymtnmail.co.za', (error, stdout, stderr) => {
                assert.equal(master, stderr);
                done();
            });
        });
    });
});