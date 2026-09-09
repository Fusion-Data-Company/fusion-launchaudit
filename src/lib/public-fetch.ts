import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import net from "node:net";
import { Agent } from "undici";

type ResolvedAddress = { address: string; family: number };

function unbracket(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function ipv6Bytes(input: string): number[] | null {
  const value = unbracket(input).split("%", 1)[0].toLowerCase();
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const piece of part.split(":")) {
      if (piece.includes(".")) {
        if (!net.isIPv4(piece)) return null;
        const octets = piece.split(".").map(Number);
        out.push((octets[0] << 8) + octets[1], (octets[2] << 8) + octets[3]);
      } else if (/^[0-9a-f]{1,4}$/.test(piece)) out.push(parseInt(piece, 16));
      else return null;
    }
    return out;
  };
  const left = parse(halves[0]);
  const right = parse(halves[1] ?? "");
  if (!left || !right || (halves.length === 1 && left.length !== 8) || (halves.length === 2 && left.length + right.length >= 8)) return null;
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right] : left;
  return words.flatMap((word) => [word >> 8, word & 0xff]);
}

function mappedIpv4(input: string): string | null {
  const bytes = ipv6Bytes(input);
  if (!bytes || bytes.length !== 16 || !bytes.slice(0, 10).every((b) => b === 0) || bytes[10] !== 0xff || bytes[11] !== 0xff) return null;
  return bytes.slice(12).join(".");
}

export function privateIp(ip: string): boolean {
  const value = unbracket(ip);
  if (net.isIPv4(value)) {
    const [a, b, c] = value.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113);
  }
  if (!net.isIPv6(value)) return false;
  const mapped = mappedIpv4(value);
  if (mapped) return privateIp(mapped);
  const bytes = ipv6Bytes(value);
  if (!bytes) return false;
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = allZero || (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1);
  return loopback || (bytes[0] & 0xfe) === 0xfc || (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) || bytes[0] === 0xff;
}

export function hostLooksPrivate(host: string): string | null {
  const h = unbracket(host).toLowerCase();
  if (["localhost", "metadata.google.internal", "instance-data"].includes(h) || h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".localhost")) return "private host";
  if (net.isIP(h) && privateIp(h)) return "private ip";
  return null;
}

export async function assertPublic(host: string): Promise<void> {
  const normalized = unbracket(host);
  const staticProblem = hostLooksPrivate(normalized);
  if (staticProblem) throw new Error(staticProblem);
  if (net.isIP(normalized)) return;
  const addrs = await dnsPromises.lookup(normalized, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a: ResolvedAddress) => privateIp(a.address))) throw new Error("resolves to private ip");
}

export function lookupPublicAddress(hostname: string, options: dns.LookupOptions, callback: (error: NodeJS.ErrnoException | null, address?: string | ResolvedAddress[], family?: number) => void): void {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    const resolved = addresses as ResolvedAddress[];
    if (!resolved.length || resolved.some((address) => privateIp(address.address))) return callback(Object.assign(new Error("resolves to private ip"), { code: "EPRIVATEIP" }));
    if (options.all) return callback(null, resolved);
    callback(null, resolved[0].address, resolved[0].family);
  });
}

const agent = new Agent({ connect: { lookup: lookupPublicAddress as never }, connections: 4 });

export async function publicFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  await assertPublic(target.hostname);
  return fetch(url, { ...opts, redirect: "manual", dispatcher: agent } as RequestInit & { dispatcher: Agent });
}
