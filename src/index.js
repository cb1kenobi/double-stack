import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import Options from './options';
import { Server, Socket } from 'net';

import sourceMap from 'source-map-support';
sourceMap.install();

const _listeners = EventEmitter.prototype.listeners;
const _removeListener = EventEmitter.prototype.removeListener;
const Timer = process.binding('timer_wrap').Timer;
let ERROR_ID = 1;
let currentTraceError = null;

/**
 * Initialize the options.
 */
export const options = new Options;

/**
 * Returns an object with active socket, server, timer, and other handles.
 * @returns {Object}
 */
export function getActiveHandles() {
	const handles = { sockets: [], servers: [], timers: [], childProcesses: [], other: [] };

	for (let handle of process._getActiveHandles()) {
		if (handle instanceof Timer) {
			const timerList = handle._list || handle;
			let t = timerList._idleNext;
			while (t !== timerList) {
				handles.timers.push(t);
				t = t._idleNext;
			}
		} else if (handle instanceof Socket) {
			handles.sockets.push(handle);
		} else if (handle instanceof Server) {
			handles.servers.push(handle);
		} else if (handle instanceof ChildProcess) {
			handles.childProcesses.push(handle);
		} else {
			handles.other.push(handle);
		}
	}

	return handles;
}

/**
 * Appends all parent stacks to this stack and returns a joined string of them.
 * @param {Error} error - The error object.
 * @param {Array<CallSite>} stack - The stack being processed.
 * @returns {String}
 */
function prepareStackTrace(error, stack, recursing) {
	let cache = error.__cached_trace__;

	if (!cache) {
		cache = [];
		Object.defineProperty(error, '__cached_trace__', { value: cache });

		for (let i = 0, l = stack.length; i < l; i++) {
			// note: the following line will cause headaches when trying to
			// debug issues inside double-stack
			if (stack[i].getFileName() !== __filename) {
				cache.push(stack[i]);
			} else if (i > 0 && !stack[i-1].getMethodName()) {
				const methodName = stack[i].getMethodName();
				Object.defineProperty(stack[i-1], 'getMethodName', { value: function () { return methodName; } });
			}
		}

		if (!error.__parent__ && !recursing) {
			Object.defineProperty(error, '__parent__', { value: currentTraceError });
		}

		if (error.__parent__) {
			const parent = prepareStackTrace(error.__parent__, error.__parent__.__stack__, true);
			if (parent && parent.length) {
				cache.push(null);
				cache.push.apply(cache, parent);
			}
		}
	}

	return recursing ? cache : options.formatStack(error, cache, sourceMap) || '';
}

/**
 * Define our function that appends parent stacks to our specific stack, then
 * combine them together into a single string.
 */
Error.prepareStackTrace = prepareStackTrace;

/**
 * Wrap a timer based function and its callback to capture the stack.
 * @param {Function} originalFunction - The original function being wrapped.
 * @param {Number|Array<Number>} callbackPositions - The position in the original function arguments of the callback function.
 * @param {Boolean} [embedStack=false] - When true, embeds the stack into the returned handle.
 * @returns {Function}
 */
function wrap(originalFunction, callbackPositions, embedStack, isConstructor) {
	const fn = function () {
		let traceError = new Error();

		// capture the stack
		const orig = Error.prepareStackTrace;
		Error.prepareStackTrace = (error, stack) => stack;
		const stack = traceError.stack;
		Error.prepareStackTrace = orig;

		Object.defineProperties(traceError, {
			__id__:          { value: ERROR_ID++ },
			__parent__:      { configurable: true, value: currentTraceError },
			__stack__:       { value: stack },
			__trace_count__: { value: currentTraceError ? currentTraceError.__trace_count__ + 1 : 1 }
		});

		// limit the stack
		if (options.asyncTraceLimit > 0) {
			let count = options.asyncTraceLimit - 1;
			let previous = traceError;
			while (previous && count > 1) {
				previous = previous.__parent__;
				--count;
			}
			if (previous) {
				delete previous.__parent__;
			}
		}

		if (!Array.isArray(callbackPositions)) {
			callbackPositions = [ callbackPositions ];
		}

		// wrap the callback
		const args = Array.prototype.slice.call(arguments);
		for (let pos of callbackPositions) {
			const callback = arguments[pos];
			if (typeof callback === 'function') {
				args[pos] = function () {
					currentTraceError = traceError;
					try {
						return callback.apply(this, arguments);
					} catch (e) {
						e.stack; // force Error.prepareStackTrace() call
						throw e;
					} finally {
						currentTraceError = null;
					}
				};
				Object.defineProperties(args[pos], {
					name: { value: callback.name },
					__original_callback__: { value: callback }
				});
			}
		}

		// call the function or create it
		let handle;
		if (isConstructor) {
			// add the context for the bind call
			args.unshift(this);
			handle = new (originalFunction.bind.apply(originalFunction, args));
		} else {
			handle = originalFunction.apply(this, args);
		}

		if (embedStack && handle) {
			const embeddedStack = [];
			for (let frame of stack) {
				if (frame.getFileName() !== __filename) {
					frame = sourceMap.wrapCallSite(frame);
					const rendered = frame.toString();
					embeddedStack.push({
						fileName:      frame.getFileName(),
						scriptName:    frame.getScriptNameOrSourceURL(),
						evalOrigin:    frame.getEvalOrigin(),
						typeName:      frame.getTypeName(),
						functionName:  frame.getFunctionName(),
						methodName:    frame.getMethodName(),
						lineNumber:    frame.getLineNumber(),
						columnNumber:  frame.getColumnNumber(),
						isToplevel:    frame.isToplevel(),
						isEval:        frame.isEval(),
						isNative:      frame.isNative(),
						isConstructor: frame.isConstructor(),
						toString:      () => rendered
					});
				}
			}
			Object.defineProperty(handle, '__stack__', { value: embeddedStack });
		}
		return handle;
	};

	Object.defineProperty(fn, 'name', { value: originalFunction.name });
	return fn;
}

/**
 * @see https://nodejs.org/api/events.html#events_emitter_addlistener_eventname_listener
 */
EventEmitter.prototype.addListener = wrap(EventEmitter.prototype.addListener, 1);

/**
 * @see https://nodejs.org/api/events.html#events_emitter_on_eventname_listener
 */
EventEmitter.prototype.on = EventEmitter.prototype.addListener;

/**
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/events.html#events_emitter_listeners_eventname
 */
EventEmitter.prototype.listeners = function listeners(type) {
	return _listeners.call(this, type).map(listener => listener.__original_callback__ || listener);
};

/**
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/events.html#events_emitter_removelistener_eventname_listener
 */
EventEmitter.prototype.removeListener = function removeListener(type, listener) {
	const listeners = _listeners.call(this, type);
	for (let wrappedListener of listeners) {
		const callback = wrappedListener.__original_callback__ || wrappedListener;
		if (callback === listener || wrappedListener === listener) {
			return _removeListener.call(this, type, wrappedListener);
		}
	}
	return this;
};

/**
 * Wraps a Promise.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
 */
global.Promise = (function (Promise) {
	// wrap the constructor
	const WrappedPromise = wrap(Promise, 0, true, true);

	for (let prop of Object.getOwnPropertyNames(Promise)) {
		if (prop !== 'name' && prop !== 'length') {
			WrappedPromise[prop] = Promise[prop];
		}
	}

	// wrap our instance methods
	WrappedPromise.prototype.then = wrap(WrappedPromise.prototype.then, [ 0, 1 ]);
	WrappedPromise.prototype.catch = wrap(WrappedPromise.prototype.catch, 0);

	return WrappedPromise;
}(global.Promise));

/**
 * Note: when debugging double-stack, you may want to comment out the nextTick()
 * wrapper to prevent a recursive call when using console.log() from inside the
 * function wrapper.
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/process.html#process_process_nexttick_callback_arg
 */
process.nextTick = wrap(process.nextTick, 0);

/**
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/timers.html#timers_setimmediate_callback_arg
 */
global.setImmediate = wrap(global.setImmediate, 0, true);

/**
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/timers.html#timers_setinterval_callback_delay_arg
 */
global.setInterval = wrap(global.setInterval, 0, true);

/**
 * @see https://nodejs.org/dist/latest-v5.x/docs/api/timers.html#timers_settimeout_callback_delay_arg
 */
global.setTimeout = wrap(global.setTimeout, 0, true);
