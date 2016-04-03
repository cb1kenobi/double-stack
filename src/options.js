/**
 * Tracks various options.
 */
export default class Options {
	constructor() {
		this._asyncTraceLimit = 10;
		this._emptyFrame = '-------------------------------------------------';
		this._formatStack = (err, frames, sourceMap) => {
			const lines = [ err.toString() ];
			for (let frame of frames) {
				lines.push(frame ? '    at ' + sourceMap.wrapCallSite(frame) : this.emptyFrame);
			}
			return lines.join('\n');
		};
	}

	/**
	 * Gets the current async trace limit.
	 * @returns {Number}
	 */
	get asyncTraceLimit() {
		return this._asyncTraceLimit;
	}

	/**
	 * Sets a new async trace limit.
	 * @param {Number} value - An integer greater than or equal to zero.
	 */
	set asyncTraceLimit(value) {
		if (typeof value !== 'number' || isNaN(value) || ~~value < 0) {
			throw new TypeError('asyncTraceLimit must be a positive integer or zero');
		}
		this._asyncTraceLimit = Math.max(~~value, 0);
	}

	/**
	 * Gets the current empty frame name.
	 * @returns {String}
	 */
	get emptyFrame() {
		return this._emptyFrame;
	}

	/**
	 * Sets a new empty frame delimiter.
	 * @param {String} value - The new empty frame delimitor.
	 */
	set emptyFrame(value) {
		if (!value) {
			throw new TypeError('emptyFrame must be a non-empty string');
		}
		this._emptyFrame = String(value);
	}

	/**
	 * Gets the current format stack function.
	 * @returns {Function}
	 */
	get formatStack() {
		return this._formatStack;
	}

	/**
	 * Sets a new format stack function.
	 * @param {Function} value - The new format stack function.
	 */
	set formatStack(value) {
		if (typeof value !== 'function') {
			throw new TypeError('formatStack must be a function');
		}
		this._formatStack = value;
	}
}
