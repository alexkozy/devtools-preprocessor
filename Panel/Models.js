function Model() {}

Model.prototype = {
    _evalFunctionInFrame: function(frameURL, func) {
        return new StdPromise(function(resolve, reject){
            var expr = func.toString() + '\n' + func.name + '();';
            function onEval(result, isException) {
                if (isException)
                    reject(Error('Eval failed for ' + expr, isException.value));
                resolve(result);
            }
            if (!!frameURL)
                chrome.devtools.inspectedWindow.eval(expr, {frame: {url: frameURL}}, onEval);
            else
                chrome.devtools.inspectedWindow.eval(expr, onEval);            
        });
    },

    _getReportPromise: function(frameURL) {
        return new StdPromise(function(resolve, reject) {
            var expr = this._getReport.toString() + '\ninjectedGetReport()';
            function onEval(report, isException) {
                if (isException)
                    reject(Error('Eval failed for ' + expr, isException.value));
                resolve(report);
            }
            if (!!frameURL)
                chrome.devtools.inspectedWindow.eval(expr, {frame: {url: frameURL, securityOrigin: origin }}, onEval);
            else
                chrome.devtools.inspectedWindow.eval(expr, onEval);
        });
    },

    _getFramesPromise: function(frameURL) {
        return new StdPromise(function(resolve, reject) {
            var expr = this._getFrames.toString() + "\ninjectedGetFrames()";
            function onEval(urls, isException) {
                if (isException)
                    reject(Error('Eval failed for ' + expr, isException.value));
                resolve(urls);
            }
            if (!!frameURL)
                chrome.devtools.inspectedWindow.eval(expr, {frame: {url: frameURL, securityOrigin: origin }}, onEval);
            else
                chrome.devtools.inspectedWindow.eval(expr, onEval);
        });
    },

    
    getReport: function(callback) {
        // this._evalFunctionInFrame(undefined, )

        var expr = this._getReport.toString() + '\ninjectedGetReport()';
        var myself = this;
        function onEval(report, isException) {
            if (isException)
                throw new Error('Eval failed for ' + expr, isException.value);
            callback(myself._process(report));
        }
        chrome.devtools.inspectedWindow.eval(expr, onEval);
    },

    getFullReport: function(urls) {
        var myself = this;
        var promises = urls.map(function(el){
            return myself._evalFunctionInFrame(el, myself._getReport);
        });
        return StdPromise.all(promises).then(function(reports){
            function getSingleArray(arrays) {
                var output = [];
                for (var i = 0; i < arrays.length; ++i) {
                    if (Array.isArray(arrays[i]))
                        output = output.concat(getSingleArray(arrays[i]));
                    else
                        output = output.concat([arrays[i]]);
                }
                return output;
            }
            var report = getSingleArray(reports);
            return myself._process(report);            
        });
    },

    _getFrameReport: function(frameURL) {
        return new StdPromise(function(resolve, reject){
            this._evalFunctionInFrame(frameURL, this._getReport).then(function(response) {
                var report = response;
                this._evalFunctionInFrame(frameURL, this._getFrames).then(function(response) {
                    var urls = reponse;


                    chrome.devtools.inspectedWindow.getResources(function(resources){
                        resources.foreach(function(resource) {
                            urls.foreach(function(url){
                                if (resource.url.indexOf(url) !== -1) {
                                    url = resource.url;
                                }
                            });
                        });
                    });
                    for (var i = 0; i < urls.length; ++i) {

                    }
                    // call assync get resources and replace all found by resource url

                }, function(error){
                    reject(error);
                });

            }).catch(function(error) {
                console.error('Error!', error);
            });
        });
    },

    _visitFrame: function(url, resources) {
        var myself = this;
        return new StdPromise(function(resolve, reject){
            myself._evalFunctionInFrame(url, myself._getFrames).then(function(urls){
                resolve(urls);

                // if (urls.length === 0) {
                //     resolve([url]);
                // } else {
                //     var promises = urls.map(function(el){
                //         for (var i = 0; i < resources.length; ++i)
                //             if (resources[i].url.indexOf(el) !== -1)
                //                 return myself._visitFrame.call(myself, resources[i].url, resources);
                //         return null;
                //     }).filter(function(el){
                //         return el != null;
                //     });
                //     StdPromise.all(promises).then(function(values) {
                //         resolve([url].concat(values));
                //     });
                // }
            });
        });
    },

    getReportFromAllFrames: function(callback) {

    },

    getReportFromFrame: function(url, callback) {

        // first get report
        // second get iframes
        // third get urls
        // forth recursive call to all frames
    },

    _process: function(report) {
        return report;
    },

    _getFramesURL: function(url, callback) {
        var expr = this._getFrames.toString() + '\ninjectedGetFrames()';
        var myself = this;
        function onEval(srcs, isException) {
            if (isException)
                throw new Error('Eval failed for ' + expr, isException.value);
            callback(srcs);            
        }
        if (!!url) {
            var options = {
                frame: {
                    url: url,
                    securityOrigin: origin
                }
            }
            chrome.devtools.inspectedWindow.eval(expr, options, onEval);
        } else {
            chrome.devtools.inspectedWindow.eval(expr, onEval);
        }
    },

    _processURLs: function(srcs, callback) {
        var resourceURLs = '';
        chrome.devtools.inspectedWindow.getResources(function(resources){
        resources.foreach(function(resource){
            // TODO: optimization O(n^2) :(
            srcs.foreach(function(src) {
                if (resource.url.indexOf(src) !== -1) {
                    // magic;
                }
            });
        });
    });
    },

    _getFrames: function injectedGetFrames() {
        var frames = Array.prototype.slice.call(document.querySelectorAll('iframe'));
        var urls = frames.map(function(el){ return el.src; }).filter(function(el){ return !!el; });
        return urls;
    }
}

function ProfilerModel() {
    Model.call(this);
}

ProfilerModel.prototype = {
    _getReport: function injectedGetReport() {
        var profileFunction = window.__profileFunction;
        var profileStart = window.__profileStart;
        var profileFinish = window.__profileFinish;
        var profileLast = window.__profileLast;
        var profileStack = window.__profileStack;
        var idToFunctionName = window.__idToFunctionName;
        var idToRow = window.__idToRow;
        var idToCol = window.__idToCol;

        var idToSource = window.__idToSource;
        var sourceToURL = window.__sourceToUrl;

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
