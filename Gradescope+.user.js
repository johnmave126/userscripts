// ==UserScript==
// @name         Gradescope+
// @namespace    http://youmu.moe/
// @version      0.2
// @description  Add more shortcuts for Gradescope
// @author       Shuhao Tan
// @match        https://gradescope.com/courses/*/superfast_grade
// @match        https://gradescope.com/courses/*/grade
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
    const ToolMap = {
        'NORMAL': 'T', //Hand
        'DRAW_FREEFORM_ANNOTATION': 'Y', //Pen
        'DRAW_BOX_ANNOTATION': 'U', //Rectangle
        'ERASE_ANNOTATION': 'I', //Eraser
    };

    //Helpers
    function $$(qry) {
        return document.body.querySelector(qry);
    }

    function $$s(qry) {
        return document.body.querySelectorAll(qry);
    }

    function findReactInt(dom) {
        for(let key in dom) {
            if(key.startsWith('__reactInternalInstance$')) {
                return dom[key];
            }
        }
    }

    function findOwner(comp) {
        return comp._owner;
    }

    // Enhance Tools
    var toolBtn = $$('div.pageViewerControls div.btnGroup:nth-child(2) button');
    var rBtnBar = findOwner(findReactInt(toolBtn)._currentElement);
    var _renderButton = rBtnBar._currentElement.type.prototype.renderButton;
    for(let key in ToolMap) {
        // Add shortcuts
        unsafeWindow.key(ToolMap[key], ((mode) => () => rBtnBar._instance.props.setMode(mode))(key));
    }
    // Add shortcut indications
    rBtnBar._currentElement.type.prototype.renderButton = function(e, t) {
        let elem = _renderButton.call(this, e, t);
        Object.assign(elem.props, {
            title: `Shortcut: ${ToolMap[e]}`
        });
        return elem;
    };
    rBtnBar._instance.forceUpdate();

    // Reset to NORMAL after rectangle and eraser keyup
    var boxParent = findReactInt($$('div.pv--viewport div.u-parentSize'));

    // Rectangle
    var rBoxAnnotation = boxParent._currentElement.props.children[1];
    var _boxRender = rBoxAnnotation.type.prototype.render;
    rBoxAnnotation.type.prototype.render = function() {
        let elem = _boxRender.apply(this, arguments);
        let _handleDragEnd = elem.props.handleDragEnd;
        Object.assign(elem.props, {
            handleDragEnd: () => {
                let ret = _handleDragEnd.apply(this, arguments);
                rBtnBar._instance.props.setMode('NORMAL');
                return ret;
            }
        });
        return elem;
    };
    var _boxDragEnd = boxParent._renderedChildren['.1']._instance.handleDragEnd;
    boxParent._renderedChildren['.1']._instance.handleDragEnd = function() {
        let ret = _boxDragEnd.apply(this, arguments);
        rBtnBar._instance.props.setMode('NORMAL');
        return ret;
    };
    boxParent._renderedChildren['.1']._instance.forceUpdate();

    // Erase
    var rErateAnnotation = boxParent._renderedChildren['.5']._renderedComponent;
    var _eraseRender = rErateAnnotation._currentElement.type.prototype.render;
    rErateAnnotation._currentElement.type.prototype.render = function() {
        let elem = _eraseRender.apply(this, arguments);
        let _handleDragEnd = elem.props.handleDragEnd;
        Object.assign(elem.props, {
            handleDragEnd: () => {
                let ret = _handleDragEnd.apply(this, arguments);
                rBtnBar._instance.props.setMode('NORMAL');
                return ret;
            }
        });
        return elem;
    };
    var _eraserDragEnd = rErateAnnotation._instance.handleDragEnd;
    rErateAnnotation._instance.handleDragEnd = function() {
        let ret = _eraserDragEnd.apply(this, arguments);
        rBtnBar._instance.props.setMode('NORMAL');
        return ret;
    };
    rErateAnnotation._instance.forceUpdate();

    // Enhance Problem List
    // Add Shortcuts
    var firstProblem = $$('a.questionSwitcher--questionTitle');
    unsafeWindow.key('home', () => firstProblem.click());
    var rProblem = findOwner(findReactInt(firstProblem.parentNode)._currentElement);
    var rProblemParent = findOwner(rProblem._currentElement);
    var _renderLink = rProblem._currentElement.type.prototype.renderLink;
    rProblem._currentElement.type.prototype.renderLink = function() {
        var elem = _renderLink.apply(this, arguments);
        if(this.props.currentQuestionId === rProblemParent._currentElement.props.leafQuestions[0].id) {
            elem.props.className += ' questionSwitcher--questionTitle-is-first';
        }
        return elem;
    };
    // Add Shortcut Indication
    var rProblemShortcut = rProblem._renderedComponent._currentElement.props.children[1];
    var _renderIndication = rProblemShortcut.type.prototype.render;
    rProblemShortcut.type.prototype.render = function() {
        return this.props.questionId === rProblemParent._currentElement.props.leafQuestions[0].id ? rProblemShortcut.type.renderIndicator('First', 'Home') : _renderIndication.apply(this, arguments);
    }
    rProblem._instance.forceUpdate();
    rProblem._renderedComponent._renderedChildren['.1']._instance.forceUpdate();

    GM_addStyle(".questionSwitcher--questionTitle-is-first { width: calc(100% - 80px); }");
})();
