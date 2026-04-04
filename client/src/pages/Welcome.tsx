import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package, Wrench, FileText, DollarSign, Users, ArrowRight } from "lucide-react";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const utils = trpc.useUtils();
  const completeOnboarding = trpc.users.completeOnboarding.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setLocation("/");
    },
  });

  const steps = [
    {
      title: "Welcome to NRCS EAM",
      description: "Nigerian Red Cross Society Enterprise Asset Management System",
      icon: CheckCircle2,
      content: (
        <div className="space-y-4">
          <p className="text-lg">
            Welcome! This system helps you manage all your organization's assets, maintenance, and operations efficiently.
          </p>
          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <Package className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Asset Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track all assets across multiple sites with barcodes, GPS, and depreciation
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Wrench className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Maintenance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Schedule preventive maintenance and manage work orders efficiently
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Generate comprehensive reports on assets, maintenance, and financials
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <DollarSign className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Financial Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor expenses, revenue, and asset depreciation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ),
    },
    {
      title: "Quick Start Guide",
      description: "Get started in 3 easy steps",
      icon: ArrowRight,
      content: (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Add Your First Site</h3>
              <p className="text-muted-foreground">
                Navigate to <strong>Sites</strong> and click "Add Site" to register your first location.
                You can add multiple sites like offices, warehouses, or field locations.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Register Your Assets</h3>
              <p className="text-muted-foreground">
                Go to <strong>Assets</strong> and add your equipment, vehicles, or inventory items.
                You can bulk upload assets using Excel templates or add them individually.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Schedule Maintenance</h3>
              <p className="text-muted-foreground">
                Set up preventive maintenance schedules in <strong>Maintenance</strong> to keep
                your assets in optimal condition and avoid unexpected breakdowns.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Ready to Go!",
      description: "You're all set to start managing your assets",
      icon: CheckCircle2,
      content: (
        <div className="space-y-6 text-center">
          <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
          <div>
            <h3 className="text-2xl font-bold mb-4">You're Ready!</h3>
            <p className="text-lg text-muted-foreground mb-6">
              Start by exploring the dashboard or jump straight into adding your first site and assets.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
            <Button size="lg" onClick={() => setLocation("/sites")}>
              <Package className="mr-2 h-5 w-5" />
              Add First Site
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/")}>
              View Dashboard
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-8">
            Need help? Contact your administrator or check the help documentation.
          </p>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Icon className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl">{currentStepData.title}</CardTitle>
          <CardDescription className="text-lg">{currentStepData.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStepData.content}

          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-12 rounded-full transition-colors ${
                    index === currentStep ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                  Previous
                </Button>
              )}
              {currentStep < steps.length - 1 ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => completeOnboarding.mutate()}>
                  Go to Dashboard
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
