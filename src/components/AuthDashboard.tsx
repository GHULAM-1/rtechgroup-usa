import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Users, Shield, Key } from 'lucide-react';

export function AuthDashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Authentication System Ready</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Your secure multi-role authentication system is now fully implemented and ready for use.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security Features
            </CardTitle>
            <CardDescription>
              Enterprise-grade security implementation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Row Level Security (RLS)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">JWT Authentication</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Encrypted Passwords</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Session Management</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Roles
            </CardTitle>
            <CardDescription>
              Four-tier role-based access control
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Head Admin</span>
              <Badge variant="destructive">Full Access</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Admin</span>
              <Badge variant="secondary">Management</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Operations</span>
              <Badge variant="outline">Limited</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Viewer</span>
              <Badge variant="outline">Read Only</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Admin Functions
            </CardTitle>
            <CardDescription>
              User management capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Create Users</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Reset Passwords</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Update Roles</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Activate/Deactivate</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Access user management and explore the authenticated features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">For Administrators:</h4>
              <p className="text-sm text-muted-foreground">
                Go to Settings → Users to manage user accounts, create new users, and handle password resets.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/settings?tab=users'}>
                Manage Users
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">For All Users:</h4>
              <p className="text-sm text-muted-foreground">
                Access the main dashboard to use the fleet management features. All routes are now protected and role-based.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          All application routes are now protected with authentication guards
        </p>
        <Badge variant="secondary">Authentication System v1.0</Badge>
      </div>
    </div>
  );
}