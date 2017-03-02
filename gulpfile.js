// const fs = require('fs');
// const path = require('path');

// const browserify = require('browserify');
// const babelify = require('babelify');
// const buffer = require('vinyl-buffer');

const gulp = require('gulp');
const sass = require('gulp-sass');
const browser = require('gulp-browser');
// const util = require('gulp-util');
const watch = require('gulp-watch');
// const rollup = require('rollup-stream');
// const inject = require('gulp-inject');
const sourcemaps = require('gulp-sourcemaps');
// // const browser = require('gulp-browser');
// const streamify = require('gulp-streamify');        // for gulp-uglify and gulp-babel
// const babel = require('gulp-babel');
// const uglify = require('gulp-uglify');
// const gulpif = require('gulp-if');
// const preprocess = require('gulp-preprocess');      // for inserting var into sass
// const source = require('vinyl-source-stream');

gulp.task('default', ['html', 'css', 'js']);

gulp.task('html', () => {
    return gulp.src('fe/index.html')
        .pipe(gulp.dest(`./public`));
});

gulp.task('css', () => {
    return gulp.src('fe/scss/style.scss')
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(`./public`));
});

gulp.task('js', () => {
    return gulp.src('fe/js/app.js')
        .pipe(browser.browserify())
        .pipe(gulp.dest('./public'));
});

gulp.task('watch', ['default'], () => {
    watch('fe/index.html', () => gulp.start('html'));
    watch('fe/scss/*.scss', () => gulp.start('css'));
    watch('fe/scss/*/*.scss', () => gulp.start('css'));

    watch('fe/js/*.js', () => gulp.start('js'));
});