<?php
if (!defined('ABSPATH')) {
    header('Status: 403 Forbidden');
    header('HTTP/1.1 403 Forbidden');
    exit;
}

/**
 * PHP 5.1! No namespaces must be there!
 */

/**
 * Plugin requirements in driver WordPress.
 * Class VcvCoreRequirements.
 */
class VcvCoreRequirements
{
    /**
     * Perform system check for requirements.
     */
    public function coreChecks()
    {
        $exitMsgPhp = sprintf('Visual Composer Website Builder requires PHP %s or newer.', VCV_REQUIRED_PHP_VERSION)
            . '<a href="https://wordpress.org/about/requirements/"> ' . 'Please update!' . '</a>';
        self::checkVersion(VCV_REQUIRED_PHP_VERSION, PHP_VERSION, $exitMsgPhp);

        $exitMsgWp = sprintf(
            'Visual Composer Website Builder requires WordPress %s or newer.',
            VCV_REQUIRED_BLOG_VERSION
        );
        $exitMsgWp .= '<a href="https://codex.wordpress.org/Upgrading_WordPress"> ' . 'Please update!' . '</a>';
        self::checkVersion(VCV_REQUIRED_BLOG_VERSION, get_bloginfo('version'), $exitMsgWp);

        return true;
    }

    public function imagesExtChecks()
    {
        $exitMsgPhpExt = 'Visual Composer Website Builder requires GD/Imagick extension to be loaded.';
        $implementation = _wp_image_editor_choose();
        if (!$implementation) {
            $this->deactivate(VCV_PLUGIN_FULL_PATH);
            wp_die($exitMsgPhpExt);
        }

        return true;
    }

    public function curlExtChecks()
    {
        if (!function_exists('curl_init') || !function_exists('curl_exec')) {
            $this->deactivate(VCV_PLUGIN_FULL_PATH);
            $exitMsgPhpExt = 'Visual Composer Website Builder requires cURL extension to be loaded.';
            wp_die($exitMsgPhpExt);
        }

        return true;
    }

    /**
     * @param string $mustHaveVersion
     * @param string $versionToCheck
     * @param string $errorMessage
     *
     * @return bool
     */
    public function checkVersion($mustHaveVersion, $versionToCheck, $errorMessage = '')
    {
        if (version_compare($mustHaveVersion, $versionToCheck, '>')) {
            $this->deactivate(VCV_PLUGIN_FULL_PATH);
            wp_die($errorMessage);
        }

        return true;
    }

    public function deactivate($path)
    {
        require_once ABSPATH . '/wp-admin/includes/plugin.php';
        if (!defined('VCV_PHPUNIT') || !VCV_PHPUNIT) {
            deactivate_plugins($path);
        }
    }
}
