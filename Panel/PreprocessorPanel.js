// TODO: move functions to different files
(function() {

// This function is converted to a string and becomes the preprocessor
function preprocessor(source, url, listenerName) {
	var start_time = (new Date()).getTime();

	if (preprocessor.esprima === undefined) {
		__PREFIX__;
	} else {
		esprima = preprocessor.esprima;
		estraverse = preprocessor.estraverse;
		escodegen = preprocessor.escodegen;
	}
	preprocessor.esprima = esprima;
	preprocessor.estraverse = estraverse;
	preprocessor.escodegen = escodegen;
	if (preprocessor.functionID === undefined) preprocessor.functionID = 0;
	var idToFunctionName = {};
	var idToLocation = {};

	var ast = esprima.parse(source, {loc:true});
	var profiled_block = '\
		function fake() {\n\
			function __profiled__(/*here function arguments*/) {\n\
				// here function body\n\
			}\n\
			if (window.top.__profileEnable) {\n\
				try {\n\
					window.top.__entryTime[++window.top.__entryTop] = window.top.performance.now();\n\
					return __profiled__.apply(this, arguments);\n\
				} finally {\n\
					++window.top.__profileLast;\n\
					window.top.__profileFinish[window.top.__profileLast] = window.top.performance.now();\n\
					window.top.__profileStack[window.top.__profileLast] = window.top.__entryTop;\n\
					window.top.__profileStart[window.top.__profileLast] = window.top.__entryTime[window.top.__entryTop--];\n\
					window.top.__profileFunction[window.top.__profileLast] = 1 /* here correct function ID */;\n\
				}\n\
			}\n\
			return __profiled__.apply(this, arguments);\n\
		}\n\
	';

	estraverse.traverse(ast, {
		enter: function (node, parent) {
			if ((node.type === "FunctionDeclaration" && node.id.name !== "__profiled__") || node.type === "FunctionExpression") {
				preprocessor.functionID++;
				if (node.id)
					idToFunctionName[preprocessor.functionID] = node.id.name;
				else if (node.type === "FunctionExpression" && parent && parent.type === "VariableDeclaration")
					idToFunctionName[preprocessor.functionID] = parent.id.name;
				else if (node.type === "FunctionExpression" && parent && parent.type === "Property")
					idToFunctionName[preprocessor.functionID] = parent.key.name;
				else {
					idToFunctionName[preprocessor.functionID] = '(anonymous: ' + preprocessor.functionID.toString() + ')';
				}
				idToLocation[preprocessor.functionID] = url;
				idToLocation[preprocessor.functionID] += ';' + node.loc.start.line + ',' + node.loc.start.column;

				var profiled_ast = esprima.parse(profiled_block);
				var profiled_function = profiled_ast.body[0].body.body[0];
				// setup inner profiled function body
				profiled_function.body = node.body;
				// setup inner profiled function arguments
				profiled_function.defaults = node.defaults;
				profiled_function.params = node.params;
				// setup function ID
				var function_id_node = profiled_ast.body[0].body.body[1].consequent.body[0].finalizer.body[4].expression.right;
				function_id_node.raw = preprocessor.functionID.toString();
				function_id_node.value = preprocessor.functionID;
				// setup alternative function body
				node.body = profiled_ast.body[0].body;
			}
		}
	});

	var processed_source = escodegen.generate(ast);
	// TODO: try to move it to InjectedScript
  	var prefix = '\
  		window.top.__entryTime = window.top.__entryTime || new Float64Array(4 * 4096);\n\
  		window.top.__entryTop = window.top.__entryTop || -1;\n\
  		window.top.__profileFunction = window.top.__profileFunction || new Int16Array(16 * 65536);\n\
  		window.top.__profileStart = window.top.__profileStart || new Float64Array(16 * 65536);\n\
  		window.top.__profileFinish = window.top.__profileFinish || new Float64Array(16 * 65536);\n\
  		window.top.__profileLast = window.top.__profileLast || -1;\n\
  		window.top.__profileStack = window.top.__profileStack || new Int16Array(16 * 65536);\n\
  		window.top.__idToFunctionName = window.top.__idToFunctionName || {};\n\
  		window.top.__idToLocation = window.top.__idToLocation || {};\n\
  		window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;\n\
  	';
  	for (id in idToFunctionName) {
  		prefix = prefix.concat('window.top.__idToFunctionName[' + id + '] = \'' + idToFunctionName[id] + '\';\n');
  		prefix = prefix.concat('window.top.__idToLocation[' + id + '] = \'' + idToLocation[id] + '\';\n');
  	}
	prefix = prefix.concat('window.top.__idToFunctionName[-1] = \'preprocess\';\n');

  	var end_time = (new Date()).getTime();
  	var total_time = (end_time - start_time);

  	if (total_time > 0.0) {
	  	prefix += '\
	  		++window.top.__profileLast;\n\
			window.top.__profileFinish[window.top.__profileLast] = window.performance.now();\n\
			window.top.__profileStart[window.top.__profileLast] = window.top.__profileFinish[window.top.__profileLast] - ' + total_time.toString() + ';\n\
			window.top.__profileStack[window.top.__profileLast] = -100;\n\
			window.top.__profileFunction[window.top.__profileLast] = -1;\n\
		';
	}

	return '{\n' + prefix + '}\n' + processed_source;
}


function XHRLoadFile(name, path) {
	console.log('Loading lib: ' + name + '..');
	var req = new XMLHttpRequest();
	req.open('GET', path + name, false);
	req.send(null);
	if (req.status === 200) {
		console.log('Lib ' + name + ' loaded');
		return req.responseText;
	}
	else
		throw "Can't load lib: " + name + " with status: " + req.status;
}


function preprocessorWithLibs(preprocessor_source, libs) {
	var LIBS_PATH = 'chrome-extension://' + chrome.runtime.id + '/libs/';
	var PREFIX_PLACE = '__PREFIX__';
	var prefix = '';
	libs.forEach(function(lib_name){
		prefix += XHRLoadFile(lib_name, LIBS_PATH);
	});
	var start_prefix_place = preprocessor_source.indexOf(PREFIX_PLACE);
	// .replace doesn't work, because lib can contain dollar sign
	preprocessor_source = preprocessor_source.substring(0, start_prefix_place) + prefix + preprocessor_source.substring(start_prefix_place + PREFIX_PLACE.length);
	preprocessor_source = '(' + preprocessor_source + ')';
	return preprocessor_source;
}


function reloadWithPreprocessor(injectedScript) {
	var preprocessor_source = preprocessorWithLibs(preprocessor.toString(), ['esprima.js', 'estraverse.js', 'escodegen.browser.js']);
  	var options = {
    	ignoreCache: true,
    	userAgent: undefined,
    	injectedScript: undefined,
    	preprocessingScript: preprocessor_source
  	};

  	chrome.devtools.inspectedWindow.reload(options);
}


function reloadWithCoverageAnalysis() {
	var preprocessor_source = preprocessorWithLibs(preprocessorCoverage.toString(), ['esprima.js', 'estraverse.js', 'escodegen.browser.js']);
  	var options = {
    	ignoreCache: true,
    	userAgent: undefined,
    	injectedScript: undefined,
    	preprocessingScript: preprocessor_source
  	};
  	chrome.devtools.inspectedWindow.reload(options);	
}


function getReport() {
	var profileFunction = window.top.__profileFunction;
	var profileStart = window.top.__profileStart;
	var profileFinish = window.top.__profileFinish;
	var profileLast = window.top.__profileLast;
	var profileStack = window.top.__profileStack;
	var idToFunctionName = window.top.__idToFunctionName;
	var idToLocation = window.top.__idToLocation;

	var report = [];
	for (var i = 0; i <= profileLast; ++i) {
		report.push({
			name: idToFunctionName[profileFunction[i]],
			start: profileStart[i],
			finish: profileFinish[i],
			stack: profileStack[i],
			args: {
				url: idToLocation[profileFunction[i]].split(';')[0],
				line: parseInt(idToLocation[profileFunction[i]].split(';')[1].split(',')[0]),
				column: parseInt(idToLocation[profileFunction[i]].split(';')[1].split(',')[1])
			}
		});
	}

	return report;
}


function removePreprocessFromReport(report) {
	var sum_preprocess_time = 0.0;

	// report is sorted by finish time by default, let's check it
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


function demoPreprocessor() {
	function onLoaded() {}
	var loadMonitor = new InspectedWindow.LoadMonitor(onLoaded);
	reloadWithPreprocessor(loadMonitor.injectedScript);
}


function refreshTimeline() {
	var expr = getReport.toString() + '\ngetReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);
		document.getElementById('results_count').innerHTML = 'Total count: ' + report.length.toString();
		refreshVisual(removePreprocessFromReport(report));	
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);
}


function onSelectionChanged(selection) {
	if (selection.length === 1) {
		var title = selection[0].title;
		var url = selection[0].args.url;
		var line = selection[0].args.line;
		chrome.devtools.panels.openResource(url, parseInt(line) - 1);
	}
}


function refreshVisual(report) {
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

	var model = new tracing.TraceModel();
	model.importTraces([data]);

	var viewEl = document.getElementById('results');
	tvcm.ui.decorate(viewEl, tracing.TimelineView);
	viewEl.model = model;
	viewEl.viewTitle = '';
	viewEl.userSelectionChanged = onSelectionChanged;
}


function getCoverageReport() {
	var report = [];
	for (var i = 0; i < window.top.__hits.length; ++i) {
		if (window.top.__hits[i] > 0)
			report.push({count: window.top.__hits[i], loc: window.top.__idToLocation[i]});
	}
	return report;
}


function refreshCoverage() {
	var expr = getCoverageReport.toString() + '\ngetCoverageReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		refreshCoverageVisual(report);
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);	
}


function refreshCoverageVisual(report) {
	console.log(report);

	var urls = {};
	for (var i = 0; i < report.length; ++i) {
		if (report[i].count > 0) {
			if (urls[report[i].loc.url] === undefined)
				urls[report[i].loc.url] = report[i].count;
			else
				urls[report[i].loc.url] += report[i].count;
		}
	}

	var urls_list = [];
	for (var url in urls) {
		urls_list.push({url: url, count: urls[url]});
	}

	urls_list.sort(function(a, b){ return b.count - a.count; });

	console.log(urls_list);
	// report.sort(function(a, b){ return b.count - a.count});
	var table = "<table id=\"sources\" cellpadding=\"0\" cellspacing=\"0\"><tbody><tr>";
	for (var i = 0; i < urls_list.length; i++) {
   		if (i > 0)
   			table += "</tr><tr>";
  		table += "<td>" + urls_list[i].count + "</td>";
  		table += "<td><a href=\"#\">" + urls_list[i].url + "</a></td>";
	}
	table += "</tr></tbody></table>";
	document.getElementById('results_info').innerHTML = table;

	$("#sources a").on("click", function(){
		refreshSourceWithCoverageQuery($(this).text());
	});

	// var readOnlyCodeMirror = CodeMirror.fromTextArea(document.getElementById('coveraged_source'), {
 //        mode: "javascript",
 //        theme: "default",
 //        lineNumbers: true,
 //        readOnly: true
 //    });

 //    readOnlyCodeMirror.setValue("function myScript(){\nreturn 100;\n}\n");
 //    readOnlyCodeMirror.markText({line: 1, ch: 1}, {line: 1, ch: 5}, {className: 'test'});

	// var myCodeMirror = CodeMirror.fromTextArea(document.getElementById('coveraged_source'));

	// var myCodeMirror = CodeMirror(document.getElementById('results_info'), {
 //  		value: "function myScript(){return 100;}\n",
 //  		mode:  "javascript"
	// });
}


function refreshSourceWithCoverageQuery(url) {
	var expr = getCoverageReport.toString() + '\ngetCoverageReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		expr = "window.top.__urlToSource['" + escape(url) + "']";
		function onEval(source, isException) {
			if (isException)
				throw new Error('Eval failed for ' + expr, isException.value);
			refreshSourceWithCoverage(report, url, unescape(source));
		}
		chrome.devtools.inspectedWindow.eval(expr, onEval);
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);	
}


function refreshSourceWithCoverage(report, url, source) {
	report = report.filter(function(obj){
		return obj.loc.url == url;
	});

	var readOnlyCodeMirror = CodeMirror.fromTextArea(document.getElementById('coveraged_source'), {
        mode: "javascript",
        theme: "default",
        lineNumbers: true,
        readOnly: true,
        gutters: ["CodeMirror-linenumbers", "counts"]
    });

    readOnlyCodeMirror.setValue(source);

    var cm = readOnlyCodeMirror;

    function makeMarker(count) {
    	var marker = document.createElement("div");
    	marker.innerHTML = count.toString();
    	return marker;
    }

    for (var i = 0; i < report.length; ++i) {
    	cm.setGutterMarker(report[i].loc.start.line - 1, "counts", makeMarker(report[i].count));;
    	// readOnlyCodeMirror.markText({line: report[i].loc.start.line - 1, ch: report[i].loc.start.column}, 
    	// 	{line: report[i].loc.end.line - 1, ch: report[i].loc.end.column},
    	// 	{className: 'test'});
    }
}


function switchProfiler() {
  	var expr = 'window.top.__profileEnable';
	function onEval(profileEnable, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);
		
		var newValue = !profileEnable;
		var newInner = newValue ? 'Disable' : 'Enable';

		var expr = 'window.top.__profileEnable = ' + newValue.toString();
		chrome.devtools.inspectedWindow.eval(expr);
		document.querySelector('.switch-button').innerHTML = newInner;
		if (!newValue)
			refreshTimeline();
			// refreshCoverage();
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);		
}


function clearProfile() {
  	var expr = 'window.top.__profileLast = -1;';
	function onEval(res, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);
		
		refreshTimeline();
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);			
}


function listen() {
  var reloadButton = document.querySelector('.reload-button');
  reloadButton.addEventListener('click', demoPreprocessor);

  var refreshButton = document.querySelector('.refresh-button');
  refreshButton.addEventListener('click', refreshCoverage/*refreshTimeline*/);

  var switchButton = document.querySelector('.switch-button');
  switchButton.addEventListener('click', switchProfiler);

  var clearButton = document.querySelector('.clear-button');
  clearButton.addEventListener('click', clearProfile);

  var reloadCoverageButton = document.querySelector('.reload-coverage-button');
  reloadCoverageButton.addEventListener('click', reloadWithCoverageAnalysis);
}


window.addEventListener('load', listen);
})();
