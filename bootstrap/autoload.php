<?php
if (!defined('ABSPATH')) {
    header('Status: 403 Forbidden');
    header('HTTP/1.1 403 Forbidden');
    exit;
}

/**
 * Register The Composer Auto Loader.
 *
 * Composer provides a convenient, automatically generated class loader
 * for our application. We just need to utilize it! We'll require it
 * into the script here so that we do not have to worry about the
 * loading of any our classes "manually".
 *
 **/
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../visualcomposer/Framework/helpers.php';

// Environment variables
if (class_exists('\Dotenv\Dotenv')) {
    $className = '\Dotenv\Dotenv';
    $env = new $className(__DIR__ . '/..');
    if (is_object($env)) {
        /** @var $env \Dotenv\Dotenv */
        $env->load();
    }
}

if (VCV_LAZY_LOAD) {
    add_action('vcv:bootstrap:lazyload', 'vcvboot');
} else {
    vcvboot();
}

/**
 * Add action for init state.
 */
add_action('init', 'vcvinit', 11);
add_action('admin_init', 'vcvadmininit', 11);
