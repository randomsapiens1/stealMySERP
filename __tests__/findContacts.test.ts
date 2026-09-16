import { describe, expect, it, vi } from "vitest";
import { findContactsForDomain } from "@/lib/contacts/findContacts";

vi.mock("@/lib/shared/fetchWithTimeout", () => ({
  fetchTextWithTimeout: vi.fn(async (url: string) => {
    if (url.endsWith("//example-site.com/")) {
      return `
        <html><body>
          <footer>
            Contact us: <a href="mailto:hello@example-site.com">hello@example-site.com</a>
          </footer>
          <!-- library refs that look like emails to a naive regex -->
          <script>/* slick-carousel@1.8.1, bootstrap@4.6.0, wght@300..900 */</script>
        </body></html>
      `;
    }
    throw new Error("404");
  }),
}));

describe("findContactsForDomain", () => {
  it("extracts a real mailto email and ignores library-version false positives", async () => {
    const result = await findContactsForDomain("example-site.com");
    expect(result.emails).toEqual(["hello@example-site.com"]);
    expect(result.emails).not.toContain("carousel@1.8.1");
    expect(result.emails).not.toContain("bootstrap@4.6.0");
    expect(result.emails).not.toContain("wght@300..900");
    expect(result.confidence).toBe("high");
  });
});
