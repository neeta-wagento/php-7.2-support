/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

/* global varienGlobalEvents, popups, tinyMceEditors, MediabrowserUtility, Base64 */
/* eslint-disable strict */
define([
    'jquery',
    'underscore',
    'tinymce4',
    'Magento_Variable/js/config-directive-generator',
    'Magento_Variable/js/custom-directive-generator',
    'mage/translate',
    'prototype',
    'mage/adminhtml/events',
    'jquery/ui',
    'mage/translate'
], function (jQuery, _, tinyMCE4, configDirectiveGenerator, customDirectiveGenerator) {
    'use strict';

    var tinyMce4Wysiwyg = Class.create();

    tinyMce4Wysiwyg.prototype = {
        mediaBrowserOpener: null,
        mediaBrowserTargetElementId: null,
        magentoVariablesPlugin: null,

        /**
         * @param {*} htmlId
         * @param {Object} config
         */
        initialize: function (htmlId, config) {

            this.id = htmlId;
            this.config = config;

            _.bindAll(
                this,
                'beforeSetContent',
                'saveContent',
                'onChangeContent',
                'openFileBrowser',
                'updateTextArea',
                'onUndo'
            );

            varienGlobalEvents.attachEventHandler('tinymceChange', this.onChangeContent);
            varienGlobalEvents.attachEventHandler('tinymceBeforeSetContent', this.beforeSetContent);
            varienGlobalEvents.attachEventHandler('tinymceSetContent', this.updateTextArea);
            varienGlobalEvents.attachEventHandler('tinymceSaveContent', this.saveContent);
            varienGlobalEvents.attachEventHandler('tinymceUndo', this.onUndo);

            if (typeof tinyMceEditors === 'undefined') {
                window.tinyMceEditors = $H({});
            }

            tinyMceEditors.set(this.id, this);
        },

        /**
         * Ensures the undo operation works properly
         */
        onUndo: function () {
            this.addContentEditableAttributeBackToNonEditableNodes();
        },

        /**
         * Setup TinyMCE4 editor
         */
        setup: function () {

            if (this.config['add_widgets']) {
                tinyMCE4.PluginManager.load('magentowidget', this.config['widget_plugin_src']);
                this.addPluginToToolbar('magentowidget', '|');
            }

            if (this.config['add_variables']) {
                this.addPluginToToolbar('magentovariable', '|');
            }

            if (this.config.plugins) {
                this.config.plugins.forEach(function (plugin) {
                    tinyMCE4.PluginManager.load(plugin.name, plugin.src);
                });
            }

            if (jQuery.isReady) {
                tinyMCE4.dom.Event.domLoaded = true;
            }
            tinyMCE4.init(this.getSettings());
        },

        /**
         * Add plugin to the toolbar if not added.
         *
         * @param {String} plugin
         * @param {String} separator
         */
        addPluginToToolbar: function (plugin, separator) {
            var plugins = this.config.tinymce4.plugins.split(' '),
                toolbar = this.config.tinymce4.toolbar.split(' ');

            if (!plugins.includes(plugin)) {
                plugins.push(plugin);
            }

            if (!toolbar.includes(plugin)) {
                toolbar.push(separator ? separator : '', plugin);
            }
            this.config.tinymce4.plugins = plugins.join(' ');
            this.config.tinymce4.toolbar = toolbar.join(' ');
        },

        /**
         * @return {Object}
         */
        getSettings: function () {
            var settings;

            settings = {
                selector: 'textarea#' + this.id,
                theme: 'modern',
                'entity_encoding': 'raw',
                'convert_urls': false,
                'content_css': this.config.tinymce4['content_css'],
                'relative_urls': true,
                menubar: false,
                plugins: this.config.tinymce4.plugins,
                toolbar: this.config.tinymce4.toolbar,
                adapter: this,

                /**
                 * @param {Object} editor
                 */
                setup: function (editor) {
                    var onChange;

                    editor.on('BeforeSetContent', function (evt) {
                        varienGlobalEvents.fireEvent('tinymceBeforeSetContent', evt);
                    });

                    editor.on('SaveContent', function (evt) {
                        varienGlobalEvents.fireEvent('tinymceSaveContent', evt);
                    });

                    editor.on('paste', function (evt) {
                        varienGlobalEvents.fireEvent('tinymcePaste', evt);
                    });

                    editor.on('PostProcess', function (evt) {
                        varienGlobalEvents.fireEvent('tinymceSaveContent', evt);
                    });

                    editor.on('undo', function (evt) {
                        varienGlobalEvents.fireEvent('tinymceUndo', evt);
                    });

                    /**
                     * @param {*} evt
                     */
                    onChange = function (evt) {
                        varienGlobalEvents.fireEvent('tinymceChange', evt);
                    };

                    editor.on('Change', onChange);
                    editor.on('keyup', onChange);

                    editor.on('ExecCommand', function (cmd) {
                        varienGlobalEvents.fireEvent('tinymceExecCommand', cmd);
                    });
                }
            };

            if (this.config.baseStaticUrl && this.config.baseStaticDefaultUrl) {
                settings['document_base_url'] = this.config.baseStaticUrl;
            }

            // Set the document base URL
            if (this.config['document_base_url']) {
                settings['document_base_url'] = this.config['document_base_url'];
            }

            if (this.config['files_browser_window_url']) {
                /**
                 * @param {*} fieldName
                 * @param {*} url
                 * @param {*} objectType
                 * @param {*} w
                 */
                settings['file_browser_callback'] = function (fieldName, url, objectType, w) {
                    varienGlobalEvents.fireEvent('open_browser_callback', {
                        win: w,
                        type: objectType,
                        field: fieldName
                    });
                };
            }

            if (this.config['widget_window_url']) {
                settings['magentowidget_url'] = this.config['widget_window_url'];
            }

            if (this.config.width) {
                settings.width = this.config.width;
            }

            if (this.config.height) {
                settings.height = this.config.height;
            }

            if (this.config.plugins) {
                settings.magentoPluginsOptions = {};

                _.each(this.config.plugins, function (plugin) {
                    settings.magentoPluginsOptions[plugin.name] = plugin.options;
                });
            }

            if (this.config.settings) {
                Object.extend(settings, this.config.settings);
            }

            return settings;
        },

        /**
         * @param {String} id
         */
        get: function (id) {
            return tinyMCE4.get(id);
        },

        /**
         * @return {Object}
         */
        activeEditor: function () {
            return tinyMCE4.activeEditor;
        },

        /**
         * Insert content to active editor.
         *
         * @param {String} content
         * @param {Boolean} ui
         */
        insertContent: function (content, ui) {
            this.activeEditor().execCommand('mceInsertContent', typeof ui !== 'undefined' ? ui : false, content);
        },

        /**
         * Set caret location in WYSIWYG editor.
         *
         * @param {Object} targetElement
         */
        setCaretOnElement: function (targetElement) {
            this.activeEditor().selection.select(targetElement);
            this.activeEditor().selection.collapse();
        },

        /**
         * @param {Object} o
         */
        openFileBrowser: function (o) {
            var typeTitle = this.translate('Select Images'),
                storeId = this.config['store_id'] !== null ? this.config['store_id'] : 0,
                frameDialog = jQuery('div.mce-container[role="dialog"]'),
                wUrl = this.config['files_browser_window_url'] +
                    'target_element_id/' + this.id + '/' +
                    'store/' + storeId + '/';

            this.mediaBrowserOpener = o.win;
            this.mediaBrowserTargetElementId = o.field;

            if (typeof o.type !== 'undefined' && o.type !== '') { //eslint-disable-line eqeqeq
                wUrl = wUrl + 'type/' + o.type + '/';
            }

            frameDialog.hide();
            jQuery('#mce-modal-block').hide();

            require(['mage/adminhtml/browser'], function () {
                MediabrowserUtility.openDialog(wUrl, false, false, typeTitle, {
                    /**
                     * Closed.
                     */
                    closed: function () {
                        frameDialog.show();
                        jQuery('#mce-modal-block').show();
                    }
                });
            });
        },

        /**
         * @param {String} string
         * @return {String}
         */
        translate: function (string) {
            return jQuery.mage.__ ? jQuery.mage.__(string) : string;
        },

        /**
         * @return {null}
         */
        getMediaBrowserOpener: function () {
            return this.mediaBrowserOpener;
        },

        /**
         * @return {null}
         */
        getMediaBrowserTargetElementId: function () {
            return this.mediaBrowserTargetElementId;
        },

        /**
         * @return {jQuery|*|HTMLElement}
         */
        getToggleButton: function () {
            return $('toggle' + this.id);
        },

        /**
         * Get plugins button.
         */
        getPluginButtons: function () {
            return $$('#buttons' + this.id + ' > button.plugin');
        },

        /**
         * @param {*} mode
         * @return {wysiwygSetup}
         */
        turnOn: function (mode) {
            this.closePopups();

            this.setup(mode);

            tinyMCE4.execCommand('mceAddControl', false, this.id);

            this.getPluginButtons().each(function (e) {
                e.hide();
            });

            return this;
        },

        /**
         * @param {String} name
         */
        closeEditorPopup: function (name) {
            if (typeof popups !== 'undefined' && popups[name] !== undefined && !popups[name].closed) {
                popups[name].close();
            }
        },

        /**
         * @return {wysiwygSetup}
         */
        turnOff: function () {
            this.closePopups();

            tinyMCE4.execCommand('mceRemoveEditor', false, this.id);

            this.getPluginButtons().each(function (e) {
                e.show();
            });

            return this;
        },

        /**
         * Close popups.
         */
        closePopups: function () {
            // close all popups to avoid problems with updating parent content area
            this.closeEditorPopup('widget_window' + this.id);
            this.closeEditorPopup('browser_window' + this.id);
        },

        /**
         * @return {Boolean}
         */
        toggle: function () {
            if (!tinyMCE4.get(this.id)) {
                this.turnOn();

                return true;
            }
            this.turnOff();

            return false;
        },

        /**
         * On form validation.
         */
        onFormValidation: function () {
            if (tinyMCE4.get(this.id)) {
                $(this.id).value = tinyMCE4.get(this.id).getContent();
            }
        },

        /**
         * On change content.
         */
        onChangeContent: function () {
            // Add "changed" to tab class if it exists
            var tab;

            this.updateTextArea();

            if (this.config['tab_id']) {
                tab = $$('a[id$=' + this.config['tab_id'] + ']')[0];

                if ($(tab) != undefined && $(tab).hasClassName('tab-item-link')) { //eslint-disable-line eqeqeq
                    $(tab).addClassName('changed');
                }
            }
        },

        /**
         * @param {Object} o
         */
        beforeSetContent: function (o) {
            o.content = this.encodeContent(o.content);
        },

        /**
         * @param {Object} o
         */
        saveContent: function (o) {
            o.content = this.decodeContent(o.content);
        },

        /**
         * Return the content stored in the WYSIWYG field
         * @param {String} id
         * @return {String}
         */
        getContent: function (id) {
            return id ? this.get(id).getContent() : this.activeEditor().getContent();
        },

        /**
         * @returns {Object}
         */
        getAdapterPrototype: function () {
            return tinyMce4Wysiwyg;
        },

        /**
         * Fix range selection placement when typing.  This fixes MAGETWO-84769
         * @param {Object} editor
         */
        fixRangeSelection: function (editor) {
            var selection = editor.selection,
                dom = editor.dom,
                rng = dom.createRng(),
                markerHtml,
                marker;

            if (!selection.getContent().length) {
                markerHtml = '<span id="mce_marker" data-mce-type="bookmark">\uFEFF</span>';
                selection.setContent(markerHtml);
                marker = dom.get('mce_marker');
                rng.setStartBefore(marker);
                rng.setEndBefore(marker);
                dom.remove(marker);
                selection.setRng(rng);
            }
        },

        /**
         * Update text area.
         */
        updateTextArea: function () {
            var editor = tinyMCE4.get(this.id),
                content;

            if (!editor) {
                return;
            }

            this.addContentEditableAttributeBackToNonEditableNodes();
            this.fixRangeSelection(editor);

            content = editor.getContent();
            content = this.decodeContent(content);

            jQuery('#' + this.id).val(content).trigger('change');
        },

        /**
         * Retrieve directives URL with substituted directive value.
         *
         * @param {String} directive
         */
        makeDirectiveUrl: function (directive) {
            return this.config['directives_url'].replace('directive', 'directive/___directive/' + directive);
        },

        /**
         * @param {Object} content
         * @return {*}
         */
        encodeDirectives: function (content) {
            // collect all HTML tags with attributes that contain directives
            return content.gsub(/<([a-z0-9\-\_]+[^>]+?)([a-z0-9\-\_]+=".*?\{\{.+?\}\}.*?".*?)>/i, function (match) {
                var attributesString = match[2];

                // process tag attributes string
                attributesString = attributesString.gsub(/([a-z0-9\-\_]+)="(.*?)(\{\{.+?\}\})(.*?)"/i, function (m) {
                    return m[1] + '="' + m[2] + this.makeDirectiveUrl(Base64.mageEncode(m[3])) + m[4] + '"';
                }.bind(this));

                return '<' + match[1] + attributesString + '>';

            }.bind(this));
        },

        /**
         * Convert {{widget}} style syntax to image placeholder HTML
         * @param {Object} content
         * @return {*}
         */
        encodeWidgets: function (content) {
            return content.gsub(/\{\{widget(.*?)\}\}/i, function (match) {
                var attributes = this.parseAttributesString(match[1]),
                    imageSrc,
                    imageHtml = '';

                if (attributes.type) {
                    attributes.type = attributes.type.replace(/\\\\/g, '\\');
                    imageSrc = this.config['widget_placeholders'][attributes.type];

                    if (this.config['widget_types'].indexOf(attributes['type_name']) > -1) {
                        imageHtml += '<span class="magento-placeholder magento-widget mceNonEditable" ' +
                            'contenteditable="false">';
                    } else {
                        imageSrc = this.config['widget_error_image_url'];
                        imageHtml += '<span ' +
                            'class="magento-placeholder magento-placeholder-error magento-widget mceNonEditable" ' +
                            'contenteditable="false">';
                    }

                    imageHtml += '<img';
                    imageHtml += ' id="' + Base64.idEncode(match[0]) + '"';
                    imageHtml += ' src="' + imageSrc + '"';
                    imageHtml += ' />';

                    if (attributes['type_name']) {
                        imageHtml += attributes['type_name'];
                    }

                    imageHtml += '</span>';

                    return imageHtml;
                }
            }.bind(this));
        },

        /**
         * @param {Object} content
         * @return {*}
         */
        decodeDirectives: function (content) {
            // escape special chars in directives url to use it in regular expression
            var url = this.makeDirectiveUrl('%directive%').replace(/([$^.?*!+:=()\[\]{}|\\])/g, '\\$1'),
                reg = new RegExp(url.replace('%directive%', '([a-zA-Z0-9,_-]+)'));

            return content.gsub(reg, function (match) { //eslint-disable-line no-extra-bind
                return Base64.mageDecode(match[1]);
            });
        },

        /**
         * Convert image placeholder HTML to {{widget}} style syntax
         * @param {Object} content
         * @return {*}
         */
        decodeWidgets: function (content) {
            return content.gsub(
                /(<span class="[^"]*magento-widget[^"]*"[^>]*>)?<img([^>]+id="[^>]+)>(([^>]*)<\/span>)?/i,
                function (match) {
                    var attributes = this.parseAttributesString(match[2]),
                        widgetCode;

                    if (attributes.id) {
                        widgetCode = Base64.idDecode(attributes.id);

                        if (widgetCode.indexOf('{{widget') !== -1) {
                            return widgetCode;
                        }
                    }

                    return match[0];
                }.bind(this)
            );
        },

        /**
         * @param {Object} attributes
         * @return {Object}
         */
        parseAttributesString: function (attributes) {
            var result = {};

            // Decode &quot; entity, as regex below does not support encoded quote
            attributes = attributes.replace(/&quot;/g, '"');

            attributes.gsub(
                /(\w+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/,
                function (match) {
                    result[match[1]] = match[2];
                }
            );

            return result;
        },

        /**
         * @param {Object} content
         * @return {*}
         */
        decodeContent: function (content) {
            var result = content;

            if (this.config['add_widgets']) {
                result = this.decodeWidgets(result);
                result = this.decodeDirectives(result);
            }

            if (this.config['add_variables']) {
                result = this.decodeVariables(result);
            }

            if (this.config['add_directives']) {
                result = this.decodeDirectives(result);
            }

            return result;
        },

        /**
         * @param {Object} content
         * @return {*}
         */
        encodeContent: function (content) {
            var result = content;

            if (this.config['add_widgets']) {
                result = this.encodeWidgets(this.decodeWidgets(result));
                result = this.removeDuplicateAncestorWidgetSpanElement(result);
            }

            if (this.config['add_variables']) {
                result = this.encodeVariables(result);
            }

            if (this.config['add_directives']) {
                result = this.encodeDirectives(result);
            }

            return result;
        },

        /**
         * Search by variables plugin and retrieve it
         *
         * @return {Object}
         */
        getVariablePluginData: function () {
            return _.filter(this.config.plugins, function (plugin) {
                return plugin.name === 'magentovariable';
            })[0];
        },

        /**
         * Encode variables in content
         *
         * @param {String} content
         * @returns {*}
         */
        encodeVariables: function (content) {
            content = content.gsub(/\{\{config path=\"([^\"]+)\"\}\}/i, function (match) {

                var path = match[1],
                    magentoVariables,
                    imageHtml;

                magentoVariables = JSON.parse(this.config['variable_placeholders']);

                if (magentoVariables[match[1]] && magentoVariables[match[1]]['variable_type'] === 'default') {
                    imageHtml = '<span id="%id" class="magento-variable magento-placeholder mceNonEditable">%s</span>';
                    imageHtml = imageHtml.replace('%s', magentoVariables[match[1]]['variable_name']);
                } else {
                    imageHtml = '<span id="%id" class="' +
                        'magento-variable magento-placeholder magento-placeholder-error ' +
                        'mceNonEditable' +
                        '">' +
                        'Not found' +
                        '</span>';
                }

                return imageHtml.replace('%id', Base64.idEncode(path));
            }.bind(this));

            content = content.gsub(/\{\{customVar code=([^\}\"]+)\}\}/i, function (match) {
                var path = match[1],
                    magentoVariables,
                    imageHtml;

                magentoVariables = JSON.parse(this.config['variable_placeholders']);

                if (magentoVariables[match[1]] && magentoVariables[match[1]]['variable_type'] === 'custom') {
                    imageHtml = '<span id="%id" class="magento-variable magento-custom-var magento-placeholder ' +
                        'mceNonEditable">%s</span>';
                    imageHtml = imageHtml.replace('%s', magentoVariables[match[1]]['variable_name']);
                } else {
                    imageHtml = '<span id="%id" class="' +
                        'magento-variable magento-custom-var magento-placeholder ' +
                        'magento-placeholder-error mceNonEditable' +
                        '">' +
                        match[1]  +
                        '</span>';
                }

                return imageHtml.replace('%id', Base64.idEncode(path));
            }.bind(this));

            return content;
        },

        /**
         * Decode variables in content.
         *
         * @param {String} content
         * @returns {*}
         */
        decodeVariables: function (content) {
            var i, el, spans, element = document.createElement('elem');

            element.innerHTML = content;
            spans = element.querySelectorAll('span.magento-variable');

            for (i = 0; i < spans.length; i++) {
                el = spans[i];

                if (el.hasClassName('magento-custom-var')) {
                    $(el).replaceWith(
                        customDirectiveGenerator.processConfig(
                            Base64.idDecode(
                                $(el).getAttribute('id')
                            )
                        )
                    );
                } else {
                    $(el).replaceWith(
                        configDirectiveGenerator.processConfig(
                            Base64.idDecode(
                                $(el).getAttribute('id')
                            )
                        )
                    );
                }

            }

            return element.innerHTML;
        },

        /**
         * Ensures the widget placeholder is not editable
         */
        addContentEditableAttributeBackToNonEditableNodes: function () {
            jQuery('.mceNonEditable', this.activeEditor().getDoc()).attr('contenteditable', false);
        },

        /**
         * Tinymce has strange behavior with html and this removes one of its side-effects
         * @param {Object} content
         * @returns string
         */
        removeDuplicateAncestorWidgetSpanElement: function (content) {
            var parser, doc;

            if (!window.DOMParser) {
                return content;
            }

            parser = new DOMParser();
            doc = parser.parseFromString(content, 'text/html');

            [].forEach.call(doc.querySelectorAll('.magento-widget'), function (widgetEl) {
                var widgetChildEl = widgetEl.querySelector('.magento-widget');

                if (!widgetChildEl) {
                    return;
                }

                [].forEach.call(widgetEl.childNodes, function (el) {
                    widgetEl.parentNode.insertBefore(el, widgetEl);
                });

                widgetEl.parentNode.removeChild(widgetEl);
            });

            return doc.body.innerHTML;
        }
    };

    return tinyMce4Wysiwyg.prototype;
});
