import * as ds from '../src/index';
import fs from 'fs';
import net from 'net';
import { spawn } from 'child_process';

describe('options', () => {
	it('should get/set async trace limit', () => {
		expect(ds.options.asyncTraceLimit).to.equal(10);
		ds.options.asyncTraceLimit = 5;
		expect(ds.options.asyncTraceLimit).to.equal(5);
		ds.options.asyncTraceLimit = 10;
	});

	it('should fail to set asyncTraceLimit', () => {
		expect(() => {
			ds.options.asyncTraceLimit = 'foo';
		}).to.throw(TypeError);

		expect(() => {
			ds.options.asyncTraceLimit = parseInt('foo');
		}).to.throw(TypeError);

		expect(() => {
			ds.options.asyncTraceLimit = -1;
		}).to.throw(TypeError);
	});

	it('should get/set empty frame', () => {
		const initial = '-------------------------------------------------';
		const updated = '*************************************************';
		expect(ds.options.emptyFrame).to.equal(initial);
		ds.options.emptyFrame = updated;
		expect(ds.options.emptyFrame).to.equal(updated);
		ds.options.emptyFrame = initial;
	});

	it('should fail to set empty frame', () => {
		expect(() => {
			ds.options.emptyFrame = null;
		}).to.throw(TypeError);

		expect(() => {
			ds.options.emptyFrame = '';
		}).to.throw(TypeError);
	});

	it('should get/set format stack function', () => {
		const initial = ds.options.formatStack;
		expect(initial).to.be.a.function;
		const fn = () => {};
		ds.options.formatStack = fn;
		expect(ds.options.formatStack).to.equal(fn);
		ds.options.formatStack = initial;
	});

	it('should fail to set format stack function', () => {
		expect(() => {
			ds.options.formatStack = null;
		}).to.throw(TypeError);

		expect(() => {
			ds.options.formatStack = 'foo';
		}).to.throw(TypeError);
	});
});

describe('active handles', () => {
	beforeEach(function () {
		this.intervalTimer = null;
		this.client = null;
		this.server = null;
	});

	afterEach(function (done) {
		if (this.intervalTimer) {
			clearInterval(this.intervalTimer);
			this.intervalTimer = null;
		}

		if (this.client) {
			this.client.on('end', () => {
				this.client.destroy();
				this.client = null;
			});
			this.client.end();
		}

		if (this.server && this.server.listening) {
			this.server.close(done);
		} else {
			done();
		}
	});

	it('should get active setTimeout timer', done => {
		let initialTimerCount = 0;

		const fn = () => {
			let handles = ds.getActiveHandles();
			expect(handles.timers).to.have.lengthOf(initialTimerCount);
			done();
		};

		let handles = ds.getActiveHandles();
		initialTimerCount = handles.timers.length;

		setTimeout(fn, 100);

		handles = ds.getActiveHandles();
		expect(handles.timers).to.have.lengthOf(initialTimerCount + 1);

		const timer = handles.timers[handles.timers.length - 1];
		expect(timer._idleTimeout).to.equal(100);
	});

	it('should get active setInterval timer', function (done) {
		let initialTimerCount = 0;

		const fn = () => {
			// I don't get this... why are there no timers for a setInterval()?
			let handles = ds.getActiveHandles();
			expect(handles.timers).to.have.lengthOf(initialTimerCount);

			clearInterval(this.intervalTimer);

			handles = ds.getActiveHandles();
			expect(handles.timers).to.have.lengthOf(initialTimerCount);

			done();
		};

		let handles = ds.getActiveHandles();
		initialTimerCount = handles.timers.length;

		this.intervalTimer = setInterval(fn, 500);

		handles = ds.getActiveHandles();
		expect(handles.timers).to.have.lengthOf(initialTimerCount + 1);

		const timer = handles.timers[handles.timers.length - 1];
		expect(timer._idleTimeout).to.equal(500);
	});

	it('should get active servers', function (done) {
		const handles = ds.getActiveHandles();
		expect(handles.servers).to.have.lengthOf(0);

		this.server = net.createServer(conn => {});

		this.server.listen('/tmp/test.sock', () => {
			const handles = ds.getActiveHandles();
			expect(handles.servers).to.have.lengthOf(1);

			this.server.close(() => {
				setImmediate(() => {
					const handles = ds.getActiveHandles();
					expect(handles.servers).to.have.lengthOf(0);
					this.server = null;
					done();
				});
			});
		});
	});

	it('should get active sockets', function (done) {
		const handles = ds.getActiveHandles();
		expect(handles.servers).to.have.lengthOf(0);
		let initialSocketCount = handles.sockets.length;

		this.server = net.createServer(conn => {
			const handles = ds.getActiveHandles();
			expect(handles.sockets).to.include(conn);
		});

		this.server.listen('/tmp/test.sock', () => {
			const handles = ds.getActiveHandles();
			expect(handles.servers).to.have.lengthOf(1);
			expect(handles.servers).to.include(this.server);

			this.client = net.connect({ path: '/tmp/test.sock' }, () => {
				const handles = ds.getActiveHandles();
				expect(handles.sockets).to.have.lengthOf(initialSocketCount + 2);
				expect(handles.sockets).to.include(this.client);

				this.client.on('end', () => {
					this.client.destroy();

					setTimeout(() => {
						const handles = ds.getActiveHandles();
						expect(handles.sockets).to.have.lengthOf(initialSocketCount);
						done();
					}, 100);
				});

				this.client.end();
			});
		});
	});

	it('should get child processes', done => {
		let handles = ds.getActiveHandles();
		expect(handles.childProcesses).to.have.lengthOf(0);

		const child = spawn(process.execPath, [ __dirname + '/resources/child.js' ]);
		child.stdout.on('data', () => {});
		child.stderr.on('data', () => {});

		handles = ds.getActiveHandles();
		expect(handles.childProcesses).to.have.lengthOf(1);
		expect(handles.childProcesses).to.include(child);

		child.on('close', () => {
			setTimeout(() => {
				const handles = ds.getActiveHandles();
				expect(handles.childProcesses).to.have.lengthOf(0);
				done();
			}, 0);
		});
	});
});

describe('throw', () => {
	beforeEach(function () {
		this.timer = null;
		this.interval = null;
		this.asyncTraceLimit = ds.options.asyncTraceLimit;
		this.formatStack = ds.options.formatStack;
	});

	afterEach(function () {
		ds.options.asyncTraceLimit = this.asyncTraceLimit;
		ds.options.formatStack = this.formatStack;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	});

	it('should throw an error', () => {
		expect(() => {
			throw new Error('foo');
		}).to.throw(Error);
	});

	it('should throw error from other modules', done => {
		fs.readFile('not_there.txt', (err, contents) => {
			expect(err).to.be.instanceof.Error;
			expect(err.stack).to.have.string('Error: ENOENT: no such file or directory, open \'not_there.txt\'');
			done();
		});
	});

	it('should capture stack from function from a setTimeout()', done => {
		function foo() {
			bar();
		}

		function bar() {
			const stack = new Error().stack;
			expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
			done();
		}

		setTimeout(foo, 0);
	});

	it('should not exceed trace limit', done => {
		ds.options.asyncTraceLimit = 2;
		let counter = 0;

		function foo() {
			if (++counter > 3) {
				const stack = new Error().stack;
				expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
				return done();
			}
			setTimeout(foo, 0);
		}

		foo();
	});

	it('should pass arguments into setTimeout()', function (done) {
		this.timer = setTimeout(function () {
			const stack = new Error().stack;
			expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
			expect(Array.prototype.slice.call(arguments)).to.deep.equal([1, 2, 3]);
			done();
		}, 0, 1, 2, 3);

		expect(this.timer).to.be.ok;
	});

	it('should pass arguments into setInterval()', function (done) {
		let counter = 0;

		this.interval = setInterval(function () {
			const stack = new Error().stack;
			expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
			expect(Array.prototype.slice.call(arguments)).to.deep.equal([1, 2, 3]);

			if (++counter >= 3) {
				clearInterval(this.interval);
				done();
			}
		}.bind(this), 100, 1, 2, 3);

		expect(this.interval).to.be.ok;
	});

	it('should pass arguments into setImmediate()', function (done) {
		setImmediate(function () {
			const stack = new Error().stack;
			expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
			expect(Array.prototype.slice.call(arguments)).to.deep.equal([1, 2, 3]);
			done();
		}, 1, 2, 3);
	});

	it('should handle a format stack function that returns something falsey', done => {
		ds.options.formatStack = function () {};

		function foo() {
			const stack = new Error().stack;
			expect(stack).to.equal('');
			done();
		}

		setTimeout(foo, 0);
	});
});

describe('uncaught exceptions', () => {
	beforeEach(function () {
		this.domainListeners = null;
		if (process.domain) {
			this.domainListeners = process.domain.listeners('error')
			process.domain.removeAllListeners('error');
		}

		this.uncaughtListeners = process.listeners('uncaughtException');
		process.removeAllListeners('uncaughtException');
	});

	afterEach(function () {
		if (process.domain && this.domainListeners) {
			this.domainListeners.forEach(listener => process.domain.on('error', listener));
		}

		process.removeAllListeners('uncaughtException');
		if (this.uncaughtListeners) {
			this.uncaughtListeners.forEach(listener => process.on('uncaughtException', listener));
		}
	});

	it('should throw an error from a setTimeout()', done => {
		process.once('uncaughtException', error => {
			const stack = error.stack;
			expect(stack.split('-------------------------------------------------')).to.have.lengthOf(2);
			done();
		});

		function foo() {
			throw new Error('foo');
		}

		setTimeout(foo, 0);
	});
});
