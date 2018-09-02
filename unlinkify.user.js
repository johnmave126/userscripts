// ==UserScript==
// @name            Unlinkify
// @namespace       http://youmu.moe/
// @description     Right click on a link while holding CTRL to unlinkify a link for easier copy & paste
// @version         0.3
// @author          Youmu Chan
// @include         *
// @exclude         file://*
// @grant           GM_addStyle
// ==/UserScript==]


(function() {
    'use strict';
    function init() {
        if (!document.body) {
            if (document.readyState === 'loading'
                && document.documentElement && document.documentElement.localName === 'html') {
                new MutationObserver((mutations, observer) => {
                    if (document.body) {
                        observer.disconnect();
                        init();
                    }
                }).observe(document.documentElement, {childList: true});
            } else {
                console.error('init got no body.');
            }
            return;
        }
        document.body.addEventListener('contextmenu', handleContextMenu);
        var prepClose = false;

        var dialog = document.createElement('dialog');
        dialog.setAttribute('id', 'tm_unlinkify_dialog');
        document.body.appendChild(dialog);
        GM_addStyle("#tm_unlinkify_dialog {padding: 0; border: 0; border-radius: 0.6rem; box-shadow: 0 0 1em black; max-width: 50%; margin: auto}");
        GM_addStyle("#tm_unlinkify_dialog:not([open]) {display: none!important;}");
        dialog.addEventListener('click', () => prepClose && dialog.close());
        dialog.addEventListener('mousedown', () => {prepClose = true;});

        var dialog_content = document.createElement('div');
        dialog.appendChild(dialog_content);
        GM_addStyle("#tm_unlinkify_dialog div {padding: 10px;}");
        dialog_content.addEventListener('click', (e) => {e.preventDefault(); e.stopPropagation()});
        dialog_content.addEventListener('mousedown', (e) => {prepClose = false; e.stopPropagation()});
    }

    function handleContextMenu(e) {
        let elem;
        if(!e.ctrlKey) {
            return;
        }
        if(!(elem = e.path.find((elem) => elem.nodeName === 'A'))) {
            return;
        }
        e.preventDefault();
        var dialog = document.getElementById('tm_unlinkify_dialog');
        dialog.firstElementChild.textContent = elem.textContent;
        dialog.showModal();
    }

    init();
})();
