<?php
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

namespace Magento\GraphQlConfigurableProduct\Model\Resolver\Products\Query;

use Magento\ConfigurableProduct\Model\Product\Type\Configurable;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\GraphQlCatalog\Model\Resolver\Products\DataProvider\Product;
use Magento\GraphQlCatalog\Model\Resolver\Products\DataProvider\Product\Formatter;
use Magento\GraphQlCatalog\Model\Resolver\Products\Query\PostFetchProcessorInterface;

/**
 * Retrieves simple product data for child products, and formats configurable data
 */
class ConfigurableProductPostProcessor implements PostFetchProcessorInterface
{
    /**
     * @var SearchCriteriaBuilder
     */
    private $searchCriteriaBuilder;

    /**
     * @var Product
     */
    private $productDataProvider;

    /**
     * @var \Magento\Catalog\Model\ResourceModel\Product
     */
    private $productResource;

    /**
     * @var Formatter
     */
    private $formatter;

    /**
     * @param SearchCriteriaBuilder $searchCriteriaBuilder
     * @param Product $productDataProvider
     * @param \Magento\Catalog\Model\ResourceModel\Product $productResource
     * @param Formatter $formatter
     */
    public function __construct(
        SearchCriteriaBuilder $searchCriteriaBuilder,
        Product $productDataProvider,
        \Magento\Catalog\Model\ResourceModel\Product $productResource,
        Formatter $formatter
    ) {
        $this->searchCriteriaBuilder = $searchCriteriaBuilder;
        $this->productDataProvider = $productDataProvider;
        $this->productResource = $productResource;
        $this->formatter = $formatter;
    }

    /**
     * Process all configurable product data, including adding simple product data and formatting relevant attributes.
     *
     * @param array $productData
     * @return array
     */
    public function process(array $productData)
    {
        $childrenIds = [];
        foreach ($productData as $key => $product) {
            if ($product['type_id'] === Configurable::TYPE_CODE) {
                $formattedChildIds = [];
                foreach ($product['configurable_product_links'] as $childId) {
                    $childrenIds[] = (int)$childId;
                    $formattedChildIds[$childId] = null;
                }
                $productData[$key]['configurable_product_links'] = $formattedChildIds;
            }
        }

        $this->searchCriteriaBuilder->addFilter('entity_id', $childrenIds, 'in');
        $childProducts = $this->productDataProvider->getList($this->searchCriteriaBuilder->create());
        /** @var \Magento\Catalog\Model\Product $childProduct */
        foreach ($childProducts->getItems() as $childProduct) {
            $childData = $this->formatter->format($childProduct);
            $childId = (int)$childProduct->getId();
            foreach ($productData as $key => $item) {
                if (isset($item['configurable_product_links'])
                    && array_key_exists($childId, $item['configurable_product_links'])
                ) {
                    $productData[$key]['configurable_product_links'][$childId] = $childData;
                    $categoryLinks = $this->productResource->getCategoryIds($childProduct);
                    foreach ($categoryLinks as $position => $link) {
                        $productData[$key]['configurable_product_links'][$childId]['category_links'][] =
                            ['position' => $position, 'category_id' => $link];
                    }
                }
            }
        }

        return $productData;
    }
}
