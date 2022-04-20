<?php

namespace App\Http\Controllers;

use GrahamCampbell\GitHub\Facades\GitHub;
use Illuminate\Support\Facades\Http;

class AuthorizationController extends Controller
{
    public function __invoke()
    {
        $sessionCode = request('code');

        $result = Http::withHeaders(['Accept' => 'application/vnd.github.v3+json'])
            ->post('https://github.com/login/oauth/access_token', [
                'client_id'     => env('GITHUB_CLIENT_ID'),
                'client_secret' => env('GITHUB_SECRET'),
                'code'          => $sessionCode,
            ]);

        $token = $result->json()['access_token'];

        GitHub::authenticate($token, null, 'token');
        print_r(GitHub::me());

        return 'success';
    }
}
