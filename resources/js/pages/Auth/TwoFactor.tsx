import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import { Copy, Download, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface TwoFactorProps {
    qrCode: string;
    secret: string;
    enabled: boolean;
}

export default function TwoFactor({ qrCode, secret, enabled }: TwoFactorProps) {
    const [showSecret, setShowSecret] = useState(false);
    const [showDisableForm, setShowDisableForm] = useState(false);

    const {
        data,
        setData,
        post,
        delete: destroy,
        processing,
        errors,
        reset,
    } = useForm({
        code: '',
        password: '',
    });

    const handleEnable = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('two-factor.store'), {
            onSuccess: () => {
                reset('code');
                toast.success('Two-factor authentication enabled successfully!');
            },
            onError: () => {
                toast.error('Failed to enable two-factor authentication.');
            },
        });
    };

    const handleDisable = (e: React.FormEvent) => {
        e.preventDefault();
        destroy(route('two-factor.destroy', { password: data.password }), {
            onSuccess: () => {
                reset('password');
                setShowDisableForm(false);
                toast.success('Two-factor authentication disabled successfully!');
            },
            onError: () => {
                toast.error('Failed to disable two-factor authentication.');
            },
        });
    };

    const copySecret = () => {
        navigator.clipboard.writeText(secret);
        toast.success('Secret copied to clipboard!');
    };

    const downloadQrCode = () => {
        const link = document.createElement('a');
        link.href = qrCode;
        link.download = 'two-factor-qr-code.svg';
        link.click();
    };

    return (
        <AppLayout>
            <Head title="Two-Factor Authentication" />

            <div className="mx-auto max-w-4xl p-6">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-3xl font-bold">
                        <Shield className="h-8 w-8" />
                        Two-Factor Authentication
                    </h1>
                    <p className="mt-2 text-gray-600">Add an extra layer of security to your account with two-factor authentication.</p>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {enabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldX className="h-5 w-5 text-red-600" />}
                                Status: {enabled ? 'Enabled' : 'Disabled'}
                            </CardTitle>
                            <CardDescription>
                                {enabled
                                    ? 'Two-factor authentication is currently enabled for your account.'
                                    : 'Two-factor authentication is currently disabled for your account.'}
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {!enabled && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Enable Two-Factor Authentication</CardTitle>
                                <CardDescription>
                                    Scan the QR code below with your authenticator app, then enter the verification code.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">1. Scan QR Code</h3>
                                        <div className="flex justify-center">
                                            <div className="rounded-lg border bg-white p-4" dangerouslySetInnerHTML={{ __html: qrCode }} />
                                        </div>
                                        <div className="flex justify-center">
                                            <Button type="button" variant="outline" onClick={downloadQrCode} className="flex items-center gap-2">
                                                <Download className="h-4 w-4" />
                                                Download QR Code
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium">2. Manual Setup (Optional)</h3>
                                        <Alert>
                                            <AlertDescription>
                                                If you can't scan the QR code, enter this secret key manually in your authenticator app:
                                            </AlertDescription>
                                        </Alert>
                                        <div className="flex items-center gap-2">
                                            <Input type={showSecret ? 'text' : 'password'} value={secret} readOnly className="font-mono" />
                                            <Button type="button" variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                                                {showSecret ? 'Hide' : 'Show'}
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={copySecret}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={handleEnable} className="mt-6 space-y-4">
                                    <div>
                                        <Label htmlFor="code">Verification Code</Label>
                                        <Input
                                            id="code"
                                            type="text"
                                            value={data.code}
                                            onChange={(e) => setData('code', e.target.value)}
                                            placeholder="000000"
                                            maxLength={6}
                                            className="text-center font-mono text-lg tracking-widest"
                                        />
                                        {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
                                    </div>
                                    <Button type="submit" disabled={processing} className="w-full">
                                        {processing ? 'Enabling...' : 'Enable Two-Factor Authentication'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {enabled && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recovery Codes</CardTitle>
                                    <CardDescription>View and manage your recovery codes for emergency access.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        onClick={() => (window.location.href = route('two-factor.recovery-codes'))}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        View Recovery Codes
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Disable Two-Factor Authentication</CardTitle>
                                    <CardDescription>Remove two-factor authentication from your account.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!showDisableForm ? (
                                        <Button onClick={() => setShowDisableForm(true)} variant="destructive" className="w-full">
                                            Disable Two-Factor Authentication
                                        </Button>
                                    ) : (
                                        <form onSubmit={handleDisable} className="space-y-4">
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
                                                    {processing ? 'Disabling...' : 'Confirm Disable'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setShowDisableForm(false);
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
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
