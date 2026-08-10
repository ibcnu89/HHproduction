import { useEffect } from 'react';

/**
 * Terms of Service Page
 * Accessible at /terms without authentication
 */

const LAST_UPDATED = 'August 9, 2026';
const EFFECTIVE_DATE = 'August 9, 2026';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service - HomeworkHelper';
  }, []);

  return (
    <div className="min-h-screen bg-paper dark:bg-ink-deep py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-display-lg text-ink font-bold mb-4">Terms of Service</h1>
          <p className="text-body text-ink-muted">
            Effective: {EFFECTIVE_DATE} • Last updated: {LAST_UPDATED}
          </p>
        </header>

        {/* Content */}
        <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft p-8 space-y-8">
          
          {/* 1. Acceptance */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="text-body text-ink-muted leading-relaxed">
              By accessing or using HomeworkHelper ("the Service") at letsmakeai.fun, you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="text-body text-ink-muted leading-relaxed mt-4">
              These Terms constitute a legally binding agreement between you ("Teacher", "User", "you") and HomeworkHelper ("we", "our", "us").
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">2. Eligibility</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>You must be at least 18 years old.</li>
              <li>You must be a teacher, educator, or authorized school staff member.</li>
              <li>You must have the authority to upload student work for grading purposes.</li>
              <li>You may not use the Service if you have been previously banned.</li>
            </ul>
          </section>

          {/* 3. Account Registration */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">3. Account Registration</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>We reserve the right to refuse or close accounts at our discretion.</li>
            </ul>
          </section>

          {/* 4. Subscription & Billing */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">4. Subscription & Billing</h2>
            
            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Pricing</h3>
            <p className="text-body text-ink-muted mb-4">
              HomeworkHelper offers a 7-day free trial. After the trial, the subscription is <strong>$20/month</strong> billed monthly.
            </p>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Payment Processing</h3>
            <p className="text-body text-ink-muted mb-4">
              Payments are processed by Stripe. We do not store your full credit card details. 
              By subscribing, you authorize Stripe to charge your payment method.
            </p>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Cancellation</h3>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>You may cancel anytime via the Billing Portal (accessible from Account Settings).</li>
              <li>Cancellation takes effect at the end of the current billing period.</li>
              <li>No refunds for partial months, except as required by law.</li>
              <li>Upon cancellation, you retain access until the period ends, then your account reverts to free tier.</li>
            </ul>

            <h3 className="text-display-md text-ink font-semibold mt-6 mb-3">Free Trial</h3>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>7-day free trial for new subscribers only.</li>
              <li>Credit card required to start trial.</li>
              <li>Cancel before trial ends to avoid charges.</li>
              <li>One trial per user/household.</li>
            </ul>
          </section>

          {/* 5. Acceptable Use */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">5. Acceptable Use</h2>
            <p className="text-body text-ink-muted mb-4">
              You agree <strong>not</strong> to use the Service for:
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>Uploading illegal content, hate speech, harassment, or explicit material</li>
              <li>Attempting to reverse-engineer, scrape, or extract our AI models or grading logic</li>
              <li>Sharing your account credentials with others</li>
              <li>Using the Service for commercial purposes beyond personal classroom use</li>
              <li>Interfering with the Service's security, integrity, or performance</li>
              <li>Violating any applicable law, including FERPA, COPPA, or copyright law</li>
              <li>Uploading student work you do not have permission to grade</li>
            </ul>
          </section>

          {/* 6. Intellectual Property */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">6. Intellectual Property</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li><strong>Our IP:</strong> The Service, AI models, grading algorithms, UI, and all software are our exclusive property.</li>
              <li><strong>Your Content:</strong> You retain ownership of student work you upload and grading results generated for you.</li>
              <li><strong>License to Us:</strong> By uploading content, you grant us a limited license to process, store, and grade it solely to provide the Service.</li>
              <li><strong>No Training:</strong> We do not use your uploaded images or grading results to train our AI models.</li>
            </ul>
          </section>

          {/* 7. Student Data & FERPA */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">7. Student Data & FERPA</h2>
            <p className="text-body text-ink-muted mb-4">
              You are responsible for ensuring your use of the Service complies with FERPA and applicable state student privacy laws.
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>Students never create accounts or log in to HomeworkHelper.</li>
              <li>You upload student work only for your own classes.</li>
              <li>We act as a School Official under FERPA (34 CFR §99.31) when processing student records on your behalf.</li>
              <li>We sign Data Processing Agreements (DPAs) with school districts upon request.</li>
              <li>Student data is deleted when you delete your account or upon your written request.</li>
            </ul>
          </section>

          {/* 8. Disclaimer of Warranties */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-body text-ink-muted mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>Merchantability, fitness for a particular purpose, or non-infringement</li>
              <li>Accuracy, completeness, or reliability of AI grading results</li>
              <li>Uninterrupted or error-free availability</li>
              <li>Correction of all defects or bugs</li>
            </ul>
            <p className="text-body text-ink-muted mt-4">
              AI grading is an assistive tool, not a replacement for teacher judgment. Always review AI-generated grades before sharing with students or parents.
            </p>
          </section>

          {/* 9. Limitation of Liability */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">9. Limitation of Liability</h2>
            <p className="text-body text-ink-muted mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, HOMEWORKHELPER SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of data, profits, goodwill, or business opportunities</li>
              <li>Grading errors, student complaints, or parent disputes arising from AI grades</li>
              <li>Service interruptions, data loss, or security breaches beyond our reasonable control</li>
            </ul>
            <p className="text-body text-ink-muted mt-4">
              Our total liability shall not exceed the amount you paid in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          {/* 10. Indemnification */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">10. Indemnification</h2>
            <p className="text-body text-ink-muted">
              You agree to indemnify and hold harmless HomeworkHelper, its officers, employees, and agents from any claims, damages, losses, or expenses (including attorney fees) arising from your use of the Service, violation of these Terms, or violation of any third-party rights.
            </p>
          </section>

          {/* 11. Termination */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">11. Termination</h2>
            <ul className="list-disc list-inside space-y-3 text-body text-ink-muted ml-4">
              <li>We may suspend or terminate your account for violation of these Terms.</li>
              <li>You may terminate by deleting your account in the Danger Zone (cascades to all data).</li>
              <li>Upon termination, your subscription ends, and all data is deleted per our retention policy.</li>
              <li>Provisions that should survive termination will survive (IP, liability, indemnification).</li>
            </ul>
          </section>

          {/* 12. Governing Law */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">12. Governing Law & Disputes</h2>
            <p className="text-body text-ink-muted">
              These Terms are governed by the laws of the State of Illinois, USA, without regard to conflict of laws principles. 
              Any disputes will be resolved in the state or federal courts located in Cook County, Illinois.
            </p>
          </section>

          {/* 13. Changes to Terms */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">13. Changes to These Terms</h2>
            <p className="text-body text-ink-muted">
              We may update these Terms from time to time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. 
              Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="text-display-sm text-ink font-bold mb-4">14. Contact</h2>
            <p className="text-body text-ink-muted">
              Questions about these Terms? Email <a href="mailto:legal@letsmakeai.fun" className="text-gold hover:underline">legal@letsmakeai.fun</a>
            </p>
          </section>

          {/* Footer */}
          <footer className="pt-8 border-t border-subtle dark:border-ink-700">
            <p className="text-caption text-ink-subtle text-center">
              Effective: {EFFECTIVE_DATE} • Last updated: {LAST_UPDATED} • Version 1.0
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}