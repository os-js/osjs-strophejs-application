<p align="center">
  <img alt="OS.js Logo" src="https://raw.githubusercontent.com/os-js/gfx/master/logo-big.png" />
</p>

[OS.js](https://www.os-js.org/) is an [open-source](https://raw.githubusercontent.com/os-js/OS.js/master/LICENSE) desktop implementation for your browser with a fully-fledged window manager, Application APIs, GUI toolkits and filesystem abstraction.

[![Community](https://img.shields.io/badge/join-community-green.svg)](https://community.os-js.org/)
[![Donate](https://img.shields.io/badge/liberapay-donate-yellowgreen.svg)](https://liberapay.com/os-js/)
[![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=andersevenrud%40gmail%2ecom&lc=NO&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted)
[![Support](https://img.shields.io/badge/patreon-support-orange.svg)](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)

# OS.js v3 Strophe.js Application

This is the Strophe.js XMPP Chat Application for OS.js v3

## Installation

```bash
npm install --save --production @osjs/strophejs-application
npm run package:discover
```

## Usage

This application connects to a standard XMPP server using BOSCH.

### Using external servers

Set up a [punjab](https://github.com/twonds/punjab) server and simply configure this application to connect to the BOSH endpoint.

```
Host: http://my-punjab-server/http-bind
Username: username@gmail.com
Password: abc123
```

### Custom BOSCH Server using Prosody

If you use Docker, you can simply add [Prosody](https://prosody.im/) to your docker-compose file:

> **NOTE: You have to copy the default prosody configuration into `src/etc/prosody` first. Then enable the BOSCH http server module.**

> NOTE: A domain name or hostname resolved via DNS is recommended (`my-domain.com` in this example)

```
services:
  prosody:
    image: prosody/prosody
    ports:
      - "5280:5280"
    volumes:
      - "./logs/prosody:/var/log/prosody"
      - "./src/prosody/etc:/etc/prosody"
```

You can now add users via the docker container with:

```
docker-compose exec prosody prosodyctl adduser username@my-domain.com
```

Then in the OS.js application:

```
Host: http://my-domain.com/http-bind
Username: username@my-domain.com
Password: abc123
```
