// Global object for any needed external references.
var app = {};

// Note: JSDoc format comments used, but since these are wrapped in a closure
// they can't actually generate JSDocs.

$(function() {

  // Initial place names from which to build the observable array for the list.
  // These names need to correlate with a place on Google Maps.
  var initialPlacesData = [
    'South San Francisco BART Station',
    'See\'s Candies',
    'Trader Joe\'s',
    'Best Buy',
    'Paris Baguette',
    'Lidia\'s Deli',
    'San Bruno Mountain State Park'
  ];

  /**
   * Creates a Place object.
   * @class
   * @param {string} name - Name of location, to be used in search
   *     on Places service.
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

    /** Lat-Long position.
        @type {google.maps.LatLng} */
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

    /** The image URLs for various marker states.
        @enum {string} */
    this.markerIcons = {
      NORMAL: 'images/marker-red.png',
      SELECTED: 'images/marker-yellow.png'
    };

    /** The filter menu.
        @type {jQuery} */
    this.$filterMenu = $('#filter-menu');

    /** The burger button for the filter menu.
        @type {jQuery} */
    this.$burgerButton = $('#burger-button');

    /** The burger icon of the burger button.
        @type {jQuery} */
    this.$burgerIcon = $('.burger-button-div');

    /** The map bounds. Used to recenter and zoom to fit all the markers.
        @type {google.maps.LatLngBounds} */
    this.mapBounds = null;

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
     * Handles click for menu button. Toggles the menu open/closed.
     */
    this.burgerButtonClick = function() {
        self.toggleFilterMenuOpen();
    };

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

      var re = new RegExp(self.filterString(), 'ig');

      self.places().forEach(function(place) {
        // Set whether place should show in filtered results.
        place.isFiltered(re.test(place.name));

        // Reset highlighted selection.
        self.toggleListItemSelection(null);

        // Reset marker state
        self.toggleMarkerSelectedState(null);
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
      self.toggleMarkerSelectedState(marker);
      self.addInfoWindow(marker, place.placeId);

      // On mobile, close the list. Only applies to the small screen stylesheet.
      self.toggleFilterMenuOpen('closed');
    };

    /**
     * Toggles the filter menu open and closed.
     * @param {string} [desiredState=null] The desired state, "open" or "closed".
     *     If no value is provided, it's toggled to the other state.
     */
    this.toggleFilterMenuOpen = function(desiredState) {
      if (desiredState == 'closed') {
        self.$filterMenu.removeClass('open');
        self.$burgerIcon.removeClass('open');
      } else if (desiredState === 'open') {
        self.$filterMenu.addClass('open');
        self.$burgerIcon.addClass('open'); // Set burger icon to an 'x'
      } else {
        self.$filterMenu.toggleClass('open');
        self.$burgerIcon.toggleClass('open'); // Set burger icon to an 'x'
      }
    };

    /**
     * Flags the currently selected place for KO.
     * @param {Place} place - The corresponding Place that was clicked.
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


    /*### Google Map functionality ###*/

    /**
     * Initializes the Google Map and the Places Service.
     */
    this.initMap = function() {
      // Note: After markers added, map bounds are reset which changes the zoom.
      // Since zoom is required here, setting to a wider view to give sense of
      // overall location before map redraws. And it makes it look intentional
      // versus a glitch if the zoom is close to the final zoom.
      //
      var mapOptions = {
        center: {lat: 37.6640317, lng: -122.445706},
        zoom: 11,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        },
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP
        },
        streetViewControl: false
      };

      // Initialize the map.
      self.map = new google.maps.Map($('#map')[0], mapOptions);
      // Initialize the Places service.
      self.placesService = new google.maps.places.PlacesService(self.map);

      // Create map bounds to extend as we add markers.
      self.mapBounds = new google.maps.LatLngBounds();

      // Place the markers.
      self.refreshMarkers();
    };

    // Make this function accessible as the Map load callback.
    app.initMap = this.initMap;

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
          animation: google.maps.Animation.DROP,
          icon: self.markerIcons.NORMAL
        });

      // Listen for clicks.
      marker.addListener('click', function() {
        // Highlight the corresponding list item.
        self.toggleListItemSelection(self.getPlaceFromId(placeId));

        // Bounce the marker.
        self.toggleMarkerAnimation(marker);
        self.toggleMarkerSelectedState(marker);

        // Open the info window.
        self.addInfoWindow(marker, placeId);
      });

      // Store a reference to this marker.
      self.markers[placeId] = marker;

      // Add this marker's LatLng to the extents of the map bounds and recenter.
      self.mapBounds.extend(location);
      self.map.fitBounds(self.mapBounds);
      self.map.setCenter(self.mapBounds.getCenter());
      // TODO: Move fit and center out of here and track status of adding all
      // markers so we can fit and center once.

    };

    /**
     * Toggles the marker to its selected highlight state.
     * @param {google.maps.Marker} markerToToggle - The marker to toggle.
     */
    this.toggleMarkerSelectedState = function(markerToToggle) {
      for (var key in self.markers) {
        var marker = self.markers[key];

        if (marker === markerToToggle) {
          marker.setIcon(self.markerIcons.SELECTED);
        } else {
          marker.setIcon(self.markerIcons.NORMAL);
        }
      }
    };

    /**
     * Toggles the marker bounce animation on or off.
     * @param {google.maps.Marker} markerToAnimate - The marker to animate/stop.
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
     * Returns a function for the setTimeout callback to stop the animation
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
      // to wrap the content and set the width in stylesheet.
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
        content: contentElement
      };

      self.infoWindow = new google.maps.InfoWindow(infoWindowOptions);

      self.infoWindow.addListener('closeclick', function() {
        // Stop marker animation.
        marker.setAnimation(null);

        self.infoWindow = null;
      });

      // Update the info window when its DOM is ready.
      self.infoWindow.addListener('domready', function() {
        // Event fires every time content is updated, so remove the listener.
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

        // If we already have a jqXHR in progress, abort it.
        if (self.$jqXHR) {
          self.$jqXHR.abort();
        }

        // Set up AJAX query.
        var wikiUrl = 'https://en.wikipedia.org/w/api.php';
        var settings = {
            dataType: 'jsonp',
            timeout: 8000,
            data: { // Wikipedia query fields
                action: 'opensearch',
                search: place.name,
                format: 'json',
                formatversion: 2
            }
        };

        // Get the data.
        self.$jqXHR = $.ajax(wikiUrl, settings)
            .done(function(data, status, jqXHR) {

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
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
              var htmlString = '';

              if (textStatus == "timeout") {
                htmlString = '<p>The request for additional information '+
                             'took too long.</p>';
              } else {
                htmlString = '<p>An error was encountered when trying to ' +
                             'get addtional information <span>[' +
                             jqXHR.statusText + ' ' + jqXHR.status +
                             ']</span>.</p>';
              }

              // Add the warning to the info window.
              self.appendInfo(htmlString);

              self.$jqXHR = null;
            });
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
  };



  /*## KO bindings ##*/

  // Bind window resize to refit map.
  ko.bindingHandlers.refitMapOnWinResize = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
      var handler = function() {
          google.maps.event.trigger(viewModel.map, 'resize');
          viewModel.map.fitBounds(viewModel.mapBounds);
          viewModel.map.setCenter(viewModel.mapBounds.getCenter());
      };

      $(window).resize(handler);
    }
  };


  ko.applyBindings(new ViewModel());

});
