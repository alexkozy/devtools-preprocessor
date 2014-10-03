// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function View(title_el, div, progress_div) {
    this.title_el = title_el;
    this.div = div;
    this.progress_div = progress_div;
    this.progress_el = progress_div.querySelector('paper-progress');
}

View.prototype = {
    setModel: function(model) {
        this.model = model;

        var view = this;
        this.div.querySelector('.reload').addEventListener('click', model.reloadWithTool.bind(model));
        this.div.querySelector('.enable').addEventListener('click', function(){
            var isEnable = this.active;
            var button = this;
            model.setEnable(isEnable, function(){
                if (isEnable) {
                    button.className += ' red-circle';
                } else {
                    button.className = button.className.replace( /(?:^|\s)red-circle(?!\S)/g, '');
                    view.refresh();
                }
            });
        });

        this.div.querySelector('.clear').addEventListener('click', function(){
            model.clear();
            view.refresh();
        });   
    },

    refresh: function() {
        var myself = this;
        function processReport(report) {
            myself.showReport(report);            
        }
        this.model_.getReport(processReport);
    },

    set div(v) {
        this.div_ = v;
    },

    get div() {
        return this.div_;
    },

    show: function() {
        this.div_.style.display = 'block';
        this.title_el.innerHTML = this.name();
    },

    hide: function() {
        this.div_.style.display = 'none';
        this.title_el.innerHTML = '';
    },

    setTotalWork: function(max) {
        this.progress_div.style.display = 'block';
        this.progress_el.max = max;
        this.progress_el.value = 0;
    },

    setWorked: function(value) {
        this.progress_el.value = value;
    },

    done: function() {
        this.progress_div.style.display = 'none';
    }
}

function ProfilerView(title_el, div, progress_div) {
    View.call(this, title_el, div, progress_div);
    this.model_ = new ProfilerModel();
    var viewEl = document.querySelector('x-timeline-view');
    viewEl.innerHTML = "";
    tvcm.ui.decorate(viewEl, tracing.TimelineView);
    viewEl.viewTitle = '';
    viewEl.userSelectionChanged = this._onSelectionChanged;
    tracing.constants.HEADING_WIDTH = 40;
    this.viewEl = viewEl;
}

ProfilerView.prototype = {
    name: function() {
        return "Profiler";
    },

    showReport: function(report) {
        var data = [];

        var kt = 1000.0;
        for (var i = 0; i < report.length; ++i) {
            data.push({
                "name": report[i].name ? report[i].name : '',
                "cat" : "PERF",
                ph: "X",
                ts: report[i].correct_start * kt,
                dur: (report[i].correct_finish - report[i].correct_start) * kt,
                pid: 0,
                tid: report[i].stack,
                args: report[i].name ? report[i].args : undefined
            });
        }

        this.div_.querySelector('.results_count').innerHTML = 'Total count: ' + report.length;
        var model = new tracing.TraceModel();
        model.importTraces([data]);
        this.viewEl.model = model;
    },

    _onSelectionChanged: function(selection) {
        if (selection.length === 1) {
            var title = selection[0].title;
            var url = selection[0].args.url;
            var line = selection[0].args.line;
            chrome.devtools.panels.openResource(url, parseInt(line) - 1);
        }
    }
}
ProfilerView.prototype.__proto__ = View.prototype;

function HitsCounterView(title_el, div, progress_div, cm) {
    View.call(this, title_el, div, progress_div);
    this.model_ = new HitsCounterModel();
    this.cm = CodeMirror.fromTextArea(document.getElementById('code-view'), {
        mode: "javascript",
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "hits"],
        readOnly: true
    });

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    var css = generateMarkStyle({r: 251, g: 255, b: 178}, {r: 247, g: 139, b: 81}, 100);
    style.type = 'text/css';
    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);

    function generateMarkStyle(from, to, count) {
        var css = '';
        for (var i = 1; i <= count; ++i) {
            var part = i / count;
            var r = (to.r - from.r) * part + from.r;
            var g = (to.g - from.g) * part + from.g;
            var b = (to.b - from.b) * part + from.b;

            css += '.mark-' + i + ' { background: rgb(' + Math.ceil(r) + ',' + Math.ceil(g) + ',' + Math.ceil(b) +'); }\n';
        }
        return css;
    }
}

HitsCounterView.prototype = {
    name: function() {
        return "Hits Counter";
    },

    show: function() {
        View.prototype.show.call(this);
        this.cm.refresh();
    },

    showReport: function(reports) {
        /**
            report is array with objects:
            {
                url, total, source
                lines: num - hits
                hits: loc - hits
            }
        */
        var cm = this.cm;
        var doc = cm.getDoc();
        doc.setValue('');
        doc.markClean();
        cm.clearGutter('hits');
        this.div_.querySelector('files-with-hits').reports = reports;
    },

    showOneReport: function(report) {
        var cm = this.cm;
        var doc = cm.getDoc();
        var max_hits = 0;
        var report_hits = report.hits;
        var progress = {value: 0, total: report_hits.length + Object.keys(report.lines).length};
        for (var i = 0; i < report_hits.length; ++i)
          if (report_hits[i].count > max_hits)
            max_hits = report_hits[i].count;

        this.setTotalWork(progress.total);
        this.setWorked(0);
        doc.markClean();
        cm.clearGutter('hits');
        doc.setValue(unescape(report.source));

        for (var i = 0; i < report_hits.length; ++i)
            setTimeout(this._markHit.bind(this, report_hits[i], max_hits, progress), 30);

        for (line in report.lines)
            setTimeout(this._makeGutter.bind(this, line, report.lines[line], progress), 30);
    },

    _markHit: function(hit, max_hits, progress) {
        var mark_count = 100;
        var loc = hit.loc;
        var hits = hit.count;
        var s = Math.ceil(hits / max_hits * mark_count);
        var doc = this.cm.getDoc();
        doc.markText({line: loc.start.line - 1, ch: loc.start.column}, {line: loc.end.line - 1, ch: loc.end.column}, {className: "mark-" + s});
        this.setWorked(progress.value++)
        if (progress.value === progress.total)
            this.done();
    },

    _makeGutter: function(line, hits, progress) {
        function makeMarker(hits) {
          var marker = document.createElement("div");
          marker.innerHTML = hits.toString();
          return marker;
        }
        this.cm.setGutterMarker(parseInt(line) - 1, "hits", makeMarker(hits));
        this.setWorked(progress.value++)
        if (progress.value === progress.total)
            this.done();
    }
}
HitsCounterView.prototype.__proto__ = View.prototype;