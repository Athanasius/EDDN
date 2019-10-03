## EDDN - Elite: Dangerous Data Network

The **Elite: Dangerous Data Network** is a system for willing Commanders to share dynamic data about the galaxy with others.  
By pooling data in a common format, tools and analyses can be produced that add an even greater depth and vibrancy to the in-game universe.

EDDN is not run by or affiliated with [Frontier Developments](http://www.frontier.co.uk/).

Hosting has been very generously provided by [Vivio Technologies](https://www.viviotech.net/), until 2017.  
Hosting is now provided by the [EDCD community](https://edcd.github.io/).

### [Using EDDN](https://github.com/EDSM-NET/EDDN/wiki)

### [EDDN Status](https://eddn.edcd.io/)

## Setup Guide

### Python 2.7
You'll need python 2.7, the code is not yet python 3.x compatible.

### You need to install the eddn package
As coded you will need to install the eddn package, else anything under
`eddn.` won't be found by imports.

`python2.7 setup.py install`

or, if you want to not globally install it:

`python2.7 setup.py install --user`

XXX: install_requires needs strict_rfc3339 adding.

### You need a mysql/mariadb database for Monitor.py

  This is used to store...

### Configuration

  To see what you can configure check `src/eddn/conf/Settings.py`.  You
don't need to edit this to make configuration changes as you can specify
`--config <path to file>` at runtime.

#### TLS Certificate

  You'll need a TLS certificate to run EDDN at all.  Probably the
easiest and most convenient method to acquire one is to utilise
<https://letsencrypt.org/>'s free service.

#### Database

  The database is only required if you wish to use Monitor.py to make
statistics available.  The schema is in [schema.sql].  Set up a database
for this and then:
		mysql -u user -p < schema.sql
