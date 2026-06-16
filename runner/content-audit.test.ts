import { test } from "node:test";
import assert from "node:assert/strict";
import { assertContent } from "./content-audit.ts";

const ok = (html: string, a: Parameters<typeof assertContent>[1]) =>
  assert.doesNotThrow(() => assertContent(html, a));
const fails = (html: string, a: Parameters<typeof assertContent>[1]) =>
  assert.throws(() => assertContent(html, a));

test("lorem ipsum filler is caught; real copy passes", () => {
  fails("<p>Lorem ipsum dolor sit amet</p>", { kind: "no_lorem" });
  ok("<p>Sacramento's most trusted pool builder.</p>", { kind: "no_lorem" });
});

test("unbound undefined/NaN values are caught; legit words are not", () => {
  fails("<div>Total: $NaN</div>", { kind: "no_unbound_values" });
  fails("<span>Welcome back, undefined</span>", { kind: "no_unbound_values" });
  ok("<p>Undefined behavior is a C concept.</p>", { kind: "no_unbound_values" }); // substring, not standalone
  ok("<p>We have 12 reviews.</p>", { kind: "no_unbound_values" });
});

test("hardcoded localhost references are caught from href/src attributes", () => {
  fails('<a href="http://localhost:3000/login">Sign in</a>', { kind: "no_localhost_refs" });
  fails('<img src="http://127.0.0.1:8080/logo.png">', { kind: "no_localhost_refs" });
  ok('<a href="https://lutherpools.com/login">Sign in</a>', { kind: "no_localhost_refs" });
});

test("placeholder markers are caught; finished copy passes", () => {
  fails("<footer>email@example.com</footer>", { kind: "no_placeholder_markers" });
  fails("<h1>Your Company Name</h1>", { kind: "no_placeholder_markers" });
  ok("<footer>hello@lutherpools.com</footer>", { kind: "no_placeholder_markers" });
});

test("scripts and styles are ignored so legit code strings don't false-positive", () => {
  ok('<script>const x = undefined;</script><p>All systems go.</p>', { kind: "no_unbound_values" });
  ok('<style>.lorem{color:red}</style><p>Real content.</p>', { kind: "no_lorem" });
});
