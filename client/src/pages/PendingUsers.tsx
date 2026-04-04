import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

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
    if (confirm("Approve this user and send them a magic link?")) {
      approveMutation.mutate({ id: userId });
    }
  };

  const handleReject = (userId: number) => {
    const reason = prompt("Reason for rejection (optional):");
    rejectMutation.mutate({ id: userId, reason: reason || undefined });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const pending = pendingUsers?.filter((u) => u.status === "pending") || [];
  const processed = pendingUsers?.filter((u) => u.status !== "pending") || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Access Requests</h1>
        <p className="text-gray-600 mt-2">Review and approve user signup requests</p>
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
                    <CardDescription>{user.email}</CardDescription>
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
                    <p><strong>Requested:</strong> {new Date(user.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
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
