// ==UserScript==
// @name         Open in app mode
// @namespace    http://youmu.moe
// @version      0.1
// @description  Open the current window in app mode (no menubar, no toolbar)
// @author       Shuhao Tan
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    GM_registerMenuCommand('Open in app mode', () => {
        unsafeWindow.open(unsafeWindow.location.href, '_target', 'menubar=no,toolbar=no');
    });
})();
