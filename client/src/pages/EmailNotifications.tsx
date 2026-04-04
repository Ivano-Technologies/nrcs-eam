import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, History, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function EmailNotifications() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientType, setRecipientType] = useState<"all" | "role">("all");
  const [recipientRole, setRecipientRole] = useState<"admin" | "manager" | "user">("user");

  const { data: history, refetch } = trpc.emailNotifications.history.useQuery();
  const sendMutation = trpc.emailNotifications.send.useMutation();

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const result = await sendMutation.mutateAsync({
        subject,
        body,
        recipientType,
        recipientRole: recipientType === "role" ? recipientRole : undefined,
      });

      toast.success(`Email sent successfully to ${result.sent} recipients`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} emails failed to send`);
      }

      setSubject("");
      setBody("");
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Notifications</h1>
          <p className="text-muted-foreground">Send custom email notifications to users</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Compose Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Compose Email Notification</DialogTitle>
              <DialogDescription>Send a custom email to selected users</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select value={recipientType} onValueChange={(v) => setRecipientType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="role">By Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === "role" && (
                <div className="space-y-2">
                  <Label>Select Role</Label>
                  <Select value={recipientRole} onValueChange={(v) => setRecipientRole(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="manager">Managers</SelectItem>
                      <SelectItem value="user">Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Message Body</Label>
                <Textarea
                  placeholder="Email message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  HTML formatting is supported. The message will be wrapped in a professional NRCS email template.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Email History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Email History
          </CardTitle>
          <CardDescription>Previously sent email notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No emails sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((email) => (
                <div
                  key={email.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{email.subject}</h4>
                      {email.status === "sent" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {email.body.replace(/<[^>]*>/g, "").substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Sent to: {email.recipientCount} {email.recipientType === "all" ? "users" : `${email.recipientRole}s`}
                      </span>
                      <span>•</span>
                      <span>{new Date(email.sentAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
