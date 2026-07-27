// Assinatura digital XMLDSig da NF-e: leitura do certificado A1 (.pfx) com node-forge
// + assinatura RSA-SHA1 via Web Crypto (SubtleCrypto). Sem dependência de node:crypto.

import forge from "npm:node-forge@1.3.1";
import { NFE_NS, DS_NS, el, canon } from "./nfeXml.ts";

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function ab2binstr(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < b.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, b.subarray(i, i + CHUNK));
  }
  return s;
}

// Lê o PFX e devolve a chave privada (PKCS8 DER) e o certificado (base64).
export function parsePfx(pfxArrayBuffer, senha) {
  const der = forge.asn1.fromDer(ab2binstr(pfxArrayBuffer));
  const p12 = forge.pkcs12.pkcs12FromAsn1(der, senha || "");

  let certBag = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])[0];
  const cert = certBag?.cert;
  if (!cert) throw new Error("Certificado não encontrado no PFX.");

  let keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  let key = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]?.key;
  if (!key) {
    let kb = p12.getBags({ bagType: forge.pki.oids.keyBag });
    key = (kb[forge.pki.oids.keyBag] || [])[0]?.key;
  }
  if (!key) throw new Error("Chave privada não encontrada no PFX (verifique a senha).");

  const rsaAsn1 = forge.pki.privateKeyToAsn1(key);
  const pkcs8 = forge.pki.wrapRsaPrivateKey(rsaAsn1);
  const pkcs8Bin = forge.asn1.toDer(pkcs8).getBytes();
  const pkcs8Bytes = new Uint8Array(pkcs8Bin.length);
  for (let i = 0; i < pkcs8Bin.length; i++) pkcs8Bytes[i] = pkcs8Bin.charCodeAt(i) & 0xff;

  const certPem = forge.pki.certificateToPem(cert);
  const certB64 = certPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");

  return { pkcs8: pkcs8Bytes, certB64 };
}

export async function importSignKey(pkcs8) {
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-1" } },
    false,
    ["sign"]
  );
}

// Assina o infNFe e devolve a árvore <Signature> (namespace xmldsig) pronta para inserção.
export async function signInfNFe(infNFeTree, cryptoKey, certB64) {
  const infCanon = canon(infNFeTree, { apex: true });
  const digestBuf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(infCanon));
  const digestB64 = b64(digestBuf);

  const signedInfo = el("SignedInfo", DS_NS, {}, [
    el("CanonicalizationMethod", DS_NS, { Algorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }, []),
    el("SignatureMethod", DS_NS, { Algorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" }, []),
    el("Reference", DS_NS, { URI: "#" + infNFeTree.attrs.Id }, [
      el("Transforms", DS_NS, {}, [
        el("Transform", DS_NS, { Algorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" }, []),
      ]),
      el("DigestMethod", DS_NS, { Algorithm: "http://www.w3.org/2000/09/xmldsig#sha1" }, []),
      el("DigestValue", DS_NS, {}, [digestB64]),
    ]),
  ]);

  const siCanon = canon(signedInfo, { apex: true });
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(siCanon));
  const sigB64 = b64(sigBuf);

  return el("Signature", DS_NS, {}, [
    signedInfo,
    el("SignatureValue", DS_NS, {}, [sigB64]),
    el("KeyInfo", DS_NS, {}, [
      el("X509Data", DS_NS, {}, [
        el("X509Certificate", DS_NS, {}, [certB64]),
      ]),
    ]),
  ]);
}