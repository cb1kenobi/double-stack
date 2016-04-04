'use strict';

const $ = require('gulp-load-plugins')();
const del = require('del');
const gulp = require('gulp');
const manifest = require('./package.json');
const path = require('path');

const coverageDir = path.join(__dirname, 'coverage');
const distDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'docs');

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-coverage', 'clean-dist', 'clean-docs']);

gulp.task('clean-coverage', function (done) {
	del([coverageDir]).then(function () { done(); });
});

gulp.task('clean-dist', function (done) {
	del([distDir]).then(function () { done(); });
});

gulp.task('clean-docs', function (done) {
	del([docsDir]).then(function () { done(); });
});

/*
 * build tasks
 */
gulp.task('build', ['clean-dist', 'lint-src'], function () {
	return gulp
		.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

gulp.task('docs', ['lint-src', 'clean-docs'], function () {
	return gulp.src('src')
		.pipe($.plumber())
		.pipe($.debug({ title: 'docs' }))
		.pipe($.esdoc({
			// debug: true,
			destination: docsDir,
			plugins: [
				{ name: 'esdoc-es7-plugin' }
			],
			title: manifest.name
		}));
});

/*
 * lint tasks
 */
function lint(pattern) {
	return gulp.src(pattern)
		.pipe($.plumber())
		.pipe($.eslint())
		.pipe($.eslint.format())
		.pipe($.eslint.failAfterError());
}

gulp.task('lint-src', function () {
	return lint('src/**/*.js');
});

gulp.task('lint-test', function () {
	return lint('test/**/test-*.js');
});

/*
 * test tasks
 */
gulp.task('test', ['build', 'lint-test'], function (cb) {
	var suite, grep;
	var p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		suite = process.argv[p + 1];
	}
	p = process.argv.indexOf('--grep');
	if (p !== -1 && p + 1 < process.argv.length) {
		grep = process.argv[p + 1];
	}

	gulp.src(['test/**/*.js'])
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(path.join(distDir, 'test')))
		.on('finish', function () {
			gulp.src(['dist/test/**/*.js'])
				.pipe($.plumber())
				.pipe($.filter(suite ? ['dist/test/setup.js'].concat(suite.split(',').map(s => 'dist/test/**/test-' + s + '.js')) : 'dist/test/**/*.js'))
				.pipe($.debug({ title: 'test' }))
				.pipe($.mocha({ grep: grep }))
				.on('end', cb);
		});
});

gulp.task('coverage', ['build', 'lint-test', 'clean-coverage'], function (cb) {
	gulp.src(['src/**/*.js'])
		.pipe($.plumber())
		.pipe($.debug({ title: 'build src' }))
		.pipe($.sourcemaps.init())
		.pipe($.babelIstanbul())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir))
		.on('finish', function () {
			gulp.src(['test/**/*.js'])
				.pipe($.plumber())
				.pipe($.debug({ title: 'build tests' }))
				.pipe($.sourcemaps.init())
				.pipe($.babel())
				.pipe($.sourcemaps.write('.'))
				.pipe(gulp.dest(path.join(distDir, 'test')))
				.on('finish', function () {
					gulp.src(['dist/test/**/*.js'])
						.pipe($.plumber())
						.pipe($.debug({ title: 'test' }))
						.pipe($.mocha())
						.pipe($.babelIstanbul.writeReports())
						.on('end', cb);
				});
		});
});

gulp.task('default', ['build']);
