import { test } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { hostLooksPrivate, lookupPublicAddress, privateIp } from "./public-fetch.ts";
import { publicFetch } from "./public-fetch.ts";

test("privateIp rejects IPv4-mapped IPv6 in dotted and hexadecimal forms", () => {
  assert.equal(privateIp("::ffff:10.0.0.1"), true);
  assert.equal(privateIp("::ffff:0a00:0001"), true);
  assert.equal(privateIp("0:0:0:0:0:ffff:c0a8:0101"), true);
  assert.equal(privateIp("0:0:0:0:0:0:0:1"), true);
  assert.equal(privateIp("::"), true);
  assert.equal(privateIp("fe90::1"), true);
  assert.equal(privateIp("ff02::1"), true);
  assert.equal(privateIp("::ffff:8.8.8.8"), false);
  assert.equal(privateIp("192.0.3.1"), false);
  assert.equal(privateIp("192.2.1.1"), false);
  assert.equal(privateIp("198.51.99.1"), false);
  assert.equal(privateIp("203.0.112.1"), false);
});

test("hostLooksPrivate handles bracketed IPv6 URL hostnames", () => {
  assert.equal(hostLooksPrivate("[::ffff:c0a8:0101]"), "private ip");
  assert.equal(hostLooksPrivate("[2001:4860:4860::8888]"), null);
});

test("connection lookup refuses a private address instead of returning it to undici", async () => {
  const result = await new Promise<Error | null>((resolve) => {
    lookupPublicAddress("localhost", { family: 0, all: false }, (error) => resolve(error));
  });
  assert.ok(result);
  assert.match(result.message, /private ip/);
});

test("publicFetch rejects a DNS rebinding between preflight and the actual connection lookup", async () => {
  const originalPromiseLookup = dnsPromises.lookup;
  const originalLookup = dns.lookup;
  let connectionLookupCalled = false;
  try {
    dnsPromises.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as typeof dnsPromises.lookup;
    dns.lookup = ((hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address?: unknown) => void) => {
      connectionLookupCalled = true;
      callback(null, [{ address: "127.0.0.1", family: 4 }]);
    }) as typeof dns.lookup;
    await assert.rejects(() => publicFetch("http://rebinding.example.test/"), /private ip|fetch failed|EPRIVATEIP/);
    assert.equal(connectionLookupCalled, true);
  } finally {
    dnsPromises.lookup = originalPromiseLookup;
    dns.lookup = originalLookup;
  }
});
