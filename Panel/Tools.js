function Tool() {}

Tool.prototype = {
	_getLib: function(name, path) {
		var req = new XMLHttpRequest();
		req.open('GET', path + name, false);
		req.send(null);
		if (req.status === 200) {
			return req.responseText;
		}
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

	
	  	var prefix = 'window.top.__sourceToUrl[' + sourceID + '] = \'' + escape(url) + '\';\n';
	  	for (id in idToFunctionName) {
	  		prefix = prefix.concat('window.top.__idToFunctionName[' + id + '] = \'' + idToFunctionName[id] + '\';\n');
	  		prefix = prefix.concat('window.top.__idToRow[' + id + '] = ' + idToRow[id] + ';\n');
	  		prefix = prefix.concat('window.top.__idToCol[' + id + '] = ' + idToCol[id] + ';\n');
	  		prefix = prefix.concat('window.top.__idToSource[' + id + '] = ' + sourceID + ';\n');
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
			window.top.__profileStart[window.top.__profileLast] = window.top.__profileFinish[window.top.__profileLast] - ' + total_time.toString() + ';\n\
		';

		var processed_source = '{\n' + prefix + '}\n' + processed_result.code;
		if (processed_result.map)
			return processed_source + '\n//# sourceMappingURL=data:application/json,' + encodeURIComponent(processed_result.map.toString());
		return processed_source;
	},

	injectedScript: function __beforeAll() {
		/* do-not-preprocess */
		// TODO: replace magic number with real value from first special instrument
		var MAX_STACK_SIZE = 1024;
  		var MAX_FUNCTION_COUNT = 32 * 1024;
  		var MAX_PROFILE_LENGTH = 1024 * 1024;

  		window.top.__entryTime = window.top.__entryTime || new Float64Array(MAX_STACK_SIZE);
  		window.top.__entryTop = window.top.__entryTop || -1;

  		window.top.__profileFunction = window.top.__profileFunction || new Int16Array(MAX_PROFILE_LENGTH);
  		window.top.__profileStart = window.top.__profileStart || new Float64Array(MAX_PROFILE_LENGTH);
  		window.top.__profileFinish = window.top.__profileFinish || new Float64Array(MAX_PROFILE_LENGTH);
  		window.top.__profileStack = window.top.__profileStack || new Int16Array(MAX_PROFILE_LENGTH);
  		window.top.__profileLast = window.top.__profileLast || -1;

  		window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;
  		window.top.__idToFunctionName = window.top.__idToFunctionName || {};

  		window.top.__idToRow = window.top.__idToRow || new Int16Array(MAX_FUNCTION_COUNT);
  		window.top.__idToCol = window.top.__idToCol || new Int16Array(MAX_FUNCTION_COUNT);	
  		window.top.__idToSource = window.top.__idToSource || new Int16Array(MAX_FUNCTION_COUNT);
  		window.top.__sourceToUrl = window.__sourceToUrl || [];

		window.top.__idToFunctionName[0] = 'preprocess';
		window.top.__idToRow[0] = 1;
		window.top.__idToCol[0] = 1;
		window.top.__idToSource[0] = 0;
		window.top.__sourceToUrl[0] = 'preprocessor';
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js', 'source-map.js'];
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
			var instrument_source = 'window.top.__profileEnable && window.top.__hits[0]++';
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
		var prefix = '';
	  	for (id in idToLocation)
	  		prefix = prefix.concat('window.top.__idToLocation[' + id + '] = ' + JSON.stringify(idToLocation[id]) + ';\n');
	  	prefix = prefix.concat('window.top.__urlToSource[\'' + escape(url) + '\'] = \'' + escape(source) + '\';\n');
	  	return '{\n' + prefix + '}\n' + processed_source;		
	},

	injectedScript: function __beforeAll() {
		/* do-not-preprocess */
		window.top.__hits = window.top.__hits || new Int32Array(1024 * 1024);
		window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;
		window.top.__idToLocation = window.top.__idToLocation || {};
		window.top.__urlToSource = window.top.__urlToSource || {};
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js'];
	}
}
HitsCounter.prototype.__proto__ = Tool.prototype;
