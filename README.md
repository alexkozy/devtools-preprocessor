devtools-preprocessor
=====================

This DevTools Extension provide two tools based on [script preprocessor API](https://code.google.com/p/chromium/wiki/ScriptPreprocessor) that you can use to trace JS execution and to measuring hits count.

- Profiler tool implements instrumentation profiler. Tool replaces all functions in script and injects code that captures timing information for each function. It is a useful tool to trace code execution and a rough estimate of time costs. Profiler generates source map for each processed source that allows you to navigate to original source code and, for example, set some breakpoints.
- Hits Counter tool measures the number of executions of each instruction. The tool can be useful when searching for unused code, or for measuring code coverage.

Extension uses next third party:
- [Esprima](http://esprima.org/) for parsing JS
- [Escodegen](https://github.com/Constellation/escodegen) for generating modfied code with source map.
- [Polymer](http://www.polymer-project.org/) for UI.
- [codemirror](http://codemirror.net/) and [trace-viewer](https://code.google.com/p/trace-viewer/) for tools UI.

## Build and install instructions
Coming soon.

## Screenshots
### Profiler
![](http://i.imgur.com/Begayyk.png)
### Hits Counter
![](http://i.imgur.com/LxeamED.png)