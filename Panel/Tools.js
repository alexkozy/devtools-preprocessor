// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function Tool() {}

Tool.prototype = {
	_getLib: function(name, path) {
		var req = new XMLHttpRequest();
		req.open('GET', path + name, false);
		req.send();
		if (req.status === 200)
			return req.responseText;
		else
			throw "Can't load lib: " + name + " with status: " + req.status;
	},

	requiredLibs: function() {
		return [];
	},

	preprocessorWithLibs: function() {
		var LIBS_PATH = 'chrome-extension://' + chrome.runtime.id + '/tools-libs/';
		var LIBS_PLACE = '__LIBS__';
		var prefix = '';
		var libs = this.requiredLibs();
		for (var i = 0; i < libs.length; ++i)
			prefix += this._getLib(libs[i], LIBS_PATH);
		var preprocessor_source = this.preprocessor.toString();
		var start_prefix_place = preprocessor_source.indexOf(LIBS_PLACE);
		preprocessor_source = preprocessor_source.substring(0, start_prefix_place) + prefix + preprocessor_source.substring(start_prefix_place + LIBS_PLACE.length);
		preprocessor_source = '(' + preprocessor_source + ')';
		return preprocessor_source;
	},

	setEnable: function(enabled) {
		var expr = 'window.__toolEnabled = ' + (enabled ? 'true' : 'false') + ';';
		evalAllFrames(expr);
	}
}

/**
 * Profiler preprocessor
 */
function Profiler() {
	Tool.call(this);	
}

Profiler.prototype = {
	preprocessor: function(source, url, functionName) {
		var start_time = (new Date()).getTime();

		if (!this.libsExported) {
			__LIBS__;
			this.libsExported = true;
		}

		this.esprima = this.esprima || esprima;
		this.estraverse = this.estraverse || estraverse;
		this.escodegen = this.escodegen || escodegen;
		this.sourceMap = this.sourceMap || window.sourceMap;

		if (this.functionID === undefined) this.functionID = 1;
		if (this.sourceID === undefined) this.sourceID = 1;

		var functionID = this.functionID;
		var idToFunctionName = {};
		var idToRow = {};
		var idToCol = {};

		var sourceID = ++this.sourceID;

		String.prototype.startsWith = function (str){
		    return this.indexOf(str) == 0;
		};

		var ast = esprima.parse(source, {loc:true, comment:true});

		for (var idx in ast.comments) {
			var comment = ast.comments[idx];
			if (comment.value.indexOf('do-not-preprocess') !== -1) {
				return source;
			}
		}
		var profiled_block = '\
			function fake() {\n\
				function __profiled__(/*here function arguments*/) {\n\
					// here function body\n\
				}\n\
				if (window.__toolEnabled && window.__profileCalls + 1 < window.__MAX_PROFILE_LENGTH) {\n\
					try {\n\
						++window.__profileCalls;\n\
						window.__entryTime[++window.__entryTop] = window.performance.now();\n\
						return __profiled__.apply(this, arguments);\n\
					} finally {\n\
						++window.__profileLast;\n\
						window.__profileFinish[window.__profileLast] = window.performance.now();\n\
						window.__profileStack[window.__profileLast] = window.__entryTop;\n\
						window.__profileStart[window.__profileLast] = window.__entryTime[window.__entryTop--];\n\
						window.__profileFunction[window.__profileLast] = 1 /* here correct function ID */;\n\
					}\n\
				}\n\
				return __profiled__.apply(this, arguments);\n\
			}\n\
		';

		function findMagicComment(content, name) {
			var pos = content.length;
			while (true) {
				pos = content.lastIndexOf(name, pos);
				if (pos === -1) return '';
				if (pos < 4) return '';
				pos -= 4;
				if (content.charAt(pos) != '/' || content.charAt(pos + 1) != '/') continue;
				if (content.charAt(pos + 2) != '#' && content.charAt(pos + 2) != '@') continue;
				if (content.charAt(pos + 3) != ' ' && content.charAt(pos + 3) != '\t') continue;
				var equalSignPos = pos + 4 + name.length;
				if (equalSignPos < content.length && content.charAt(equalSignPos) != '=') continue;
				break;
			}

			var urlPos = equalSignPos + 1;
			var match = content.substring(urlPos);
			var newLine = match.indexOf('\n');
			if (newLine !== -1)
				match = match.substring(0, newLine);
			match = match.trim();
			var disallowedChars = '"\' \t';
			for (var i = 0; i < match.length; ++i)
				if (disallowedChars.indexOf(match.charAt(i)) !== -1)
					return '';
			return match;
		}

		var hasURL = true;
		if (!url)
			url = findMagicComment(source, 'sourceURL');
		if (!url) {
			hasURL = false;
			url = '(anonymous:' + sourceID + ')';
		}

		estraverse.traverse(ast, {
			enter: function (node, parent) {
				if ((node.type === "FunctionDeclaration" && node.id.name !== "__profiled__") || node.type === "FunctionExpression") {
					functionID++;
					if (node.id)
						idToFunctionName[functionID] = node.id.name;
					else if (node.type === "FunctionExpression" && parent && parent.type === "VariableDeclaration")
						idToFunctionName[functionID] = parent.id.name;
					else if (node.type === "FunctionExpression" && parent && parent.type === "Property")
						idToFunctionName[functionID] = parent.key.name;
					else {
						idToFunctionName[functionID] = '(anonymous: ' + functionID.toString() + ')';
					}

					idToRow[functionID] = node.loc.start.line  ? node.loc.start.line : 1;
					idToCol[functionID] = node.loc.start.column ? node.loc.start.column : 1;

					var profiled_ast = esprima.parse(profiled_block);
					var profiled_function = profiled_ast.body[0].body.body[0];
					// setup inner profiled function body
					profiled_function.body = node.body;
					// setup inner profiled function arguments
					profiled_function.defaults = node.defaults;
					profiled_function.params = node.params;
					// setup function ID
					var function_id_node = profiled_ast.body[0].body.body[1].consequent.body[0].finalizer.body[4].expression.right;
					function_id_node.raw = functionID.toString();
					function_id_node.value = functionID;
					// setup alternative function body
					node.body = profiled_ast.body[0].body;
				}
			}
		});
		this.functionID = functionID;

	
	  	var prefix = __beforeAll.toString() + '\n__beforeAll();\n';
	  	prefix += 'window.__sourceToUrl[' + sourceID + '] = \'' + escape(url) + '\';\n';
	  	for (id in idToFunctionName) {
	  		prefix = prefix.concat('window.__idToFunctionName[' + id + '] = \'' + idToFunctionName[id] + '\';\n');
	  		prefix = prefix.concat('window.__idToRow[' + id + '] = ' + idToRow[id] + ';\n');
	  		prefix = prefix.concat('window.__idToCol[' + id + '] = ' + idToCol[id] + ';\n');
	  		prefix = prefix.concat('window.__idToSource[' + id + '] = ' + sourceID + ';\n');
	  	}

		var prefix_ast = esprima.parse(prefix);
		var prefix_body = prefix_ast.body;

		ast.body = prefix_body.concat(ast.body);

		var processed_result;
		if (hasURL)
			processed_result = escodegen.generate(ast, {sourceMap: url, sourceMapWithCode: true});
		else
			processed_result = escodegen.generate(ast, {sourceMap: url, sourceMapWithCode: true, sourceContent: source});
		
	  	var end_time = (new Date()).getTime();
	  	var total_time = (end_time - start_time);
	  	prefix += '\
			window.__profileStart[window.__profileLast] = window.__profileFinish[window.__profileLast] - ' + total_time.toString() + ';\n\
		';

		var processed_source = '{\n' + prefix + '}\n' + processed_result.code;
		if (processed_result.map)
			return processed_source + '\n//# sourceMappingURL=data:application/json,' + encodeURIComponent(processed_result.map.toString());
		return processed_source;

		function __beforeAll() {
			/* do-not-preprocess */
			// TODO: replace magic number with real value from first special instrument
			var MAX_STACK_SIZE = 1024;
	  		var MAX_FUNCTION_COUNT = 32 * 1024;
	  		var MAX_PROFILE_LENGTH = 1024 * 1024;

	  		window.__entryTime = window.__entryTime || new Float64Array(MAX_STACK_SIZE);
	  		window.__entryTop = window.__entryTop || -1;

	  		window.__MAX_PROFILE_LENGTH = MAX_PROFILE_LENGTH;
	  		window.__profileFunction = window.__profileFunction || new Int16Array(MAX_PROFILE_LENGTH);
	  		window.__profileStart = window.__profileStart || new Float64Array(MAX_PROFILE_LENGTH);
	  		window.__profileFinish = window.__profileFinish || new Float64Array(MAX_PROFILE_LENGTH);
	  		window.__profileStack = window.__profileStack || new Int16Array(MAX_PROFILE_LENGTH);
	  		window.__profileLast = window.__profileLast || -1;
	  		window.__profileCalls = window.__profileCalls || -1;

	  		window.__toolEnabled = window.__toolEnabled !== undefined ? window.__toolEnabled : false;
	  		window.__idToFunctionName = window.__idToFunctionName || {};

	  		window.__idToRow = window.__idToRow || new Int16Array(MAX_FUNCTION_COUNT);
	  		window.__idToCol = window.__idToCol || new Int16Array(MAX_FUNCTION_COUNT);	
	  		window.__idToSource = window.__idToSource || new Int16Array(MAX_FUNCTION_COUNT);
	  		window.__sourceToUrl = window.__sourceToUrl || [];

			window.__idToFunctionName[0] = 'preprocess';
			window.__idToRow[0] = 1;
			window.__idToCol[0] = 1;
			window.__idToSource[0] = 0;
			window.__sourceToUrl[0] = 'preprocessor';
		}
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js', 'source-map.js'];
	},

	clear: function() {
		var expr = 'window.__profileLast = -1;';
		evalAllFrames(expr);
	}
}
Profiler.prototype.__proto__ = Tool.prototype;

/**
 * Hits Counter preprocessor
 */
function HitsCounter() {
	Tool.call(this);
}

HitsCounter.prototype = {
	preprocessor: function (source, url, functionName) {
		if (!this.libsExported) {
			__LIBS__;
			this.libsExported = true;
		}

		this.esprima = this.esprima || esprima;
		this.estraverse = this.estraverse || estraverse;
		this.escodegen = this.escodegen || escodegen;

		if (this.lastLocID === undefined) this.lastLocID = 0;
		var lastLocID = this.lastLocID;

		String.prototype.endsWith = function(suffix) {
		    return this.indexOf(suffix, this.length - suffix.length) !== -1;
		};
		function makeInstrument(id) {
			var instrument_source = 'window.__toolEnabled && window.__hits[0]++';
			var instrument = esprima.parse(instrument_source).body[0].expression;
			var id_property = instrument.right.argument.property;
			id_property.raw = id.toString();
			id_property.value = id;
			return instrument;
		}
		function addSourceUrl(location) {
			location.url = url;
			return location;
		}
		var idToLocation = {};
		var ast = esprima.parse(source, {loc:true});
		ast = estraverse.replace(ast, {
			leave: function (node, parent) {
				if (node.type === "ReturnStatement" && node.argument === null) {
				 	++lastLocID;
				 	idToLocation[lastLocID] = addSourceUrl(node.loc);	
				 	return { 
				 		type: "ReturnStatement", argument: { 
				 			type: "SequenceExpression", expressions: [
				 				makeInstrument(lastLocID), 
				 				{ type: "Identifier", name: "undefined" }
				 			]
				 		}
				 	};			
				}
				if (node.type === "EmptyStatement") {
					++lastLocID;
					idToLocation[lastLocID] = addSourceUrl(node.loc);			
					return {type: "ExpressionStatement", expression: makeInstrument(lastLocID), loc: node.loc };			
				}
				if (node.type === "Literal" && !parent.type.endsWith("Expression") && !(parent.type === "Property" && parent.key == node)) {
					++lastLocID;
					idToLocation[lastLocID] = addSourceUrl(node.loc);
					return {expressions: [makeInstrument(lastLocID), node], type: "SequenceExpression"};
				}
				if (node.type.endsWith("Expression") && node.type != "FunctionExpression" && !parent.type.endsWith("Expression")) {
					++lastLocID;
					idToLocation[lastLocID] = addSourceUrl(node.loc);
					return {expressions: [makeInstrument(lastLocID), node], type: "SequenceExpression", old: node };				
				}
			}
		});
		this.lastLocID = lastLocID;
		var processed_source = escodegen.generate(ast);
		var prefix = __beforeAll.toString() + '\n__beforeAll();\n';
	  	for (id in idToLocation)
	  		prefix = prefix.concat('window.__idToLocation[' + id + '] = ' + JSON.stringify(idToLocation[id]) + ';\n');
	  	prefix = prefix.concat('window.__urlToSource[\'' + escape(url) + '\'] = \'' + escape(source) + '\';\n');
	  	return '{\n' + prefix + '}\n' + processed_source;

	  	function __beforeAll() {
			window.__hits = window.__hits || new Int32Array(1024 * 1024);
			window.__toolEnabled = window.__toolEnabled !== undefined ? window.__toolEnabled : false;
			window.__idToLocation = window.__idToLocation || {};
			window.__urlToSource = window.__urlToSource || {};
		}
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js'];
	},

	clear: function() {
		var expr = 'window.__hits = new Int32Array(1024 * 1024);';
		evalAllFrames(expr);
	}
}
HitsCounter.prototype.__proto__ = Tool.prototype;
