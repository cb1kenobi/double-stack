import { ChildProcess } from 'child_process';
import Options from './options';
import { Server, Socket } from 'net';

import sourceMap from 'source-map-support';
sourceMap.install();

const Timer = process.binding('timer_wrap').Timer;
let ERROR_ID = 1;
let currentTraceError = null;

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
 * @param {Number} callbackPosition - The position in the original function arguments of the callback function.
 * @param {Boolean} [embedStack=false] - When true, embeds the stack into the returned handle.
 * @returns {Function}
 */
function wrap(originalFunction, callbackPosition, embedStack) {
	return function () {
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

		// wrap the callback
		const args = Array.prototype.slice.call(arguments);
		const callback = arguments[callbackPosition];
		args[callbackPosition] = function () {
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
		Object.defineProperties(args[callbackPosition], {
			name: { value: originalFunction.name },
			__original_callback__: { value: callback }
		});

		// call the function
		const handle = originalFunction.apply(this, args);
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
}

/**
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
