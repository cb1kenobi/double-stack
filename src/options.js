/**
 * Tracks various options.
 */
module.exports = class Options {
	constructor() {
		this._asyncTraceLimit = 10;
		this._emptyFrame = '-------------------------------------------------';
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
};
