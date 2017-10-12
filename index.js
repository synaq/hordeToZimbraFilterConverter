#!/usr/bin/env node
'use strict';

const application = require("commander");
const mysql = require('nodejs-mysql').default;
const phpSerializer = require("serialize-like-php");
const IngoToZimbraRuleConverter = require('./src/IngoToZimbraRuleConverter');

const converter = new IngoToZimbraRuleConverter(application, mysql, phpSerializer);
converter.initialiseApplication();