function Model() {}

Model.prototype = {
    getReport: function(callback) {
        var expr = this._getReport.toString() + '\ninjectedGetReport()';
        var self = this;
        evalAllFrames(expr, function(report){
            var merged = [];
            merged = merged.concat.apply(merged, report);
            callback(self._process(merged));
        });
    }
}

function ProfilerModel() {
    Model.call(this);
}

ProfilerModel.prototype = {
    _getReport: function injectedGetReport() {
        var profileFunction = window.top.__profileFunction;
        var profileStart = window.top.__profileStart;
        var profileFinish = window.top.__profileFinish;
        var profileLast = window.top.__profileLast;
        var profileStack = window.top.__profileStack;
        var idToFunctionName = window.top.__idToFunctionName;
        var idToRow = window.top.__idToRow;
        var idToCol = window.top.__idToCol;

        var idToSource = window.top.__idToSource;
        var sourceToURL = window.top.__sourceToUrl;

        var report = [];
        for (var i = 0; i <= profileLast; ++i) {
            report.push({
                name: idToFunctionName[profileFunction[i]],
                start: profileStart[i],
                finish: profileFinish[i],
                stack: profileStack[i],
                args: {
                    url: unescape(sourceToURL[idToSource[profileFunction[i]]]),
                    line: idToRow[profileFunction[i]],
                    column: idToCol[profileFunction[i]]
                }
            });
        }

        return report;
    },

    _process: function(report) {
        var sum_preprocess_time = 0.0;
        // report is sorted by finish time by default, let's check it
        report.sort(function(a, b){ return a.finish - b.finish; });
        for (var i = 1; i < report.length; ++i)
            if (report[i].finish < report[i - 1].finish)
                throw 'Bad report order by finish time on index: ' + i;
        var report_by_start = [];
        for (var i = 0; i < report.length; ++i) {
            report_by_start.push(report[i]);
        }
        report_by_start.sort(function(a, b){ return a.start - b.start; });
        // report is sorted by finish time after sort, let's check it
        for (var i = 1; i < report.length; ++i)
            if (report[i].finish < report[i - 1].finish)
                throw 'Bad report order on index: ' + i;
        // report by start is sorted by start time, let's check it
        for (var i = 1; i < report_by_start.length; ++i)
            if (report_by_start[i].start < report_by_start[i - 1].start)
                throw 'Bad report_by_start order on index: ' + i;
        var out = [];
        var start_idx = 0;
        var finish_idx = 0;
        var report_by_finish = report;
        // two times for each element - enter and leave
        for (var i = 0; i < report.length * 2; ++i) {
            var cur;
            var is_start = false;
            if (start_idx >= report.length) {
                // if no starts  - alwasys give finish left
                cur = report_by_finish[finish_idx];
                ++finish_idx;
            } else if (finish_idx >= report.length || report_by_start[start_idx].start < report_by_finish[finish_idx].finish) {
                // if start and finish records exists - get first by time
                cur = report_by_start[start_idx];
                ++start_idx;
                is_start = true;
            } else {
                // if finish exists and finish time less than start time
                cur = report_by_finish[finish_idx];
                ++finish_idx;
            }
            if (cur.name == "preprocess") {
                // if it's preprocess record
                if (is_start) {
                    // if is preprocess start
                    cur.correct_start = cur.start - sum_preprocess_time;
                } else {
                    cur.correct_finish = cur.finish - sum_preprocess_time;
                    var dur = cur.finish - cur.start;
                    sum_preprocess_time += dur;
                }
            } else if (is_start) {
                cur.correct_start = cur.start - sum_preprocess_time
            } else {
                cur.correct_finish = cur.finish - sum_preprocess_time;
                out.push(cur);
            }
        }
        return out;
    }
}
ProfilerModel.prototype.__proto__ = Model.prototype;

function HitsCounterModel() {}

HitsCounterModel.prototype = {
    _getReport: function injectedGetReport() {
        var report = {};
        for (var i = 0; i < window.top.__hits.length; ++i) {
            if (window.top.__hits[i] > 0) {
                var hits_count = window.top.__hits[i];
                var loc = window.top.__idToLocation[i];
                var per_url = report[loc.url] || {hits: [], lines: {}, total: 0, source: '', url: loc.url};
                per_url.hits.push({loc: loc, count: hits_count});
                if (per_url.lines[loc.start.line])
                    per_url.lines[loc.start.line] += hits_count;
                else
                    per_url.lines[loc.start.line] = hits_count;
                per_url.total += hits_count;
                per_url.source = __urlToSource[escape(loc.url)];
                report[loc.url] = per_url;
            }
        }
        return Object.keys(report).map(function (key) {
            return report[key];
        });
    }
}
HitsCounterModel.prototype.__proto__ = Model.prototype;
