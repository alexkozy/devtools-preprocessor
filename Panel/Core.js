// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function Core(title_span) {
    this.current_ = "";
    this.title_span_ = title_span;
    this.tools_ = {}
}

Core.prototype = {
    view: function(name) {
        return this.tools_[name].view;
    },

    register: function(name, tool, view) {
        this.tools_[name] = {tool: tool, view: view};
        view.hide();

        view.div.querySelector('.reload').addEventListener('click', function(){
            var options = {
                ignoreCache: true,
                userAgent: undefined,
                preprocessingScript: tool.preprocessorWithLibs()
            };
            chrome.devtools.inspectedWindow.reload(options);
        });

        view.div.querySelector('.enable').addEventListener('click', function(){
            var isEnable = this.active;
            if (isEnable)
                this.className += ' red-circle';
            else
                this.className = this.className.replace( /(?:^|\s)red-circle(?!\S)/g, '');
            tool.setEnable(isEnable);
            if (!isEnable)
                view.refresh();
        });

        view.div.querySelector('.clear').addEventListener('click', function(){
            tool.clear();
            view.refresh();
        });
    },

    show: function(name) {
        if (this.current_ in this.tools_)
            this.tools_[this.current_].view.hide();
        this.current_ = "";
        if (name in this.tools_)
            this.tools_[name].view.show();
        this.current_ = name;
        this.title_span_.innerHTML = name;
    }
}

document.addEventListener('polymer-ready', function() {
    core = new Core(document.getElementById('title'));

    var progress_div = document.getElementById('progress');

    core.register('Profiler', new Profiler(), new ProfilerView(document.getElementById('profiler-content'), progress_div));
    core.register('Hits Counter', new HitsCounter(), new HitsCounterView(document.getElementById('hits-counter-content'), progress_div));

    var link_profiler = document.getElementById('link-profiler');
    link_profiler.addEventListener('click', function() {
        core.show('Profiler');
    });

    var link_hits_counter = document.getElementById('link-hits-counter');
    link_hits_counter.addEventListener('click', function() {
        core.show('Hits Counter');
    });

    codeMirror = CodeMirror.fromTextArea(document.getElementById('code-view'), {
        mode: "javascript",
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "hits"],
        readOnly: true
    });

    function generateMarkStyle(from, to, count) {
        var head = document.head || document.getElementsByTagName('head')[0];
        var style = document.createElement('style');
        var css = '';
        for (var i = 1; i <= count; ++i) {
            var part = i / count;
            var r = (to.r - from.r) * part + from.r;
            var g = (to.g - from.g) * part + from.g;
            var b = (to.b - from.b) * part + from.b;

            css += '.mark-' + i + ' { background: rgb(' + Math.ceil(r) + ',' + Math.ceil(g) + ',' + Math.ceil(b) +'); }\n';
        }
        style.type = 'text/css';
        if (style.styleSheet){
          style.styleSheet.cssText = css;
        } else {
          style.appendChild(document.createTextNode(css));
        }

        head.appendChild(style);        
    }

    var mark_count = 100;
    generateMarkStyle({r: 251, g: 255, b: 178}, {r: 247, g: 139, b: 81}, mark_count);
});