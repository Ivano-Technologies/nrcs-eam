import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last Updated: {new Date().toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing and using the Nigerian Red Cross Society Enterprise Asset Management (NRCS EAM) system, 
              you accept and agree to be bound by the terms and provision of this agreement. If you do not agree 
              to these terms, please do not use this system.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">2. Use License</h2>
            <p className="text-muted-foreground mb-4">
              Permission is granted to authorized Nigerian Red Cross Society personnel to use this system for 
              official organizational purposes only. This license shall automatically terminate if you violate 
              any of these restrictions.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access is restricted to authorized users only</li>
              <li>User credentials must not be shared with unauthorized individuals</li>
              <li>System must be used in compliance with organizational policies</li>
              <li>Data must be handled according to confidentiality requirements</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
            <p className="text-muted-foreground mb-4">
              Users of the NRCS EAM system agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Maintain the confidentiality of login credentials</li>
              <li>Ensure accuracy of data entered into the system</li>
              <li>Report any security breaches or unauthorized access immediately</li>
              <li>Use the system only for legitimate organizational purposes</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">4. Data Accuracy and Liability</h2>
            <p className="text-muted-foreground mb-4">
              While we strive to ensure data accuracy, the Nigerian Red Cross Society makes no warranties or 
              representations regarding the accuracy, completeness, or reliability of information in this system. 
              Users are responsible for verifying critical information before making decisions based on system data.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              All content, data, and materials within the NRCS EAM system are the property of the Nigerian Red 
              Cross Society. Unauthorized reproduction, distribution, or use of system content is prohibited.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">6. System Availability</h2>
            <p className="text-muted-foreground mb-4">
              We strive to maintain system availability but do not guarantee uninterrupted access. The system 
              may be temporarily unavailable due to maintenance, updates, or unforeseen technical issues.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">7. Modifications to Terms</h2>
            <p className="text-muted-foreground mb-4">
              The Nigerian Red Cross Society reserves the right to modify these terms at any time. Continued 
              use of the system after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
            <p className="text-muted-foreground mb-4">
              Access to the NRCS EAM system may be terminated at any time for violation of these terms or for 
              any other reason deemed necessary by the Nigerian Red Cross Society.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">9. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These terms shall be governed by and construed in accordance with the laws of the Federal Republic 
              of Nigeria, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              For questions regarding these Terms of Service, please contact:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">Nigerian Red Cross Society</p>
              <p className="text-sm text-muted-foreground">IT Department</p>
              <p className="text-sm text-muted-foreground">Email: it@redcrossnigeria.org</p>
            </div>
          </section>

          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Note:</strong> This is a template document. Please have your legal team review and 
              customize this content to meet your organization's specific requirements and comply with 
              applicable laws and regulations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
