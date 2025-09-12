import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Edit, RotateCcw, Eye, EyeOff, Copy, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'ops' | 'viewer';
  status: 'active' | 'disabled';
  created_at: string;
  last_login: string | null;
}

export default function UsersManagementPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    role: 'viewer' as const
  });
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-manage-users', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        setUsers(data.users);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load users",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error loading users",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.role) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-manage-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          username: newUser.username,
          role: newUser.role
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTempPassword(data.tempPassword);
        setShowTempPassword(true);
        await loadUsers();
        setNewUser({ username: '', role: 'viewer' });
        toast({
          title: "User Created",
          description: "User created successfully with temporary password",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create user",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error creating user",
        variant: "destructive"
      });
    }
  };

  const handleUpdateUser = async (userId: string, updates: { role?: string; status?: string }) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-manage-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          userId,
          ...updates
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadUsers();
        toast({
          title: "User Updated",
          description: "User updated successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update user",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error updating user",
        variant: "destructive"
      });
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-manage-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resetPassword',
          userId
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTempPassword(data.tempPassword);
        setShowTempPassword(true);
        toast({
          title: "Password Reset",
          description: "Password reset successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to reset password",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error resetting password",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Password copied to clipboard",
    });
  };

  if (!hasPermission('manage_users')) {
    return (
      <div className="text-center p-8">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Users & Roles</h1>
          <p className="text-muted-foreground">Manage system users and their permissions</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with a temporary password
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(value: any) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="ops">Operations</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full">
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Temporary Password Modal */}
      <Dialog open={showTempPassword} onOpenChange={setShowTempPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password Generated</DialogTitle>
            <DialogDescription>
              Please save this password securely. The user will need to change it on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono">{tempPassword}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(tempPassword)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button onClick={() => setShowTempPassword(false)} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : user.role === 'ops' ? 'secondary' : 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_login ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm') : 'Never'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleUpdateUser(user.id, { role: value })}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="ops">Ops</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateUser(user.id, { 
                            status: user.status === 'active' ? 'disabled' : 'active' 
                          })}
                        >
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(user.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}