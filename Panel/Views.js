function View(div) {
    this.div = div;
}

View.prototype = {
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
    },

    hide: function() {
        this.div_.style.display = 'none';
    }
}

function ProfilerView(div) {
    View.call(this, div);
    this.model_ = new ProfilerModel();
}

ProfilerView.prototype = {
    showReport: function(report) {
        var data = [];

        var kt = 1000.0;
        for (var i = 0; i < report.length; ++i) {
            data.push({
                "name": report[i].name,
                "cat" : "PERF",
                ph: "X",
                ts: report[i].correct_start * kt,
                dur: (report[i].correct_finish - report[i].correct_start) * kt,
                pid: 0,
                tid: report[i].stack,
                args: report[i].args
            });
        }

        this.div_.querySelector('.results_count').innerHTML = 'Total count: ' + report.length;
        tracing.constants.HEADING_WIDTH = 40;

        var model = new tracing.TraceModel();
        model.importTraces([data]);

        var viewEl = document.querySelector('x-timeline-view');
        viewEl.innerHTML = "";
        tvcm.ui.decorate(viewEl, tracing.TimelineView);
        viewEl.model = model;
        viewEl.viewTitle = '';
        viewEl.userSelectionChanged = this._onSelectionChanged;
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

function HitsCounterView(div) {
    View.call(this, div);
    this.model_ = new HitsCounterModel();
}

HitsCounterView.prototype = {
    showReport: function(report) {
        /**
            report is array with objects:
            {
                url, total, source
                lines: num - hits
                hits: loc - hits
            }
        */
        this.div_.querySelector('files-with-hits').reports = report;
    }
}
HitsCounterView.prototype.__proto__ = View.prototype;