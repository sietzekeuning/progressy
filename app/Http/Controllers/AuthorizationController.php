<?php

namespace App\Http\Controllers;

use GrahamCampbell\GitHub\Facades\GitHub;

class AuthorizationController extends Controller
{
    public function __invoke()
    {
        $sessionCode = request('code');

        print_r(GitHub::me()->organizations());

        return 'success';
    }
}
