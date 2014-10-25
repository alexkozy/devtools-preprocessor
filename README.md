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
- git clone https://github.com/ak239/devtools-preprocessor
- cd devtools-preprocessor
- [bower](http://bower.io/) install
- [vulcanize](https://github.com/polymer/vulcanize) -o ./Panel/build.html ./Panel/Panel.html --csp
- open [extensions tab](chrome://extensions) in chrome
- check developer mode and load extension folder

Install last release:
- download *.crx for last release [here](https://github.com/ak239/devtools-preprocessor/releases)
- open chrome://extensions tab
- drag and drop crx file to tab

## Screenshots
### Profiler
![](https://cloud.githubusercontent.com/assets/426418/4781152/904250e0-5c8c-11e4-9827-0e9ddffc3cb9.png)
### Hits Counter
![](https://cloud.githubusercontent.com/assets/426418/4781164/fc3ed35e-5c8c-11e4-9396-4fc09aec267e.png)