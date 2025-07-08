import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, Key } from 'lucide-react';
import { toast } from 'sonner';
import AuthLayout from '@/layouts/auth-layout';

export default function TwoFactorChallenge() {
    const [activeTab, setActiveTab] = useState<'authenticator' | 'recovery'>('authenticator');

    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('two-factor.verify'), {
            onSuccess: () => {
                toast.success('Authentication successful!');
            },
            onError: () => {
                reset('code');
                toast.error('Invalid code. Please try again.');
            },
        });
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value as 'authenticator' | 'recovery');
        reset('code');
    };

    return (
        <AuthLayout title="Two-Factor Authentication" description="Please verify your identity to continue">
            <Head title="Two-Factor Authentication" />

            <div className="max-w-md w-full space-y-8">

                    <Card>
                        <CardHeader className="text-center">
                            <CardTitle>Verification Required</CardTitle>
                            <CardDescription>
                                Enter your authentication code to access your account
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-center space-x-2 mb-6">
                                    <Button
                                        type="button"
                                        variant={activeTab === 'authenticator' ? 'default' : 'outline'}
                                        onClick={() => handleTabChange('authenticator')}
                                        className="flex items-center gap-2"
                                    >
                                        <Smartphone className="w-4 h-4" />
                                        Authenticator
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={activeTab === 'recovery' ? 'default' : 'outline'}
                                        onClick={() => handleTabChange('recovery')}
                                        className="flex items-center gap-2"
                                    >
                                        <Key className="w-4 h-4" />
                                        Recovery Code
                                    </Button>
                                </div>

                                {activeTab === 'authenticator' && (
                                    <div className="space-y-4">
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <Label htmlFor="code">Authentication Code</Label>
                                                <Input
                                                    id="code"
                                                    type="text"
                                                    value={data.code}
                                                    onChange={(e) => setData('code', e.target.value)}
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    className="font-mono text-center text-lg tracking-widest"
                                                    autoFocus
                                                />
                                                {errors.code && (
                                                    <p className="text-sm text-red-600 mt-1">{errors.code}</p>
                                                )}
                                            </div>
                                            
                                            <Button type="submit" disabled={processing} className="w-full">
                                                {processing ? 'Verifying...' : 'Verify Code'}
                                            </Button>
                                        </form>
                                        
                                        <Alert>
                                            <AlertDescription>
                                                Open your authenticator app and enter the 6-digit code.
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}

                                {activeTab === 'recovery' && (
                                    <div className="space-y-4">
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <Label htmlFor="code">Recovery Code</Label>
                                                <Input
                                                    id="code"
                                                    type="text"
                                                    value={data.code}
                                                    onChange={(e) => setData('code', e.target.value)}
                                                    placeholder="Enter recovery code"
                                                    className="font-mono"
                                                    autoFocus
                                                />
                                                {errors.code && (
                                                    <p className="text-sm text-red-600 mt-1">{errors.code}</p>
                                                )}
                                            </div>
                                            
                                            <Button type="submit" disabled={processing} className="w-full">
                                                {processing ? 'Verifying...' : 'Use Recovery Code'}
                                            </Button>
                                        </form>
                                        
                                        <Alert>
                                            <AlertDescription>
                                                Enter one of your recovery codes. Each code can only be used once.
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                <div className="text-center">
                    <a
                        href={route('login')}
                        className="text-sm text-blue-600 hover:text-blue-500"
                    >
                        Back to Login
                    </a>
                </div>
            </div>
        </AuthLayout>
    );
}