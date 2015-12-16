var app = {};

$(function() {

  // Initial place names from which to build the observable array for the list.
  var initialPlacesData = [
    'South San Francisco BART Station',
    'See\'s Candies',
    'Trader Joe\'s',
    'Five Guys',
    'Paris Baguette',
    'Starbucks',
    'San Bruno Mountain State Park'
  ];

  /**
   * Creates a Place object.
   * @param {string} name Name of location, to be used in search
   * on Places service.
   */
  var Place = function(name) {
    /**
     * The name of the place (i.e. Starbucks). Used to search on
     * the Places service.
     * @type {string}
     */
    this.name = name;

    /** The Places service Place ID.
        @type {string} */
    this.placeId = null;

    /** The Places types.
        @type {Array.<strings>} */
    this.types = null;

    /** Lat-Long position. {Lat: val, Lng: val}
        @type {Object} */
    this.position = null;

    /** Whether the Place is included in filtered results.
        @type {boolean} */
    this.isFiltered = ko.observable(true);

    this.isSelected = ko.observable(false);

    this.wikipediaData = '';
  };

  /**
   * Creates a ViewModel for Knockout.
   */
  var ViewModel = function() {
    var self = this;
    this.map = null;
    this.markers = {};
    this.infoWindow = null;
    this.markerAnimationTimeout = null;
    this.markerAnimationTimeoutDuration = 3000;

    this.filterString = ko.observable('');

    // Sort the initial places array alphabetically.
    initialPlacesData = initialPlacesData.sort(function(a,b) {
        if (a > b) {
          return 1;
        }
        if (b > a) {
          return -1;
        }

        return 0;
    });

    // Build observable array of Places from initial data.
    this.places = ko.observableArray(initialPlacesData.map(function(name) {
        return new Place(name);
      }));

    this.filterList = function() {
      if (self.infoWindow) {
        self.infoWindow.close();
        self.infoWindow = null;
      }

      self.places().forEach(function(place) {
        // Set whether place should show in filtered results.
        var re = new RegExp(self.filterString(), 'ig');
        place.isFiltered(re.test(place.name));

        // Reset highlighted selection.
        self.toggleListItemSelection(null);
      });

      self.refreshMarkers();
    };

    this.listClick = function(place) {
      self.toggleListItemSelection(place);

      self.map.panTo(place.position);

      var marker = self.markers[place.placeId];
      self.toggleMarkerAnimation(marker);
      self.addInfoWindow(marker, place.placeId);
    };

    this.toggleListItemSelection = function(place) {
      self.places().forEach(function(currentPlace) {
        currentPlace.isSelected(currentPlace === place);
      });
    };

    this.getPlaceFromId = function(placeId) {
      for (var i = 0, len = self.places().length; i < len; i++) {

        if (self.places()[i].placeId === placeId) {
          return self.places()[i];
        }
      }
    };


    /* Google Map functionality */

    this.initMap = function() {
      var mapOptions = {
        center: {lat: 37.6640317, lng: -122.445706},
        zoom: 14,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false
      };

      self.map = new google.maps.Map($('#map')[0], mapOptions);
      self.placesService = new google.maps.places.PlacesService(self.map);
      self.refreshMarkers();
    };

    app.initMap = this.initMap;

    this.addMarker = function(placeId, location) {
      var marker = new google.maps.Marker({
          map: self.map,
          place: {
            placeId: placeId,
            location: location
          },
          animation: google.maps.Animation.DROP
        });

      marker.addListener('click', function() {
        self.toggleListItemSelection(self.getPlaceFromId(placeId));
        self.toggleMarkerAnimation(marker);
        self.addInfoWindow(marker, placeId);
      });

      self.markers[placeId] = marker;

    };

    this.toggleMarkerAnimation = function(markerToAnimate) {
      // Loop through all markers and set their animation state.
      for (var key in self.markers) {
        var marker = self.markers[key];

        // If this is the marker we want to animate and it's not
        // already animating.
        if (marker === markerToAnimate && !marker.getAnimation()) {
          // Animate it.
          marker.setAnimation(google.maps.Animation.BOUNCE);

          // Set a timeout to stop this marker from bouncing indefinitely.
          self.markerAnimationTimeout = setTimeout(
              self.createAnimationTimeoutHandler(marker),
              self.markerAnimationTimeoutDuration
          );
        } else {
          // Stop the animation.
          marker.setAnimation(null);
        }
      }
    };

    this.createAnimationTimeoutHandler = function(currentMarker) {
      return function() {
        currentMarker.setAnimation(null);
      };
    };

    this.addInfoWindow = function(marker, placeId) {
      // If the info window is already opened, clean up and close it.
      if (self.infoWindow) {
        google.maps.event.clearListeners(self.infoWindow, 'closeclick');
        self.infoWindow.close();
      }

      var place = self.getPlaceFromId(placeId);

      // Build nodes for info window content. In order to control the
      // width of the info window, we have to wrap the content.
      var contentElement = document.createElement('div');
      contentElement.id = 'info-window-content';

      var infoHeaderElement = document.createElement('div');
      infoHeaderElement.className = 'info-window-heading';
      infoHeaderElement.appendChild(document.createTextNode(place.name));

      var statusElement = document.createElement('div');
      statusElement.className = 'info-status';
      statusElement.appendChild(
          document.createTextNode('Getting more information...'));

      contentElement.appendChild(infoHeaderElement);
      contentElement.appendChild(statusElement);

      // Create the info window object.
      var infoWindowOptions = {
        content: contentElement
      };

      self.infoWindow = new google.maps.InfoWindow(infoWindowOptions);

      self.infoWindow.addListener('closeclick', function() {
        // Stop marker animation.
        marker.setAnimation(null);

        self.infoWindow = null;
      });

      // Update the info window when it's DOM is ready.
      self.infoWindow.addListener('domready', function() {
        // Event firest every time content is updated, so remove the listener.
        google.maps.event.clearListeners(self.infoWindow, 'domready');

        self.populateInfoWindow(place);
      })

      // Show the info window.
      self.infoWindow.open(self.map, marker);
    };

    this.populateInfoWindow = function(place) {

      // If we already have Wikipedia data, use it.
      if (place.wikipediaData) {

        self.appendInfo(place.wikipediaData);

      } else {

        // jQuery JSONP does not call an error handler. So, set a timeout.
        var wikiRequestTimeout = setTimeout(function() {
            console.warn('wiki request timed out');
        }, 8000);

        // Set up AJAX query and handlers.
        var wikiUrl = 'https://en.wikipedia.org/w/api.php';
        var settings = {
            dataType: 'jsonp',
            data: { // Wikipedia query fields
                action: 'opensearch',
                search: place.name,
                format: 'json',
                formatversion: 2
            },
            success: function(data, status, jqXHR) {
                clearTimeout(wikiRequestTimeout);

                var htmlString = '';

                if (data[2][0]) {
                  var snippet = data[2][0];
                  var url = data[3][0];

                  var citation = '<a href="' + url + '" target="_blank">' +
                                 'Wikipedia</a>';

                  htmlString = '<blockquote>' + snippet + '</blockquote>' +
                      '<cite class="info-window-citation">' + citation +
                      '</cite>';

                } else {
                  htmlString = '<blockquote>No additional information ' +
                               'available.<blockquote>';
                }

                self.appendInfo(htmlString);
                place.wikipediaData = htmlString;
            }
        };

        // Get the data.
        $.ajax(wikiUrl, settings);
      }
    };

    this.appendInfo = function(htmlString) {
      // Get the DOM tree that was used to set the content.
      // The info window UI is too slow to resize if we modify the node
      // directly (text overflows). Thus, we're cloning the node so we can make
      // changes and use use setContent() to update the info window.
      var infoElement = self.infoWindow.getContent().cloneNode(true);

      // Replace the status text and add the new data.
      var infoStr = infoElement.innerHTML;
      infoStr = infoStr.replace(
          '<div class="info-status">Getting more information...</div>', '');
      infoStr += htmlString;
      infoElement.innerHTML = infoStr;

      // Update the info window with the updated node.
      self.infoWindow.setContent(infoElement);
    };

    this.refreshMarkers = function() {
      self.places().forEach(function(place) {
          if (!place.placeId) {
            var request = {
              location: self.map.getCenter(),
              radius: '500',
              query: place.name
            };

            // Query Google Places API.
            self.placesService.textSearch(request, function(results, status) {
              if (status == google.maps.places.PlacesServiceStatus.OK) {
                self.addMarker(results[0].place_id,
                               results[0].geometry.location);

                // Store data to our Places object so we don't have to requery.
                place.placeId = results[0].place_id;
                place.position = results[0].geometry.location;
                place.types = results[0].types;
              }
            });
          } else {
            var marker = self.markers[place.placeId];
            marker.setVisible(place.isFiltered());
            if (marker.getAnimation() !== null) {
              marker.setAnimation(null);
            }
          }
      });


    };
  };

  ko.applyBindings(new ViewModel());

  $('#burger-button').click(function() {
      $('#filter-menu').toggleClass('open');
  });

});
