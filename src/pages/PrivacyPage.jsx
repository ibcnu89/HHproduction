import { useEffect } from 'react';

/**
 * Privacy Policy Page
 * Accessible at /privacy without authentication
 */

const LAST_UPDATED = 'August 9, 2026';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy - HomeworkHelper';
  }, []);

  return (
    <div className="min-h-screen bg-paper dark:bg-ink-deep py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-display-lg text-ink font-bold mb-4">Privacy Policy</h1>
          <p className="text-body text-ink-muted">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        {/* Content */}
        <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft p-8 space-y-8">
          
          {/* 1. Introduction */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">1. Introduction</h2>
            <p className="text-body text-ink-muted leading-relaxed">
              HomeworkHelper ("we", "our", "us") is an AI-powered homework grading tool for teachers. 
              This Privacy Policy explains how we collect, use, and protect your information when you use our service at letsmakeai.fun.
            </p>
            <p className="text-body text-ink-muted leading-relaxed mt-4">
              We are committed to protecting your privacy and complying with applicable laws, including FERPA (Family Educational Rights and Privacy Act) 
              as it applies to educational records.
            </p>
          </section>

          {/* 2. Data We Collect */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">2. Data We Collect</h2>
            
            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Teacher Account Data</h3>
            <ul className="list-disc list-inside space-y-2 text-body text-ink-muted ml-4">
              <li><strong>Email address</strong> — for account creation, login, and billing communications</li>
              <li><strong>Password hash</strong> — bcrypt-hashed, never stored in plaintext (for email/password accounts)</li>
              <li><strong>Google OAuth tokens</strong> — access/refresh tokens for Google Classroom integration (encrypted at rest)</li>
              <li><strong>Name & avatar</strong> — from Google profile or manually entered</li>
              <li><strong>Subscription & billing data</strong> — Stripe customer ID, subscription status, payment history</li>
              <li><strong>Preferences</strong> — grade level, subject, state for standards alignment</li>
            </ul>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Grading Data</h3>
            <ul className="list-disc list-inside space-y-2 text-body text-ink-muted ml-4">
              <li><strong>Uploaded images</strong> — homework photos (stored in memory during processing, never written to disk)</li>
              <li><strong>Extracted questions & answers</strong> — OCR transcription of student work</li>
              <li><strong>Grading results</strong> — scores, feedback, letter grades, rubrics</li>
              <li><strong>Rubrics & answer keys</strong> — teacher-provided or auto-generated</li>
            </ul>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Student Data (Google Classroom Sync)</h3>
            <p className="text-body text-ink-muted mb-3">
              When you connect Google Classroom, we may sync the following student data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-body text-ink-muted ml-4">
              <li><strong>Student name</strong> — from Classroom profile (full name)</li>
              <li><strong>Student email</strong> — from Classroom profile (if accessible)</li>
              <li><strong>Google internal IDs</strong> — student ID, course ID, assignment IDs for sync operations</li>
            </ul>
            <p className="text-body text-ink-muted mt-3 text-warm-600 dark:text-warm-400 font-medium">
              ⚠️ Students never create accounts or log in to HomeworkHelper. All student data originates from teacher uploads or Google Classroom sync initiated by the teacher.
            </p>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Technical & Usage Data</h3>
            <ul className="list-disc list-inside space-y-2 text-body text-ink-muted ml-4">
              <li>IP address (for security & audit logging)</li>
              <li>User agent & device info</li>
              <li>Audit log entries (login, grading, sync, deletion actions)</li>
              <li>Error logs & performance metrics</li>
            </ul>
          </section>

          {/* 3. How We Use Your Data */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">3. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li><strong>Provide the service:</strong> Grade homework, generate feedback, sync with Google Classroom</li>
              <li><strong>Account management:</strong> Authentication, password reset, subscription billing</li>
              <li><strong>Security:</strong> Audit logging, fraud prevention, abuse detection</li>
              <li><strong>Improvement:</strong> Aggregate, anonymized usage analytics to improve grading accuracy</li>
              <li><strong>Legal compliance:</strong> FERPA record-keeping, audit trails for educational records</li>
            </ul>
          </section>

          {/* 4. Data Retention */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">4. Data Retention</h2>
            <p className="text-body text-ink-muted mb-4">
              We retain data only as long as necessary for the purposes described above, with the following defaults:
            </p>
            <table className="w-full text-sm text-ink-muted border-collapse">
              <thead>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <th className="text-left pb-2 font-semibold text-ink">Data Type</th>
                  <th className="text-left pb-2 font-semibold text-ink">Retention Period</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Uploaded homework images</td>
                  <td className="py-2">30 days (purged after grading)</td>
                </tr>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Batch grading results</td>
                  <td className="py-2">1 year</td>
                </tr>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Individual grading results</td>
                  <td className="py-2">2 years</td>
                </tr>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Classroom sync logs</td>
                  <td className="py-2">90 days</td>
                </tr>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Audit logs</td>
                  <td className="py-2">1 year</td>
                </tr>
                <tr className="border-b border-subtle dark:border-ink-700">
                  <td className="py-2">Account & billing data</td>
                  <td className="py-2">Duration of account + 1 year after deletion</td>
                </tr>
              </tbody>
            </table>
            <p className="text-body text-ink-muted mt-4">
              You can request earlier deletion via the <a href="#" className="text-gold hover:underline">Danger Zone</a> in Account Settings.
            </p>
          </section>

          {/* 5. Data Sharing */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">5. Data Sharing & Third Parties</h2>
            <p className="text-body text-ink-muted mb-4">
              We do not sell your data. We share data only with:
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li><strong>Google Cloud / Gemini API:</strong> For OCR and AI grading (images sent to Google, not stored by Google)</li>
              <li><strong>Stripe:</strong> For payment processing (email, name, billing address)</li>
              <li><strong>Google Classroom:</strong> When you explicitly sync, we push grades/feedback back to your Classroom</li>
              <li><strong>Legal requirements:</strong> If compelled by law, court order, or to protect safety</li>
            </ul>
          </section>

          {/* 6. FERPA Compliance */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">6. FERPA Compliance</h2>
            <p className="text-body text-ink-muted mb-4">
              HomeworkHelper acts as a <strong>School Official</strong> under FERPA (34 CFR §99.31) when processing student education records on behalf of teachers/schools.
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>We only access student data at the direction of the teacher (legitimate educational interest)</li>
              <li>We do not redisclose student PII without teacher consent</li>
              <li>We maintain audit logs of all access to student data</li>
              <li>We support data deletion requests (teacher-initiated account deletion cascades to all student data)</li>
              <li>We sign Data Processing Agreements (DPAs) with school districts upon request</li>
            </ul>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li><strong>Access:</strong> View all your data in Account Settings</li>
              <li><strong>Rectification:</strong> Update profile, preferences, billing info anytime</li>
              <li><strong>Deletion:</strong> Delete your account via the Danger Zone (cascades to all data)</li>
              <li><strong>Portability:</strong> Export your grading data (contact support for full export)</li>
              <li><strong>Objection:</strong> Disconnect Google Classroom, cancel subscription anytime</li>
            </ul>
          </section>

          {/* 8. Security */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">8. Security</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>All data encrypted in transit (TLS 1.2+) and at rest (Neon PostgreSQL encryption)</li>
              <li>Passwords hashed with bcrypt (cost factor 12)</li>
              <li>Refresh tokens stored as SHA-256 hashes</li>
              <li>HttpOnly, Secure, SameSite=Lax cookies for authentication</li>
              <li>Helmet.js security headers, CSP policies</li>
              <li>Regular dependency updates & vulnerability scanning</li>
            </ul>
          </section>

          {/* 9. International Transfers */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">9. International Data Transfers</h2>
            <p className="text-body text-ink-muted">
              Our infrastructure is hosted in the United States (Railway, Neon, Google Cloud). 
              If you are located in the EU/UK, your data is transferred to the US under Standard Contractual Clauses (SCCs) 
              or equivalent safeguards. Contact us for DPA with SCCs attached.
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">10. Contact Us</h2>
            <p className="text-body text-ink-muted">
              Questions about this policy or your data? Email <a href="mailto:privacy@letsmakeai.fun" className="text-gold hover:underline">privacy@letsmakeai.fun</a>
            </p>
          </section>

          {/* Last Updated */}
          <footer className="pt-8 border-t border-subtle dark:border-ink-700">
            <p className="text-caption text-ink-subtle text-center">
              Last updated: {LAST_UPDATED} • Version 1.0
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}