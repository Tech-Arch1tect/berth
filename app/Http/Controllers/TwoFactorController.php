<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TwoFactorController extends Controller
{
    public function show()
    {
        $user = Auth::user();
        
        if (!$user->google2fa_secret) {
            $user->google2fa_secret = $user->generateTwoFactorSecret();
            $user->save();
        }

        return Inertia::render('Auth/TwoFactor', [
            'qrCode' => $user->getTwoFactorQrCode(),
            'secret' => $user->google2fa_secret,
            'enabled' => $user->hasTwoFactorEnabled(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'code' => 'required|string|min:6|max:6',
        ]);

        $user = Auth::user();

        if (!$user->verifyTwoFactorCode($request->code)) {
            throw ValidationException::withMessages([
                'code' => ['The provided two-factor authentication code is invalid.'],
            ]);
        }

        $user->two_factor_confirmed_at = now();
        $user->two_factor_recovery_codes = $user->generateRecoveryCodes();
        $user->save();

        return redirect()->back()->with('success', 'Two-factor authentication has been enabled.');
    }

    public function destroy(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if (!password_verify($request->password, $request->user()->password)) {
            throw ValidationException::withMessages([
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $user = Auth::user();
        $user->google2fa_secret = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        return redirect()->back()->with('success', 'Two-factor authentication has been disabled.');
    }

    public function recoveryCodes()
    {
        $user = Auth::user();
        
        if (!$user->hasTwoFactorEnabled()) {
            return redirect()->route('two-factor.show');
        }

        return Inertia::render('Auth/TwoFactorRecoveryCodes', [
            'codes' => $user->two_factor_recovery_codes,
        ]);
    }

    public function newRecoveryCodes(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if (!password_verify($request->password, $request->user()->password)) {
            throw ValidationException::withMessages([
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $user = Auth::user();
        $user->two_factor_recovery_codes = $user->generateRecoveryCodes();
        $user->save();

        return redirect()->back()->with('success', 'New recovery codes have been generated.');
    }

    public function challenge()
    {
        $user = Auth::user();

        if (!$user->hasTwoFactorEnabled()) {
            return redirect()->route('dashboard');
        }

        if (session('two_factor_verified')) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/TwoFactorChallenge');
    }

    public function verify(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $user = Auth::user();
        $code = $request->code;

        // Try regular 2FA code first
        if ($user->verifyTwoFactorCode($code)) {
            session(['two_factor_verified' => true]);
            return redirect()->intended(route('dashboard'));
        }

        // Try recovery code
        if ($user->useRecoveryCode($code)) {
            session(['two_factor_verified' => true]);
            return redirect()->intended(route('dashboard'))->with('warning', 'You used a recovery code. Please consider regenerating your recovery codes.');
        }

        throw ValidationException::withMessages([
            'code' => ['The provided code is invalid.'],
        ]);
    }
}
