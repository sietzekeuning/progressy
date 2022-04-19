<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;

class AuthorizationController extends Controller
{
    public function __invoke()
    {
        $sessionCode = request('code');

        return Http::post('https://github.com/login/oauth/access_token', [
            'client_id'     => env('GITHUB_CLIENT_ID'),
            'client_secret' => env('GITHUB_SECRET'),
            'code'          => $sessionCode,
            'accept'        => 'json'
        ]);

        return 'success';
    }
}
