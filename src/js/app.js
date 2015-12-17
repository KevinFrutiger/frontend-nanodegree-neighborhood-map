// Global object for any needed external references.
var app = {};

// Note: JSDoc format comments used, but since these are wrapped in a closure
// they can't actually generate JSDocs.

$(function() {

  // Set up UI
  $filterMenu = $('#filter-menu');
  $burgerButton = $('#burger-button');

  $burgerButton.click(function() {
      $filterMenu.toggleClass('open');
  });

  // Initial place names from which to build the observable array for the list.
  // These names need to correlate with a place on Google Maps.
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
   * @class
   * @param {string} name - Name of location, to be used in search
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

    /** Whether the Place is selected (in the list)
        @type {boolean} */
    this.isSelected = ko.observable(false);

    /** Data from Wikipedia API.
        @type {string} */
    this.wikipediaData = '';
  };

  /**
   * Creates a ViewModel for Knockout.
   * @class
   */
  var ViewModel = function() {
    var self = this;

    /** The Google Map
        @type {google.maps.Map} */
    this.map = null;

    /** All the Markers on the map, keyed by placeId for Place instances.
        @type {Object.<string, google.maps.Marker>} */
    this.markers = {};

    /** The InfoWindow.
        @type {google.maps.InfoWindow} */
    this.infoWindow = null;

    /** Timeout ID for the timeout to stop the marker bounce animation.
        @type {number} */
    this.markerAnimationTimeout = null;

    /** The duration for the setTimeout call to stop the marker bounce animation.
        @type {number} */
    this.markerAnimationTimeoutDuration = 3000;

    /** An observable to filter the list with.
        @type {ko.observable} */
    this.filterString = ko.observable('');

    /** The jqXHR object.
        @type {jqXHR} */
    this.$jqXHR = null;

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

    /** Observable array of Places. Built from initialPlacesData.
        @type {ko.obeservableArray.<Places>} */
    this.places = ko.observableArray(initialPlacesData.map(function(name) {
        return new Place(name);
      }));

    /**
     * Filters the list and calls to refresh markers.
     * Sets KO observables to filter.
     */
    this.filterList = function() {
      // Close the info window if it's open.
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

      // Sync the markers.
      self.refreshMarkers();
    };

    /**
     * KO click handler for the items in the list.
     * @param {Place} place - The correspanding Place that was clicked.
     */
    this.listItemClick = function(place) {
      // Highlight this item.
      self.toggleListItemSelection(place);

      // Re-center the map to the corresponding location/marker.
      self.map.panTo(place.position);

      // Bounce the marker and open the info window.
      var marker = self.markers[place.placeId];
      self.toggleMarkerAnimation(marker);
      self.addInfoWindow(marker, place.placeId);

      // On mobile, close the list. Only applies to the small screen stylesheet.
      $('#filter-menu').removeClass('open');
    };

    /**
     * Flags the currently selected place for KO.
     * @param {Place} place - The correspanding Place that was clicked.
     */
    this.toggleListItemSelection = function(place) {
      self.places().forEach(function(currentPlace) {
        currentPlace.isSelected(currentPlace === place);
      });
    };

    /**
     * Returns the Place that has the provided placeId.
     * @param {string} placeId - The placeId for the Place to get from the array.
     * @returns {Place}
     */
    this.getPlaceFromId = function(placeId) {
      for (var i = 0, len = self.places().length; i < len; i++) {
        if (self.places()[i].placeId === placeId) {
          return self.places()[i];
        }
      }
    };


    /* Google Map functionality */

    /**
     * Initializes the Google Map and the Places Service.
     */
    this.initMap = function() {
      var mapOptions = {
        center: {lat: 37.6640317, lng: -122.445706},
        zoom: 14,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false
      };

      // Initialize the map.
      self.map = new google.maps.Map($('#map')[0], mapOptions);
      // Initialize the Places service.
      self.placesService = new google.maps.places.PlacesService(self.map);

      // Place the markers.
      self.refreshMarkers();
    };

    // Make this function accessible as the Map load callback.
    app.initMap = this.initMap;

    /**
     * Adds a marker to the map and sets up listeners.
     * @param {string} placeId - The placeId to use as a key to store in the
     *     markers object.
     * @param {google.maps.LatLng} location - The location for the place in the
     *     marker options.
     */
    this.addMarker = function(placeId, location) {
      // Add marker to the map.
      var marker = new google.maps.Marker({
          map: self.map,
          place: {
            placeId: placeId,
            location: location
          },
          animation: google.maps.Animation.DROP
        });

      // Listen for clicks.
      marker.addListener('click', function() {
        // Highlight the corresponding list item.
        self.toggleListItemSelection(self.getPlaceFromId(placeId));

        // Bounce the marker.
        self.toggleMarkerAnimation(marker);

        // Open the info window.
        self.addInfoWindow(marker, placeId);
      });

      // Store a reference to this marker.
      self.markers[placeId] = marker;

    };

    /**
     * Toggles the marker bounce animation on or off.
     * @param {google.maps.Marker} markerToAnimate - The marker animate/stop.
     */
    this.toggleMarkerAnimation = function(markerToAnimate) {
      // Loop through all markers and set their animation state.
      for (var key in self.markers) {
        var marker = self.markers[key];

        // If this is the marker we want to animate and it's not
        // already animating...
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

    /**
     * Returns a function for the setTimeout callback to set the animation
     * for the marker.
     * @param {google.maps.Marker} currentMaker - The marker to stop.
     * @returns {function}
     */
    this.createAnimationTimeoutHandler = function(currentMarker) {
      return function() {
        currentMarker.setAnimation(null);
      };
    };

    /**
     * Adds the info window to the map and sets up listeners.
     * @param {google.maps.Marker} marker - The marker to attach the info
     *     window to.
     * @param {string} placeId - The placeId for the Place in the
     *     places array.
     */
    this.addInfoWindow = function(marker, placeId) {
      // If the info window is already opened, clean up and close it.
      if (self.infoWindow) {
        google.maps.event.clearListeners(self.infoWindow, 'closeclick');
        self.infoWindow.close();
      }

      var place = self.getPlaceFromId(placeId);

      // Build nodes for info window content.
      //
      // To keep the width of the info window from fluctuating, we have
      // to wrap the content and set the width in CSS.
      var contentElement = document.createElement('div');
      contentElement.className = 'info-window-content';

      var infoHeaderElement = document.createElement('div');
      infoHeaderElement.className = 'info-window-heading';
      infoHeaderElement.appendChild(document.createTextNode(place.name));

      var statusElement = document.createElement('div');
      statusElement.className = 'info-status';
      statusElement.appendChild(
          document.createTextNode('Getting more information...'));

      contentElement.appendChild(infoHeaderElement);
      contentElement.appendChild(statusElement);

      // Create a new info window.
      var infoWindowOptions = {
        content: contentElement,
      };

      self.infoWindow = new google.maps.InfoWindow(infoWindowOptions);

      self.infoWindow.addListener('closeclick', function() {
        // Stop marker animation.
        marker.setAnimation(null);

        self.infoWindow = null;
      });

      // Update the info window when its DOM is ready.
      self.infoWindow.addListener('domready', function() {
        // Event firest every time content is updated, so remove the listener.
        google.maps.event.clearListeners(self.infoWindow, 'domready');

        self.populateInfoWindow(place);
      });

      // Show the info window.
      self.infoWindow.open(self.map, marker);
    };

    /**
     * Gets content from the Wikipedia API and calls to append it to the
     * info window content.
     * @param {Place} place - The Place to store/retrieve the Wikipedia data.
     */
    this.populateInfoWindow = function(place) {

      // If we already have Wikipedia data...
      if (place.wikipediaData) {

        // add data to the info window.
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

                // Build the HTML to add to the info window.
                var htmlString = '';

                // If there's a snippet...
                if (data[2][0]) {
                  var snippet = data[2][0];
                  var url = data[3][0];

                  var citation = '<a href="' + url + '" target="_blank">' +
                                 'Wikipedia</a>';

                  htmlString = '<blockquote>' + snippet + '</blockquote>' +
                      '<cite class="info-window-citation">Source: ' + citation +
                      '</cite>';

                } else {
                  htmlString = '<blockquote>No additional information ' +
                               'available.<blockquote>';
                }

                // Add the content to the info window.
                self.appendInfo(htmlString);

                // Store this data so we don't have to requery.
                place.wikipediaData = htmlString;

                self.$jqXHR = null;
            }
        };

        // If we already have a jqXHR in progress, abort it.
        if (self.$jqXHR) {
          self.$jqXHR.abort();
        }

        // Get the data.
        self.$jqXHR = $.ajax(wikiUrl, settings);
      }
    };

    /**
     * Adds content to the info window content.
     * @param {string} htmlString - The HTML content to add to the info window's
     *     content.
     */
    this.appendInfo = function(htmlString) {
      // Get the DOM nodes that were used to set the content.
      //
      // The info window UI is too slow to resize if we modify the node
      // directly (text overflows). Thus, we're cloning the node so we can make
      // changes and use use setContent() to update the info window.
      //
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

    /**
     * Adds/shows the markers on the map for Places in the filtered list.
     */
    this.refreshMarkers = function() {

      // For each Place, create/show/hide a marker.
      self.places().forEach(function(place) {

          // If there's no placeId, we haven't created a marker for this
          // place yet.
          if (!place.placeId) {
            // Set up request object for the Places Service.
            var request = {
              location: self.map.getCenter(),
              radius: '500',
              query: place.name
            };

            // Query the Places API.
            self.placesService.textSearch(request, function(results, status) {
              if (status == google.maps.places.PlacesServiceStatus.OK) {
                // Add a marker to the map.
                self.addMarker(results[0].place_id,
                               results[0].geometry.location);

                // Store data to our Places object so we don't have to requery.
                place.placeId = results[0].place_id;
                place.position = results[0].geometry.location;
                place.types = results[0].types;
              }
            });
          } else { // We have a marker for this place already.

            // Get the marker for this place.
            var marker = self.markers[place.placeId];

            // Show/hide based on whether place is in the filtered list.
            marker.setVisible(place.isFiltered());

            // Stop any bouncing markers.
            if (marker.getAnimation() !== null) {
              marker.setAnimation(null);
            }
          }
      });
    };
  };

  // Bind the ViewModel.
  ko.applyBindings(new ViewModel());

});
