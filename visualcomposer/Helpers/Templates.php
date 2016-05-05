<?php

namespace VisualComposer\Helpers;

use VisualComposer\Helpers\Filters;
use VisualComposer\Framework\Illuminate\Support\Helper;

/**
 * Helper methods related to templates.
 * Class Templates.
 */
class Templates implements Helper
{
    /**
     * Render template.
     *
     * @param string $_path Path to view to render. Must be relative to /visualcomposer/resources/views/
     *   Extension ".php" can be ommited.
     * @param array $_args Arguments to pass to view.
     *
     * @return string Rendered view.
     * @note Do not modify variables name! Because it will be passed into `include`
     */
    public function render($_path, $_args = [])
    {
        if (strtolower(substr($_path, -4, 4)) !== '.php') {
            $_path .= '.php';
        }
        /** @var \VisualComposer\Application $_app */
        $_app = vcapp();
        ob_start();
        extract($_args);

        /** @var Filters $filterHelper */
        $filterHelper = vchelper('Filters');
        $_path = $filterHelper->fire(
            'vcv:helpers:templates:render:path',
            $_app->path('visualcomposer/resources/views/' . ltrim($_path, '/\\')),
            [
                'path' => $_path,
                'args' => $_args,
            ]
        );
        /** @noinspection PhpIncludeInspection */
        include($_path);
        $content = ob_get_clean();

        return $content;
    }
}
