module.exports = function(grunt) {

  grunt.initConfig({

    // Build

    clean: {
      build: {
        src: ['deploy/*']
      },
      inlinedcss: { // Used to clean out stylesheets that are now in <style>
        src: ['deploy/css/style-small.css']
      }
    },

    htmlmin: {
      main: {
        options: {
          collapseWhitespace: true,
          conservativeCollapse: true,
          removeComments: true,
          minifyJS: true,
          minifyCSS: true
        },
        files: [{
          expand: true,
          cwd: 'src/',
          src: ['*.html'],
          dest: 'deploy/'
        }]
      }
    },

    cssmin: {
      main: {
        files: [{
          expand: true,
          cwd: 'src/css',
          src: ['*.css'],
          dest: 'deploy/css/'
        }]
      }
    },

    replace: {
      dist: {
        options: {
          patterns: [{
            match: /<link rel=\"stylesheet\" href=\"css\/style-small.css\" media=\"screen and \(max-width:800px\)\">/g,
            replacement: '<style>@media screen and (max-width:800px) {' +
                         '<%= grunt.file.read("deploy/css/style-small.css") %>' +
                         '}</style>'
          }]
        },
        files: [{
          expand: true,
          cwd: 'deploy/',
          src: ['index.html'],
          dest: 'deploy/'
        }]
      }
    },

    uglify: {
      options: {
        mangle: false,
        wrap: false,
        compress: {
          negate_iife: false,
          drop_console: true
        }
      },
      main: {
        files: [{
          expand: true,
          cwd: 'src/js',
          src: ['**/*.js'],
          dest: 'deploy/js/'
        }]
      }
    },

    copy: {
      hidden: {
        files: [{
          expand: true,
          cwd: 'src/',
          src: ['*.htaccess'],
          dest: 'deploy/',
          dot: true
        }]
      },
      images: {
        files: [{
          expand: true,
          cwd: 'src/images/',
          src: ['**/*.{png,jpg,gif}'],
          dest: 'deploy/images/',
          dot: true
        }]
      }
    },


    // Testing

    jshint: {
      main: ['src/js/*.js']
    },

    pagespeed: {
      options: {
        nokey: true,
        url: "https://kevinfrutiger.github.io/frontend-nanodegree-neighborhood-map/",
        locale: "en_US",
        threshold: 90
      },
      desktop: {
        options: {
          strategy: "desktop"
        }
      },
      mobile: {
        options: {
          strategy: "mobile"
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-pagespeed');
  grunt.loadNpmTasks('grunt-replace');

  grunt.registerTask('build', ['jshint', 'clean:build', 'htmlmin', 'cssmin', 'uglify', 'copy', 'replace', 'clean:inlinedcss']);

};