<?php

namespace App\Http\Controllers;

use GrahamCampbell\GitHub\Facades\GitHub;

class AuthorizationController extends Controller
{
    public function __invoke()
    {
        $sessionCode = request('code');

        // GitHub::connection('app');
        print_r(GitHub::me());

        return 'success';
    }
}
