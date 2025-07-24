import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import { AlertTriangle, Copy, Download, RefreshCw, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface TwoFactorRecoveryCodesProps {
    codes: string[];
}

export default function TwoFactorRecoveryCodes({ codes }: TwoFactorRecoveryCodesProps) {
    const [showRegenerateForm, setShowRegenerateForm] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const handleRegenerate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('two-factor.recovery-codes.new'), {
            onSuccess: () => {
                reset('password');
                setShowRegenerateForm(false);
                toast.success('New recovery codes generated successfully!');
            },
            onError: () => {
                toast.error('Failed to generate new recovery codes.');
            },
        });
    };

    const copyAllCodes = () => {
        const codesText = codes.join('\n');
        navigator.clipboard.writeText(codesText);
        toast.success('All recovery codes copied to clipboard!');
    };

    const downloadCodes = () => {
        const codesText = codes.join('\n');
        const blob = new Blob([codesText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'two-factor-recovery-codes.txt';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AppLayout>
            <Head title="Two-Factor Recovery Codes" />

            <div className="mx-auto max-w-4xl p-6">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-3xl font-bold">
                        <Shield className="h-8 w-8" />
                        Recovery Codes
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Store these recovery codes in a secure location. They can be used to recover access to your account if you lose your
                        authenticator device.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Important:</strong> Each recovery code can only be used once. Make sure to store them securely and consider
                            generating new ones after use.
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardHeader>
                            <CardTitle>Your Recovery Codes</CardTitle>
                            <CardDescription>You have {codes.length} recovery codes remaining.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-4 font-mono text-sm">
                                    {codes.map((code, index) => (
                                        <div key={index} className="rounded border bg-white p-2 text-center">
                                            {code}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <Button onClick={copyAllCodes} variant="outline" className="flex items-center gap-2">
                                        <Copy className="h-4 w-4" />
                                        Copy All
                                    </Button>
                                    <Button onClick={downloadCodes} variant="outline" className="flex items-center gap-2">
                                        <Download className="h-4 w-4" />
                                        Download
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Generate New Recovery Codes</CardTitle>
                            <CardDescription>Generate a new set of recovery codes. This will invalidate all existing codes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!showRegenerateForm ? (
                                <Button onClick={() => setShowRegenerateForm(true)} variant="outline" className="flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Generate New Recovery Codes
                                </Button>
                            ) : (
                                <form onSubmit={handleRegenerate} className="space-y-4">
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>
                                            <strong>Warning:</strong> Generating new recovery codes will invalidate all existing codes. Make sure you
                                            have access to your authenticator app.
                                        </AlertDescription>
                                    </Alert>

                                    <div>
                                        <Label htmlFor="password">Confirm Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            placeholder="Enter your password"
                                        />
                                        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={processing} variant="destructive" className="flex-1">
                                            {processing ? 'Generating...' : 'Generate New Codes'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setShowRegenerateForm(false);
                                                reset('password');
                                            }}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button onClick={() => (window.location.href = route('two-factor.show'))} variant="outline">
                            Back to Two-Factor Settings
                        </Button>
                        <Button onClick={() => (window.location.href = route('dashboard'))} variant="outline">
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
