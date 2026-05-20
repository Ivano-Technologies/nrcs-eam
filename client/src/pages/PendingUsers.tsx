import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import TableLoader from "@/components/ui/TableLoader";
import { CheckCircle, XCircle, Clock, Loader2, UserCheck } from "lucide-react";

export default function PendingUsers() {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  
  const { data: pendingUsers, isLoading, refetch } = trpc.pendingUsers.list.useQuery();
  
  const approveMutation = trpc.pendingUsers.approve.useMutation({
    onSuccess: () => {
      alert("User approved successfully!");
      refetch();
    },
    onError: (error: any) => {
      alert(`Failed to approve user: ${error.message}`);
    },
  });
  
  const rejectMutation = trpc.pendingUsers.reject.useMutation({
    onSuccess: () => {
      alert("User rejected");
      setSelectedUser(null);
      setRejectReason("");
      refetch();
    },
    onError: (error: any) => {
      alert(`Failed to reject user: ${error.message}`);
    },
  });

  const handleApprove = (userId: number) => {
    if (
      confirm(
        "Approve this user? They will receive an email with sign-in instructions (if email is configured)."
      )
    ) {
      approveMutation.mutate({ id: userId });
    }
  };

  const handleReject = (userId: number) => {
    const reason = prompt("Reason for rejection (optional):");
    rejectMutation.mutate({ id: userId, reason: reason || undefined });
  };

  if (isLoading) return <TableLoader />;

  const pending = pendingUsers?.filter((u) => u.status === "pending") || [];
  const processed = pendingUsers?.filter((u) => u.status !== "pending") || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div data-testid="pending-users-heading">
        <PageHeader
          icon={UserCheck}
          title="Pending Users"
          subtitle="Review and approve user signup requests"
        />
      </div>

      {pending.length === 0 && (
        <Alert>
          <AlertDescription>No pending user requests at this time.</AlertDescription>
        </Alert>
      )}

      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Requests ({pending.length})</h2>
          {pending.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{user.name}</CardTitle>
                    <CardDescription data-testid={`pending-user-email-${user.id}`}>
                      {user.email}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p><strong>Requested Role:</strong> {user.requestedRole || "user"}</p>
                    {user.designation ? (
                      <p>
                        <strong>Designation:</strong> {user.designation}
                      </p>
                    ) : null}
                    {user.department ? (
                      <p>
                        <strong>Department:</strong> {user.department}
                      </p>
                    ) : null}
                    <p><strong>Requested:</strong> {new Date(user.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      data-testid={`pending-approve-${user.id}`}
                      onClick={() => handleApprove(user.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving…
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                    >
                      {rejectMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Rejecting…
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Processed Requests ({processed.length})</h2>
          {processed.map((user) => (
            <Card key={user.id} className="opacity-75">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                  <Badge
                    variant={user.status === "approved" ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {user.status === "approved" ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Approved
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  <p><strong>Processed:</strong> {user.approvedAt ? new Date(user.approvedAt).toLocaleString() : "N/A"}</p>
                  {user.rejectionReason && (
                    <p><strong>Reason:</strong> {user.rejectionReason}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
