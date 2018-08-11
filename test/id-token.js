'use strict';

const { forEach } = require('lodash');
const jose = require('node-jose'); // eslint-disable-line import/no-extraneous-dependencies
const {
  noFollow,
  redirect_uri,
  register,
  reject,
  describe,
  authorize,
  authorizationCallback,
  it,
} = require('./helper');

const assert = require('assert');

describe('ID Token', function () {
  describe('rp-id_token-bad-sig-rs256', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-bad-sig-rs256', { id_token_signed_response_alg: 'RS256' });
        assert.equal(client.id_token_signed_response_alg, 'RS256');
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'invalid signature');
        }
      });
    });
  });

  it('rp-id_token-bad-sig-hs256', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-bad-sig-hs256', { id_token_signed_response_alg: 'HS256' });
    assert.equal(client.id_token_signed_response_alg, 'HS256');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    try {
      await authorizationCallback(client, redirect_uri, params, { response_type });
      reject();
    } catch (err) {
      assert.equal(err.message, 'invalid signature');
    }
  });

  it('rp-id_token-sig+enc', async function () {
    const response_type = 'code';
    const keystore = jose.JWK.createKeyStore();
    await keystore.generate('RSA', 512);
    const { client } = await register('rp-id_token-sig+enc', { id_token_signed_response_alg: 'RS256', id_token_encrypted_response_alg: 'RSA1_5' }, keystore);
    assert.equal(client.id_token_signed_response_alg, 'RS256');
    assert.equal(client.id_token_encrypted_response_alg, 'RSA1_5');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    const tokens = await authorizationCallback(client, redirect_uri, params, { response_type });
    assert(tokens);
  });

  describe('rp-id_token-sig-rs256', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-sig-rs256', { id_token_signed_response_alg: 'RS256' });
        assert.equal(client.id_token_signed_response_alg, 'RS256');
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        const tokens = await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
        assert(tokens);
      });
    });
  });

  it('rp-id_token-sig-hs256', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-sig-hs256', { id_token_signed_response_alg: 'HS256' });
    assert.equal(client.id_token_signed_response_alg, 'HS256');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    const tokens = await authorizationCallback(client, redirect_uri, params, { response_type });
    assert(tokens);
  });

  it('rp-id_token-sig-es256', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-sig-es256', { id_token_signed_response_alg: 'ES256' });
    assert.equal(client.id_token_signed_response_alg, 'ES256');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    const tokens = await authorizationCallback(client, redirect_uri, params, { response_type });
    assert(tokens);
  });

  it('rp-id_token-sig+enc-a128kw', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-sig+enc-a128kw', {
      id_token_signed_response_alg: 'RS256',
      id_token_encrypted_response_alg: 'A128KW',
      id_token_encrypted_response_enc: 'A256CBC-HS512',
    });
    assert.equal(client.id_token_signed_response_alg, 'RS256');
    assert.equal(client.id_token_encrypted_response_alg, 'A128KW');
    assert.equal(client.id_token_encrypted_response_enc, 'A256CBC-HS512');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    const tokens = await authorizationCallback(client, redirect_uri, params, { response_type });
    assert(tokens);
  });

  it('rp-id_token-sig-none @code-basic,@code-config,@code-dynamic', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-sig-none', { id_token_signed_response_alg: 'none' });
    assert.equal(client.id_token_signed_response_alg, 'none');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    const tokens = await authorizationCallback(client, redirect_uri, params, { response_type });
    assert(tokens.id_token);
  });

  describe('rp-id_token-bad-c_hash', function () {
    forEach({
      '@code+id_token-hybrid': 'code id_token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-bad-c_hash', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'c_hash mismatch');
        }
      });
    });
  });

  describe('rp-id_token-missing-c_hash', function () {
    forEach({
      '@code+id_token-hybrid': 'code id_token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-missing-c_hash', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'missing required property c_hash');
        }
      });
    });
  });

  describe('rp-id_token-bad-at_hash', function () {
    forEach({
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-bad-at_hash', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'at_hash mismatch');
        }
      });
    });
  });

  describe('rp-id_token-missing-at_hash', function () {
    forEach({
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-missing-at_hash', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'missing required property at_hash');
        }
      });
    });
  });

  describe('rp-id_token-issuer-mismatch', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-issuer-mismatch', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'unexpected iss value');
        }
      });
    });
  });

  describe('rp-id_token-iat', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-iat', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'missing required JWT property iat');
        }
      });
    });
  });


  it('rp-id_token-bad-sig-es256', async function () {
    const response_type = 'code';
    const { client } = await register('rp-id_token-bad-sig-es256', { id_token_signed_response_alg: 'ES256' });
    assert.equal(client.id_token_signed_response_alg, 'ES256');
    const authorization = await authorize(client.authorizationUrl({ redirect_uri, response_type }), noFollow);

    const params = client.callbackParams(authorization.headers.location);
    try {
      await authorizationCallback(client, redirect_uri, params, { response_type });
      reject();
    } catch (err) {
      assert.equal(err.message, 'invalid signature');
    }
  });

  describe('rp-id_token-aud', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-aud', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'aud is missing the client_id');
        }
      });
    });
  });

  describe('rp-id_token-sub', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-sub', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'missing required JWT property sub');
        }
      });
    });
  });

  describe('rp-id_token-kid-absent-single-jwks', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-kid-absent-single-jwks', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        const tokens = await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
        assert(tokens);
      });
    });
  });

  describe('rp-id_token-kid-absent-multiple-jwks', function () {
    forEach({
      '@code-basic': 'code',
      '@id_token-implicit': 'id_token',
      '@id_token+token-implicit': 'id_token token',
      '@code+id_token-hybrid': 'code id_token',
      '@code+token-hybrid': 'code token',
      '@code+id_token+token-hybrid': 'code id_token token',
    }, (response_type, profile) => {
      it(profile, async function () {
        const { client } = await register('rp-id_token-kid-absent-multiple-jwks', { });
        const nonce = String(Math.random());
        const authorization = await authorize(client.authorizationUrl({ redirect_uri, nonce, response_type }), noFollow);

        const params = client.callbackParams(authorization.headers.location.replace('#', '?'));
        try {
          await authorizationCallback(client, redirect_uri, params, { nonce, response_type });
          reject();
        } catch (err) {
          assert.equal(err.message, 'multiple matching keys, kid must be provided');
        }
      });
    });
  });
});
