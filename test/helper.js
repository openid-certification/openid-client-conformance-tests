/* eslint-disable no-console */

const { Issuer, custom } = require('openid-client');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const tar = require('tar');
const got = require('got').extend({ timeout: parseInt(process.env.TIMEOUT, 10) || 7500 });
const url = require('url');
const base64url = require('base64url');
const crypto = require('crypto');

custom.setHttpOptionsDefaults({ timeout: parseInt(process.env.TIMEOUT, 10) || 7500 });

let rpId = 'node-openid-client';
const echoUrl = 'https://limitless-retreat-96294.herokuapp.com';
const root = process.env.ISSUER || 'https://rp.certification.openid.net:8080';
const redirectUri = `https://${rpId}.dev/cb`;

const [responseType, profile] = (() => {
  const fgrep = process.argv.findIndex(a => a === '--fgrep');
  if (fgrep === -1) {
    return [];
  }

  const value = process.argv[fgrep + 1];
  if (value.startsWith('@')) {
    return value.slice(1).split('-');
  }

  return [];
})();

if (responseType && profile) {
  rpId = `${rpId}-${profile}-${responseType}`;
}

console.log('RP Identifier', rpId);
const logsLocation = `${root}/log/${rpId}`;
console.log('Logs location', logsLocation);

before(async function () {
  const logIndex = await got(logsLocation);
  if (/Clear all test logs/.exec(logIndex.body)) {
    console.log('Clearing logs');
    await got(`${root}/clear/${rpId}`);
    console.log('Clearing logs - DONE');
  }
});

before(function kickstartEcho() {
  return got.get(echoUrl).catch(() => {});
});

if (profile) {
  const profileFolder = path.resolve('logs', profile);
  fse.emptyDirSync(`${profileFolder}/${responseType}`);
  after(async function () {
    const logIndex = await got(logsLocation);
    if (/Download tar file/.exec(logIndex.body)) {
      await new Promise((resolve, reject) => {
        console.log('Downloading logs');
        got.stream(`${root}/mktar/${rpId}`)
          .pipe(tar.x({
            cwd: profileFolder,
          }))
          .on('close', () => {
            fse.move(`${profileFolder}/${rpId}`, `${profileFolder}/${responseType}`, {
              clobber: true,
            }, (err) => {
              if (err) {
                reject();
              } else {
                resolve();
              }
            });
          })
          .on('error', reject);
      });
    }
  });
}

let testId;
global.log = function () {};

function myIt(...args) {
  if (args[0].startsWith('rp-')) {
    [testId] = args;
  }
  const localTestId = testId.includes(' ') ? testId.substring(0, testId.indexOf(' ')) : testId;
  if (args[1]) {
    it(args[0], async function () {
      if (profile) {
        const profileFolder = path.resolve('logs', profile);
        const rpFolder = `${profileFolder}/${rpId}`;
        const logFile = `${rpFolder}/${localTestId}.log`;
        fse.createFileSync(logFile);
        fs.appendFileSync(logFile, `${new Date().toISOString()} ${localTestId} test definition\n`);
        fs.appendFileSync(logFile, `  ${args[1]}\n`);
        fs.appendFileSync(logFile, `${new Date().toISOString()} executing\n\n`);
        global.log = function (...logargs) {
          logargs.unshift(new Date().toISOString());
          logargs.push('\n');
          fs.appendFileSync(logFile, logargs.join(' '));
        };
      }
      try {
        await args[1].call(this);
      } catch (err) {
        log('test failed, message:', err.message);
        throw err;
      }
      log('test finished, OK');
    });
  } else {
    it(args[0]);
  }
}
myIt.skip = it.skip;
myIt.only = it.only;

function myDescribe(...args) {
  if (args[0].startsWith('rp-')) {
    [testId] = args;
  }
  describe.apply(this, args);
}
myDescribe.skip = describe.skip;
myDescribe.only = describe.only;

module.exports = {
  noFollow: { followRedirect: false },
  root,
  it: myIt,
  describe: myDescribe,
  rpId,
  redirect_uri: redirectUri,
  redirect_uris: [redirectUri],
  async callback(client, ...params) {
    try {
      const res = await client.callback(...params);
      log('authentication callback succeeded', JSON.stringify(res, null, 4));
      return res;
    } catch (err) {
      log('authentication callback failed', err);
      throw err;
    }
  },
  async userinfoCall(client, ...params) {
    try {
      const res = await client.userinfo(...params);
      log('userinfo response', JSON.stringify(res, null, 4));
      return res;
    } catch (err) {
      log('userinfo failed', err);
      throw err;
    }
  },
  async authorize(...params) {
    const { pathname, query } = url.parse(params[0], true);
    log('authentication request to', pathname);
    log('authentication request parameters', JSON.stringify(query, null, 4));
    const response = await got(...params);
    const { query: callback } = url.parse(response.headers.location.replace('#', '?'), true);
    log('authentication response', JSON.stringify(callback, null, 4));
    return response;
  },
  async discover(test) {
    const issuer = await Issuer.discover(`${root}/${rpId}/${test}`);
    log('discovered', issuer.issuer, JSON.stringify(issuer, null, 4));
    return issuer;
  },
  async register(test, metadata, keystore) {
    const issuer = await Issuer.discover(`${root}/${rpId}/${test}`);
    log('discovered', issuer.issuer, JSON.stringify(issuer, null, 4));

    const properties = Object.assign({
      client_name: 'openid-client/v3.x (https://github.com/panva/node-openid-client)',
      redirect_uris: [redirectUri],
      contacts: ['dummy@dummy.org'],
      response_types: responseType ? [responseType.replace(/\+/g, ' ')] : ['code', 'id_token', 'code token', 'code id_token', 'id_token token', 'code id_token token', 'none'],
      grant_types: responseType && responseType.indexOf('token') === -1 ? ['authorization_code'] : ['implicit', 'authorization_code'],
    }, metadata);

    log('registering client', JSON.stringify(properties, null, 4));
    const client = await issuer.Client.register(properties, { jwks: (keystore && keystore.toJWKS(true)) || undefined });
    log('registered client', client.client_id, JSON.stringify(client.metadata, null, 4));
    client[custom.clock_tolerance] = 5;
    return { issuer, client };
  },
  random() { return base64url(crypto.randomBytes(32)); },
  reject() { throw new Error('expected a rejection'); },
  echo: {
    async post(body, type) {
      await got.post(echoUrl, { body, headers: { 'content-type': type } });
      return `${echoUrl}/${Date.now()}`;
    },
    async get() {
      const { body } = await got.get(echoUrl);
      return body;
    },
  },
};
