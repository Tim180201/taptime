import { createServer } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { expect, it } from 'vitest';
import { SupabaseJwtAccessTokenVerifier } from '../src/index.js';

it('carries only the verified assurance level and preserves the existing identity shape', async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...await exportJWK(publicKey), kid:'t068a', alg:'ES256' };
  const server = createServer((_,res) => { res.setHeader('content-type','application/json'); res.end(JSON.stringify({keys:[jwk]})); });
  await new Promise<void>(r => server.listen(0,'127.0.0.1',r));
  const address = server.address();
  if (!address || typeof address==='string') throw new Error('Local JWKS not listening');
  const issuer = `http://127.0.0.1:${address.port}/auth/v1`;
  try {
    const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({issuer,
      jwksUrl:new URL(`${issuer}/.well-known/jwks.json`),allowedAlgorithms:['ES256']});
    for (const aal of ['aal1','aal2','invented']) {
      const token = await new SignJWT({aal,email:'test@example.invalid',phone:'',role:'authenticated',
        is_anonymous:false,session_id:'91000000-0000-4000-8000-000000000001'})
        .setProtectedHeader({alg:'ES256',typ:'JWT',kid:'t068a'}).setIssuer(issuer)
        .setSubject('92000000-0000-4000-8000-000000000001').setAudience('authenticated')
        .setIssuedAt().setExpirationTime('5m').sign(privateKey);
      const result = await verifier.verify(token);
      if (aal==='invented') expect(result).toEqual({status:'rejected',reason:'unsuitable_token'});
      else expect(result).toEqual({status:'verified',aal,identity:{issuer,subject:'92000000-0000-4000-8000-000000000001'}});
    }
  } finally { await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
});
