# double-stack

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Travis CI Build][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Code Climate][codeclimate-image]][codeclimate-url]
[![Deps][david-image]][david-url]
[![Dev Deps][david-dev-image]][david-dev-url]

A modern implementation of long stack traces for Node.js based-on
[longjohn][longjohn-url] and [superstack][superstack-url].

## Features

* Written in ES2015
* Support for Node.js 4 and newer
* Support for source maps
* Support for EventEmitters
* Support for Promises
* Configurable stack limit and empty frame token
* Returns active handles (timers, servers, socket connections, child processes, etc)
  * For `setTimeout()` or `setInterval()`, double-stack adds the stack to the timer object

## Installation

    npm install double-stack

## Usage

If you just want long stack traces:

```javascript
import 'double-stack';
// or require('double-stack');
```

If you want to change options or get active handles:

```javascript
import * as ds from 'double-stack';

ds.options.asyncTraceLimit = 5;

const handles = ds.getActiveHandles();
```

## Options

### ds.options.asyncTraceLimit (Number)

A positive integer that is greater than or equal to zero. Defaults to `10`.

### ds.options.emptyFrame (String)

A string to print representing an empty frame in the stack. Defaults to `-` x 50.

## getActiveHandles()

Returns an object containing arrays of various handle types including:
`timers`, `sockets`, `servers`, `childProcesses`, and `other`.

```javascript
import * as ds from 'double-stack';

setTimeout(() => {}, 1000);

const handles = ds.getActiveHandles();
handles.timers.forEach(timer => {
    console.log(timer);

    // you can also do a clearTimeout(timer)
});
```

## Production Use

According to the [longjohn readme][longjohn-url]:

> Longjohn collects a large amount of data in order to provide useful stack
traces. While it is very helpful in development and testing environments, it is
not recommended to use longjohn in production. The data collection puts a lot of
strain on V8's garbage collector and can greatly slow down heavily-loaded
applications.

Since double-stack is basically the same as longjohn, then the same is true for
double-stack. With that said, I've been using longjohn in production command
line tools for years without any issues. However, it's probably a completely
different story when running a server such as an Express.js app.

## References

double-stack wouldn't exist without the great work done by
[mattinsler/longjohn][longjohn-url],
[defunctzombie/node-superstack][superstack-url], and
[tlrobinson/long-stack-traces][longstacktraces-url]. Each of these projects are
licensed under the MIT license.

## License

(The MIT License)

Copyright (c) 2016-2017 Chris Barber<br>
Copyright (c) 2012 Matt Insler<br>
Copyright (c) 2013 Roman Shtylman<br>
Copyright (c) 2011 Thomas Robinson tom@tlrobinson.net

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

[npm-image]: https://img.shields.io/npm/v/double-stack.svg
[npm-url]: https://npmjs.org/package/double-stack
[downloads-image]: https://img.shields.io/npm/dm/double-stack.svg
[downloads-url]: https://npmjs.org/package/double-stack
[travis-image]: https://img.shields.io/travis/cb1kenobi/double-stack.svg
[travis-url]: https://travis-ci.org/cb1kenobi/double-stack
[coveralls-image]: https://img.shields.io/coveralls/cb1kenobi/double-stack/master.svg
[coveralls-url]: https://coveralls.io/r/cb1kenobi/double-stack
[codeclimate-image]: https://img.shields.io/codeclimate/github/cb1kenobi/double-stack.svg
[codeclimate-url]: https://codeclimate.com/github/cb1kenobi/double-stack
[david-image]: https://img.shields.io/david/cb1kenobi/double-stack.svg
[david-url]: https://david-dm.org/cb1kenobi/double-stack
[david-dev-image]: https://img.shields.io/david/dev/cb1kenobi/double-stack.svg
[david-dev-url]: https://david-dm.org/cb1kenobi/double-stack#info=devDependencies
[longjohn-url]: https://github.com/mattinsler/longjohn
[superstack-url]: https://github.com/defunctzombie/node-superstack
[longstacktraces-url]: https://github.com/tlrobinson/long-stack-traces
