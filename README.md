#ingo2zimbra

A node.js command line tool to convert Ingo message filter rules stored using
the standard Horde preferences mechanism to Zimbra filter rules.

The script accepts database configuration for the Horde database, and the target
mailbox address. As Horde has no concept of separate domains, the domain in the
fully qualified address is simply used to create the Zimbra script in the correct
format.

The output from the script can be piped to Zimbra's `zmprov` command line utility
to import the converted rules into the target mailbox.

##Installation

Yarn is preferred

```bash
yarn global add ingo2zimbra
```

Or use NPM if desired

```bash
npm install -g ingo2zimbra
```

##Usage

Basic usage information can be obtained by running:

```bash
ingo2zimbra --help
```

```
  Usage: ingo2zimbra [options] <mailbox>

  Read Horde / Ingo rules from the preferences database and write a script which can be piped to Zimbra's zmprov command.


  Options:

    -V, --version                       output the version number
    -H, --database-host <host>          Database host (default localhost)
    -P, --database-port <port>          Database port (default 3306)
    -d, --database <database>           Database name (default horde)
    -u, --database-user <user>          Database user name
    -p, --database-password <password>  Database password
    -D, --debug                         Write warnings when skipping invalid or unwanted rules
    -h, --help                          output usage information
```

##Limitations

Some rules are not required or supported by Zimbra, or are not converted because
they are not required in a Zimbra environment. Here is a brief list of unsupported
or omitted rules:

* *Redirect with reason*: This is remapped to a simply `discard` rule to save on traffic.
* *Whitelist*: An internal Ingo rule, this is ignored.
* *Blacklist*: An internal Ingo rule, this is ignored.
* *Forwardt*: An internal Ingo rule, this is ignored.
* *Vacation*: An internal Ingo rule, this is ignored.
* *Rules that check for X-Spam-Flag*: This is redundant as Zimbra's default filters will file it correctly into the Junk folder.
* *Rules with invalid condition statements*: Ignored
* *Rules with invalid action configurations*: Ignored

##Debugging

If the output appears to be missing some rules which you expect in the script, you
can check if the rules are being intentionally skipped due to the above limitations by
requesting debug output using the `-D` or `--debug` flags.

The debug output is available on the command's `stderr` stream.

##Development

Pull requests are always welcome and appreciated. Our only request is that
any PR we receive should roughly conform to the existing coding style, and that
all tests should be passing.

Yarn is our preferred package manager for the project. To install all dependencies:

```bash
yarn install
```

To run the tests:

```bash
yarn run test
```