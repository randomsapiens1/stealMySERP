import type { RunReport } from "@/lib/shared/types";
import { Section } from "./Section";

export function OutreachOpportunities({ report }: { report: RunReport }) {
  return (
    <Section title="Outreach Opportunities">
      {report.contacts.length === 0 ? (
        <p className="text-sm text-gray-500">No competitor contacts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Emails</th>
                <th className="py-2 pr-4">Contact page</th>
                <th className="py-2 pr-4">Social</th>
                <th className="py-2 pr-4">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {report.contacts.map((c) => (
                <tr key={c.domain} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-4">{c.domain}</td>
                  <td className="py-2 pr-4">{c.emails.join(", ") || "—"}</td>
                  <td className="py-2 pr-4 break-all">{c.contactPageUrl ?? "—"}</td>
                  <td className="py-2 pr-4">{c.socialLinks.length || "—"}</td>
                  <td className="py-2 pr-4">{c.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
