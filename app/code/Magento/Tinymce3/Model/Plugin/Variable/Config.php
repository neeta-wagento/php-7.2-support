<?php
/**le
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
namespace Magento\Tinymce3\Model\Plugin\Variable;

class Config
{
    /**
     * @var \Magento\Framework\View\Asset\Repository
     */
    private $assetRepo;

    /**
     * @var \Magento\Ui\Block\Wysiwyg\ActiveEditor
     */
    private $activeEditor;

    /**
     * @param \Magento\Framework\View\Asset\Repository $assetRepo
     */
    public function __construct(
        \Magento\Framework\View\Asset\Repository $assetRepo,
        \Magento\Ui\Block\Wysiwyg\ActiveEditor $activeEditor
    ) {
        $this->assetRepo = $assetRepo;
        $this->activeEditor = $activeEditor;
    }

    /**
     * @param \Magento\Variable\Model\Variable\Config $subject
     * @param string $result
     * @return string
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    public function afterGetWysiwygJsPluginSrc(
        \Magento\Variable\Model\Variable\Config $subject,
        $result
    ) {
        if ($this->activeEditor->getWysiwygAdapterPath() === 'Magento_Tinymce3/tinymce3Adapter') {
            $editorPluginJs = 'Magento_Tinymce3::wysiwyg/tiny_mce/plugins/magentovariable/editor_plugin.js';
            $result = $this->assetRepo->getUrl($editorPluginJs);
        }
        return $result;
    }
}
