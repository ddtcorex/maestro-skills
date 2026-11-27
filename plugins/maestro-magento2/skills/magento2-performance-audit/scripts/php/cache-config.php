<?php
// Read only: prints the cache and session storage layout of app/etc/env.php
// as JSON (backend class and database index only, never credentials).
$env = include 'app/etc/env.php';
$frontend = [];
foreach (($env['cache']['frontend'] ?? []) as $name => $config) {
    $frontend[$name] = [
        'backend' => $config['backend'] ?? null,
        'backend_options' => ['database' => $config['backend_options']['database'] ?? null],
    ];
}
$session = ['save' => $env['session']['save'] ?? 'files'];
if (isset($env['session']['redis']['database'])) {
    $session['redis'] = ['database' => $env['session']['redis']['database']];
}
echo json_encode(['cache' => ['frontend' => $frontend], 'session' => $session]);
