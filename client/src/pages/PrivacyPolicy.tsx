import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last Updated: {new Date().toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              The Nigerian Red Cross Society ("we", "our", or "us") is committed to protecting the privacy and 
              security of your personal information. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you use the NRCS Enterprise Asset Management (EAM) system.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">
              We collect information that you provide directly to us when using the NRCS EAM system:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Account Information:</strong> Name, email address, role, and authentication credentials</li>
              <li><strong>Asset Data:</strong> Information about organizational assets, maintenance records, and work orders</li>
              <li><strong>Financial Data:</strong> Transaction records, costs, and budget information</li>
              <li><strong>Usage Data:</strong> System access logs, activity timestamps, and feature usage patterns</li>
              <li><strong>Uploaded Content:</strong> Photos, documents, and other files you upload to the system</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>To provide and maintain the EAM system functionality</li>
              <li>To manage user accounts and authentication</li>
              <li>To track and manage organizational assets</li>
              <li>To generate reports and analytics</li>
              <li>To improve system performance and user experience</li>
              <li>To ensure system security and prevent unauthorized access</li>
              <li>To comply with legal obligations and organizational policies</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">4. Data Storage and Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Data is stored in secure cloud infrastructure with encryption</li>
              <li>Access is restricted to authorized personnel only</li>
              <li>Regular security audits and updates are performed</li>
              <li>User authentication and session management protocols are enforced</li>
              <li>Backup and disaster recovery procedures are maintained</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground mb-4">
              We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Within the Organization:</strong> With authorized NRCS personnel who need access to perform their duties</li>
              <li><strong>Service Providers:</strong> With trusted third-party service providers who assist in system operations (cloud hosting, etc.)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulations</li>
              <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of NRCS, our users, or others</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this 
              Privacy Policy, unless a longer retention period is required or permitted by law. Asset and financial 
              records are retained according to organizational record-keeping policies and legal requirements.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to your personal information stored in the system</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal and organizational requirements)</li>
              <li><strong>Objection:</strong> Object to certain processing of your personal information</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, please contact the IT Department or your system administrator.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground mb-4">
              The NRCS EAM system uses cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Maintain user sessions and authentication</li>
              <li>Remember user preferences and settings</li>
              <li>Analyze system usage and performance</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You can control cookie settings through your browser, but disabling cookies may affect system functionality.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p className="text-muted-foreground mb-4">
              The NRCS EAM system is not intended for use by individuals under the age of 18. We do not knowingly 
              collect personal information from children.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground mb-4">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal 
              requirements. We will notify users of significant changes through the system or via email.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">11. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions or concerns about this Privacy Policy or our data practices, please contact:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">Nigerian Red Cross Society</p>
              <p className="text-sm text-muted-foreground">Data Protection Officer / IT Department</p>
              <p className="text-sm text-muted-foreground">Email: privacy@redcrossnigeria.org</p>
              <p className="text-sm text-muted-foreground">Phone: [Contact Number]</p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">12. Compliance</h2>
            <p className="text-muted-foreground mb-4">
              This Privacy Policy is designed to comply with the Nigeria Data Protection Regulation (NDPR) and 
              other applicable data protection laws. We are committed to protecting your privacy rights and 
              maintaining compliance with all relevant regulations.
            </p>
          </section>

          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Note:</strong> This is a template document. Please have your legal team and Data Protection 
              Officer review and customize this content to ensure full compliance with NDPR, organizational policies, 
              and specific data handling practices.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
