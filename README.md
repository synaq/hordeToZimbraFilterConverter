# ingo2zimbra

A node.js command line tool to convert Ingo message filter rules stored using
the standard Horde preferences mechanism to Zimbra filter rules.

The script accepts database configuration for the Horde database, and the target
mailbox address. As Horde has no concept of separate domains, the domain in the
fully qualified address is simply used to create the Zimbra script in the correct
format.

The output from the script can be piped to Zimbra's `zmprov` command line utility
to import the converted rules into the target mailbox.

## Installation

Yarn is preferred

```bash
yarn global add ingo2zimbra
```

Or use NPM if desired

```bash
npm install -g ingo2zimbra
```

## Usage

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
    -n, --no-exit                       Suppress writing of exit statements
    -D, --debug                         Write warnings when skipping invalid or unwanted rules
    -h, --help                          output usage information
```

### Options

The *database user* and *database password* fields are always required, as is the mailbox.

The *no-exit* flag will cause the script not to output `exit` statements after each mailbox,
which is useful if it is desired to concatinate the output from multiple calls into a bulk
`zmprov` script, for rule migrations into multiple mailboxes. The script will still output
the `sm <mailbox>` statement before each mailbox.

The *debug* flag sends debugging output to `stderr`, see [debugging](#debugging) below for
more information.

### Examples

To generate rules for a single mailbox, the command might be used thus (assuming a local 
database using the default database name):

```bash
ingo2zimbra -u someUser -p SomePassword123$ foo@bar.com | zmprov
```

```
sm 0718769860@mymtnmail.co.za
afrl "Send mail to my other mailbox" active all address "To" all contains "Some Alias"  redirect "bar@baz.com" stop
afrl "Mail for another one of my other identities" active all address "To" all contains "Some Other Alias"  redirect "baz@baz.com" stop
afrl "No big mail please" active all size over "1000K"  discard  stop
exit
exit
```

To debug the output for a mailbox, to check why some rules might be missing:

```bash
ingo2zimbra -D -u someUser -p SomePassword123$ foo@bar.com
```

```
sm foo@bar.com
# Skipping flag rule "Some Flag Rule" because Zimbra rejects flag rules, even though they are claimed to be valid in the documentation
afrl "No mail from this guy" active any address "From" all contains "Jerk" header "subject"  contains "Something"  discard  stop
exit
exit
```

To create a bulk migration script, assuming you have a list of mailbox IDs you want
to migrate rules for, and the mailboxes are already provisioned and have all folders
in place:

```bash
for MAILBOX in `cat /tmp/list-of-ids`; do ingo2zimbra -n -u someUser -p SomePassword123$ ${MAILBOX}@target-domain.com >> /tmp/bulk-migration-script; done

# Remember to add two exit statements to the very end, so that zmprov will exit after consuming the script
echo exit >> /tmp/bulk-migration-script
echo exit >> /tmp/bulk-migration-script

zmprov < /tmp/bulk-migration-script
```

```
sm foo@bar.com
afrl "Received faxes" inactive all address "From" all is "some@faxmail.com"  fileinto "INBOX.Faxes" stop
afrl "Some Junk" active all address "From" all contains "Some Spammer <spammer@spammer.com"  fileinto "INBOX.trash" stop
sm bar@bar.com
afrl "Send big stuff to my other ISP" inactive all size over "300000"  redirect "me@someisp.com" stop
afrl "Unwanted Marketing" active all address "From" all contains "Some Guy"  discard
sm baz@bar.com
afrl "No Twitter" active all address "From" all contains "twitter"  discard  stop
afrl "No Facebook" active all address "From" all contains "Facebook"  fileinto "Trash" stop
sm foobar@bar.com
afrl "Some Spam" active all header "List-Id"  contains "SPAM.ER" address "From" all contains "spammer@spammer.com"  fileinto "INBOX.spam" stop
afrl "Broken spam rule" active all header "List-Id"  contains "spammer@spammer.com" address "From" all contains "another@spammer.com"  fileinto "INBOX.drafts" stop
sm foobaz@bar.com
afrl "Send social media stuff to my GMail" active all address "From" all contains "zorpia" address "From" all contains "facebook" address "From" all contains "groupon"  keep redirect "me@gmail.com" stop
afrl "Throw away some social media stuff locally" active all address "From" all contains "zorp" address "From" all matches "groupon"  discard  stop
```

## Limitations

Some rules are not required or supported by Zimbra, or are not converted because
they are not required in a Zimbra environment. Here is a brief list of unsupported
or omitted rules:

* *Redirect with reason*: This is remapped to a simple `discard` rule to save on traffic.
* *Whitelist*: An internal Ingo rule, this is ignored.
* *Blacklist*: An internal Ingo rule, this is ignored.
* *Forwardt*: An internal Ingo rule, this is ignored.
* *Vacation*: An internal Ingo rule, this is ignored.
* *Rules that check for X-Spam-Flag*: This is redundant as Zimbra's default filters will file it correctly into the Junk folder.
* *Rules with the flag action*: This is claimed to be supported in Zimbra documentation, but rejected in practice.
* *Rules with invalid condition statements*: Ignored
* *Rules with invalid action configurations*: Ignored

<a name="debugging"></a>
## Debugging

If the output appears to be missing some rules which you expect in the script, you
can check if the rules are being intentionally skipped due to the above limitations by
requesting debug output using the `-D` or `--debug` flags.

This causes the command to write additional output preceded with a #, showing
why certain rules are omitted, to the `stderr` stream.

## Development

Pull requests are always welcome and appreciated. We only ask the following as a courtesy
to make the PR easier to integrate:

- All PRs should attempt to roughly follow the existing coding style
- All changes must be covered by unit tests, included in the PR
- All unit tests must be passing

Yarn is our preferred package manager for the project. To install all dependencies:

```bash
yarn install
```

To run the tests:

```bash
yarn run test
```

## How rules are processed

An in-depth speficication for how rules are processed, generated from the latest output
from our Mocha test runner, is available on the Wiki page here:

https://github.com/synaq/ingo2zimbra/wiki/In-depth-description-of-processing