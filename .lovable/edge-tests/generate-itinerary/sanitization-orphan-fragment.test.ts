import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeAITextField } from "./sanitization.ts";

Deno.test("strips 'Advance booking required for ...' and preserves following sentence", () => {
  const input = "Advance booking required for the late-night. ☔ Rain: Stay for an extra treatment.";
  const out = sanitizeAITextField(input);
  assertEquals(out, "☔ Rain: Stay for an extra treatment.");
});

Deno.test("strips 'BOOK 2 WEEKS AHEAD for ...' tail", () => {
  const out = sanitizeAITextField("BOOK 2 WEEKS AHEAD for the chef's table. Try the tasting menu.");
  assertEquals(out, "Try the tasting menu.");
});

Deno.test("strips 'Reserve in advance at ...' tail", () => {
  const out = sanitizeAITextField("Reserve in advance at the rooftop. Sunset views are unbeatable.");
  assertEquals(out, "Sunset views are unbeatable.");
});

Deno.test("regression: 'Advance booking required.' alone still strips cleanly", () => {
  const out = sanitizeAITextField("Advance booking required.");
  assertEquals(out, "");
});

Deno.test("regression: untouched sentence with no booking prefix stays intact", () => {
  const out = sanitizeAITextField("Sunset views are unbeatable.");
  assertEquals(out, "Sunset views are unbeatable.");
});

Deno.test("regression: capitalized real opening starting with 'For' is NOT eaten by post-pass", () => {
  // Post-pass requires lowercase prep at start; "For" capitalized → untouched.
  const out = sanitizeAITextField("For the best views, arrive early. Bring a camera.");
  assertEquals(out, "For the best views, arrive early. Bring a camera.");
});
